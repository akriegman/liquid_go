'use strict';
import React, { Component } from 'react';

import * as wasm from '../pkg/index';
import { memory } from '../pkg/index_bg.wasm';

export default class Board extends Component {
  static defaultProps = {
    cells: 1200,
    pixels: 600,
    capturing: true,
    flow: 300,
  };
  
  constructor(props) {
    super(props);
    this.canvas = React.createRef();
  }

  componentDidMount() {
    this.props.cells = Math.max(1, this.props.cells);
    
    const offscreen = document.createElement('canvas');
    const ctx = this.canvas.current.getContext('2d');
    const ctxOff = offscreen.getContext('2d');
    this.canvas.current.width = this.props.pixels;
    this.canvas.current.height = this.props.pixels;
    // this.canvas.current.style.left = Math.round(scrollX + this.canvas.current.getBoundingClientRect().left) + 'px';
    // this.canvas.current.style.top = Math.round(scrollY + this.canvas.current.getBoundingClientRect().top) + 'px';
    // this.canvas.current.style.position = 'absolute';
    offscreen.width = this.props.cells;
    offscreen.height = this.props.cells;

    this.board = wasm.Board.new(this.props.cells, this.props.capturing);
    this.blackMouse = wasm.Point.new(this.props.cells / 2, this.props.cells / 2);
    this.whiteMouse = wasm.Point.new(this.props.cells / 2, this.props.cells / 2);
    this.mounted = true;
    this.blackFirst = true;
    this.mouse = { left: false, right: false, x: this.props.cells / 2, y: this.props.cells / 2 };

    if (this.props.pixels % this.props.cells == 0) {
      this.canvas.current.style.imageRendering = 'pixelated';
      ctx.imageSmoothingEnabled = false;
    }

    const loop = () => {
      // I'm doing some manual bindings here. This takes care of my vector
      // transmutation problem and my finicky Rust APIs problem at the same time.
      const { x: ptr, y: len } = this.board.get_image_slice();
      ctxOff.putImageData(
        new ImageData(
          new Uint8ClampedArray(memory.buffer).subarray(ptr, ptr + len),
          this.props.cells,
          this.props.cells
        ),
        0,
        0
      );
      ctx.drawImage(offscreen, 0, 0, this.props.pixels, this.props.pixels);

      if (this.mounted) {
        requestAnimationFrame(loop);
      }
    };
    loop();

    this.canvas.current.addEventListener('contextmenu', event => event.preventDefault());
    this.canvas.current.addEventListener('mousemove', this.updatePosition);
    this.canvas.current.addEventListener('mousedown', event => {
      switch (event.button) {
      case 0: this.mouse.left = true; break;
      case 2: this.mouse.right = true; break;
      }
      this.updatePosition(event);
    });
    this.canvas.current.addEventListener('mouseup', event => {
      switch (event.button) {
      case 0: this.mouse.left = false; break;
      case 2: this.mouse.right = false; break;
      }
      this.updatePosition(event);
    });
    this.canvas.current.addEventListener('touchstart', event => {
      const touch = this.getTouch(event);
      if (touch) {
        this.mouse.left = true;
        this.updatePosition(touch);
      }
    });
    this.canvas.current.addEventListener('touchend', event => {
      const touch = this.getTouch(event);
      if (touch) {
        this.mouse.left = false;
        this.updatePosition(touch);
      }
    });
    this.canvas.current.addEventListener('touchmove', event => this.updatePosition(this.getTouch(event)));
    this.canvas.current.addEventListener('touchcancel', console.log);
  }
  
  componentDidUpdate(prevProps) {
    if (this.props.cells != prevProps.cells) {
      this.componentWillUnmount();
      this.componentDidMount();
    } else {
      this.board.set_capturing(this.props.capturing);
    }
  } 

  componentWillUnmount() {
    this.board.free();
    this.blackMouse.free();
    this.whiteMouse.free();
    this.mounted = false;
  }

  spill(black, white) {
    this.blackMouse.set(black.x, black.y);
    this.whiteMouse.set(white.x, white.y);
    this.board.spill(
      this.blackMouse,
      black.active,
      this.whiteMouse,
      white.active,
      this.props.flow,
      this.blackFirst
    );
    this.blackFirst = !this.blackFirst;
  }

  render() {
    return <canvas ref={this.canvas} width={this.props.pixels} height={this.props.pixels}
      style={{
        display: 'inline-block',
        'margin-left': 'auto',
        'margin-right': 'auto',
        flex: '0 0'
      }}>
    </canvas>;
  }

  updatePosition = event => {
    // `event` is either a MouseEvent or a Touch.
    const rect = this.canvas.current.getBoundingClientRect();
    this.mouse.x = Math.max(Math.min(Math.round((event.clientX - rect.left) * this.props.cells / this.props.pixels), this.props.cells - 1), 0);
    this.mouse.y = Math.max(Math.min(Math.round((event.clientY - rect.top) * this.props.cells / this.props.pixels), this.props.cells - 1), 0);
  };
  
  getTouch = event => {
    // We are making the bold assumptions that touch 0 is always first
    // if present, and when there are no touches a new touch will be touch 0.
    const touch = event.changedTouches[0];
    return touch.identifier == 0 ? touch : null;
  };
}

export class Save extends Component {
  render() {
    return <button onClick={() => {
      window.location.href = document.getElementsByTagName('canvas')[0]
        .toDataURL('image/png')
        .replace('image/png', 'image/octet-stream');
    }} >Screenshot</button>;
  }
}