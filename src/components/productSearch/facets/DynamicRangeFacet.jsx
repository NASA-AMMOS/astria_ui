import { Field, Form, Formik } from 'formik';
import debounce from 'lodash.debounce';
import PropTypes from 'prop-types';
import React from 'react';
import Button from 'src/components/common/Button';
import { SearchIcon } from 'src/components/common/Icons';
import Tooltip from 'src/components/common/Tooltip';
import FacetSearchStyles from 'src/styles/FacetSearch.module.css';
import FormsStyles from 'src/styles/Forms.module.css';
import { performElasticSearchQuery } from 'src/utils';
import * as telemetry from 'src/utils/telemetryUtils';
import { VictoryAxis, VictoryBar, VictoryBrushContainer, VictoryChart, VictoryLabel } from 'victory';

class DynamicRangeFacet extends React.Component {
  constructor(props) {
    super(props);

    this.debouncedFetchValues = debounce(this.fetchValues, 250, {
      leading: true,
      trailing: true,
    });

    this.state = {
      dataRange: [],
      histogram: [],
      values: [],
      loading: true,
      loadingFailed: false,
    };

    this.dirtyValues = {};
  }

  componentDidMount() {
    const values = this.parseValuesFromProps(this.props.values);
    this.setState({ values });
  }

  async componentDidUpdate(prevProps) {
    const { values, registering, queryID, queryComponents, inverted } = this.props;

    // TODO component is re-rendering a lot more than it needs to during searches,
    // may want to add a shouldComponentUpdate
    const { baseQueries } = this.props;
    // If baseQueries has changed then we'll re-run our extrema search
    if (JSON.stringify(prevProps.baseQueries) !== JSON.stringify(baseQueries)) {
      // TODO what if we just have fetchValues set values to null every time?
      this.setState({ values: null }, () => this.debouncedFetchValues());
    }

    // If values have changed, set internal state values
    if (JSON.stringify(prevProps.values) !== JSON.stringify(this.props.values)) {
      const newValues = this.parseValuesFromProps(this.props.values);
      this.setState({ values: newValues });
    }

    // If component registration has finished or queryID or queryComponents changed,
    // fetch new values
    if (
      (prevProps.registering && !registering) ||
      prevProps.queryID !== queryID ||
      JSON.stringify(prevProps.queryComponents) !== JSON.stringify(queryComponents)
    ) {
      this.debouncedFetchValues();
    }

    if (!registering) {
      if (prevProps.inverted !== inverted) {
        // Handle values from DynamicRangeFacet and RangeSelectFacet
        let vals = [];
        if (values.length) {
          if (values.length === 2) vals = values;
          else if (values.length === 3) vals = values.slice(1, 3); // Cover RangeSelectFacet
          this.submitChange({ startValue: vals[0], endValue: vals[1] });
        }
      }
    }
  }

  getQuery(dataRange = []) {
    return new Promise((resolve) => {
      const {
        facet: { dataField },
        inverted,
      } = this.props;
      const mustOrMustNot = inverted ? 'must_not' : 'must';

      const query = {
        bool: {
          [mustOrMustNot]: { range: { [dataField]: { gte: dataRange[0], lte: dataRange[1] } } },
        },
      };

      resolve(dataRange.length ? query : null);
    });
  }

  async fetchValues() {
    const {
      baseQueries,
      queryComponents,
      facet: { dataField, truncateDecimals },
    } = this.props;

    this.setState({ loading: true });

    const { err, min, max } = await this.fetchDataRange();
    if (err) {
      this.setState({ dataRange: [], histogram: [], loading: false, loadingFailed: true });
      return;
    }

    // Do not fetch histogram if there's no min or max. This scenario will happen when the user's
    // search does not intersect with any valid ranges for this field. Most facets are already
    // restricted to valid values but various facets like Input may allow more open ended values.
    if (typeof min !== 'number' || typeof max !== 'number') {
      this.setState({ dataRange: [], histogram: [], loading: false, loadingFailed: false });
      return;
    }

    // Compute dynamic histogram bin size based off data range
    // We want around 30 bins ideally, doesn't need to start at 0 either (question ?)
    const range = max - min;
    let binSize = Math.round(range / 30);
    binSize = Math.max(1, binSize); // ensure bin size is at least 1

    // Cancel any previous requests by checking for an existing abort controller
    if (this.controller) this.controller.abort();

    this.controller = new AbortController();
    const signal = this.controller.signal;
    const searchQuery = { bool: { must: baseQueries.concat(queryComponents) } };

    /* NOTE: Don't believe we can do proper result collapsing on these aggs */
    /* At least according to ES 7.9 docs where:
      'The collapsing is applied to the top hits only and does not affect aggregations.'
      See: https://www.elastic.co/guide/en/elasticsearch/reference/7.9/collapse-search-results.html
      */
    const aggs = {
      field_counts: {
        histogram: {
          field: dataField,
          interval: binSize,
          offset: min,
        },
      },
    };

    const size = 0; // don't want any hits, just aggregations, since we don't use hits here

    const body = {
      query: searchQuery,
      aggs,
      size,
    };

    try {
      const json = await performElasticSearchQuery(body, signal);
      if (!json.aggregations) {
        throw new Error('Bad ES response');
      }

      const aggResults = json.aggregations;
      let dataRange = [min, max];
      let histogram = aggResults.field_counts.buckets;
      if (truncateDecimals) {
        dataRange[0] = Math.trunc(dataRange[0]);
        dataRange[1] = Math.trunc(dataRange[1]);
        histogram = histogram.map((b) => {
          b.key = Math.trunc(b.key);
          return b;
        });
      }
      this.setState({ dataRange, histogram, loading: false, loadingFailed: false }, () => {
        if (this.postFetchValues) {
          this.postFetchValues();
        }
      });
    } catch (err) {
      if (err.name === 'AbortError') return true;
      telemetry.logError('Error fetching values in DynamicRangeFacet', err);
      this.setState({ dataRange: [], histogram: [], loading: false, loadingFailed: true });
    }
    return true;
  }

