'use strict';
import React, { Component } from 'react';

import rtc from './rtc';
import Board from './Board';

export default class Multiplayer extends Component {
  constructor(props) {
    super(props);
    this.board = React.createRef();
  }

  componentDidMount() {
    rtc.join(this.props.room).then(({ isBlack, dc }) => {
      let theseSamples = [];
      let thoseSamples = [];
      this.dc = dc;

      dc.addEventListener('close', () => console.log('Closing data channel'));

      dc.addEventListener('open', () => {
        this.intervalID = setInterval(() => {
          if (theseSamples.length < 60) {
            const sample = {
              x: this.board.current.mouse.x,
              y: this.board.current.mouse.y,
              active: this.board.current.mouse.left,
            };
            theseSamples.push(sample);
            dc.send(JSON.stringify(sample));
          } else {
            console.log('Ahead of opponent, skipping sample');
          }

          while (theseSamples.length > 0 && thoseSamples.length > 0) {
            isBlack ?
              this.board.current.spill(theseSamples[0], thoseSamples[0]) :
              this.board.current.spill(thoseSamples[0], theseSamples[0]);
            
            theseSamples.shift();
            thoseSamples.shift();
          }
        }, 17);
      });

      dc.addEventListener('message', event => {
        thoseSamples.push(JSON.parse(event.data));
      });
    });
  }

  componentWillUnmount() {
    this.dc.close();
    clearInterval(this.intervalID);
  }

  render() {
    return <Board ref={this.board} />;
  }
}
