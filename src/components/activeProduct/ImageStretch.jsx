import classNames from 'classnames';
import { Field, Form, Formik } from 'formik';
import PropTypes from 'prop-types';
import 'rc-slider/assets/index.css';
import React from 'react';
import MultiSelect from 'src/components/common/MultiSelect';
import formStyles from '../../styles/Forms.module.css';
import imageStretchStyles from '../../styles/ImageStretch.module.css';
import ProductDetailsStyles from '../../styles/ProductDetails.module.css';
import typographyStyles from '../../styles/common/typography.module.css';
import Button from '../common/Button';
import Select from '../common/Select';
import { Slider } from '../common/Slider';
import Toggle from '../common/Toggle';
import ImageHistogram from './ImageHistogram';

import config from 'config.js';
import { getPropFromProduct } from 'src/utils/sharedUtils';
const stretchModeOptions = [
  { value: 'percentStretch', label: 'Percent Stretch' },
  { value: 'manualStretch', label: 'Manual Stretch' },
];

class ImageStretch extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      manualStretchValues: [props.stretchMin, props.stretchMax],
      percentileValues: [props.percentMin, props.percentMax],
      stretchMode: 'manualStretch',
    };

    this.onSliderChange = this.onSliderChange.bind(this);
    this.onStretchBackendChange = this.onStretchBackendChange.bind(this);
    this.imageStretch = this.imageStretch.bind(this);
    this.reset = this.reset.bind(this);

    this.inputMinRef = React.createRef();
    this.inputMaxRef = React.createRef();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.stretchMin !== this.props.stretchMin || prevProps.stretchMax !== this.props.stretchMax) {
      const stretchMin = typeof this.props.stretchMin === 'number' ? this.props.stretchMin : 0;
      const stretchMax = typeof this.props.stretchMax === 'number' ? this.props.stretchMax : 0;
      this.setState({ manualStretchValues: [stretchMin, stretchMax] });
    }
    if (prevProps.percentMin !== this.props.percentMin || prevProps.percentMax !== this.props.percentMax) {
      const percentMin = typeof this.props.percentMin === 'number' ? this.props.percentMin : 0;
      const percentMax = typeof this.props.percentMax === 'number' ? this.props.percentMax : 0;
      this.setState({ percentileValues: [percentMin, percentMax] });
    }
    if (prevProps.stretchBackend !== this.props.stretchBackend && this.props.stretchBackend === 'backend') {
      if (this.props.extrema !== prevProps.extrema && this.props.extrema) {
        this.setState({ stretchMode: 'manualStretch' });
      } else {
        this.setState({ stretchMode: 'percentStretch' });
      }
    }
  }

  onSliderChange(value) {
    this.setState({ manualStretchValues: value });
  }

  onStretchBackendChange(value) {
    this.props.onUpdateStretchMode(value);

    if (value === 'local') {
      this.setState({ stretchMode: 'manualStretch' });
    } else {
      this.setState({ stretchMode: 'percentStretch' });
    }
  }

  setStretchMode(stretchMode) {
    this.setState({
      stretchMode,
    });
  }

  imageStretch() {
    const { onImageStretch, onPercentStretch } = this.props;
    const { manualStretchValues, percentileValues, stretchMode } = this.state;
    if (stretchMode === 'manualStretch') {
      onImageStretch(manualStretchValues[0], manualStretchValues[1]);
    } else {
      onImageStretch(manualStretchValues[0], manualStretchValues[1]);
      onPercentStretch(percentileValues[0], percentileValues[1]);
    }
  }

  reset() {
    const { onImageStretch, stretchLow, stretchHigh, percentLow, percentHigh, stretchBackend } = this.props;

    // reset stretch DN vals to current bounds
    onImageStretch(stretchLow, stretchHigh);

    // reset percentile vals to current bounds
    this.setState({ percentileValues: [percentLow, percentHigh], manualStretchValues: [stretchLow, stretchHigh] });

    // if in backend mode trigger a new stretch with bounds as params
    if (stretchBackend === 'backend') {
      this.props.onDispatchStretch(true, stretchLow, stretchHigh);
    }
  }

  dispatchStretch() {
    const { stretchMode, manualStretchValues, percentileValues } = this.state;
    let isDNStretch = true;
    let low = manualStretchValues[0];
    let high = manualStretchValues[1];

    if (stretchMode === 'percentStretch') {
      isDNStretch = false;
      low = percentileValues[0];
      high = percentileValues[1];
      this.props.onPercentStretch(low, high);
    }
    this.props.onDispatchStretch(isDNStretch, low, high);
  }

  renderStretchControlInput(name, min, max, label, ref) {
    const { stretchMode } = this.state;
    return (
      <Field name={name}>
        {({ field }) => {
          const { value: currentValue, ...otherFieldProps } = field;
          const inputClass = classNames({
            [formStyles.textInput]: true,
            [imageStretchStyles.input]: true,
          });
          return (
            <div className={imageStretchStyles.inputControlContainer}>
              <label htmlFor={name} className={formStyles.label}>
                {label}
              </label>
              <input
                id={name}
                ref={ref}
                min={min}
                max={max}
                step={1}
                type="number"
                className={inputClass}
                value={currentValue}
                {...otherFieldProps}
              />
              {stretchMode === 'percentStretch' && <span className={formStyles.inputIconRight}>%</span>}
            </div>
          );
        }}
      </Field>
    );
  }

  renderStretchControls() {
    const { histogramLow, histogramHigh, stretchBackend } = this.props;
    const { stretchMode, manualStretchValues, percentileValues } = this.state;

    let renderSlider = false;
    let inputValues = [];
    let inputValueName = '';
    let minValueLabel = '';
    let maxValueLabel = '';
    let minValue;
    let maxValue;
    let enforceBounds = false; // there is a use case for percent stretch above 100 but currently backend doesn't support
    let stretchLowBound = histogramLow;
    let stretchHighBound = histogramHigh;

    if (stretchBackend === 'local') {
      stretchLowBound = 0;
      stretchHighBound = 255;
    }

    if (stretchMode === 'manualStretch') {
      inputValues = manualStretchValues;
      renderSlider = true;
      inputValueName = 'manualStretchValues';
      minValueLabel = `Minimum Value (${stretchLowBound}–${stretchHighBound})`;
      maxValueLabel = `Maximum Value (${stretchLowBound}-${stretchHighBound})`;
    } else {
      inputValues = percentileValues;
      inputValueName = 'percentileValues';
      minValueLabel = `Minimum Percentile`;
      maxValueLabel = `Maxiumum Percentile`;
      minValue = 0;
      maxValue = 100;
    }

    return (
      <div>
        {renderSlider && (
          <Slider
            className={imageStretchStyles.slider}
            type="range"
            value={manualStretchValues}
            min={stretchLowBound}
            max={stretchHighBound}
            step={1}
            allowCross={false}
            onChange={this.onSliderChange}
            onAfterChange={this.imageStretch}
            showTooltip={false}
            throttle={0}
          />
        )}
        <div>
          <Formik
            enableReinitialize
            initialValues={{ min: inputValues[0], max: inputValues[1] }}
            onSubmit={(values, { setSubmitting }) => {
              this.setState(
                {
                  [inputValueName]: enforceBounds
                    ? [Math.max(values.min, minValue), Math.min(values.max, maxValue)]
                    : [values.min, values.max],
                },
                () => {
                  this.imageStretch();
                  if (stretchBackend === 'backend') {
                    this.dispatchStretch();
                  }
                  setSubmitting(false);
                }
              );
            }}
          >
            {({ isSubmitting }) => (
              <Form noValidate autoComplete="off" className={formStyles.form}>
                {this.renderStretchControlInput('min', minValue, maxValue, minValueLabel, this.inputMinRef)}
                {this.renderStretchControlInput('max', minValue, maxValue, maxValueLabel, this.inputMaxRef)}
                <button hidden type="submit" disabled={isSubmitting}>
                  Hidden Submit
                </button>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    );
  }

  renderModeWarning() {
    const { stretchBackend } = this.props;
    if (stretchBackend === 'local') {
      return (
        <div>
          <div className={imageStretchStyles.labelText}>Fast but Inaccurate</div>
          <div className={imageStretchStyles.bodyText}>
            Image stretching in the browser.
            <div className={imageStretchStyles.warningBody}>
              <span className={imageStretchStyles.warning}> Warning: </span>This stretch mode operates on a pre-streched
              image and does not use the full dynamic range of the image so many details of the image may be lost (such
              as rocks within shadows).
            </div>
          </div>
        </div>
      );
    }
    return (
      <div>
        <div className={imageStretchStyles.labelText}>Slow but Accurate</div>
        <div className={imageStretchStyles.bodyText}>
          Dynamically stretch the source image. This mode is slower than Preview Mode but preserves all available
          detail.
        </div>
      </div>
    );
  }

  render() {
    const { stretchMode } = this.state;
    const {
      resetStretch,
      onToggleResetStretch,
      stretchBackend,
      baseImage,
      fetchingInitialData,
      isAnnotatableProduct,
      loading,
      histogram,
      histogramLow,
      histogramHigh,
    } = this.props;

    if (fetchingInitialData) return <div className={ProductDetailsStyles.emptyStateMessage}>Loading</div>;
    if (!baseImage) return <div className={ProductDetailsStyles.emptyStateMessage}>Select an Image</div>;
    if (!isAnnotatableProduct) {
      return <div className={ProductDetailsStyles.emptyStateMessage}>Stretching not available on this product</div>;
    }
    if (loading) return <div className={ProductDetailsStyles.emptyStateMessage}>Loading Histogram</div>;

    let selectValue = { value: 'percentStretch', label: 'Percent Stretch' };
    if (stretchMode === 'manualStretch') {
      selectValue = { value: 'manualStretch', label: 'Manual Stretch' };
    }
    return (
      <div className={imageStretchStyles.container}>
        <MultiSelect
          className={imageStretchStyles.modeSwitchMultiSelect}
          selectedValue={stretchBackend}
          options={[
            { label: 'Preview Mode', value: 'local' },
            { label: 'Dynamic Mode', value: 'backend' },
          ]}
          onChange={this.onStretchBackendChange}
        />
        {this.renderModeWarning()}
        {stretchBackend === 'backend' && (
          <div className={imageStretchStyles.stretchControlsRow}>
            <Select
              className={imageStretchStyles.select}
              value={selectValue}
              searchable={false}
              options={stretchModeOptions}
              onChange={(selectedOption) => this.setStretchMode(selectedOption.value)}
            />
          </div>
        )}
        <ImageHistogram
          className={imageStretchStyles.histogram}
          imageID={getPropFromProduct(baseImage, config.es_mappings.id)}
          histogram={histogram}
          histogramLow={histogramLow}
          histogramHigh={histogramHigh - 1}
        />
        {this.renderStretchControls()}
        <div className={imageStretchStyles.saveStretch}>
          <div className={typographyStyles.label}> Reset Stretch on Image Switch </div>
          <Toggle on={resetStretch} onChange={() => onToggleResetStretch()} />
        </div>
        <div className={imageStretchStyles.bottomRow}>
          {stretchBackend === 'backend' && (
            <div className={imageStretchStyles.processButton}>
              <Button
                full
                variant="primary"
                text="Process Stretch"
                onClick={() => {
                  // Unfortunate but due to lack of time need to just grab current values from inputs
                  // imperatively since it's complex to track current state of inputs from keypress
                  // without submit..
                  let inputValueName = '';
                  let newMin = this.inputMinRef.current.value;
                  let newMax = this.inputMaxRef.current.value;
                  if (stretchMode === 'manualStretch') {
                    inputValueName = 'manualStretchValues';
                    newMin = parseInt(newMin);
                    newMax = parseInt(newMax);
                  } else {
                    inputValueName = 'percentileValues';
                    newMin = parseFloat(newMin);
                    newMax = parseFloat(newMax);
                  }
                  this.setState({ [inputValueName]: [newMin, newMax] }, () => {
                    this.imageStretch();
                    this.dispatchStretch();
                  });
                }}
              />
            </div>
          )}
          <div className={imageStretchStyles.resetButton}>
            <Button full variant="secondary" text="Reset" onClick={this.reset} />
          </div>
        </div>
      </div>
    );
  }
}

ImageStretch.defaultProps = {
  onImageStretch: () => {},
  histogramLow: 0,
  histogramHigh: 0,
  stretchLow: 0,
  stretchHigh: 0,
  percentMin: 0,
  percentMax: 0,
  percentLow: 0,
  percentHigh: 0,
};

ImageStretch.propTypes = {
  onImageStretch: PropTypes.func,
  histogram: PropTypes.array,
  histogramLow: PropTypes.number,
  histogramHigh: PropTypes.number,
  percentMin: PropTypes.number,
  percentMax: PropTypes.number,
  percentLow: PropTypes.number,
  percentHigh: PropTypes.number,
  stretchLow: PropTypes.number,
  stretchHigh: PropTypes.number,
  stretchMin: PropTypes.number.isRequired,
  stretchMax: PropTypes.number.isRequired,
  stretchBackend: PropTypes.string.isRequired,
};

export default ImageStretch;