  async fetchDataRange() {
    const {
      baseQueries,
      queryComponents,
      facet: { dataField },
    } = this.props;

    // Cancel any previous requests by checking for an existing abort controller
    if (this.dataRangeAbortController) this.dataRangeAbortController.abort();

    this.dataRangeAbortController = new AbortController();
    const signal = this.dataRangeAbortController.signal;

    const searchQuery = { bool: { must: baseQueries.concat(queryComponents) } };

    const aggs = {
      min: { min: { field: dataField } },
      max: { max: { field: dataField } },
    };

    const size = 0; // don't want any hits, just aggregations, since we don't use hits here

    const body = {
      query: searchQuery,
      aggs,
      size,
    };

    try {
      const json = await performElasticSearchQuery(body, signal);
      if (!json.aggregations) {
        throw new Error('Bad ES response');
      }
      const aggResults = json.aggregations;
      return { min: aggResults.min.value, max: aggResults.max.value };
    } catch (err) {
      if (err.name === 'AbortError') return true;
      telemetry.logError('Error fetching data range values in DynamicRangeFacet', err);
      return { error: err };
    }
  }

  parseValuesFromProps(values) {
    let stateValues = null;
    if (values.length) stateValues = values.map((x) => parseFloat(x));
    return stateValues;
  }

  renderHistogram(startValue, endValue) {
    const {
      facet: { label },
      values,
    } = this.props;
    const { histogram, dataRange } = this.state;

    if (histogram.length < 1) return <div className={FacetSearchStyles.multiListMessage}>No matching {label}</div>;

    const constrainedStart = startValue > dataRange[0] ? startValue : dataRange[0];
    const constrainedEnd = endValue < dataRange[1] ? endValue : dataRange[1];

    const brushContainer = (
      <VictoryBrushContainer
        defaultBrushArea="move"
        handleComponent={<rect className={FacetSearchStyles.histogramBrushHandle} />}
        brushComponent={<rect className={FacetSearchStyles.histogramBrush} />}
        onBrushDomainChangeEnd={async ({ x }) => {
          const min = parseInt(Math.floor(x[0]));
          const max = parseInt(Math.ceil(x[1]));
          if (min === startValue && max === endValue) return;
          this.submitChange({ startValue: min, endValue: max });
        }}
        brushDomain={{ x: [constrainedStart, constrainedEnd] }}
        cachedBrushDomain={{ x: [constrainedStart, constrainedEnd] }} // override cache since this cache seems to not always correctly invalidate/update
        brushDimension="x"
        handleWidth={10}
      />
    );
    return (
      <VictoryChart
        aria-label="histogram"
        key={values.toString()} // Use a key here to fix an issue with the brush not clearing
        containerComponent={brushContainer}
        height={90}
        scale={{ x: 'linear', y: 'sqrt' }}
        padding={{ top: 0, bottom: 32, left: 20, right: 20 }}
      >
        <VictoryAxis
          style={{
            axis: { stroke: '#91919175' },
            tickLabels: { fontFamily: 'Inter', fontWeight: '600', fontSize: 22, color: '#919191', fill: '#919191' },
          }}
          padding={{ top: 0, bottom: 32, left: 20, right: 20 }}
          tickLabelComponent={
            <VictoryLabel
              textAnchor={({ text }) => {
                if (!text.length || !dataRange.length) return 'middle';
                // right align start value, left align end value
                return text[0] === dataRange[0].toString() ? 'start' : 'end';
              }}
            />
          }
          tickValues={dataRange}
          minDomain={{ x: 0 }}
        />
        <VictoryBar style={{ data: { fill: 'rgb(135 147 212)' } }} data={histogram} x="key" y="doc_count" />
      </VictoryChart>
    );
  }

