import React from 'react';

export function format_score(score) {
  if (Math.abs(score) >= 10_000_000) {
    return Math.round(score / 1000) + 'm';
  } else if (Math.abs(score) >= 10_000) {
    return Math.round(score / 1000) + 'k';
  } else {
    return score;
  }
}

export function Radio(props) {
  const name = Math.random();
  return <fieldset
    onChange={() =>
      props.on(document.querySelector(
        'input[name="' + name + '"]:checked'
      ).value)
    }
  >
    {React.Children.map(
      props.children,
      child => React.cloneElement(child, {
        name: name,
        defaultChecked: child.props.value == props.value,
      })
    )}
  </fieldset>;
}

export function Option(props) {
  const { children, ...normalProps } = props;
  return <><label>
    <input type="radio" {...normalProps} />
    {children}
  </label><br/></>;
}