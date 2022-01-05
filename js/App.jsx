import React, { Component } from 'react';

import Multiplayer from './Multiplayer';
import Singleplayer from './Singleplayer';
import { Radio, Option, mobileOrTablet } from './utils';

export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mode: 'lobby',
      scoring: 'china',
      flow: 'Normal',
      resolution: mobileOrTablet() ? 'Blocky' : 'Smooth',
      name: '',
      room: '',
    };
  }
  
  render() {
    switch(this.state.mode) {
    case 'lobby': 
      return <>
        <div style={{ display: 'flex', flexDirection: 'column', margin: '0 auto' }}>
          <div className='accent' style={{ display: 'flex', flexDirection: 'column', padding: '8px' }}>
            <button onClick={() => this.setState({ mode: 'singleplayer' }) } >
            Singleplayer
            </button>
          </div>
          <br className='big'/>
          <div className='accent' style={{ display: 'flex', flexDirection: 'column', padding: '8px' }}>
            <input value={this.state.name} onChange={event => this.setState({ name: event.target.value })} placeholder='Display name'/>
            <br/><input value={this.state.room} onChange={event => this.setState({ room: event.target.value })} placeholder='Passphrase' />
            <p>
        Leave the passphrase blank to play a stranger.
            </p>
            <br className='big'/><Radio value={this.state.scoring} on={value => this.setState({ scoring: value })}>
              <legend>Scoring method:</legend>
              <Option value='stone'>Stone</Option>
              <Option value='china'>Chinese</Option>
              <Option value='japan'>Japanese</Option>
            </Radio>
            <br className='big'/><Radio value={this.state.flow} on={value => this.setState({ flow: value })}>
              <legend>Game speed:</legend>
              <Option value={'Slow'}>Slow</Option>
              <Option value={'Normal'}>Normal</Option>
              <Option value={'Fast'}>Fast</Option>
            </Radio>
            <br className='big'/><Radio value={this.state.resolution} on={value => this.setState({ resolution: value })}>
              <legend>Resolution:</legend>
              <Option value={'Blocky'}>Blocky</Option>
              <Option value={'Smooth'}>Smooth</Option>
            </Radio>
            <br/><button onClick={() => this.setState({ mode: 'multiplayer' }) }>
            Find opponent
            </button>
          </div>
        </div>
        <p>
        Liquid Go is a game based on the classic East-Asian board game Go. The rules are essentially
        the same, except instead of taking turns placing individual stones, you pour the stones out like
        a liquid in real time.</p>
        <p>
          You can find the rules of Go on
          &nbsp;<a href='https://en.wikipedia.org/wiki/Rules_of_Go#Concise_statement'>Wikipedia</a>,
          but you don't need to know them. Here are the rules for Liquid Go:
        </p>
        <blockquote>
          <h4 style={{ marginTop: '0' }}>Rules of play:</h4>
          <ul>
            <li>The board is empty at the onset of the game.</li>
            <li>Once the game begins, you can hold the mouse button to pour liquid of your color out from the cursor, or release the mouse button to pass.</li>
            <li>You can pour into empty board space, but once poured the liquid cannot move or be overwritten.</li>
            <li>A connected body of liquid of one color is captured and removed from the board when all of it's boundaries either touch the edge of the board or the enemy's liquid. (Capture of the enemy takes precedence over self capture.)</li>
          </ul>
          <h4>End of the game:</h4>
          <ul>
            <li>If a continuous region of empty board only touches liquid of one color, then it is the territory of that player.</li>
            <li>A player's score is calculated with one of the following methods:
              <ul>
                <li>Stone: your score is the area of your liquid on the board.</li>
                <li>Chinese: your score is the area of your liquid and your territory.</li>
                <li>Japanese: your score is the area of your territory minus the area of your captured bodies.</li>
              </ul>
            </li>
            <li>When both players pass for one second, the score will be calculated and each player's territories highlighted.</li>
            <li>If both players pass for three more seconds then the game will end.</li>
          </ul>
        </blockquote>
      </>;
    case 'multiplayer':
      return <Multiplayer
        scoring={this.state.scoring}
        flow={this.state.flow}
        resolution={this.state.resolution}
        room={this.state.room + '?scoring=' + this.state.scoring + '?flow=' + this.state.flow + '?resolution=' + this.state.resolution}
        thisName={this.state.name || 'Stranger'}
      >
        <button onClick={() => this.setState({ mode: 'lobby' }) }>
          Back to lobby
        </button>
      </Multiplayer>;
    case 'singleplayer':
      return <Singleplayer>
        <button onClick={() => this.setState({ mode: 'lobby' }) }>
          Back to lobby
        </button>
      </Singleplayer>;
    }
  }
}
