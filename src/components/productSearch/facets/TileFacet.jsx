import debounce from 'lodash.debounce';
import PropTypes from 'prop-types';
import React from 'react';
import { components } from 'react-select';
import Button from 'src/components/common/Button';
import RadioButton from 'src/components/common/RadioButton';
import Select from 'src/components/common/Select';
import FacetSearchStyles from 'src/styles/FacetSearch.module.css';
import FormsStyles from 'src/styles/Forms.module.css';
import { performElasticSearchQuery } from 'src/utils';
import * as telemetry from 'src/utils/telemetryUtils';

import { getConfig } from 'src/utils/configRegistry';
const ALL_IMAGES = 'Both';
const NORMAL_IMAGES = 'Reconstructed / FDR';
const IMAGE_TILES = 'ECAM Tiles';

class TileFacet extends React.Component {
  constructor(props) {
    super(props);

    this.debouncedFetchValues = debounce(this.fetchValues, 250, {
      leading: true,
      trailing: true,
    });

    this.controllers = [];

    this.state = {
      results: { [ALL_IMAGES]: 0, [NORMAL_IMAGES]: 0, [IMAGE_TILES]: 0 },
      loading: true,
      loadingFailed: false,
    };
  }

  async componentDidUpdate(prevProps) {
    const { values, onChange, registering, queryID, queryComponents, inverted } = this.props;
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

  async getQuery(values = []) {
    const config = getConfig();
    const { inverted } = this.props;

    const mustOrMustNot = inverted ? 'must_not' : 'must';

    const onlyTilesQuery = { bool: { [mustOrMustNot]: { match: { [config.es_mappings.tile_flag.key]: true } } } };
    const excludeTilesQuery = {
      bool: {
        [mustOrMustNot]: {
          bool: {
            should: [
              { match: { [config.es_mappings.tile_flag.key]: false } },
              {
                bool: {
                  must_not: [
                    { match: { [config.es_mappings.object_type.key]: config.object_type_mappings.single_frame } },
                  ],
                },
              },
            ],
          },
        },
      },
    };
    if (values.length) {
      if (values[0] === ALL_IMAGES) return null;
      else return onlyTilesQuery; // only tiles
    }
    return excludeTilesQuery; // no tiles
  }

  async fetchValue(query) {
    const config = getConfig();
    const { baseQueries, queryComponents, groupResults } = this.props;

    const searchQuery = { bool: { must: baseQueries.concat(queryComponents).concat(query) } }; // TODO get from above
    const body = {
      query: searchQuery,
      size: 0,
      track_total_hits: true,
    };

    if (groupResults) {
      body.aggs = {
        group_count: {
          cardinality: {
            field: config.es_mappings.group_id.key,
          },
        },
      };
    }

    const controller = new AbortController();
    this.controllers.push(controller);
    const signal = controller.signal;

    try {
      const json = await performElasticSearchQuery(body, signal);
      if (!json.hits || !json.hits.hits) {
        throw new Error('Bad ES response');
      }

      const esResponse = json;

      let value;
      if (groupResults) {
        value = esResponse.aggregations.group_count.value;
      } else {
        if (config.es_version < 7) {
          value = esResponse.hits.total;
        } else {
          value = esResponse.hits.total.value;
        }
      }

      return { value, loadingFailed: false };
    } catch (err) {
      if (err.name === 'AbortError') return { aborted: true };
      telemetry.logError('Error fetching value in TileFacet', err);
      return { loadingFailed: true };
    }
  }

  async fetchValues() {
    this.setState({ loading: true });

    // Cancel any previous requests by checking for an existing abort controller
    this.controllers.forEach((controller) => controller.abort());
    this.controllers = [];

    const normalImagesQuery = await this.getQuery([]);
    const tilesQuery = await this.getQuery([IMAGE_TILES]);
    const results = await Promise.all([this.fetchValue(normalImagesQuery), this.fetchValue(tilesQuery)]);
    let anyFailed = false;
    let finalResults = [];

    if (results[0].aborted || results[1].aborted) return;
    if (results[0].loadingFailed || results[1].loadingFailed) {
      anyFailed = true;
    } else {
      finalResults = {
        [ALL_IMAGES]: results[0].value + results[1].value,
        [NORMAL_IMAGES]: results[0].value,
        [IMAGE_TILES]: results[1].value,
      };
    }

    this.setState({ results: finalResults, loading: false, loadingFailed: anyFailed });
  }

  async selectValue(key) {
    const { onChange, values } = this.props;
    const newValue = key === NORMAL_IMAGES ? '' : key;
    if (values[0] === newValue) return;

    const newValues = newValue ? [newValue] : [];

    const query = await this.getQuery(newValues);
    onChange(query, newValues);
  }

  CustomSingleValue = (props) => {
    const { data, children: _children, ...rest } = props;
    return <components.SingleValue {...rest}>{data.value}</components.SingleValue>;
  };

  CustomOption = (props) => {
    const { data, children: _children, ...rest } = props;
    return (
      <components.Option {...rest}>
        {data.value}
        <span className={FacetSearchStyles.selectOptionCount}>{data.label}</span>
      </components.Option>
    );
  };

  customFilter = (option, searchText) => {
    return option.value.toLowerCase().includes(searchText.toLowerCase());
  };

  renderDropdownInput() {
    const {
      values,
      inverted,
      setComponentInverted,
      facet: { facetID },
    } = this.props;
    const { results, loading } = this.state;

    const getLabel = (val) => {
      const matchingValue = results[val];
      return typeof matchingValue === 'number' ? matchingValue.toString() : val;
    };
    const selectedValue = values.length
      ? { value: values[0], label: values[0] }
      : { value: NORMAL_IMAGES, label: getLabel(NORMAL_IMAGES) };

    const options = [ALL_IMAGES, NORMAL_IMAGES, IMAGE_TILES].map((o) => {
      return { value: o, label: getLabel(o) };
    });

    const labelEl = (
      <>
        <div className={FormsStyles.inlineLabelChildren}>
          {<div className={FormsStyles.label}>Tiles</div>}
          <Button
            text={!inverted ? 'Invert' : 'Clear Inversion'}
            variant="text"
            onClick={() => setComponentInverted(!inverted, facetID)}
          />
        </div>
      </>
    );

    return (
      <Select
        label={labelEl}
        labelPosition="top"
        labelWidth="100%"
        labelClass={FormsStyles.inlineSelectLabel}
        filterOption={this.customFilter}
        components={{ Option: this.CustomOption, SingleValue: this.CustomSingleValue }}
        isLoading={loading}
        disabled={loading}
        value={selectedValue}
        searchable
        options={options}
        onChange={(selectedOption) => this.selectValue(selectedOption.value)}
      />
    );
  }

  renderRadioInput() {
    const { values } = this.props;
    const { results, loading, loadingFailed } = this.state;

    if (loading) {
      return <div className={FacetSearchStyles.multiListMessage}>Fetching Results...</div>;
    }
    if (loadingFailed) {
      return <div className={FacetSearchStyles.multiListMessage}>Error fetching facets for this field.</div>;
    }

    return (
      <div className={FacetSearchStyles.multiList}>
        <RadioButton
          label={NORMAL_IMAGES}
          labelRight={results[NORMAL_IMAGES].toString()}
          onClick={() => this.selectValue(NORMAL_IMAGES)}
          selected={!values[0]}
        />
        <RadioButton
          label={IMAGE_TILES}
          labelRight={results[IMAGE_TILES].toString()}
          onClick={() => this.selectValue(IMAGE_TILES)}
          selected={values[0] === IMAGE_TILES}
        />
        <RadioButton
          label={ALL_IMAGES}
          labelRight={results[ALL_IMAGES].toString()}
          onClick={() => this.selectValue(ALL_IMAGES)}
          selected={values[0] === ALL_IMAGES}
        />
      </div>
    );
  }

  render() {
    const {
      facet: { variant },
    } = this.props;

    return variant === 'radio' ? this.renderRadioInput() : this.renderDropdownInput();
  }
}

TileFacet.defaultProps = {
  values: [],
  baseQueries: [],
  registering: true,
};

TileFacet.propTypes = {
  facet: PropTypes.object.isRequired,
  queryComponents: PropTypes.array.isRequired,
  values: PropTypes.array,
  onChange: PropTypes.func.isRequired,
  baseQueries: PropTypes.array,
  registering: PropTypes.bool,
  groupResults: PropTypes.bool.isRequired,
  queryID: PropTypes.number.isRequired,
  setComponentInverted: PropTypes.func,
  inverted: PropTypes.bool,
};

export default TileFacet;
