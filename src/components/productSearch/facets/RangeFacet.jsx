import classNames from 'classnames';
import { Field, Form, Formik } from 'formik';
import PropTypes from 'prop-types';
import React from 'react';
import Button from 'src/components/common/Button';
import { SearchIcon } from 'src/components/common/Icons';
import Tooltip from 'src/components/common/Tooltip';
import FacetSearchStyles from 'src/styles/FacetSearch.module.css';
import FormsStyles from 'src/styles/Forms.module.css';

class RangeFacet extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      values: [],
    };

    this.dirtyValues = {};
  }

  componentDidMount() {
    const values = this.parseValuesFromProps(this.props.values);
    this.setState({ values });
  }

  componentDidUpdate(prevProps) {
    const { values, inverted } = this.props;

    // If values have changed, set internal state values
    if (JSON.stringify(prevProps.values) !== JSON.stringify(this.props.values)) {
      const newValues = this.parseValuesFromProps(this.props.values);
      this.setState({ values: newValues });
    }

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

  getQuery(dataRange = {}) {
    return new Promise((resolve) => {
      let { startValue, endValue } = dataRange;

      // params from URL come in as array
      if (Array.isArray(dataRange)) {
        startValue = dataRange[0];
        endValue = dataRange[1];
      }

      const {
        facet: { dataField },
        inverted,
      } = this.props;
      const mustOrMustNot = inverted ? 'must_not' : 'must';

      const validStart = !isNaN(parseFloat(startValue));
      const validEnd = !isNaN(parseFloat(endValue));

      const queryRange = {};
      if (validStart) {
        queryRange.gte = startValue;
      }
      if (validEnd) {
        queryRange.lte = endValue;
      }
      const query = {
        bool: {
          [mustOrMustNot]: { range: { [dataField]: queryRange } },
        },
      };

      resolve(validStart || validEnd ? query : null);
    });
  }

  parseValuesFromProps(values) {
    let stateValues = null;
    if (values.length) stateValues = values.map((x) => parseFloat(x));
    return stateValues;
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
    const query = await this.getQuery({ startValue: dataRange[0], endValue: dataRange[1] });
    onInputChange(query, dataRange);
  };

  onSubmit = async (values, { setSubmitting }) => {
    await this.submitChange(values);
    setSubmitting(false);
  };

  submitChange = (values) => {
    return new Promise(async (resolve) => {
      const { onChange } = this.props;
      this.dirtyValues = { startValue: values.startValue, endValue: values.endValue };

      // use '_' in to signify empty value externally
      const dataRange = [
        isNaN(parseFloat(values.startValue)) ? '_' : values.startValue,
        isNaN(parseFloat(values.endValue)) ? '_' : values.endValue,
      ];

      const query = await this.getQuery({ ...this.dirtyValues });
      onChange(query, dataRange);
      resolve();
    });
  };

  render() {
    const { values: propsValues, facet } = this.props;
    const { values: stateValues } = this.state;

    // Use value if provided
    let startValue;
    let endValue;
    if (propsValues && propsValues.length) {
      // ensure prop values are numbers
      startValue = parseFloat(propsValues[0]) || '';
      endValue = parseFloat(propsValues[1]) || '';
    } else if (stateValues) {
      startValue = stateValues[0];
      endValue = stateValues[1];
    }

    const showLabel = facet.variant === 'compact' || facet.variant === 'inline';
    const labelClass = classNames({
      [FormsStyles.label]: facet.variant === 'compact',
      [FormsStyles.inlineLabel]: facet.variant === 'inline',
      [`facet_label_${facet.key}`]: true, // hacky non-module class for special styling
    });

    return (
      <div className={facet.variant === 'inline' ? FacetSearchStyles.inlineLabelFacet : ''}>
        {showLabel && <div className={labelClass}>{facet.label}</div>}
        <Formik enableReinitialize initialValues={{ startValue, endValue }} onSubmit={this.onSubmit}>
          {({ isSubmitting, handleSubmit, handleChange }) => (
            <Form autoComplete="off" className={FacetSearchStyles.rangeInputForm}>
              <Field
                className={facet.variant === 'inline' ? FacetSearchStyles.textInputInline : FacetSearchStyles.textInput}
                min={0}
                type="number"
                placeholder="Start"
                name="startValue"
                onChange={(e) => {
                  this.onChange(e);
                  handleChange(e);
                }}
              />
              <div className={FacetSearchStyles.textInputRangeLabel}>to</div>
              <Field
                className={facet.variant === 'inline' ? FacetSearchStyles.textInputInline : FacetSearchStyles.textInput}
                min={0}
                type="number"
                name="endValue"
                placeholder="End"
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

RangeFacet.defaultProps = {
  values: [],
  inverted: false,
};

RangeFacet.propTypes = {
  facet: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  values: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),
  inverted: PropTypes.bool.isRequired,
};

export default RangeFacet;
