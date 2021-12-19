"use strict";
import * as wasm from "../pkg/index.js";
import { memory } from "../pkg/index_bg.wasm";

const CPU = 2; // Cells per unit
const PPU = 1; // Pixel per unit
const UNITS = 600; // Units per side
const CELLS = UNITS * CPU; // Cells per side
const PIXEL = UNITS * PPU; // Pixel per side

let mousePos = wasm.Point.new(CELLS / 2, CELLS / 2);
let mouseLast = { x: CELLS / 2, y: CELLS / 2 };
let mouseNext = { x: CELLS / 2, y: CELLS / 2 };
let mouseL = false;
let mouseR = false;

const board = wasm.Board.new(CELLS);
const save = document.getElementById("save");
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
canvas.width = PIXEL;
canvas.height = PIXEL;
if (CPU == 1) {
  canvas.style.imageRendering = "pixelated";
  ctx.imageSmoothingEnabled = false;
}

save.addEventListener("click", event => {
  var image = canvas
    .toDataURL("image/png")
    .replace("image/png", "image/octet-stream");
  window.location.href = image;
});
canvas.addEventListener("contextmenu", event => event.preventDefault());
canvas.addEventListener("mousemove", updatePosition);
canvas.addEventListener("mousedown", event => {
  switch (event.button) {
    case 0:
      mouseL = true;
      break;
    case 2:
      mouseR = true;
      break;
  }
  updatePosition(event);
  mouseLast = mouseNext;
});
canvas.addEventListener("mouseup", event => {
  switch (event.button) {
    case 0:
      mouseL = false;
      break;
    case 2:
      mouseR = false;
      break;
  }
  updatePosition(event);
});

const { x: ptr, y: len } = board.get_image_slice();
const tmp = new ImageData(
  new Uint8ClampedArray(memory.buffer).subarray(ptr, ptr + len),
  CELLS,
  CELLS
);
createImageBitmap(tmp)
  .then(bitmap => {
    let blackFirst = true;
    let frames = 0;
    let then = performance.now();

    function loop(now) {
      frames += 1;
      for (let lam = 0; lam < 1; lam += 0.02) {
        mousePos.set(
          (1 - lam) * mouseLast.x + lam * mouseNext.x,
          (1 - lam) * mouseLast.y + lam * mouseNext.y
        );
        board.spill(mousePos, mouseL, mousePos, mouseR, 8, blackFirst);
      }
      blackFirst = !blackFirst;
      mouseLast = mouseNext;
      ctx.drawImage(bitmap, 0, 0, PIXEL, PIXEL);
      if (frames % 60 == 0) {
        console.log((60 * 1000) / (now - then));
        then = now;
      }
      requestAnimationFrame(loop);
    }

    loop();
  })
  .catch(console.error);

// wasm_bindgen requires manual garbage collection right now.
// This function will never be called as is, which is okay since
// we'll be using these until the page is closed, but just a reminder
// for now. And if we can figure out how to use wasm-bindgen --weak-ref
// with wasm-pack, this can hopefully be eliminated.
// board.free();
// mousePos.free();

function updatePosition(event) {
  mouseNext = {
    x: (event.offsetX * CPU) / PPU,
    y: (event.offsetY * CPU) / PPU,
  };
}

// I'm doing some manual bindings here. This takes care of my vector
// transmutation problem and my finicky Rust APIs problem at the same time.
