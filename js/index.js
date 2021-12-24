'use strict';
import * as wasm from '../pkg/index.js';
import { memory } from '../pkg/index_bg.wasm';
import rtc from './rtc.js';

const CPU = 2; // Cells per unit
const PPU = 1; // Pixel per unit
const UNITS = 600; // Units per side
const CELLS = UNITS * CPU; // Cells per side
const PIXEL = UNITS * PPU; // Pixel per side

let mouse = { left: false, x: CELLS / 2, y: CELLS / 2 };
// let mouseL = false;
let mouseR = false;
const thisMouse = wasm.Point.new(CELLS / 2, CELLS / 2);
const thatMouse = wasm.Point.new(CELLS / 2, CELLS / 2);

const board = wasm.Board.new(CELLS);
const save = document.getElementById('save');
const room = document.getElementById('room');
const play = document.getElementById('play');
const canvas = document.getElementById('board');
const offscreen = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const ctxOff = offscreen.getContext('2d');
canvas.width = PIXEL;
canvas.height = PIXEL;
offscreen.width = CELLS;
offscreen.height = CELLS;
if (CPU == 1) {
  canvas.style.imageRendering = 'pixelated';
  ctx.imageSmoothingEnabled = false;
}

save.addEventListener('click', event => {
  var image = canvas
    .toDataURL('image/png')
    .replace('image/png', 'image/octet-stream');
  window.location.href = image;
});
play.addEventListener('click', start)
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('mousemove', updatePosition);
canvas.addEventListener('mousedown', event => {
  switch (event.button) {
    case 0:
      mouse.left = true;
      break;
    case 2:
      mouseR = true;
      break;
  }
  updatePosition(event);
});
canvas.addEventListener('mouseup', event => {
  switch (event.button) {
    case 0:
      mouse.left = false;
      break;
    case 2:
      mouseR = false;
      break;
  }
  updatePosition(event);
});

let frames = 0;
let then = performance.now();


function start() {
  rtc.join(room.value).then(({ isBlack, dc }) => {

    let theseSamples = [];
    let thoseSamples = [];
    let blackFirst = true;

    dc.addEventListener('open', event => {
      loop();

      setInterval(() => {
        if (theseSamples.length < 60) {
          theseSamples.push(mouse);
          dc.send(JSON.stringify(mouse));
        } else {
          console.log('Ahead of opponent, skipping sample');
        }

        while (theseSamples.length > 0 && thoseSamples.length > 0) {
          thisMouse.set(theseSamples[0].x, theseSamples[0].y);
          thatMouse.set(thoseSamples[0].x, thoseSamples[0].y);
          if (isBlack) {
            board.spill(thisMouse, theseSamples[0].left, thatMouse, thoseSamples[0].left, 300, blackFirst)
          } else {
            board.spill(thatMouse, thoseSamples[0].left, thisMouse, theseSamples[0].left, 300, blackFirst)
          }
          theseSamples.shift();
          thoseSamples.shift();
          blackFirst = !blackFirst;
        }

      }, 17);
    });

    dc.addEventListener('message', event => {
      thoseSamples.push(JSON.parse(event.data));
    });
  });
}

// If this program ever exits, remember to call board.free() and mouse.free().

// I'm doing some manual bindings here. This takes care of my vector
// transmutation problem and my finicky Rust APIs problem at the same time.
function draw() {
  const { x: ptr, y: len } = board.get_image_slice();
  ctxOff.putImageData(new ImageData(
    new Uint8ClampedArray(memory.buffer).subarray(ptr, ptr + len),
    CELLS,
    CELLS
  ), 0, 0);
  ctx.drawImage(offscreen, 0, 0, PIXEL, PIXEL);
}

function loop(now) {
  draw();

  frames += 1;
  if (now - then > 5000) {
    console.log(frames / (now - then) * 1000);
    then = now;
    frames = 0;
  }
  requestAnimationFrame(loop);
}

function updatePosition(event) {
  mouse.x = event.offsetX * CPU / PPU;
  mouse.y = event.offsetY * CPU / PPU;
}