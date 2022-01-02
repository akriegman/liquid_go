// liquid_go, written by Aaron Kriegman <aaronkplus2@gmail.com>

use rstar::RTree;
use union_find::{QuickFindUf as UF, Union, UnionFind, UnionResult};
use wasm_bindgen::prelude::*;

use console::debug;
use Team::*;
mod score;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// #[cfg(not)]
mod console {
  use super::wasm_bindgen;

  #[wasm_bindgen]
  extern "C" {
    #[wasm_bindgen(js_namespace = console, js_name = log)]
    pub fn console_log(s: &str);
    #[wasm_bindgen(js_namespace = console, js_name = time)]
    pub fn time(s: &str);
    #[wasm_bindgen(js_namespace = console, js_name = timeEnd)]
    pub fn time_end(s: &str);
  }

  macro_rules! log {
    ($($t:tt)*) => (crate::console::console_log(&format_args!($($t)*).to_string()))
  }
  macro_rules! debug {
    ($($t:tt)*) => (crate::console::console_log(&format_args!("{:#?}", $($t)*).to_string()))
  }

  pub(crate) use debug;
  pub(crate) use log;
}

// /// Just sets the console hook if in debug mode.
// // #[cfg(debug_assertions)]
// #[wasm_bindgen(start)]
// pub fn main() {
//   console_error_panic_hook::set_once();
// }

#[wasm_bindgen]
pub struct Board {
  // OPTIONS, INPUT, AND STATE ---------------------------------------------
  b_pos: Option<[f32; 2]>,
  b_tail: Option<[f32; 2]>,
  w_pos: Option<[f32; 2]>,
  w_tail: Option<[f32; 2]>,

  capturing: bool,
  /// Side length.
  size: usize,

  b_prisoners: isize,
  w_prisoners: isize,

  // INTERNALS -------------------------------------------------------------

  // The board data is split into two separate
  // Vecs instead of one Vec of structs so that
  // hopefully the data will need no additional
  // processing when drawn to the canvas. `team`
  // serves both as the board state and as the
  // iamge to draw, since a `Team` is also a color.
  teams: Vec<Team>,
  /// owner[i] is the index of the Body in bodies
  /// that cell i belongs to.
  owner: Vec<usize>,
  /// The list of continuous bodies of liquid.
  bodies: UF<Body>,
  /// An alternate screenbuffer. Used in debugging and showing territory.
  alt_image: Vec<u32>,
}

struct TreeParams {}

impl rstar::RTreeParams for TreeParams {
  const MIN_SIZE: usize = 3;
  const MAX_SIZE: usize = 6;
  const REINSERTION_COUNT: usize = 2;
  type DefaultInsertionStrategy = rstar::RStarInsertionStrategy;
}

/// A wrapper around an RTree. Implements Union for use in a UnionFind, and
/// checks for duplicates in Body::insert and Body::union. If elements are only
/// added through these two methods, and Body is only constructed from duplicate
/// free lists, then we can assume the invariant that Body is duplicate free.
/// Reading and removing points can be done with the underlying RTree safely.
#[derive(Debug)]
struct Body {
  libs: RTree<Point, TreeParams>,
  /// A list of intersections in this body that would be liberties of another body,
  /// for the sole purpose of restoring those liberties when this body dies.
  stollen_libs: Vec<(Point, usize)>,
  /// For use when reinserting liberties like above, so that we don't give liberties
  /// to a dead body.
  alive: bool,
  team: Team,
}

/// These numbers are meant to be converted to little endian RGBA colors.
#[repr(u32)]
#[derive(PartialEq, Eq, Clone, Copy, Debug)]
enum Team {
  Black = 0x_ff_20_00_00,
  White = 0x_ff_e0_ff_ff,
  Empty = 0x_ff_48_9b_bb,
}

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Point {
  pub x: isize,
  pub y: isize,
}

#[wasm_bindgen]
impl Board {
  pub fn new(size: usize, capturing: bool) -> Self {
    Self {
      b_pos: None,
      b_tail: None,
      w_pos: None,
      w_tail: None,
      capturing,
      size,
      b_prisoners: 0,
      w_prisoners: 0,
      teams: vec![Empty; size * size],
      owner: vec![0; size * size],
      bodies: UF::new(1),
      alt_image: vec![0; size * size],
    }
  }

