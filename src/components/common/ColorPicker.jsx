import classNames from 'classnames';
import PropTypes from 'prop-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CompactPicker, SketchPicker } from 'react-color';
import ColorPickerStyles from '../../styles/ColorPicker.module.css';
import { hexToRgb, rgbStringToObject, rgbToHex } from '../../utils';
import Button from './Button';

import config from 'config.js';
const getHexAndRGB = (color) => {
  let rgb = color;
  let hex = color;
  if (color.indexOf('rgb') !== -1) {
    rgb = rgbStringToObject(color);
    hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  } else {
    rgb = { ...hexToRgb(color), a: 1 };
  }

  return { rgb, hex };
};

const ColorPicker = ({ className = '', defaultColor = '#ff0000', onChange = () => {}, ...props }) => {
  const { asDot, preferHex, compact } = props;

  const defColor = getHexAndRGB(defaultColor);

  // initialize state
  const [currColor, setCurrColor] = useState(defColor);
  const [open, setOpen] = useState(false);
  const rootEl = useRef(null);

  const handleChange = (color) => {
    const { r, g, b } = color.rgb;
    const { a: pa } = currColor.rgb;

    const newColor = `rgba(${r},${g},${b},${pa})`;
    onChange(preferHex ? color.hex : newColor);
    setCurrColor(getHexAndRGB(newColor));
  };

  const handleOpen = () => {
    const color = getHexAndRGB(defaultColor);
    setCurrColor(color);
    setOpen(!open);
  };

  const handleClick = useCallback(
    (event) => {
      if (!open) return;
      if (!rootEl.current.contains(event.target)) {
        setOpen(false);
      }
    },
    [open, rootEl]
  );

  // add click listener for closing the color picker
  useEffect(() => {
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [handleClick]);

  const rootClasses = classNames({
    [ColorPickerStyles.root]: true,
    [className]: typeof className !== 'undefined',
  });

  const pickerWrapperClasses = classNames({
    [ColorPickerStyles.pickerWrapper]: true,
    [ColorPickerStyles.pickerWrapperOpen]: open,
  });

  const picker = compact ? (
    <CompactPicker color={currColor.rgb} onChange={handleChange} colors={config.drawing_presets.colors} />
  ) : (
    <SketchPicker
      disableAlpha={true}
      color={currColor.rgb}
      onChange={handleChange}
      presetColors={config.drawing_presets.colors}
    />
  );

  return asDot ? (
    <div ref={rootEl} className={rootClasses}>
      <Button
        aria-label="Color Picker"
        className={ColorPickerStyles.pickerButton}
        variant="icon"
        icon={<div style={{ background: currColor.hex }} className={ColorPickerStyles.colorPreview} />}
        onClick={handleOpen}
      />
      <div className={pickerWrapperClasses}>{picker}</div>
    </div>
  ) : (
    <div ref={rootEl} className={rootClasses}>
      <Button
        className={ColorPickerStyles.pickerButton}
        variant="secondary"
        text={currColor.hex.toUpperCase()}
        icon={<div style={{ background: currColor.hex }} className={ColorPickerStyles.colorPreview} />}
        onClick={handleOpen}
      />
      <div className={pickerWrapperClasses}>{picker}</div>
    </div>
  );
};

ColorPicker.propTypes = {
  className: PropTypes.string,
  defaultColor: PropTypes.string,
  onChange: PropTypes.func,
};

export default ColorPicker;
