import { Field, Form, Formik } from 'formik';
import PropTypes from 'prop-types';
import React from 'react';
import Button from 'src/components/common/Button';
import { LatestSolIcon, MinusIcon, PlusIcon, SearchIcon } from 'src/components/common/Icons';
import Tooltip from 'src/components/common/Tooltip';
import primaryTimeInputStyles from 'src/styles/PrimaryTimeInput.module.css';
import { performElasticSearchQuery } from 'src/utils';
import * as telemetry from 'src/utils/telemetryUtils';

class PrimaryTimeInput extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      value: 0,
      maxValue: 0,
      loading: true,
      loadingFailed: false,
    };
  }

  async componentDidMount() {
    const { values } = this.props;
    let propValue = this.parseValueFromProps(values);
    let rest = {};
    if (values.length) {
      // Fetch max values since they won't be fetched by the initial getQuery
      const { value, loading, loadingFailed, aborted } = await this.fetchValues();
      if (!aborted) rest = { value: propValue, maxValue: value, loading, loadingFailed };
    }
    this.setState({ ...rest });
  }

  async componentDidUpdate(prevProps) {
    // If we get a new value from props, update state
    // This covers cases like clearing the value externally
    if (prevProps.values[0] !== this.props.values[0]) {
      this.setState({ value: this.parseValueFromProps(this.props.values) });
    }

    // If base query changes, fetch new max value but do not reset current value
    if (JSON.stringify(prevProps.baseQueries) !== JSON.stringify(this.props.baseQueries)) {
      const { value, loading, loadingFailed, aborted } = await this.fetchValues();
      if (!aborted) this.setState({ maxValue: value, loading, loadingFailed });
    }
  }

  parseValueFromProps(values) {
    const propValue = values[0];
    let stateValue = 0;
    if (typeof propValue === 'string') {
      if (propValue) stateValue = parseInt(propValue);
    }
    if (typeof propValue === 'number') stateValue = propValue;
    return stateValue;
  }

  async getQuery(values = []) {
    const {
      facet: { dataField },
    } = this.props;

    let newValues = [];

    // If we have a value from props, return the query
    if (values.length) newValues = values;
    else {
      // Otherwise fetch max values
      const { value, loading, loadingFailed, aborted } = await this.fetchValues();
      if (!aborted) this.setState({ value, maxValue: value, loading, loadingFailed });
      newValues = [value];
    }
    return { terms: { [dataField]: newValues } };
  }

  async fetchValues() {
    const {
      baseQueries,
      facet: { dataField },
    } = this.props;
    this.setState({ loading: true });

    // Cancel any previous requests by checking for an existing abort controller
    if (this.controller) this.controller.abort();

    this.controller = new AbortController();
    const signal = this.controller.signal;

    const searchQuery = { bool: { must: baseQueries } }; // TODO get from above
    const aggs = {
      max: { max: { field: dataField } },
    };

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

      const aggResults = json.aggregations;
      const maxValue = aggResults.max.value;
      return { value: maxValue, loading: false, loadingFailed: false, aborted: false };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { value: 0, loading: false, loadingFailed: false, aborted: true };
      }
      telemetry.logError('Error fetching values in PrimaryTimeInput', err);
      return { value: 0, loading: false, loadingFailed: true, aborted: false };
    }
  }

  onChange = async (e) => {
    const value = e.target.value;
    const query = await this.getQuery([value]);
    this.props.onInputChange(query, typeof value === 'number' ? [value.toString()] : null);
  };

  submit = async (newValue) => {
    const query = await this.getQuery([newValue]);
    this.props.onChange(query, typeof newValue === 'number' ? [newValue.toString()] : null);
    this.setState({
      value: newValue,
    });
  };

  render() {
    const {
      facet: { label },
    } = this.props;
    const { value, loading, loadingFailed } = this.state;
    const validate = (inputValues) => {
      const errors = {};
      if (typeof inputValues.value !== 'number' || inputValues.value < 0) {
        errors.time = 'Start Sol Required';
      }
      return errors;
    };

    return (
      <Formik
        enableReinitialize
        initialValues={{ value: loading ? '' : value }} // if we're loading, don't display a value to avoid value flash
        onSubmit={(values, { setSubmitting }) => {
          this.submit(values.value);
          setSubmitting(false);
        }}
        validate={validate}
      >
        {({ values }) => (
          <Form autoComplete="off" className={primaryTimeInputStyles.primaryTimeInputForm}>
            <Field name="value">
              {({ field }) => {
                const { onChange, ...fieldOther } = field;
                return (
                  <div className={primaryTimeInputStyles.primaryTimeInputForm}>
                    <div className={primaryTimeInputStyles.primaryTimeInputLabel}>{label}</div>
                    <div className={primaryTimeInputStyles.primaryTimeInputContainer}>
                      <input
                        aria-label="Sol"
                        min={0}
                        value={values.value}
                        disabled={!(!loading && !loadingFailed)}
                        type="number"
                        {...fieldOther}
                        className={primaryTimeInputStyles.primaryTimeInput}
                        onChange={(e) => {
                          this.onChange(e);
                          onChange(e);
                        }}
                      />
                      <div className={primaryTimeInputStyles.primaryTimeInputRightActions}>
                        <Tooltip overlay="Previous Sol" placement="top">
                          <Button
                            aria-label="Previous Sol"
                            className={primaryTimeInputStyles.primaryTimeInputButton}
                            type="button"
                            icon={<MinusIcon />}
                            disabled={loading}
                            variant="icon"
                            onClick={() => this.submit(Math.max(values.value - 1, 0))}
                          />
                        </Tooltip>
                        <Tooltip overlay="Next Sol" placement="top">
                          <Button
                            aria-label="Next Sol"
                            className={primaryTimeInputStyles.primaryTimeInputButton}
                            type="button"
                            icon={<PlusIcon />}
                            disabled={loading}
                            variant="icon"
                            onClick={() => this.submit(values.value + 1)}
                          />
                        </Tooltip>
                        <Tooltip overlay="Latest Sol" placement="top">
                          <Button
                            aria-label="Latest Sol"
                            className={primaryTimeInputStyles.primaryTimeInputButton}
                            type="button"
                            icon={<LatestSolIcon />}
                            disabled={loading}
                            variant="icon"
                            onClick={() => this.submit(this.state.maxValue)}
                          />
                        </Tooltip>
                        <Tooltip overlay="Search" placement="top">
                          <Button
                            aria-label="Search"
                            className={primaryTimeInputStyles.primaryTimeInputButton}
                            type="button"
                            icon={<SearchIcon />}
                            disabled={loading}
                            variant="icon"
                            onClick={() => this.submit(values.value)}
                          />
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                );
              }}
            </Field>
          </Form>
        )}
      </Formik>
    );
  }
}

PrimaryTimeInput.defaultProps = {
  values: [],
  baseQueries: [],
  onInputChange: () => {},
};

PrimaryTimeInput.propTypes = {
  facet: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onInputChange: PropTypes.func,
  baseQueries: PropTypes.array,
  values: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string])),
};

export default PrimaryTimeInput;
