import React, { Component } from 'react';

import Board from './Board';
import { formatScore, Radio, Option, mobileOrTablet } from './utils';

export default class Singleplayer extends Component {
  constructor(props) {
    super(props);
    this.board = React.createRef();
    this.state = {
      blackStrat: 'mouse left',
      whiteStrat: 'mouse right',
      cells: mobileOrTablet() ? 200 : 1200,
      pixels: 600,
      capturing: true,
      flow: 300,
      scoreType: 'china',
      score: null,
      prisoners: { black: 0, white: 0 }
    };
  }

  componentDidMount() {
    let then = performance.now();
    let frames = 0;
    this.intervalID = setInterval(() => {
      this.setState({ prisoners: this.board.current.spill(
        this.blackSample(),
        this.whiteSample(),
      ) });
      
      let now = performance.now();
      frames += 1;
      if (now - then >= 5000) {
        console.log(frames / (now - then) * 1000);
        then = now;
        frames = 0;
      }
    }, 17);
  }
  
  componentWillUnmount() {
    clearInterval(this.intervalID);
  }
  
  componentDidUpdate(_, prevState) {
    if (prevState.cells != this.state.cells) {
      this.setState({ flow: Math.ceil(this.area() / 4800) });
    }
  }

  render() {
    this.blackSample = this.sampleFunc(true, this.state.blackStrat);
    this.whiteSample = this.sampleFunc(false, this.state.whiteStrat);
    
    return <Board ref={this.board} cells={this.state.cells <= 0 ? 1 : Number(this.state.cells)} pixels={Number(this.state.pixels)} flow={this.state.flow} capturing={this.state.capturing}>
      <Radio value={this.state.blackStrat} on={value => this.setState({ blackStrat: value })}>
        <legend>Behavior for Black:</legend>
        <Option value='mouse left'>Left click</Option>
        <Option value='mouse right'>Right click</Option>
        <Option value='sine'>Lattice</Option>
      </Radio>
      <br/>
      <Radio value={this.state.whiteStrat} on={value => this.setState({ whiteStrat: value })}>
        <legend>Behavior for White:</legend>
        <Option value='mouse left'>Left click</Option>
        <Option value='mouse right'>Right click</Option>
        <Option value='sine'>Lattice</Option>
      </Radio>
      <br/><label>
          Width in pixels:
        <br/><input type='number' value={this.state.pixels}
          onInput={event => this.setState({ pixels: event.target.value })}></input>
      </label>
      <br className='big'/>
      <label>
          Width in cells:
        <br/><input type='number' value={this.state.cells}
          onInput={event => this.setState({ cells: event.target.value })} ></input>
      </label>
      <br className='big'/>
      <label>
        <input type='checkbox' defaultChecked={this.state.capturing}
          onInput={() => this.setState({ capturing: !this.state.capturing })}></input>
            &nbsp;Enable capturing
      </label>
      <br className='big'/>
      <label>
          Flow: {this.state.flow} cells per frame
        <br/>
        <input type='range' value={this.state.flow} min={Math.floor(this.area() / 14400)} max={Math.floor(this.area() / 1200)}
          onInput={event => this.setState({ flow: Number(event.target.value) })}></input>
      </label>
      <br className='big'/>
      <Radio value={this.state.scoreType} on={value => this.setState({ scoreType: value })}>
        <legend>Scoring method:</legend>
        <Option value='stone'>Stone</Option>
        <Option value='china'>Chinese</Option>
        <Option value='japan'>Japanese</Option>
      </Radio>
      <br/><button onClick={() => {
        this.setState({ score: this.board.current.score(this.state.scoreType) });
      }}>Calculate score</button>
      <br/>
      Black:
      <div style={{ marginLeft: '1em' }}>
        {formatScore(this.state.prisoners.black)} prisoners taken
        <br/>{this.state.score == null ? '' : formatScore(this.state.score.black) + ' points'}
      </div>
      <br className='big'/>
      White:
      <div style={{ marginLeft: '1em' }}>
        {formatScore(this.state.prisoners.white)} prisoners taken
        <br/>{this.state.score == null ? '' : formatScore(this.state.score.white) + ' points'}
      </div>
      <br/><button onClick={() => {
        this.board.current.componentWillUnmount();
        this.board.current.componentDidMount();
      }}>Clear board</button>
      <br/>{this.props.children}
    </Board> ;
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
        
  area = () => this.state.cells * this.state.cells;
}
