import React from 'react';
import PropTypes from 'prop-types';
import RCSlider from 'rc-slider';
import classNames from 'classnames';
import throttle from 'lodash.throttle';
import Tooltip from './Tooltip';
import sliderStyles from '../../styles/Slider.module.css';

const Handle = RCSlider.Handle;

const TooltipHandle = (props) => {
  const { value, dragging, index, ...restProps } = props;
  return (
    <Tooltip overlay={`${(value * 100).toFixed(0)}% opacity`} visible={dragging} placement="top" key={index}>
      <Handle value={value} {...restProps} />
    </Tooltip>
  );
};

TooltipHandle.propTypes = {
  value: PropTypes.number.isRequired,
  dragging: PropTypes.bool.isRequired,
  index: PropTypes.number.isRequired,
};

export class Slider extends React.Component {
  constructor(props) {
    super(props);
    this.state = { isChangingValue: false };

    this.afterChange = this.afterChange.bind(this);
    this.throttledSliderChangedHandler = throttle(this.onSliderChangedHandler.bind(this), props.throttle, {
      leading: true,
      trailing: true,
    });
    this.onSliderChange = (value) => {
      this.throttledSliderChangedHandler(value);
      if (!this.state.isChangingValue) {
        this.setState({
          isChangingValue: true,
        });
      }
    };
  }

  onSliderChangedHandler(value) {
    const { onChange } = this.props;
    onChange(value);
  }

  afterChange() {
    this.setState({ isChangingValue: false });
  }

  render() {
    const { minimal, onChange, type, showTooltip, className, wrapperClassName, disabled, ...restProps } = this.props;
    const wrapperClass = classNames({
      [sliderStyles.sliderWrapper]: true,
      [wrapperClassName]: typeof wrapperClassName !== 'undefined',
    });
    const sliderClass = classNames({
      [sliderStyles.slider]: true,
      [sliderStyles.isChangingValue]: minimal && this.state.isChangingValue,
      [sliderStyles.minimal]: minimal,
      [sliderStyles.disabled]: disabled,
      [className]: typeof className !== 'undefined',
    });

    const RCComponent = type === 'slider' ? RCSlider : RCSlider.Range;

    const sliderProps = {
      className: sliderClass,
      onChange: this.onSliderChange,
      onAfterChange: this.afterChange,
    };

    if (showTooltip) sliderProps.handle = TooltipHandle;

    return (
      <div className={wrapperClass}>
        <div className={sliderStyles.sliderAbsoluteWrapper}>
          <RCComponent disabled={disabled} {...sliderProps} {...restProps} />
        </div>
      </div>
    );
  }
}

Slider.defaultProps = {
  disabled: false,
  minimal: false,
  throttle: 50,
  showTooltip: false,
  className: '',
  wrapperClassName: '',
  type: 'slider',
};

Slider.propTypes = {
  disabled: PropTypes.bool,
  minimal: PropTypes.bool,
  throttle: PropTypes.number,
  showTooltip: PropTypes.bool,
  className: PropTypes.string,
  wrapperClassName: PropTypes.string,
  type: PropTypes.oneOf(['slider', 'range']),
  onChange: PropTypes.func.isRequired,
};

export default Slider;
