import React, { Component } from 'react';

import Multiplayer from './Multiplayer';
import Singleplayer from './Singleplayer';
import { Radio, Option } from './utils';

export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mode: 'lobby',
      scoring: 'china',
    };
    this.room = React.createRef();
    this.name = React.createRef();
  }
  
  render() {
    switch(this.state.mode) {
    case 'lobby': 
      return <>
        <p>
        Press "Find opponent" to play a stranger, or start a private match by first entering a passphrase and having you opponent enter the same phrase.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', margin: '0 auto' }}>
          <div className='accent' style={{ display: 'flex', flexDirection: 'column', padding: '8px' }}>
            <button onClick={() => this.setState({ mode: 'singleplayer' }) } >
            Singleplayer
            </button>
          </div>
          <br className='big'/>
          <div className='accent' style={{ display: 'flex', flexDirection: 'column', padding: '8px' }}>
            <input ref={this.name} placeholder='Display name'/>
            <br/><input ref={this.room} placeholder='Passphrase' />
            <br className='big'/><Radio value={this.state.scoring} on={value => this.setState({ scoring: value })}>
              <legend>Scoring method</legend>
              <Option value='stone'>Stone</Option>
              <Option value='china'>Chinese</Option>
              <Option value='japan'>Japanese</Option>
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
          If you are unfamiliar with Go, here is a brief statement of the rules from <a href='https://en.wikipedia.org/wiki/Rules_of_Go#Concise_statement'>Wikipedia
          </a> (in turn quoted from elsewhere, and simplified a bit by me):
        </p>
        <blockquote>
          <ol>
            <li>The board is empty at the onset of the game.</li>
            <li>Black makes the first move, after which White and Black alternate.</li>
            <li>A move consists of placing one stone of one's own color on an empty space on the board.</li>
            <li>A player may pass their turn at any time.</li>
            <li>A stone or solidly connected group of stones of one color is captured and removed from the board when all the intersections directly adjacent to it are occupied by the enemy. (Capture of the enemy takes precedence over self capture.)</li>
            <li>Two consecutive passes end the game.</li>
            <li>A player's area consists of all the points the player has either occupied or surrounded.</li>
            <li>The player with more area wins.</li>
          </ol>
        </blockquote>
        <p>
          In Liquid Go, your stones are instead a continuous body of liquid, and you hold the mouse button to pour.
          The rules are otherwise very similar.
        </p>
      </>;
    case 'multiplayer':
      return <Multiplayer room={this.room.current.value} thisName={this.name.current.value || 'Stranger'}>
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
