import React, { Component } from 'react';

import Board, { Save } from './Board';

export default class Singleplayer extends Component {
  constructor(props) {
    super(props);
    this.board = React.createRef();
    this.state = {
      blackStrat: 'mouse left',
      whiteStrat: 'mouse right',
      cells: 1200,
      pixels: 600,
      capturing: true,
      flow: 300,
    };
  }

  componentDidMount() {
    let then = performance.now();
    let frames = 0;
    this.intervalID = setInterval(() => {
      this.board.current.spill(
        this.blackSample(),
        this.whiteSample(),
      );
      
      let now = performance.now();
      frames += 1;
      if (now - then >= 5000) {
        console.log(frames / (now - then) * 1000);
        then = now;
        frames = 0;
      }
    }, 16);
  }
  
  componentWillUnmount() {
    clearInterval(this.intervalID);
  }

  render() {
    this.blackSample = this.sampleFunc(true, this.state.blackStrat);
    this.whiteSample = this.sampleFunc(false, this.state.whiteStrat);
    
    return <div style={{ display: 'flex', 'align-items': 'flex-start' }}>
      <div style={{ flex: '0 0', 'white-space': 'nowrap', display: 'block' }}>
        <fieldset
          onChange={() =>
            this.setState({
              blackStrat: document.querySelector(
                'input[name="blackStrat"]:checked'
              ).value,
            })
          }
        >
          <legend>Strategy for Black:</legend>
          <label>
            <input type="radio" name="blackStrat" value="mouse left" defaultChecked />
              Left click
          </label>
          <div>
            <label>
              <input type="radio" name="blackStrat" value="mouse right" />
              Right click
            </label>
          </div>
          <div>
            <label>
              <input type="radio" name="blackStrat" value="sine" />
              Lattice
            </label>
          </div>
        </fieldset>
        <fieldset
          onChange={() =>
            this.setState({
              whiteStrat: document.querySelector(
                'input[name="whiteStrat"]:checked'
              ).value,
            })
          }
        >
          <legend>Strategy for White:</legend>
          <label>
            <input type="radio" name="whiteStrat" value="mouse left" />
              Left click
          </label>
          <div>
            <label>
              <input type="radio" name="whiteStrat" value="mouse right" defaultChecked />
              Right click
            </label>
          </div>
          <div>
            <label>
              <input type="radio" name="whiteStrat" value="sine" />
              Lattice
            </label>
          </div>
        </fieldset>
        <br/><label>
          Width in pixels:
          <br/><input type='number' value={this.state.pixels}
            onInput={event => this.setState({ pixels: event.target.value })}></input>
        </label>
        <br/><label>
          Width in cells:
          <br/><input type='number' value={this.state.cells}
            onInput={event => this.setState({ cells: event.target.value })}></input>
        </label>
        <br/><label>
          <input type='checkbox' checked={this.state.capturing}
            onInput={() => this.setState({ capturing: !this.state.capturing })}></input>
            &nbsp;Enable capturing
        </label>
        <br/><label>
          Flow: {this.state.flow} cells per frame
          <br/>
          <input type='range' value={this.state.flow} min={Math.floor(this.state.cells / 12)} max={this.state.cells}
            onInput={event => this.setState({ flow: event.target.value })}></input>
        </label>
        <br/><Save/>
      </div>
      
      <Board ref={this.board} cells={this.state.cells} pixels={this.state.pixels} flow={this.state.flow} capturing={this.state.capturing}/>
    </div>;
  }

  sampleFunc = (isBlack, strat) => strat === 'mouse left'
    ? () => ({
      x: this.board.current.mouse.x,
      y: this.board.current.mouse.y,
      active: this.board.current.mouse.left,
    })
    : strat === 'mouse right'
      ? () => ({
        x: this.board.current.mouse.x,
        y: this.board.current.mouse.y,
        active: this.board.current.mouse.right,
      })
      : strat === 'sine'
        ? () => ({
          x: (Math.sin(performance.now() / 300 + (isBlack ? 100 : 0)) + 1) * this.state.cells / 2,
          y: (Math.sin(performance.now() / 300 * (1 + Math.sqrt(5)) / 2 + (isBlack ? 20 : 0)) + 1) * this.state.cells / 2,
          active: true,
        })
        : () => ({ x: 0, y: 0, active: false });
}