  /// This function is for passing the image across the js-wasm barrier.
  /// This is a hacky re-use of Point, since you basically need a struct
  /// to return two values with wasm-bindgen, and either two functions or
  /// complicated pointer stuff to do it without.
  #[cfg(not(feature = "show_liberties"))]
  pub fn get_image_slice(&self, buffer: u8) -> Point {
    match buffer {
      0 => Point {
        x: self.teams.as_ptr() as isize,
        y: self.teams.len() as isize * 4, // sizeof u32 / sizeof u8 = 4
      },
      1 => Point {
        x: self.alt_image.as_ptr() as isize,
        y: self.alt_image.len() as isize * 4, // sizeof u32 / sizeof u8 = 4
      },
      _ => {
        debug!("buffer should be 0 for the main board or 1 for the alternate board. Treat it like an enum.");
        panic!();
      }
    }
  }
  /// This version does dome more expensive copying just so that it can color in
  /// the boundaries. A cheap pseudorandom color is made for each body.
  #[cfg(feature = "show_liberties")]
  pub fn get_image_slice(&mut self) -> Point {
    self.debug_image = self.teams.clone();
    for key in 0..self.bodies.size() {
      let color: u32 = 0xff000000
        | (key as u32 * 64 & 0xff) << 16
        | (key as u32 * 32 + 64 & 0xff) << 8
        | key as u32 * 16 & 0xff;
      // Collect to appease the borrow checker. This wouldn't be necessary if
      // Rust let functions take references to just part of an object.
      for lib in self.bodies.get(key).libs.iter().cloned().collect::<Vec<_>>() {
        let idx = self.get_idx(lib);
        // debug_assert!(self.teams[idx] != Black);
        self.debug_image[idx] = unsafe { std::mem::transmute::<_, _>(color) };
      }
    }
    Point {
      x: self.debug_image.as_ptr() as isize,
      y: self.debug_image.len() as isize * 4, // sizeof u32 / sizeof u8 = 4
    }
  }

  pub fn set_capturing(&mut self, capturing: bool) {
    self.capturing = capturing;
  }

  #[inline]
  fn get_idx(&self, p: Point) -> usize {
    p.x as usize + p.y as usize * self.size
  }

  #[inline]
  fn get_teams(&self, p: Point) -> Team {
    self.teams[self.get_idx(p)]
  }

  #[inline]
  fn get_teams_mut(&mut self, p: Point) -> &mut Team {
    let idx = self.get_idx(p);
    &mut self.teams[idx]
  }

  #[inline]
  fn get_owner(&self, p: Point) -> usize {
    self.owner[self.get_idx(p)]
  }

  #[inline]
  fn get_owner_mut(&mut self, p: Point) -> &mut usize {
    let idx = self.get_idx(p);
    &mut self.owner[idx]
  }

  #[inline]
  fn area(&self) -> usize {
    self.size * self.size
  }

