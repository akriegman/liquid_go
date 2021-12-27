import React, { Component } from 'react';

import Multiplayer from './Multiplayer';
import Singleplayer from './Singleplayer';

export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = { mode : 'lobby' };
    this.room = React.createRef();
  }
  
  render() {
    switch(this.state.mode) {
    case 'lobby': 
      return <>
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
          <p>
              These rules rely on common sense to make notions such as "connected group" and "surround" precise.
          </p>
        </blockquote>
        <p>
          In Liquid Go, your stones are instead a continuous body of liquid, and you hold the mouse button to pour.
          The rule are otherwise very similar.
        </p>
        <p>
          Press "Find opponent" to play a stranger, or start a private match by first entering a passphrase and having you opponent enter the same phrase.
        </p>
        {/* <div style={{ margin: '0 auto' }}> */}
        <div style={{ display: 'flex', flexDirection: 'column', margin: '0 auto' }}>
          <input placeholder='Display name'/>
          <br/><input ref={this.room} placeholder='Passphrase' />
          <br/><button onClick={() => this.setState({ mode: 'multiplayer' }) }>
          Find opponent
          </button>
          <br/><button onClick={() => this.setState({ mode: 'singleplayer' }) }>
          Singleplayer
          </button>
        </div>
        {/* </div> */}
      </>;
    case 'multiplayer':
      return <Multiplayer room={this.room.current.value} />;
    case 'singleplayer':
      return <Singleplayer />;
    }
  }
}
