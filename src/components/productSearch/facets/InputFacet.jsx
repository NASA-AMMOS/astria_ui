import classNames from 'classnames';
import debounce from 'lodash.debounce';
import PropTypes from 'prop-types';
import React from 'react';
import Autosuggest from 'react-autosuggest';
import Button from 'src/components/common/Button';
import { CloseIcon, SearchIcon } from 'src/components/common/Icons';
import Tooltip from 'src/components/common/Tooltip';
import FacetSearchStyles from 'src/styles/FacetSearch.module.css';
import FormsStyles from 'src/styles/Forms.module.css';
import { objAlphaSort, performElasticSearchQuery } from 'src/utils';
import { getConfig } from 'src/utils/configRegistry';
import { getDescendantProp } from 'src/utils/sharedUtils';
import * as telemetry from 'src/utils/telemetryUtils';

class InputFacet extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      value: '',
      topHits: [],
      suggestions: [],
      isLoadingSuggestions: false,
      isLoadingTopHits: false,
      showMore: false,
    };

    this.debouncedLoadSuggestions = debounce(this.loadSuggestions.bind(this), 250, {
      trailing: true,
    });
    this.debouncedFetchTopHits = debounce(this.fetchTopHits, 250, {
      leading: true,
      trailing: true,
    });
    this.suggestionsController = null;
    this.topHitsController = null;
  }

  componentDidMount() {
    const { values } = this.props;
    this.setState({ value: values[0] || '' });
  }

  async componentDidUpdate(prevProps) {
    const { values, onChange, inverted, registering, queryID, queryComponents } = this.props;

    // If we get a new value from props, update state
    // This covers cases like clearing the value externally
    if (prevProps.values[0] !== this.props.values[0]) {
      let value =
        typeof this.props.values[0] === 'string' || typeof this.props.values[0] === 'number'
          ? this.props.values[0]
          : '';
      this.setState({ value });

      // Trigger top hits refresh
      this.debouncedFetchTopHits(value);
    }

    // If component registration has finished or queryID or queryComponents changed,
    // fetch new values
    if (
      (prevProps.registering && !registering) ||
      prevProps.queryID !== queryID ||
      JSON.stringify(prevProps.queryComponents) !== JSON.stringify(queryComponents)
    ) {
      this.debouncedFetchTopHits();
    }

    if (prevProps.inverted !== inverted) {
      const query = await this.getQuery(values);
      onChange(query, values);
    }
  }

  async getQuery(values = []) {
    const {
      facet: { dataField, dataType },
      inverted,
    } = this.props;
    const value = values[0];
    const mustOrMustNot = inverted ? 'must_not' : 'must';
    if (dataType === 'number') {
      return values.length
        ? {
            bool: {
              [mustOrMustNot]: {
                terms: { [dataField]: values },
              },
            },
          }
        : null;
    } else {
      // Otherwise assume it's a string
      const valSearchStr = this.getSearchString(value);
      const query = {
        bool: {
          [mustOrMustNot]: {
            query_string: {
              query: `${valSearchStr}`,
              fields: [dataField],
            },
          },
        },
      };
      return value ? query : null;
    }
  }

  sortResults(results) {
    return objAlphaSort(
      results.map((result) => ({ ...result, name: result.name.toString() })), // ensure name keys are strings
      'name'
    );
  }

  async fetchTopHits(optValue) {
    const {
      facet: { enableTopHits, variant, dataType },
    } = this.props;
    const { value: stateValue } = this.state;
    let value = '';
    if (dataType === 'string') {
      value = typeof optValue === 'string' ? optValue : stateValue;
    } else if (dataType === 'number') {
      value = typeof optValue === 'number' ? optValue : stateValue;
    }

    if (!enableTopHits || variant === 'compact') return;

    this.setState({
      isLoadingTopHits: true,
    });
    const escapedValue = this.escapeValue(value);
    const { results, error, stale } = await this.fetchValues('topHits', escapedValue, 50);

    if (!error && !stale) {
      // Sort top results alphabetically
      const sortedResults = this.sortResults(results);
      this.setState({ isLoadingTopHits: false, topHits: sortedResults });
    } else {
      // Otherwise only reset loading state if there was an error as stale results indicate another request in flight
      if (error) this.setState({ isLoadingTopHits: true });
    }
  }

  getSearchString(value, escape = true) {
    const {
      facet: { autoLeadStar },
    } = this.props;
    const escapedValue = escape ? this.escapeValue(value) : value;
    const starredValue = this.starValue(escapedValue, autoLeadStar);
    return starredValue;
  }

  escapeValue(value) {
    if (typeof value === 'number') return value;
    return value
      ? value
          .replaceAll('/', '\\/') // escape slashes
          .replaceAll(' ', '\\ ') // escape spaces
          .replaceAll('(', '\\(') // escape open paren
          .replaceAll(')', '\\)') // escape close paren
          .replaceAll(':', '\\:') // escape colons
      : '';
  }

  starValue(value, autoLeadStar = false) {
    let retVal = value;
    if (!retVal.endsWith('*')) {
      retVal = `${retVal}*`;
    }
    if (autoLeadStar && !retVal.startsWith('*')) {
      retVal = `*${retVal}`;
    }
    return retVal;
  }

  getSuggestionValue(suggestion) {
    return suggestion.name;
  }

  renderSuggestion(suggestion) {
    return <span>{suggestion.name}</span>;
  }

  renderInputComponent = ({ key, ...inputProps }) => {
    const {
      facet: { variant },
      noSearchButton,
    } = this.props;

    const { value: stateValue } = this.state;

    const containerClasses = classNames({
      [FormsStyles.autosuggestInputContainer]: true,
      [FormsStyles.iconRight]: true,
      [FormsStyles.inputCompact]: variant === 'compact',
      [FormsStyles.inputNormal]: variant !== 'compact',
    });

    // TODO would be really nice to have this as a real input component instead of remaking this a few times.
    // Same with other inputs.
    return (
      <div className={containerClasses}>
        <input key={key} aria-label={this.props.facet.label} {...inputProps} />
        {inputProps.value && (
          <Button
            aria-label="Clear"
            variant="icon"
            onClick={this.handleInputClear}
            icon={<CloseIcon />}
            className={FormsStyles.autosuggestClearIcon}
          />
        )}
        {!noSearchButton ? (
          <Tooltip overlay="Search" placement="top">
            <Button
              aria-label="Search"
              variant="icon"
              onClick={(event) => this.onChange(event, { newValue: stateValue, method: 'click' })}
              icon={<SearchIcon />}
              className={FormsStyles.autosuggestSearchIcon}
            />
          </Tooltip>
        ) : null}
      </div>
    );
  };

  async fetchValues(searchType, value, size = 5) {
    const config = getConfig();
    // Where searchType is a namespace string to differentiate between topHits and suggestions
    const {
      groupResults,
      facet: { key: facetKey, dataField, useAggregateSuggestions, dataType },
      queryComponents,
      baseQueries,
    } = this.props;

    // Cancel any previous requests by checking for an existing abort controller
    let signal;
    if (searchType === 'topHits') {
      if (this.topHitsController) this.topHitsController.abort();
      this.topHitsController = new AbortController();
      signal = this.topHitsController.signal;
    }
    if (searchType === 'suggestions') {
      if (this.suggestionsController) this.suggestionsController.abort();
      this.suggestionsController = new AbortController();
      signal = this.suggestionsController.signal;
    }

    // Construct aggregation query
    let query;
    // Filter the query by the value if one is provided
    if (value) {
      if (dataType === 'string') {
        const valSearchStr = this.getSearchString(value, false); // should already be escaped
        query = {
          query_string: {
            query: `${valSearchStr}`,
            fields: [dataField],
          },
        };
      } else if (Array.isArray(value)) {
        query = { terms: { [dataField]: value } };
      } else {
        query = { terms: { [dataField]: [value] } };
      }
    }
    const aggs = {
      [dataField]: {
        terms: {
          field: dataField,
          size,
          order: { _count: 'desc' },
        },
      },
    };

    if (groupResults) {
      aggs[dataField].aggs = {
        group_count: {
          cardinality: {
            field: config.es_mappings.group_id.key,
          },
        },
      };
    }

    let must = query ? baseQueries.concat([query]) : baseQueries;
    if (queryComponents) {
      must = must.concat(queryComponents);
    }

    const searchQuery = { bool: { must } };
    const queryBody = {
      query: searchQuery,
    };
    if (useAggregateSuggestions) queryBody.aggs = aggs;
    const body = {
      ...queryBody,
      size: useAggregateSuggestions ? 0 : size, // don't want any hits if using aggregate suggestions, just aggregations, since we don't use hits here
    };

    try {
      const json = await performElasticSearchQuery(body, signal);
      if (!useAggregateSuggestions) {
        if (!json.hits.hits || !json.hits.hits.length) {
          return { results: [] };
        } else {
          const results = json.hits.hits.map((o) => {
            return {
              name: getDescendantProp(o._source, facetKey),
              value: getDescendantProp(o._source, facetKey),
              count: 1,
            };
          });
          return { results };
        }
      } else if (!json.aggregations) {
        return { results: [] };
      } else {
        const results = json.aggregations[dataField].buckets.map((o) => {
          return {
            name: o.key,
            value: o.key,
            count: groupResults ? o.group_count.value : o.doc_count,
          };
        });
        return { results };
      }
    } catch (error) {
      if (error.name === 'AbortError') return { results: [], stale: true };
      telemetry.logError('Error fetching suggestions in InputFacet', error);
      return { results: [], error };
    }
  }

  async loadSuggestions(value) {
    this.setState({
      isLoadingSuggestions: true,
    });
    const escapedValue = this.escapeValue(value);
    const { results, error, stale } = await this.fetchValues('suggestions', escapedValue, 5);
    if (!error && !stale) {
      this.setState({ isLoadingSuggestions: false, suggestions: results });
    } else this.setState({ isLoading: false });
  }

  onTopHitClick(newValue) {
    // get the query object
    this.getQuery([newValue]).then((query) => {
      const valueIsDefined = typeof newValue === 'string' || typeof newValue === 'number';
      const value = valueIsDefined ? [newValue] : null;
      query = newValue ? query : null;
      // check for type of change
      this.props.onChange(query, value);
    });
  }

  onChange = (event, { newValue, method }) => {
    // get the query object
    this.getQuery([newValue]).then((query) => {
      const value = newValue ? [newValue] : null;
      query = newValue ? query : null;
      // check for type of change
      if (method === 'enter' || method === 'click') {
        this.props.onChange(query, value);
      } else {
        this.props.onInputChange(query, value);
      }
    });

    // update our render state
    this.setState({
      value: newValue,
    });
  };

  onKeyDown = (event) => {
    const { value } = this.state;
    // fire our on change when we see enter key pressed
    if (event.keyCode === 13) {
      this.onChange(event, { newValue: value, method: 'enter' });
    }
  };

  onSuggestionsFetchRequested = ({ value }) => {
    const {
      facet: { dataType, disableSuggestions },
    } = this.props;
    if (dataType === 'string' && !disableSuggestions) this.debouncedLoadSuggestions(value);
  };

  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: [],
    });
  };

  handleInputClear = (_setQuery) => {
    this.setState(
      {
        suggestions: [],
        value: '',
        isLoadingSuggestions: false,
      },
      () => this.onChange(null, { newValue: '', method: 'click' })
    );
  };

  toggleShowMore = () => {
    const { showMore } = this.state;
    this.setState({ showMore: !showMore });
  };

  getTopHitLabel(value) {
    return value;
  }

  render() {
    const {
      facet: { placeholder, variant, label, enableTopHits, dataType, facetID, defaults, inputType },
      inverted,
      values,
      setComponentInverted,
    } = this.props;
    const { value: stateValue, suggestions, topHits, isLoadingTopHits, showMore } = this.state;

    // TODO catch and handle suggestions fetching errors
    // if (error) {
    //   return <div className={FacetSearchStyles.multiListMessage}>Error</div>;
    // }

    let type;
    if (dataType === 'number' && inputType !== 'string') {
      type = 'number';
    }

    const inputProps = {
      placeholder,
      value: (stateValue || '').toString(),
      onKeyDown: this.onKeyDown,
      onChange: this.onChange,
      type,
      spellCheck: false,
    };

    const inversionEnabled = values.length || !!defaults;
    const rootClasses = classNames({
      [FormsStyles.autosuggestWrapper]: true,
      [FacetSearchStyles.inlineLabelFacet]: variant === 'inline',
    });
    return (
      <div className={rootClasses}>
        {variant === 'inline' && <div className={FormsStyles.inlineLabel}>{label}</div>}
        {variant === 'compact' && (
          <div className={FormsStyles.inlineLabelChildren}>
            <div className={FormsStyles.label}>{label}</div>
            {inversionEnabled && (
              <Button
                text={!inverted ? 'Invert' : 'Clear Inversion'}
                variant="text"
                onClick={() => setComponentInverted(!inverted, facetID)}
              />
            )}
          </div>
        )}
        <Autosuggest
          containerProps={{
            'aria-label': `${label}-combobox`,
          }}
          theme={{
            container: FormsStyles.autosuggestContainer,
            containerOpen: FormsStyles.autosuggestContainerOpen,
            input: FormsStyles.autosuggestInput,
            inputOpen: FormsStyles.autosuggestInputOpen,
            suggestionsContainer: FormsStyles.autosuggestSuggestionsContainer,
            suggestionsContainerOpen: FormsStyles.autosuggestSuggestionsContainerOpen,
            suggestionHighlighted: FormsStyles.autosuggestSuggestionHighlighted,
            suggestion: FormsStyles.autosuggestSuggestion,
            suggestionsList: FormsStyles.autosuggestSuggestionsList,
          }}
          suggestions={suggestions}
          onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
          onSuggestionsClearRequested={this.onSuggestionsClearRequested}
          getSuggestionValue={this.getSuggestionValue}
          renderSuggestion={this.renderSuggestion}
          renderInputComponent={this.renderInputComponent}
          inputProps={inputProps}
        />
        {enableTopHits && variant !== 'compact' && (
          <div className={FacetSearchStyles.inputFacetList}>
            {isLoadingTopHits && <div className={FacetSearchStyles.multiListMessage}>Fetching Results...</div>}
            {!isLoadingTopHits && topHits.length < 1 && (
              <div className={FacetSearchStyles.multiListMessage}>no matching {label}</div>
            )}
            {!isLoadingTopHits && topHits.length > 0 && (
              <div className={FacetSearchStyles.inputFacetTopResultsLabel}>Top Results</div>
            )}
            {!isLoadingTopHits &&
              topHits
                .slice(0, !showMore ? 12 : topHits.length) // limit number of items if showMore not active
                .map((hit) => (
                  <button
                    className={FacetSearchStyles.inputFacetListItem}
                    onClick={() => this.onTopHitClick(hit.value)}
                    key={hit.name}
                  >
                    <div className={FacetSearchStyles.inputFacetListItemLabel}>{this.getTopHitLabel(hit.name)}</div>
                    <div className={FacetSearchStyles.inputFacetListItemCount}>{hit.count}</div>
                  </button>
                ))}
            {!isLoadingTopHits && topHits.length > 12 && (
              <Button
                className={FacetSearchStyles.inputShowMoreButton}
                variant="text"
                onClick={this.toggleShowMore}
                text={showMore ? 'Show less' : 'Show more'}
              />
            )}
          </div>
        )}
      </div>
    );
  }
}

InputFacet.defaultProps = {
  values: [],
  baseQueries: [],
  onInputChange: () => {},
};

InputFacet.propTypes = {
  baseQueries: PropTypes.array,
  facet: PropTypes.object.isRequired,
  groupResults: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  onInputChange: PropTypes.func,
  values: PropTypes.array,
  setComponentInverted: PropTypes.func,
  inverted: PropTypes.bool,
};

export default InputFacet;
