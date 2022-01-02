'use strict';
import React, { Component } from 'react';

import rtc from './rtc';
import Board from './Board';

export default class Multiplayer extends Component {
  constructor(props) {
    super(props);
    this.board = React.createRef();
    this.state = {
      thatName: 'Stranger',
      score: undefined,
    };
  }
  
  static defaultProps = {
    thisName: 'Stranger',
  };

  componentDidMount() {
    rtc.join(this.props.room).then(({ isBlack, dc }) => {
      let theseSamples = [];
      let thoseSamples = [];
      this.dc = dc;
      this.setState({ isBlack });

      dc.addEventListener('close', () => this.componentWillUnmount());

      dc.addEventListener('open', () => {
        dc.send(JSON.stringify({ name: this.props.thisName }));
        
        this.intervalID = setInterval(() => {
          // the Math.random() is so that if one player gets a lead
          // it will decay back down.
          if (theseSamples.length < 10 * Math.random() + 1) {
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
            const thisSample = theseSamples.shift();
            const thatSample = thoseSamples.shift();
            this.setState({ prisoners: isBlack
              ? this.board.current.spill(thisSample, thatSample)
              : this.board.current.spill(thatSample, thisSample)
            });
            
            this.timeout++;
            if (thisSample.active || thatSample.active) {
              this.started = true;
              this.timeout = 0;
            } else {
              if (this.timeout == 60 && this.started) this.board.current.score();
            }
              
          }
        }, 17);
      });

      dc.addEventListener('message', event => {
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
    return <Board ref={this.board}>
      {this.state.isBlack == undefined
        ? <p>Searching for opponent...</p>
        : <><p>Black:<br/>{this.state.isBlack ? this.props.thisName : this.state.thatName}</p>
          <br/><p>White:<br/>{!this.state.isBlack ? this.props.thisName : this.state.thatName}</p></>}
      <br/>{this.props.children}
    </Board>;
  }
}