  /// Pseudo code:
  /// ```
  /// for each player:
  ///   if mouse is not down or is down over enemy cells:
  ///     this player does nothing this frame.
  ///   else:
  ///     if mouse is over empty space:
  ///       player.current_body = new body
  ///     else:
  ///       player.current_body = the body at this position
  ///
  /// for count / 2 times:
  ///   first player spills if they're active this frame
  ///   second player spills ---
  ///   second player spills ---
  ///   first player spills ---
  /// ```
  pub fn spill(
    &mut self,
    b_pos: &Point,
    b_active: bool,
    w_pos: &Point,
    w_active: bool,
    count: u32,
    black_first: bool,
  ) -> Point {
    let b_pos: Option<Point> = if b_active { Some(*b_pos) } else { None };
    let w_pos: Option<Point> = if w_active { Some(*w_pos) } else { None };
    let mut b_key: Option<usize> = None;
    let mut w_key: Option<usize> = None;
    if self.b_pos == None || b_pos == None {
      self.b_pos = b_pos.map(Point::as_f32);
      self.b_tail = self.b_pos;
    };
    if self.w_pos == None || w_pos == None {
      self.w_pos = w_pos.map(Point::as_f32);
      self.w_tail = self.w_pos;
    };

    // Summary of the ugly spaghetti logic:
    // If mouse is not down or we are over enemy territory, p_pos = None and p_key =
    // 0. Otherwise set p_key to the existing body if over our own territory,
    // or a new body if over empty board. Do this for both players.
    // I claim that after this block, p_key will be non-zero iff p_pos is non-None.
    for (pos, key_ref, team) in [(self.b_pos, &mut b_key, Black), (self.w_pos, &mut w_key, White)] {
      if let Some(pos) = pos.map(Point::from_f32) {
        match (self.get_teams(pos), team) {
          (Black, White) | (White, Black) => {
            if let Some(&near) = self.bodies.get(self.get_owner(pos)).libs.nearest_neighbor(&pos) {
              *key_ref = Some(self.bodies.insert(Body::new(vec![near], team)))
            }
          }
          (Black, Black) | (White, White) => {
            *key_ref = Some(self.get_owner(pos));
          }
          (Empty, _) => *key_ref = Some(self.bodies.insert(Body::new(vec![pos], team))),
          (_, Empty) => unreachable!(),
        }
      }
    }

    // vroom = 2 (or vroom close to 2) causes problems, hence the max.
    let vroom = 2. / count.max(2) as f32;
    for _ in (0..count).step_by(2) {
      for tup in
        [(&mut self.b_tail, &mut self.b_pos, b_pos), (&mut self.w_tail, &mut self.w_pos, w_pos)]
      {
        if let (Some(self_tail), Some(self_pos), Some(pos)) = tup {
          self_tail[0] += (pos.x as f32 - self_tail[0]) * vroom;
          self_tail[1] += (pos.y as f32 - self_tail[1]) * vroom;
          self_pos[0] += (self_tail[0] - self_pos[0]) * vroom;
          self_pos[1] += (self_tail[1] - self_pos[1]) * vroom;
        }
      }

      // for (pos, key) in [(self.b_pos, &mut b_key), (self.w_pos, &mut w_key)] {
      //   if let (Some(pos), Some(key)) = (pos.map(Point::from_f32), key) {
      //     if self.get_teams(pos) == Empty && (i / 2) % (count / 8) == (count / 16) {
      //       *key = self
      //         .bodies
      //         .insert(Body { libs: RTree::bulk_load_with_params(vec![pos]), ..Body::default() })
      //     }
      //   }
      // }

      // What I'm really trying to do here is irreducible control flow.
      let (f_pos, f_key, f_team, s_pos, s_key, s_team) = if black_first {
        (self.b_pos, &mut b_key, Black, self.w_pos, &mut w_key, White)
      } else {
        (self.w_pos, &mut w_key, White, self.b_pos, &mut b_key, Black)
      };
      let f_pos = f_pos.map(Point::from_f32);
      let s_pos = s_pos.map(Point::from_f32);
      // I could technically remove these if statements because the if statement in
      // assimilate will fail for the 0th Body. TODO check if this makes a
      // difference.
      if let (Some(pos), Some(key)) = (f_pos, *f_key) {
        if self.assimilate(pos, key, f_team) {
          *f_key = None;
        }
      }
      if let (Some(pos), Some(key)) = (s_pos, *s_key) {
        if self.assimilate(pos, key, s_team) {
          *s_key = None;
        }
        if self.assimilate(pos, key, s_team) {
          *s_key = None;
        }
      }
      if let (Some(pos), Some(key)) = (f_pos, *f_key) {
        if self.assimilate(pos, key, f_team) {
          *f_key = None;
        }
      }
    }

    Point::new(self.b_prisoners, self.w_prisoners)
  }

  /// Tell bodies[bod_key] to absorb it's nearest liberty. Returns true if there's no
  fn assimilate(&mut self, spigot: Point, bod_key: usize, us: Team) -> bool {
    // TODO: some of these `bodies.get` calls should be merged, since
    // `get` is not a simple read on a UnionFind.
    if let Some(pos) = self.bodies.get_mut(bod_key).libs.pop_nearest_neighbor(&spigot) {
      if self.get_teams(pos) != Empty {
        // panic!("Liberties should always be empty board.");
        // This case should only occur when two bodies are initiated
        // at the same position on the same frame. We do not panic so
        // we can handle this case gracefully.
        return true;
      }

      *self.get_teams_mut(pos) = us;
      *self.get_owner_mut(pos) = bod_key;
      // Neighboring bodies to be `check_dead`ed at the end of this function.
      let mut neighbors = Vec::new();

      for lib in [
        if pos.x > 0 { Some(Point { x: pos.x - 1, ..pos }) } else { None },
        if pos.y > 0 { Some(Point { y: pos.y - 1, ..pos }) } else { None },
        if pos.x < self.size as isize - 1 { Some(Point { x: pos.x + 1, ..pos }) } else { None },
        if pos.y < self.size as isize - 1 { Some(Point { y: pos.y + 1, ..pos }) } else { None },
      ]
      .into_iter()
      .flatten()
      {
        match (us, self.get_teams(lib)) {
          (Black, White) | (White, Black) => {
            let other_key = self.get_owner(lib);
            let other = self.bodies.get_mut(other_key);
            other.libs.remove(&pos);
            other.stollen_libs.push((lib, bod_key));
            self.bodies.get_mut(bod_key).stollen_libs.push((pos, other_key));
            neighbors.push(other_key);
          }
          (Black, Black) | (White, White) => {
            self.bodies.union(bod_key, self.get_owner(lib));
            self.bodies.get_mut(bod_key).libs.remove(&pos);
          }

          (_, Empty) => {
            self.bodies.get_mut(bod_key).insert(lib);
          }
          (Empty, _) => unreachable!("You cannot assimilate back into the board."),
        }
      }

      // Check if opponent is captured first.
      for neighbor in neighbors {
        self.check_dead(neighbor);
      }
      self.check_dead(bod_key)
    } else {
      // panic!("Assimilate should never be called on a body with no liberties.");
      // This case only occurs when capturing is disabled then reenabled. We will not panic
      // here so we can handle this case gracefully.
      self.check_dead(bod_key)
    }
  }

