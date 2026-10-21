import classNames from 'classnames';
import debounce from 'lodash.debounce';
import PropTypes from 'prop-types';
import React from 'react';
import { components } from 'react-select';
import Button from 'src/components/common/Button';
import Checkbox from 'src/components/common/Checkbox';
import Select from 'src/components/common/Select';
import FacetSearchStyles from 'src/styles/FacetSearch.module.css';
import FormsStyles from 'src/styles/Forms.module.css';
import { performElasticSearchQuery } from 'src/utils';
import { getConfig } from 'src/utils/configRegistry';
import { descendentPropertyToObject, getPropFromProduct } from 'src/utils/sharedUtils';
import * as telemetry from 'src/utils/telemetryUtils';

class MultiListFacet extends React.Component {
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

  componentDidMount() {
    const { registering } = this.props;
    // If component mounts without needing to register, fetch values
    if (!registering) {
      this.debouncedFetchValues();
    }
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
      if (values.length) {
        const query = await this.getQuery(values);
        onChange(query, values);
      }
    }
  }

  async getQuery(values = []) {
    const {
      facet: { dataField },
      inverted,
    } = this.props;
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

  // eslint-disable-next-line react/sort-comp
  async fetchValues() {
    const config = getConfig();
    const {
      baseQueries,
      facet: { dataField, dataType },
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
        results = json.aggregations[dataField].buckets.map((b) => {
          return {
            key: b.key,
            doc_count: b.group_count.value,
            label: this.getResultLabel(b.key).toString(),
            value: b.key,
          };
        });
      } else {
        results = json.aggregations[dataField].buckets.map((x) => {
          x.label = this.getResultLabel(x.key).toString();
          return x;
        });
      }
      results.sort((a, b) => {
        if (dataType === 'number') {
          return parseFloat(a.value) > parseFloat(b.value) ? 1 : -1;
        } else return a.label.localeCompare(b.label);
      });
      this.setState({ results, loading: false, loadingFailed: false });
    } catch (err) {
      if (err.name === 'AbortError') return true;
      telemetry.logError('Error fetching values in MultiListFacet', err);
      this.setState({ results: [], loading: false, loadingFailed: true });
    }
    return true;
  }

  toggleValue(key) {
    const { values } = this.props;

    const newValues = values.slice();
    const valueIndex = newValues.indexOf(key);
    if (valueIndex > -1) newValues.splice(valueIndex, 1);
    else newValues.push(key);

    this.toggleValues(newValues);
  }

  async toggleValues(values) {
    const { onChange } = this.props;
    const query = await this.getQuery(values);
    onChange(query, values);
  }

  getResultLabel(result) {
    const {
      facet: { key, alias, useKeyword },
    } = this.props;

    let obj;
    // If keyword is being used it means we need to reconstruct the
    // nested object, i.e. VICAR label keys
    if (useKeyword || key.indexOf('.') > 0) {
      obj = descendentPropertyToObject(key, result);
    } else obj = { [key]: result };
    return getPropFromProduct(obj, { alias: !!alias, key });
  }

  renderList() {
    const { results, loading, loadingFailed } = this.state;
    const {
      facet: { label, noCount },
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
    return (
      <div className={FacetSearchStyles.multiList}>
        {results.map((result) => (
          <div key={result.key}>
            <Checkbox
              key={result.key}
              value={result.key}
              checked={values.indexOf(result.key.toString()) > -1}
              onChange={(event) => this.toggleValue(event.target.value)}
              label={result.label}
              labelRight={!noCount && result.doc_count.toString()}
            />
          </div>
        ))}
      </div>
    );
  }

  CustomMultiValueLabel = (props) => {
    const { data } = props;
    return <div className={FacetSearchStyles.selectValueLabel}>{this.getResultLabel(data.value)}</div>;
  };

  CustomOption = (props) => {
    const { data, children: _children, ...rest } = props;
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
      facet: { label, defaults, facetID, noCount, variant, invertable = true },
      values,
      inverted,
      setComponentInverted,
    } = this.props;
    const { results, loading } = this.state;

    // TODO handle loading failed here

    const isInline = variant.indexOf('inline') > -1;

    const resultMap = {};
    const options = results.map((result) => {
      resultMap[result.key] = result;
      return { value: result.key, label: noCount ? '' : result.doc_count };
    });
    const selectedValues = values.map((value) => {
      return { value, label: this.getResultLabel(value) };
    });

    const labelClass = classNames({
      [FormsStyles.label]: !isInline,
      [FormsStyles.inlineLabel]: isInline,
    });
    const inversionEnabled = invertable && (values.length || !!defaults);
    const labelEl = (
      <>
        <div className={FormsStyles.inlineLabelChildren}>
          {<div className={labelClass}>{label}</div>}
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
        clearable
        filterOption={this.customFilter}
        components={{ Input: this.CustomInput, MultiValueLabel: this.CustomMultiValueLabel, Option: this.CustomOption }}
        placeholder="Select..."
        isLoading={loading}
        disabled={loading}
        closeMenuOnSelect={false}
        label={labelEl}
        labelPosition={isInline ? 'left' : 'top'}
        labelWidth={isInline ? 'auto' : '100%'}
        labelClass={FormsStyles.inlineSelectLabel}
        value={selectedValues}
        searchable
        options={options}
        onChange={(selectedOptions) => {
          this.toggleValues(selectedOptions ? selectedOptions.map((option) => option.value) : []);
        }}
      />
    );
  }

  render() {
    const {
      facet: { variant },
    } = this.props;

    return variant.indexOf('dropdown') > -1 ? this.renderDropdown() : this.renderList();
  }
}

MultiListFacet.defaultProps = {
  values: [],
  baseQueries: [],
  registering: true,
  variant: 'list',
  inverted: false,
};

MultiListFacet.propTypes = {
  queryComponents: PropTypes.array.isRequired,
  facet: PropTypes.object.isRequired,
  values: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func.isRequired,
  setComponentInverted: PropTypes.func.isRequired,
  baseQueries: PropTypes.array,
  registering: PropTypes.bool,
  groupResults: PropTypes.bool.isRequired,
  variant: PropTypes.oneOf(['dropdown', 'list', 'inline-dropdown', 'inline-list']),
  queryID: PropTypes.number.isRequired,
  inverted: PropTypes.bool,
};

export default MultiListFacet;
