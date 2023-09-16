"use strict";
import React, { Component } from "react";

import rtc from "./rtc";
import Board from "./Board";
import { formatScore } from "./utils";

export default class Multiplayer extends Component {
  constructor(props) {
    super(props);
    this.board = React.createRef();
    this.state = {
      thatName: "Stranger",
      score: undefined,
      prisoners: undefined,
      done: false,
    };
  }

  static defaultProps = {
    thisName: "Stranger",
  };

  componentDidMount() {
    rtc.join(this.props.room).then(({ isBlack, dc }) => {
      let theseSamples = [];
      let thoseSamples = [];
      this.dc = dc;
      this.setState({ isBlack });

      dc.addEventListener("close", () => this.componentWillUnmount());

      dc.addEventListener("open", () => {
        dc.send(JSON.stringify({ name: this.props.thisName }));

        // These should really be part of state, but we're setting state
        // every frame anyways for prisoners...
        this.frames = 0;
        this.timeout = 0;
        this.started = false;

        this.intervalID = setInterval(() => {
          // the Math.random() is so that if one player gets a lead
          // it will decay back down.
          if (theseSamples.length < 10 * Math.random() + 5) {
            const sample = {
              x: this.board.current.mouse.x,
              y: this.board.current.mouse.y,
              active: this.frames < 180 ? false : this.board.current.mouse.left,
            };
            theseSamples.push(sample);
            dc.send(JSON.stringify(sample));
            this.frames++;
          } else {
            console.log("Ahead of opponent, skipping sample");
          }

          while (theseSamples.length > 0 && thoseSamples.length > 0) {
            const thisSample = theseSamples.shift();
            const thatSample = thoseSamples.shift();
            this.setState({
              prisoners: isBlack
                ? this.board.current.spill(thisSample, thatSample)
                : this.board.current.spill(thatSample, thisSample),
            });

            this.timeout++;
            if (thisSample.active || thatSample.active) {
              this.started = true;
              this.timeout = 0;
            } else {
              if (this.timeout == 60 && this.started) {
                this.setState({
                  score: this.board.current.score(this.props.scoring),
                });
              }
              if (this.timeout == 240 && this.started) {
                this.setState({ done: true });
                clearInterval(this.intervalID);
              }
            }
          }
        }, 17);
      });

      dc.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.name != undefined) {
          this.setState({ thatName: message.name });
        } else {
          thoseSamples.push(message);
        }
      });
    });
  }

  componentWillUnmount() {
    this.dc?.close();
    clearInterval(this.intervalID);
    rtc.cancel();
  }

  render() {
    return (
      <Board
        ref={this.board}
        flow={(() => {
          switch (this.props.flow) {
            case "Slow":
              return 100;
            case "Normal":
              return 300;
            case "Fast":
              return 500;
          }
        })() / (this.props.resolution == "Smooth" ? 1 : 36)}
        cells={this.props.resolution == "Smooth" ? 1200 : 200}
      >
        {this.state.isBlack == undefined ? <p>Searching for opponent...</p> : (
          <>
            Black:
            <div style={{ marginLeft: "1em" }}>
              {this.state.isBlack
                ? this.props.thisName + " (you)"
                : this.state.thatName}
              <br />
              {formatScore(this.state.prisoners?.black)} prisoners taken
              <br />
              {this.state.score == null
                ? ""
                : formatScore(this.state.score.black) + " points"}
            </div>
            <br className="big" />
            White:
            <div style={{ marginLeft: "1em" }}>
              {!this.state.isBlack
                ? this.props.thisName + " (you)"
                : this.state.thatName}
              <br />
              {formatScore(this.state.prisoners?.white)} prisoners taken
              <br />
              {this.state.score == null
                ? ""
                : formatScore(this.state.score.white) + " points"}
            </div>
          </>
        )}
        <br className="big" />
        {this.frames < 180
          ? "Match starting in " + Math.floor(4 - this.frames / 60)
          : ""}
        {this.started && this.timeout >= 60 && !this.state.done
          ? "Match ending in " + Math.floor(5 - this.timeout / 60)
          : ""}
        {this.state.done
          ? [
            "Game over",
            <br />,
            (this.state.score.black > this.state.score.white
              ? "Black"
              : "White") +
            " wins by " +
            formatScore(
              Math.abs(this.state.score.black - this.state.score.white),
            ),
          ]
          : ""}
        <div style={{ margin: "auto 0" }} />
        Game info:
        <br />
        Scoring: {(() => {
          switch (this.props.scoring) {
            case "stone":
              return "Stone";
            case "china":
              return "Chinese";
            case "japan":
              return "Japanese";
          }
        })()}
        <br />
        Speed: {this.props.flow}
        <br />
        Resolution: {this.props.resolution}
        <br />
        {this.props.children}
      </Board>
    );
  }
}
