use union_find::{QuickFindUf as UF, Union, UnionFind, UnionResult};
use wasm_bindgen::prelude::*;

use super::{
  console::debug,
  Board,
  Team::{self, *},
};

#[wasm_bindgen]
impl Board {
  pub fn score(&mut self) -> ScoreResult {
    // We are again pulling the first layer out of the UnionFind,
    // only because UnionFind doesn't provide a reasonable way to
    // iterate over the sets. This is a silly problem that would be
    // solved by default public members.
    let mut owners = Vec::with_capacity(self.area());
    let mut territory = UF::from_iter([]);

    for idx in 0..self.area() {
      let neighbors = [
        if idx % self.size != 0 { Some(idx - 1) } else { None },
        if idx >= self.size { Some(idx - self.size) } else { None },
      ]
      .into_iter()
      .flatten();

      let mut friends = neighbors.clone().filter(|other| self.teams[idx] == self.teams[*other]);
      if let Some(besty) = friends.next() {
        owners.push(owners[besty]);
        if let Some(buddy) = friends.next() {
          territory.union(owners[idx], owners[buddy]);
        }
      } else {
        owners.push(territory.insert(Body::new(self.teams[idx])));
      }

      let bod = territory.get_mut(owners[idx]);
      bod.count += 1;
      neighbors.clone().for_each(|neigh| match self.teams[neigh] {
        Black => bod.touch_black = true,
        White => bod.touch_white = true,
        Empty => (),
      });
      match self.teams[idx] {
        Black => neighbors.for_each(|neigh| territory.get_mut(owners[neigh]).touch_black = true),
        White => neighbors.for_each(|neigh| territory.get_mut(owners[neigh]).touch_white = true),
        Empty => (),
      }
    }

    let mut b_stones = 0;
    let mut w_stones = 0;
    let mut b_territory = 0;
    let mut w_territory = 0;

    for key in 0..territory.size() {
      if territory.find(key) == key {
        let bod = territory.get(key);
        match bod.team {
          Black => b_stones += bod.count,
          White => w_stones += bod.count,
          Empty => match (bod.touch_black, bod.touch_white) {
            (true, false) => b_territory += bod.count,
            (false, true) => w_territory += bod.count,
            _ => (),
          },
        }
      }
    }

    for idx in 0..self.area() {
      let bod = territory.get(owners[idx]);
      self.alt_image[idx] = 1;
      self.alt_image[idx] = match bod.team {
        Black => color(Black),
        White => color(White),
        Empty => match (bod.touch_black, bod.touch_white) {
          (true, false) => color_average(Black, Empty),
          (false, true) => color_average(White, Empty),
          _ => color(Empty),
        },
      }
    }

    ScoreResult {
      b_stone: b_stones,
      w_stone: w_stones,
      b_china: b_stones + b_territory,
      w_china: w_stones + w_territory,
      b_japan: b_territory - self.b_prisoners,
      w_japan: w_territory - self.w_prisoners,
    }
  }
}

struct Body {
  count: isize,
  team: Team,
  touch_black: bool,
  touch_white: bool,
}

impl Body {
  fn new(team: Team) -> Self {
    Body { count: 0, team, touch_black: false, touch_white: false }
  }
}

impl Union for Body {
  fn union(lval: Self, rval: Self) -> UnionResult<Self> {
    // assert_eq!(lval.team, rval.team);

    let result = Body {
      count: lval.count + rval.count,
      team: lval.team,
      touch_black: lval.touch_black || rval.touch_black,
      touch_white: lval.touch_white || rval.touch_white,
    };

    if lval.count > rval.count {
      UnionResult::Left(result)
    } else {
      UnionResult::Right(result)
    }
  }
}

#[wasm_bindgen]
pub struct ScoreResult {
  pub b_stone: isize,
  pub w_stone: isize,
  pub b_china: isize,
  pub w_china: isize,
  pub b_japan: isize,
  pub w_japan: isize,
}

#[allow(clippy::zero_prefixed_literal)]
#[allow(clippy::precedence)]
fn color_average(a: Team, b: Team) -> u32 {
  let a = unsafe { std::mem::transmute::<Team, u32>(a) };
  let b = unsafe { std::mem::transmute::<Team, u32>(b) };
  (a >> 24) + (b >> 24) >> 1 << 24
    | ((a >> 16) + (b >> 16) >> 1 & 0xff) << 16
    | ((a >> 08) + (b >> 08) >> 1 & 0xff) << 08
    | (a & 0xff) + (b & 0xff) >> 1 & 0xff
}

fn color(team: Team) -> u32 {
  unsafe { std::mem::transmute::<Team, u32>(team) }
}
