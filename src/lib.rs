use rstar::RTree;
use union_find::{QuickFindUf as UF, Union, UnionFind, UnionResult};
use wasm_bindgen::prelude::*;

use Team::*;

const VROOM: f32 = 0.05;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
  #[wasm_bindgen(js_namespace = console)]
  fn log(s: &str);
}

macro_rules! log {
  ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}
macro_rules! dbg {
  ($($t:tt)*) => (log(&format_args!("{:?}", $($t)*).to_string()))
}

/// Just sets the console hook if in debug mode.
#[wasm_bindgen(start)]
pub fn main() {
  #[cfg(debug_assertions)]
  console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub struct Board {
  w_pos: Option<[f32; 2]>,
  b_pos: Option<[f32; 2]>,
  /// Side length.
  size: usize,
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
  #[cfg(feature = "show_liberties")]
  debug_image: Vec<Team>,
}

struct Body {
  libs: RTree<Point>,
}

/// These numbers are meant to be converted to little endian RGBA colors.
#[repr(u32)]
#[derive(PartialEq, Eq, Clone, Copy, Debug)]
enum Team {
  Black = 0x_ff_20_00_00,
  White = 0x_ff_e0_ff_ff,
  Empty = 0x_ff_1e_8c_b4,
}

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Point {
  pub x: isize,
  pub y: isize,
}

#[wasm_bindgen]
impl Board {
  pub fn new(size: usize) -> Self {
    Self {
      b_pos: None,
      w_pos: None,
      size,
      teams: vec![Empty; size * size],
      owner: vec![0; size * size],
      bodies: UF::new(1),
      #[cfg(feature = "show_liberties")]
      debug_image: vec![],
    }
  }

  /// This function is for passing the image across the js-wasm barrier.
  /// This is a hacky re-use of Point, since you basically need a struct
  /// to return two values with wasm-bindgen, and either two functions or
  /// complicated pointer stuff to do it without.
  #[cfg(not(feature = "show_liberties"))]
  pub fn get_image_slice(&self) -> Point {
    Point {
      x: self.teams.as_ptr() as isize,
      y: self.teams.len() as isize * 4, // sizeof u32 / sizeof u8 = 4
    }
  }
  /// This version does dome more expensive copying just so that it can color in the boundaries.
  /// A cheap pseudorandom color is made for each body.
  #[cfg(feature = "show_liberties")]
  pub fn get_image_slice(&mut self) -> Point {
    self.debug_image = self.teams.clone();
    for key in 0..self.bodies.size() {
      let color: u32 = 0xff000000
        | (key as u32 * 64 & 0xff) << 16
        | (key as u32 * 32 & 0xff) << 8
        | key as u32 * 16 & 0xff;
      // Clone to appease the borrow checker.
      for lib in self.bodies.get(key).libs.clone().iter() {
        let idx = self.get_idx(*lib);
        // debug_assert!(self.teams[idx] != Black);
        self.debug_image[idx] = unsafe { std::mem::transmute::<_, _>(color) };
      }
    }
    Point {
      x: self.debug_image.as_ptr() as usize,
      y: self.debug_image.len() * 4, // sizeof u32 / sizeof u8 = 4
    }
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
  ) {
    let mut b_pos: Option<Point> = if b_active { Some(*b_pos) } else { None };
    let mut w_pos: Option<Point> = if w_active { Some(*w_pos) } else { None };
    let mut b_key: Option<usize> = None;
    let mut w_key: Option<usize> = None;
    if self.b_pos == None || b_pos == None {
      self.b_pos = b_pos.map(Point::as_f32);
    };
    if self.w_pos == None || w_pos == None {
      self.w_pos = w_pos.map(Point::as_f32);
    };

    // Sumarry of the ugly spaghetti logic:
    // If mouse is not down or we are over enemy territory, p_pos = None and p_key = 0.
    // Otherwise set p_key to the existing body if over our own territory,
    // or a new body if over empty board. Do this for both players.
    // I claim that after this block, p_key will be non-zero iff p_pos is non-None.
    for (pos_ref, key_ref, team) in
      [(&mut b_pos, &mut b_key, Black), (&mut w_pos, &mut w_key, White)]
    {
      if let &mut Some(pos) = pos_ref {
        match (self.get_teams(pos), team) {
          (Black, White) | (White, Black) => *pos_ref = None,
          (Black, Black) | (White, White) => {
            *key_ref = Some(self.get_owner(pos));
          }
          (Empty, _) => {
            *key_ref = Some(self.bodies.insert(Body { libs: RTree::bulk_load(vec![pos]) }))
          }
          (_, Empty) => unreachable!(),
        }
      }
    }

    // What I'm really trying to do here is irreducible control flow.
    let (ref f_pos, f_key, f_team, ref s_pos, s_key, s_team) = if black_first {
      (self.b_pos, b_key, Black, self.w_pos, w_key, White)
    } else {
      (self.w_pos, w_key, White, self.b_pos, b_key, Black)
    };

    for _ in (0..count).step_by(2) {
      if let (Some(ref mut self_pos), Some(pos)) = (self.b_pos, b_pos) {
        self_pos[0] += (pos.x as f32 - self_pos[0]) * VROOM;
        self_pos[1] += (pos.y as f32 - self_pos[1]) * VROOM;
      }
      if let (Some(ref mut self_pos), Some(pos)) = (self.w_pos, w_pos) {
        self_pos[0] += (pos.x as f32 - self_pos[0]) * VROOM;
        self_pos[1] += (pos.y as f32 - self_pos[1]) * VROOM;
      }
      // I could technically remove these if statements because the if statement in assimilate
      // will fail for the 0th Body. TODO check if this makes a difference.
      if let (Some(pos), Some(key)) = (f_pos, f_key) {
        self.assimilate(*pos, key, f_team);
      }
      if let (Some(pos), Some(key)) = (s_pos, s_key) {
        self.assimilate(*pos, key, s_team);
        self.assimilate(*pos, key, s_team);
      }
      if let (Some(pos), Some(key)) = (f_pos, f_key) {
        self.assimilate(*pos, key, f_team);
      }
    }
  }

  /// Tell bodies[bod_key] to absorb it's nearest liberty.
  fn assimilate(&mut self, spigot: [f32; 2], bod_key: usize, us: Team) {
    let spigot = Point::from_f32(spigot);
    // TODO: some of these `bodies.get` calls should be merged, since
    // `get` is not a simple read on a UnionFind.
    if let Some(pos) = self.bodies.get_mut(bod_key).libs.pop_nearest_neighbor(&spigot) {
      // TODO: once we properly prune opponent liberties this check will no
      // longer be necessary. Update: that might not be true, idk.
      if self.get_teams(pos) != Empty {
        return;
      }

      *self.get_teams_mut(pos) = us;
      *self.get_owner_mut(pos) = bod_key;
      dbg!(self.get_teams(pos));

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
            // TODO: see below.
          }
          (Black, Black) | (White, White) => {
            if self.bodies.union(bod_key, self.get_owner(lib)) {
              // ^^^ This function call short circuits if they're already the same body.

              // TODO: we should remove a liberty from `owner[lib]` here. Doing this efficiently will
              // require switching from a BinaryHeap to a BTree (I think).
            }
          }

          (_, Empty) => {
            self.bodies.get_mut(bod_key).libs.insert(lib);
          }
          (Empty, _) => panic!("You cannot assimilate back into the board (yet)."),
        }
      }
    } else {
      // We have no liberties remaining. We could capture the body here,
      // but that's a hacky solution because this only gets triggered when
      // we try to grow the surrounded body.
    }
  }
}

impl Union for Body {
  /// Always returns Left. This way the caller can and must
  /// ensure that the currently active body is the parent.
  fn union(mut lval: Self, rval: Self) -> UnionResult<Self> {
    // This rebuilds the tree with RTree::bulk_load(), which requires allocating the elements
    // into a Vec first. I wonder if there's a more efficient way to do this? It's probably good
    // to rebuild the tree every now and then anyways to maintain quality? idk.
    lval.libs = RTree::bulk_load(lval.libs.iter().chain(rval.libs.iter()).copied().collect());
    UnionResult::Left(lval)
  }
}

impl Default for Body {
  fn default() -> Self {
    Body { libs: RTree::new() }
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
