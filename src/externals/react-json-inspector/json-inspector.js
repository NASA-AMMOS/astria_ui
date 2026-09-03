import createReactClass from 'create-react-class';
import debounce from 'debounce';
import PropTypes from 'prop-types';
import React from 'react';
import Leaf from './lib/leaf';
import SearchBar from './lib/search-bar';

import filterer from './lib/filterer';
import isEmpty from './lib/is-empty';
import lens from './lib/lens';
import noop from './lib/noop';
const h = React.createElement;

export default createReactClass({
  propTypes: {
    data: PropTypes.any.isRequired,
    // For now it expects a factory function, not element.
    search: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
    searchOptions: PropTypes.shape({
      debounceTime: PropTypes.number,
    }),
    onClick: PropTypes.func,
    validateQuery: PropTypes.func,
    isExpanded: PropTypes.func,
    filterOptions: PropTypes.shape({
      cacheResults: PropTypes.bool,
      ignoreCase: PropTypes.bool,
    }),
    query: PropTypes.string,
    verboseShowOriginal: PropTypes.bool,
  },
  getDefaultProps: function () {
    return {
      data: null,
      search: SearchBar,
      searchOptions: {
        debounceTime: 0,
      },
      className: '',
      id: 'json-' + Date.now(),
      onClick: noop,
      filterOptions: {
        cacheResults: true,
        ignoreCase: false,
      },
      validateQuery: function (query) {
        return query.length >= 2;
      },
      /**
       * Decide whether the leaf node at given `keypath` should be
       * expanded initially.
       * @param  {String} keypath
       * @param  {Any} value
       * @return {Boolean}
       */
      isExpanded: function (keypath, value) {
        return false;
      },
      verboseShowOriginal: false,
    };
  },
  getInitialState: function () {
    return {
      query: this.props.query || '',
      filterer: filterer(this.props.data, this.props.filterOptions),
    };
  },
  render: function () {
    var p = this.props;
    var s = this.state;

    var isQueryValid = s.query !== '' && p.validateQuery(s.query);

    var data = isQueryValid ? s.filterer(s.query) : p.data;

    var isNotFound = isQueryValid && isEmpty(data);

    return h(
      'div',
      { className: 'json-inspector ' + p.className },
      this.renderToolbar(),
      isNotFound
        ? h('div', { className: 'json-inspector__not-found' }, 'Nothing found')
        : h(Leaf, {
            data: data,
            onClick: p.onClick,
            id: p.id,
            getOriginal: this.getOriginal,
            query: isQueryValid ? new RegExp(s.query, p.filterOptions.ignoreCase ? 'i' : '') : null,
            label: 'root',
            root: true,
            isExpanded: p.isExpanded,
            interactiveLabel: p.interactiveLabel,
            verboseShowOriginal: p.verboseShowOriginal,
          })
    );
  },
  renderToolbar: function () {
    var search = this.props.search;

    if (search) {
      return h(
        'div',
        { className: 'json-inspector__toolbar' },
        h(search, {
          onChange: debounce(this.search, this.props.searchOptions.debounceTime),
          data: this.props.data,
          query: this.state.query,
        })
      );
    }
  },
  search: function (query) {
    this.setState({
      query: query,
    });
  },
  componentDidUpdate: function (prevProps) {
    if (prevProps.data !== this.props.data || prevProps.filterOptions !== this.props.filterOptions) {
      this.createFilterer(this.props.data, this.props.filterOptions);
    }

    var isReceivingNewQuery = typeof this.props.query === 'string' && this.props.query !== this.state.query;

    if (isReceivingNewQuery) {
      this.setState({
        query: this.props.query,
      });
    }
  },
  shouldComponentUpdate: function (p, s) {
    return (
      p.query !== this.props.query ||
      s.query !== this.state.query ||
      p.data !== this.props.data ||
      p.onClick !== this.props.onClick
    );
  },
  createFilterer: function (data, options) {
    this.setState({
      filterer: filterer(data, options),
    });
  },
  getOriginal: function (path) {
    return lens(this.props.data, path);
  },
});