  /// Check if `bod` is dead, and if so remove it and return true.
  fn check_dead(&mut self, bod_key: usize) -> bool {
    if !self.capturing {
      return false;
    }
    let bod = self.bodies.get_mut(bod_key);
    if bod.libs.size() == 0 && bod.alive {
      // We can't shrink our UnionFind, but we can still free up the memory of this now unused body.
      let corpse = std::mem::take(bod);
      bod.alive = false;

      let mut prisoners = 0;
      self.teams.iter_mut().zip(self.owner.iter_mut()).for_each(|(t, o)| {
        if self.bodies.find(*o) == self.bodies.find(bod_key) {
          *t = Empty;
          *o = 0;
          prisoners += 1;
        }
      });

      match corpse.team {
        Black => self.b_prisoners += prisoners,
        White => self.w_prisoners += prisoners,
        Empty => debug!("It should not be possible to capture a body of empty board."),
      }

      for (lib, other_key) in corpse.stollen_libs {
        let other = self.bodies.get_mut(other_key);
        if other.alive {
          other.insert(lib);
        }
      }
      true
    } else {
      false
    }
  }
}

impl Body {
  fn new(libs: Vec<Point>, team: Team) -> Self {
    Body { libs: RTree::bulk_load_with_params(libs), stollen_libs: vec![], alive: true, team }
  }
  /// A wrapper around RTree::insert which checks for duplicates,
  /// effectively making an RTreeSet.
  #[inline]
  fn insert(&mut self, lib: Point) {
    if !self.libs.contains(&lib) {
      self.libs.insert(lib);
    }
  }
}

impl Union for Body {
  /// Always returns Left. This way the caller can and must
  /// ensure that the currently active body is the parent.
  fn union(mut lval: Self, mut rval: Self) -> UnionResult<Self> {
    // Remove duplicates. If we do this here and when inserting then we can assume uniqueness
    // when popping and deleteing.
    lval.libs.iter().for_each(|p| {
      // I read that `for_each` is sometimes faster than for loops. It's really just a matter
      // of taste though.
      rval.libs.remove(p);
    });
    // This rebuilds the tree with RTree::bulk_load(), which requires allocating the
    // elements into a Vec first. I wonder if there's a more efficient way to do
    // this? It's probably good to rebuild the tree every now and then anyways
    // to maintain quality? idk.
    lval.libs =
      RTree::bulk_load_with_params(lval.libs.iter().chain(rval.libs.iter()).copied().collect());

    lval.stollen_libs.append(&mut rval.stollen_libs);
    UnionResult::Left(lval)
  }
}

impl Default for Body {
  fn default() -> Self {
    Body::new(vec![], Empty)
  }
}

#[wasm_bindgen]
impl Point {
  /// For crossing the js-wasm barrier.
  pub fn new(x: isize, y: isize) -> Self {
    Point { x, y }
  }

  /// For crossing the js-wasm barrier.
  pub fn set(&mut self, x: isize, y: isize) {
    self.x = x;
    self.y = y;
  }

  fn as_f32(self) -> [f32; 2] {
    [self.x as f32, self.y as f32]
  }

  fn from_f32(arr: [f32; 2]) -> Point {
    Point { x: arr[0] as isize, y: arr[1] as isize }
  }
}

/// Copy pasted from the rstar docs.
impl rstar::Point for Point {
  type Scalar = isize;
  const DIMENSIONS: usize = 2;

  fn generate(mut generator: impl FnMut(usize) -> Self::Scalar) -> Self {
    Self { x: generator(0), y: generator(1) }
  }

  fn nth(&self, index: usize) -> Self::Scalar {
    match index {
      0 => self.x,
      1 => self.y,
      _ => unreachable!(),
    }
  }

  fn nth_mut(&mut self, index: usize) -> &mut Self::Scalar {
    match index {
      0 => &mut self.x,
      1 => &mut self.y,
      _ => unreachable!(),
    }
  }
}

#[cfg(no)]
#[cfg(test)]
mod test {
  #![feature(impl_trait_in_bindings)]
  use super::*;
  use binary_heap_plus::KeyComparator;

  #[derive(Debug)]
  struct HeapVec {
    data: Vec<BinaryHeap<i32, KeyComparator<impl Fn(&i32) -> i32>>>,
  }

  #[test]
  fn homogenous_comparators() {
    let hv = HeapVec { data: vec![] };
    for i in 0..4 {
      hv.data.push(BinaryHeap::new_by_key(|x| x));
    }
  }
} // end mod test
