import classNames from 'classnames';
import { Field, Form, Formik } from 'formik';
import PropTypes from 'prop-types';
import Button from 'src/components/common/Button';
import { SearchIcon } from 'src/components/common/Icons';
import Select from 'src/components/common/Select';
import Tooltip from 'src/components/common/Tooltip';
import DynamicRangeFacet from 'src/components/productSearch/facets/DynamicRangeFacet';
import FacetSearchStyles from 'src/styles/FacetSearch.module.css';

class RangeSelectFacet extends DynamicRangeFacet {
  convertTypeToRange = (rangeType, rangeValues = []) => {
    let { dataRange, loading } = this.state;

    // default to the best range we know about at this point
    let values = dataRange && dataRange.length > 0 ? [...dataRange] : [0, 0];

    // if we need to translate a conceptual time to hard values
    // don't bother if we haven't loaded our data range yet
    if (rangeType.indexOf('last_') >= 0 && !loading && dataRange.length === 2) {
      const lastNum = parseInt(rangeType.split('_')[1]);

      let maxVal = dataRange[1];
      let minVal = dataRange[0];
      values[0] = Math.max(maxVal - lastNum, minVal);
    } else if (rangeValues.length === 2) {
      values = [...rangeValues];
    }

    return values;
  };

  handleRangeTypeSelect = (rangeType) => {
    const rangeTypeVal = rangeType.value;
    const range = this.convertTypeToRange(rangeTypeVal);

    this.submitChange({ rangeType: rangeTypeVal, startValue: range[0], endValue: range[1] });
  };

  parseValuesFromProps(values) {
    let stateValues = null;
    if (values.length) {
      const dataRange = this.convertTypeToRange(values[0], [parseFloat(values[1]), parseFloat(values[2])]);
      stateValues = [values[0], ...dataRange];
    }

    return stateValues;
  }

  postFetchValues() {
    const { values } = this.state;
    if (values && values.length > 0) {
      const rangeType = values[0];
      const currRange = [values[1], values[2]];
      const range = this.convertTypeToRange(rangeType, currRange);

      if (currRange[0] !== range[0] && currRange[1] !== range[1]) {
        this.submitChange({ rangeType: rangeType, startValue: range[0], endValue: range[1] });
      }
    }
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
    onInputChange(query, ['custom', ...dataRange]);
  };

  submitChange = (values) => {
    return new Promise(async (resolve) => {
      const { onChange } = this.props;
      const valuesArr = [values.rangeType || 'custom', values.startValue, values.endValue];
      const dataRange = [values.startValue, values.endValue];
      this.dirtyValues = { startValue: values.startValue, endValue: values.endValue };

      const query = await this.getQuery(dataRange);
      onChange(query, valuesArr);
      resolve();
    });
  };

  getQuery = (values) => {
    if (values) {
      if (values.length === 1) {
        // assume we have [type]
        const rangeValues = this.convertTypeToRange(values[0]);
        return super.getQuery(rangeValues);
      }
      if (values.length === 3) {
        // assume we have [type,min,max]
        const rangeValues = this.convertTypeToRange(values[0], [values[1], values[2]]);
        return super.getQuery(rangeValues);
      } else {
        // assume this is a plain [min, max]
        return super.getQuery(values);
      }
    } else {
      return super.getQuery(values);
    }
  };

  render() {
    const { values: propsValues, facet } = this.props;
    const { loading, loadingFailed, dataRange, values: stateValues } = this.state;

    // Use value if provided, otherwise default to min/max values from default aggregation query
    let rangeType;
    let startValue;
    let endValue;
    if (propsValues && propsValues.length) {
      rangeType = propsValues[0];

      // ensure prop values are numbers
      startValue = parseFloat(propsValues[1]);
      endValue = parseFloat(propsValues[2]);
    } else if (stateValues) {
      rangeType = stateValues[0];
      startValue = stateValues[1];
      endValue = stateValues[2];
    } else {
      rangeType = 'custom';
      startValue = typeof dataRange[0] === 'number' ? dataRange[0] : 0;
      endValue = typeof dataRange[1] === 'number' ? dataRange[1] : 0;
    }

    if (loading) {
      const loadingMessageClasses = classNames({
        [FacetSearchStyles.multiListMessage]: true,
        [FacetSearchStyles.histogramLoadingMessage]: true,
        [FacetSearchStyles.histogramLoadingMessageWithInput]: rangeType === 'custom',
      });
      return <div className={loadingMessageClasses}>Fetching Results...</div>;
    }

    // TODO what should happen in the event of an aggregation query failure?

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

    const rangeIsCustom = rangeType === 'custom';
    const selectOptions = [...facet.selectOptions];
    let rangeSelectValue = selectOptions.find((v) => v.value === rangeType);
    if (!rangeSelectValue) {
      const rangePieces = rangeType.split('_');
      const newEntry = {
        value: rangeType,
        label: `${rangePieces[0]} ${rangePieces[1]} Sols`,
      };
      selectOptions.unshift(newEntry);
      rangeSelectValue = newEntry;
    }

    return (
      <div>
        {!facet.no_chart ? (
          <div style={{ paddingBottom: '8px' }}>{!loadingFailed && this.renderHistogram(startValue, endValue)}</div>
        ) : null}
        <Select
          aria-label={rangeIsCustom ? 'Range' : `${startValue} - ${endValue}`}
          label={rangeIsCustom ? 'Range' : `${startValue} - ${endValue}`}
          className={FacetSearchStyles.rangeSelect}
          labelPosition="inner"
          value={rangeSelectValue}
          searchable={false}
          options={facet.selectOptions}
          onChange={this.handleRangeTypeSelect}
        />
        {rangeIsCustom ? (
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
                  aria-label="Start Value"
                  name="startValue"
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
                  aria-label="End Value"
                  name="endValue"
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
        ) : null}
      </div>
    );
  }
}

RangeSelectFacet.defaultProps = {
  values: [],
  baseQueries: [],
};

RangeSelectFacet.propTypes = {
  facet: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  baseQueries: PropTypes.array,
  values: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),
  inverted: PropTypes.bool,
  truncateDecimals: PropTypes.bool,
};

export default RangeSelectFacet;
