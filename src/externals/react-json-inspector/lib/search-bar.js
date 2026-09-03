import createReactClass from 'create-react-class';
import React from 'react';
import noop from './noop';

const h = React.createElement;

export default createReactClass({
  getDefaultProps: function () {
    return {
      onChange: noop,
    };
  },
  render: function () {
    return h('input', {
      className: 'json-inspector__search',
      type: 'search',
      placeholder: 'Search',
      onChange: this.onChange,
    });
  },
  onChange: function (e) {
    this.props.onChange(e.target.value);
  },
});
