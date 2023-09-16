"use strict";
import React, { Component } from "react";

import * as wasm from "../pkg/index";
import { memory } from "../pkg/index_bg.wasm";

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
    this.state = {
      refsReady: false,
    };
  }

  componentDidMount() {
    this.setState({ refsReady: true });

    const offscreen = document.createElement("canvas");
    const ctx = this.canvas.current.getContext("2d");
    const ctxOff = offscreen.getContext("2d");
    this.canvas.current.width = this.props.pixels;
    this.canvas.current.height = this.props.pixels;
    // this.canvas.current.style.left = Math.round(scrollX + this.canvas.current.getBoundingClientRect().left) + 'px';
    // this.canvas.current.style.top = Math.round(scrollY + this.canvas.current.getBoundingClientRect().top) + 'px';
    // this.canvas.current.style.position = 'absolute';
    offscreen.width = this.props.cells;
    offscreen.height = this.props.cells;

    this.board = wasm.Board.new(this.props.cells, this.props.capturing);
    this.blackMouse = wasm.Point.new(
      this.props.cells / 2,
      this.props.cells / 2,
    );
    this.whiteMouse = wasm.Point.new(
      this.props.cells / 2,
      this.props.cells / 2,
    );
    this.mounted = true;
    this.doDraw = true;
    this.blackFirst = true;
    this.mouse = {
      left: false,
      right: false,
      x: this.props.cells / 2,
      y: this.props.cells / 2,
    };

    this.draw = (buffer) => {
      if (this.props.pixels >= this.props.cells) {
        this.canvas.current.style.imageRendering = "pixelated";
        ctx.imageSmoothingEnabled = false;
      }

      // I'm doing some manual bindings here. This takes care of my vector
      // transmutation problem and my finicky Rust APIs problem at the same time.
      const slice = this.board.get_image_slice(buffer);
      ctxOff.putImageData(
        new ImageData(
          new Uint8ClampedArray(memory.buffer).subarray(
            slice.x,
            slice.x + slice.y,
          ),
          this.props.cells,
          this.props.cells,
        ),
        0,
        0,
      );
      ctx.drawImage(offscreen, 0, 0, this.props.pixels, this.props.pixels);
      slice.free();
    };

    const loop = () => {
      if (!this.mounted) return;

      if (this.doDraw) this.draw(0);
      this.doDraw = false;

      requestAnimationFrame(loop);
    };
    loop();

    this.canvas.current.addEventListener(
      "contextmenu",
      (event) => event.preventDefault(),
    );
    this.canvas.current.addEventListener("mousemove", this.updatePosition);
    this.canvas.current.addEventListener("mousedown", (event) => {
      switch (event.button) {
        case 0:
          this.mouse.left = true;
          break;
        case 2:
          this.mouse.right = true;
          break;
      }
      this.updatePosition(event);
    });
    this.canvas.current.addEventListener("mouseup", (event) => {
      switch (event.button) {
        case 0:
          this.mouse.left = false;
          break;
        case 2:
          this.mouse.right = false;
          break;
      }
      this.updatePosition(event);
    });
    this.canvas.current.addEventListener(
      "touchstart",
      (event) => this.updateTouch(event, true),
    );
    this.canvas.current.addEventListener(
      "touchend",
      (event) => this.updateTouch(event, false),
    );
    this.canvas.current.addEventListener(
      "touchmove",
      (event) => this.updateTouch(event, null),
    );
    this.canvas.current.addEventListener("touchcancel", console.log);
  }

  componentDidUpdate(prevProps) {
    if (this.props.cells != prevProps.cells) {
      this.componentWillUnmount();
      this.componentDidMount();
    } else {
      this.board.set_capturing(this.props.capturing);
    }

    if (this.props.pixels != prevProps.pixels) this.draw(0);
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

    const prisoners = this.board.spill(
      this.blackMouse,
      black.active,
      this.whiteMouse,
      white.active,
      this.props.flow,
      this.blackFirst,
    );
    const result = { black: prisoners.x, white: prisoners.y };
    prisoners.free();

    this.blackFirst = !this.blackFirst;
    this.doDraw = black.active || white.active;
    return result;
  }

  score(method) {
    const score = this.board.score();
    const result = {
      black: score["b_" + method],
      white: score["w_" + method],
    };
    score.free();

    this.doDraw = false;
    if (method != "stone") this.draw(1);

    return result;
  }

  render() {
    return (
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div
          style={{
            flex: "0 0",
            whiteSpace: "nowrap",
            display: "flex",
            flexDirection: "column",
            marginRight: "12px",
          }}
          className="accent"
        >
          {this.props.children}
          <br className="big" />
          {this.state.refsReady
            ? (
              <>
                <br />
                <Save canvas={this.canvas} />
                <br />
                <Record canvas={this.canvas} />
              </>
            )
            : <></>}
          <div id="debug" />
        </div>

        <div
          style={{
            display: "inline-block",
            margin: "0 auto",
            flex: "0 0",
          }}
        >
          <canvas
            ref={this.canvas}
            width={this.props.pixels}
            height={this.props.pixels}
          >
          </canvas>
        </div>
      </div>
    );
  }

  updatePosition = (event) => {
    // `event` is either a MouseEvent or a Touch.
    pauseEvent(event);
    const rect = this.canvas.current.getBoundingClientRect();
    this.mouse.x = Math.max(
      Math.min(
        Math.round(
          (event.clientX - rect.left) * this.props.cells / this.props.pixels,
        ),
        this.props.cells - 1,
      ),
      0,
    );
    this.mouse.y = Math.max(
      Math.min(
        Math.round(
          (event.clientY - rect.top) * this.props.cells / this.props.pixels,
        ),
        this.props.cells - 1,
      ),
      0,
    );
  };

  updateTouch = (event, down) => {
    // We are making the bold assumptions that touch 0 is always first
    // if present, and when there are no touches a new touch will be touch 0.
    pauseEvent(event);

    let touch;
    if (this.mouse.left) {
      for (const t of event.changedTouches) {
        if (t.identifier == this.mouse.finger) touch = t;
      }
    } else {
      touch = event.changedTouches[0];
      this.mouse.finger = touch.identifier;
    }

    if (touch) {
      if (down != null) {
        this.mouse.left = down;
      }
      this.updatePosition(touch);
    }
  };
}