  onChange = async (e) => {
    const { onInputChange } = this.props;

    const { startValue, endValue } = this.dirtyValues;

    // sort out start/end update
    const dirtyValue = parseInt(e.target.value);
    const target = e.target.name;
    const dataRange = target === 'startValue' ? [dirtyValue, endValue] : [startValue, dirtyValue];
    this.dirtyValues[target] = dirtyValue;

    // submit change
    const query = await this.getQuery(dataRange);
    onInputChange(query, dataRange);
  };

  onSubmit = async (values, { setSubmitting }) => {
    await this.submitChange(values);
    setSubmitting(false);
  };

  submitChange = (values) => {
    return new Promise(async (resolve) => {
      const { onChange } = this.props;
      const dataRange = [values.startValue, values.endValue];
      this.dirtyValues = { startValue: values.startValue, endValue: values.endValue };

      const query = await this.getQuery(dataRange);
      onChange(query, dataRange);
      resolve();
    });
  };

  render() {
    const { values: propsValues, facet } = this.props;
    const { loading, loadingFailed, dataRange, values: stateValues } = this.state;

    if (loading) return <div className={FacetSearchStyles.multiListMessage}>Fetching Results...</div>;

    // TODO what should happen in the event of an aggregation query failure?

    // Use value if provided, otherwise default to min/max values from default aggregation query
    let startValue;
    let endValue;
    if (propsValues && propsValues.length) {
      // ensure prop values are numbers
      startValue = parseFloat(propsValues[0]);
      endValue = parseFloat(propsValues[1]);
    } else if (stateValues) {
      startValue = stateValues[0];
      endValue = stateValues[1];
    } else {
      startValue = typeof dataRange[0] === 'number' ? dataRange[0] : 0;
      endValue = typeof dataRange[1] === 'number' ? dataRange[1] : 0;
    }

    const validate = (inputValues) => {
      const errors = {};
      if (typeof inputValues.startValue !== 'number' || inputValues.startValue < 0) {
        errors.startValue = 'Start Value Required';
      }
      if (typeof inputValues.endValue !== 'number' || inputValues.endValue < 0) {
        errors.endValue = 'End Value Required';
      }
      if (inputValues.startValue > inputValues.endValue) {
        errors.startValue = 'Invalid Value Range';
      }
      return errors;
    };

    return (
      <div>
        {facet.variant === 'compact' && <div className={FormsStyles.label}>{facet.label}</div>}
        {!facet.no_chart ? (
          <div style={{ paddingBottom: '8px' }}>{!loadingFailed && this.renderHistogram(startValue, endValue)}</div>
        ) : null}
        <Formik
          enableReinitialize
          initialValues={{ startValue, endValue }}
          validate={validate}
          onSubmit={this.onSubmit}
        >
          {({ isSubmitting, handleSubmit, handleChange }) => (
            <Form autoComplete="off" className={FacetSearchStyles.rangeInputForm}>
              <Field
                className={FacetSearchStyles.textInput}
                min={0}
                type="number"
                name="startValue"
                aria-label="Start value"
                onChange={(e) => {
                  this.onChange(e);
                  handleChange(e);
                }}
              />
              <div className={FacetSearchStyles.textInputRangeLabel}>to</div>
              <Field
                className={FacetSearchStyles.textInput}
                min={0}
                type="number"
                name="endValue"
                aria-label="End value"
                onChange={(e) => {
                  this.onChange(e);
                  handleChange(e);
                }}
              />
              <Tooltip overlay="Search" placement="top">
                <Button
                  aria-label="Search"
                  variant="icon"
                  type="submit"
                  onClick={handleSubmit}
                  icon={<SearchIcon />}
                  className={FacetSearchStyles.inlineSearchButton}
                />
              </Tooltip>
              <button hidden type="submit" disabled={isSubmitting}>
                Submit
              </button>
            </Form>
          )}
        </Formik>
      </div>
    );
  }
}

DynamicRangeFacet.defaultProps = {
  values: [],
  baseQueries: [],
  inverted: false,
};

DynamicRangeFacet.propTypes = {
  facet: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  baseQueries: PropTypes.array,
  values: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),
  inverted: PropTypes.bool.isRequired,
};

export default DynamicRangeFacet;
