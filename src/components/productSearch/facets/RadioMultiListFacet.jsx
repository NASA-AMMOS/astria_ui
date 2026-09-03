import classNames from 'classnames';
import config from 'config.js';
import debounce from 'lodash.debounce';
import PropTypes from 'prop-types';
import React from 'react';
import { components } from 'react-select';
import Button from 'src/components/common/Button';
import Checkbox from 'src/components/common/Checkbox';
import RadioButton from 'src/components/common/RadioButton';
import Select from 'src/components/common/Select';
import LayoutStyles from 'src/styles/common/layout.module.css';
import FacetSearchStyles from 'src/styles/FacetSearch.module.css';
import FormsStyles from 'src/styles/Forms.module.css';
import { DeepDiffMapper, performElasticSearchQuery } from 'src/utils';
import { descendentPropertyToObject, getPropFromProduct } from 'src/utils/sharedUtils';
import * as telemetry from 'src/utils/telemetryUtils';

class RadioMultiListFacet extends React.Component {
  constructor(props) {
    super(props);

    this.debouncedFetchValues = debounce(this.fetchValues, 250, {
      leading: true,
      trailing: true,
    });

    this.state = {
      results: [],
      loading: true,
      loadingFailed: false,
    };
  }

  async componentDidUpdate(prevProps) {
    const { registering, queryID, queryComponents, inverted, onChange, values } = this.props;
    // If component registration has finished or queryID or queryComponents changed,
    // fetch new values
    if (
      (prevProps.registering && !registering) ||
      prevProps.queryID !== queryID ||
      JSON.stringify(prevProps.queryComponents) !== JSON.stringify(queryComponents)
    ) {
      this.debouncedFetchValues();
    }

    if (prevProps.inverted !== inverted) {
      const query = await this.getQuery(values);
      onChange(query, values);
    }
  }

  getValues() {
    const {
      facet: { defaults, defaultsExt },
      values: propValues,
    } = this.props;

    // substitute in defaultExt for the query if necessary
    let values = propValues;
    const differ = new DeepDiffMapper();
    const valueDiff = differ.map(defaults, [...propValues].sort());
    const defaultSelected = !valueDiff.changed;
    if (defaultSelected || propValues.length === 0) {
      values = defaultsExt || values;
    }
    return values;
  }

  async getQuery(values = []) {
    const {
      facet: { dataField, defaults, defaultsExt },
      inverted,
    } = this.props;

    // substitute in defaultExt for the query if necessary
    const differ = new DeepDiffMapper();
    const valueDiff = differ.map(defaults, [...values].sort());
    const defaultSelected = !valueDiff.changed;
    if (defaultSelected || values.length === 0) {
      values = defaultsExt || values;
    }

    const mustOrMustNot = inverted ? 'must_not' : 'must';

    return values.length
      ? {
          bool: {
            [mustOrMustNot]: {
              terms: { [dataField]: values },
            },
          },
        }
      : null;
  }