export class Save extends Component {
  render() {
    return (
      <button
        onClick={() => {
          const link = document.createElement("a");
          link.href = this.props.canvas.current
            .toDataURL("image/png");
          link.download = "liquid_go_image_" +
            new Date().toISOString().replaceAll(":", "_") + ".png";
          link.click();
        }}
      >
        Screenshot
      </button>
    );
  }
}

export class Record extends Component {
  constructor(props) {
    super(props);
    this.state = { recording: false };
  }

  componentDidMount() {
    this.recorder = new MediaRecorder(
      this.props.canvas.current.captureStream(
        60,
      ), /*, { mimeType: 'video/webm' }*/
    );
    this.chunks = [];
    this.recorder.ondataavailable = (event) => this.chunks.push(event.data);
    this.recorder.onstop = () => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(
        new Blob(this.chunks /*, { type : 'video/webm' }*/),
      );
      console.log("mime type: ", this.recorder.mimeType);
      link.download = "liquid_go_video_" +
        new Date().toISOString().replaceAll(":", "_") +
        (this.recorder.mimeType
          ? "." + this.recorder.mimeType.split("/")[1].split(";")[0]
          : "");
      link.click();
      this.chunks = [];
    };
  }

  render() {
    return !this.state.recording
      ? (
        <button
          onClick={() => {
            this.recorder.start();
            this.setState({ recording: true });
          }}
        >
          Start recording
        </button>
      )
      : (
        <button
          onClick={() => {
            this.recorder.stop();
            this.setState({ recording: false });
          }}
        >
          Stop recording
        </button>
      );
  }
}

function pauseEvent(e) {
  if (e.stopPropagation) e.stopPropagation();
  if (e.preventDefault) e.preventDefault();
  e.cancelBubble = true;
  e.returnValue = false;
  return false;
}
