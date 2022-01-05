import React from 'react';
import ReactDOM from 'react-dom';

import App from './App';
import { cookie } from './utils';

ReactDOM.render(<App />, document.getElementById('root'));

document.getElementById('email').onclick = () => {
  if (cookie('number_style')) document.cookie = 'number_style=';
  else document.cookie = 'number_style=exponential';
  const secret = document.getElementById('secret');
  secret.innerHTML = 'Toggled number style!';
  setTimeout(() => secret.innerHTML = '', 3000);
};