  async fetchValues() {
    const {
      baseQueries,
      facet: { dataField },
      queryComponents,
      groupResults,
    } = this.props;

    this.setState({ loading: true });

    // Cancel any previous requests by checking for an existing abort controller
    if (this.controller) this.controller.abort();

    this.controller = new AbortController();
    const signal = this.controller.signal;

    const searchQuery = { bool: { must: baseQueries.concat(queryComponents) } };
    const aggs = {
      [dataField]: {
        terms: {
          field: dataField,
          size: 100,
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

    const body = {
      query: searchQuery,
      aggs,
      size: 0, // don't want any hits, just aggregations, since we don't use hits here
    };

    try {
      const json = await performElasticSearchQuery(body, signal);
      if (!json.aggregations) {
        throw new Error('Bad ES response');
      }

      let results = [];
      if (groupResults) {
        results = json.aggregations[dataField].buckets
          .map((b) => {
            return { key: b.key_as_string || b.key, doc_count: b.group_count.value };
          })
          .sort((a, b) => b.doc_count - a.doc_count);
      } else
        results = json.aggregations[dataField].buckets.map((obj) => {
          return { ...obj, key: obj.key_as_string || obj.key };
        });

      this.setState({ results, loading: false, loadingFailed: false });
    } catch (err) {
      if (err.name === 'AbortError') return true;
      telemetry.logError('Error fetching values in RadioMultiListFacet', err);
      this.setState({ results: [], loading: false, loadingFailed: true });
    }
    return true;
  }

  toggleValue(key) {
    const {
      values,
      facet: { defaults = [] },
    } = this.props;

    let newValues = values.slice();

    // remove default if necessary
    defaults.forEach((val) => {
      const defIndex = newValues.indexOf(val);
      if (defIndex > -1) {
        newValues.splice(defIndex, 1);
      }
    });

    const valueIndex = newValues.indexOf(key);
    if (valueIndex > -1) newValues.splice(valueIndex, 1);
    else newValues.push(key);

    // reset to default if necessary
    if (newValues.length === 0) {
      newValues = [...defaults];
    }

    this.toggleValues(newValues);
  }

  async toggleValues(values) {
    const { onChange } = this.props;
    const query = await this.getQuery(values);
    onChange(query, values);
  }

  handleDropdownSelect = (selectedOptions) => {
    const {
      facet: { defaults = [] },
      values,
    } = this.props;

    const defaultsSelected = (selected) => {
      return defaults.reduce((acc, el) => {
        if (selected.indexOf(el) >= 0) {
          return true;
        }
        return acc;
      }, false);
    };

    // remove defaults from selection if previously selected
    // defaults are mutually exclusive to non-defaults
    const selectedValues = selectedOptions ? selectedOptions.map((option) => option.value) : [];
    if (defaultsSelected(values)) {
      defaults.forEach((defV) => {
        const i = selectedValues.indexOf(defV);
        if (i > -1) {
          selectedValues.splice(i, 1);
        }
      });
    }

    // check if we still have defaults selected
    if (defaultsSelected(selectedValues)) {
      // toggle only defaults on
      this.selectDefaults();
    } else {
      // if this removing previous selections then revert to default
      this.toggleValues(selectedValues.length ? selectedValues : defaults);
    }
  };

  selectDefaults = () => {
    const {
      facet: { defaults },
    } = this.props;

    this.toggleValues(defaults);
  };

  getResultLabel(result) {
    const {
      facet: { key, alias },
    } = this.props;

    let obj = {};
    if (key.indexOf('.') > 0) {
      obj = descendentPropertyToObject(key, result);
    } else obj = { [key]: result };

    return getPropFromProduct(obj, { alias: !!alias, key });
  }

  renderList() {
    const { results, loading, loadingFailed } = this.state;
    const {
      facet: { label, defaults, noCount },
      values,
    } = this.props;
    if (loading) {
      return <div className={FacetSearchStyles.multiListMessage}>Fetching Results...</div>;
    }
    if (loadingFailed) {
      return <div className={FacetSearchStyles.multiListMessage}>Error fetching facets for this field.</div>;
    }
    if (!results.length) {
      return <div className={FacetSearchStyles.multiListMessage}>No Matching {label}</div>;
    }

    // check if these are just the defaults
    const differ = new DeepDiffMapper();
    const valueDiff = differ.map(defaults, [...values].sort());
    const defaultSelected = !valueDiff.changed;
    const dividerClass = classNames({
      [LayoutStyles.dividerLight]: true,
      [LayoutStyles.marginVerticalDouble]: true,
      [LayoutStyles.dividerOR]: true,
    });

    return (
      <div className={FacetSearchStyles.multiList}>
        {defaults && defaults.length ? (
          <>
            <RadioButton
              label={this.getResultLabel(defaults.join(','))}
              onClick={this.selectDefaults}
              selected={defaultSelected}
            />
            <div className={dividerClass}>
              <div className={LayoutStyles.dividerORText}>OR</div>
            </div>
          </>
        ) : null}
        {results.map((result) => (
          <div key={result.key}>
            <Checkbox
              key={result.key}
              value={result.key}
              checked={!defaultSelected && values.indexOf(result.key.toString()) > -1}
              onChange={(event) => this.toggleValue(event.target.value)}
              label={this.getResultLabel(result.key).toString()}
              labelRight={!noCount && result.doc_count.toString()}
            />
          </div>
        ))}
      </div>
    );
  }

  CustomMultiValueLabel = (props) => {
    const { data } = props;
    const {
      facet: { defaults },
    } = this.props;

    const differ = new DeepDiffMapper();
    const valueDiff = differ.map(defaults, [data.value]);
    const defaultSelected = !valueDiff.changed;

    const classes = classNames({
      [FacetSearchStyles.selectValueLabel]: true,
      [FacetSearchStyles.defaultSelectValueLabel]: defaultSelected,
    });

    return <div className={classes}>{this.getResultLabel(data.value)}</div>;
  };

  CustomOption = (props) => {
    const { data, children, ...rest } = props;
    return (
      <components.Option {...rest}>
        {this.getResultLabel(data.value)}
        <span className={FacetSearchStyles.selectOptionCount}>{data.label}</span>
      </components.Option>
    );
  };

  CustomInput = (props) => {
    return <components.Input {...props} />;
  };

  customFilter = (option, searchText) => {
    const aliasedOption = this.getResultLabel(option.value);
    return aliasedOption.toLowerCase().includes(searchText.toLowerCase());
  };

  renderDropdown() {
    const {
      facet: { label, defaults, facetID, noCount },
      values,
      setComponentInverted,
      inverted,
    } = this.props;
    const { results, loading } = this.state;

    // TODO handle loading failed here

    // prep the options
    const resultMap = {};
    let options = results.map((result) => {
      resultMap[result.key] = result;
      return { value: result.key, label: noCount ? '' : result.doc_count };
    });
    if (defaults) {
      options = defaults.reduce((acc, el) => {
        acc.unshift({ value: el, label: 'default' });
        return acc;
      }, options);
    }

    // prep selected values
    const selectedValues = values.map((value) => {
      return { value, label: this.getResultLabel(value) };
    });

    // check if the default is the current option
    const differ = new DeepDiffMapper();
    const valueDiff = differ.map(defaults, values);
    const defaultSelected = !valueDiff.changed;

    const inversionEnabled = values.length || !!defaults;
    const labelEl = (
      <>
        <div className={FormsStyles.inlineLabelChildren}>
          {<div className={FormsStyles.label}>{label}</div>}
          {inversionEnabled && (
            <Button
              text={!inverted ? 'Invert' : 'Clear Inversion'}
              variant="text"
              onClick={() => setComponentInverted(!inverted, facetID)}
            />
          )}
        </div>
      </>
    );

    return (
      <Select
        multi
        clearable={!defaultSelected}
        filterOption={this.customFilter}
        components={{ Input: this.CustomInput, MultiValueLabel: this.CustomMultiValueLabel, Option: this.CustomOption }}
        placeholder="Select..."
        isLoading={loading}
        disabled={loading}
        closeMenuOnSelect={false}
        label={labelEl}
        labelPosition="top"
        labelWidth="100%"
        labelClass={FormsStyles.inlineSelectLabel}
        value={selectedValues}
        searchable
        options={options}
        onChange={this.handleDropdownSelect}
      />
    );
  }

  render() {
    const {
      facet: { variant },
    } = this.props;

    return variant === 'dropdown' ? this.renderDropdown() : this.renderList();
  }
}

RadioMultiListFacet.defaultProps = {
  values: [],
  baseQueries: [],
  registering: true,
  variant: 'list',
  inverted: false,
};

RadioMultiListFacet.propTypes = {
  queryComponents: PropTypes.array.isRequired,
  facet: PropTypes.object.isRequired,
  values: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func.isRequired,
  baseQueries: PropTypes.array,
  registering: PropTypes.bool,
  groupResults: PropTypes.bool.isRequired,
  variant: PropTypes.oneOf(['dropdown', 'list']),
  queryID: PropTypes.number.isRequired,
  setComponentInverted: PropTypes.func,
  inverted: PropTypes.bool.isRequired,
};

export default RadioMultiListFacet;
