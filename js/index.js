"use strict";
import * as wasm from "../pkg/index.js";
import { memory } from "../pkg/index_bg.wasm";

const CPU = 2; // Cells per unit
const PPU = 1; // Pixel per unit
const UNITS = 600; // Units per side
const CELLS = UNITS * CPU; // Cells per side
const PIXEL = UNITS * PPU; // Pixel per side

let mouse = wasm.Point.new(CELLS / 2, CELLS / 2);
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
let blackFirst = true;
let frames = 0;
let then = performance.now();

loop();

// If this program ever exits, remember to call board.free() and mouse.free().

// I'm doing some manual bindings here. This takes care of my vector
// transmutation problem and my finicky Rust APIs problem at the same time.
function draw() {
  const { x: ptr, y: len } = board.get_image_slice();
  createImageBitmap(new ImageData(
    new Uint8ClampedArray(memory.buffer).subarray(ptr, ptr + len),
    CELLS,
    CELLS
  ))
    .then(bitmap => {
      ctx.drawImage(bitmap, 0, 0, PIXEL, PIXEL);
    })
    .catch(console.error);
}

function loop(now) {
  board.spill(mouse, mouseL, mouse, mouseR, 301, blackFirst);
  draw();

  frames += 1;
  blackFirst = !blackFirst;
  if (now - then > 5000) {
    console.log(frames / (now - then) * 1000);
    then = now;
    frames = 0;
  }
  requestAnimationFrame(loop);
}

function updatePosition(event) {
  mouse.set(event.offsetX * (CPU / PPU), event.offsetY * CPU / PPU);
}
