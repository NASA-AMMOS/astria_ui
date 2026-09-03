import classNames from 'classnames';
import PropTypes from 'prop-types';
import scalebarStyles from 'src/styles/Scalebar.module.css';
import { formatWithUnit } from 'src/utils';
import Button from './Button';
import { PinCrossedIcon, PinIcon, PlusIcon, TrashIcon, WarningIcon } from './Icons';
import Tooltip from './Tooltip';

// scalebar logic borrowed from https://github.com/usnistgov/OpenSeadragonScalebar/blob/master/openseadragon-scalebar.js
function getScalebarSizeAndTextForMetric(ppm, minSize, unitSuffix) {
  const value = normalize(ppm, minSize);
  const factor = roundSignificand((value / ppm) * minSize, 3);
  const size = Math.round(value * minSize);
  const valueWithUnit = formatWithUnit(factor, unitSuffix);
  return {
    size,
    text: valueWithUnit,
  };
}

function normalize(value, minSize) {
  const significand = getSignificand(value);
  const minSizeSign = getSignificand(minSize);
  let result = getSignificand(significand / minSizeSign);
  if (result >= 5) {
    result /= 5;
  }
  if (result >= 4) {
    result /= 4;
  }
  if (result >= 2) {
    result /= 2;
  }
  return result;
}

function getSignificand(x) {
  return x * Math.pow(10, Math.ceil(-log10(x)));
}

function roundSignificand(x, decimalPlaces) {
  const exponent = -Math.ceil(-log10(x));
  const power = decimalPlaces - exponent;
  const significand = x * Math.pow(10, power);
  // To avoid rounding problems, always work with integers
  if (power < 0) {
    return Math.round(significand) * Math.pow(10, -power);
  }
  return Math.round(significand) / Math.pow(10, power);
}

function log10(x) {
  return Math.log(x) / Math.log(10);
}

export function Scalebar({
  pixelsPerMeter = null,
  pixelsPerMeterUncertainty = null,
  hidden = false,
  drag = false,
  approximate = false,
  pinned = false,
  togglePinned = () => {},
  addScalebar = () => {},
  removeScalebar = () => {},
  size: propSize = 85,
  draggable = false,
  className,
}) {
  let text = '--';
  let size = propSize;
  if (pixelsPerMeter >= 0) {
    const scaleLabel = getScalebarSizeAndTextForMetric(pixelsPerMeter, size, 'm');
    // text = `${scaleLabel.text}${approximate ? ' ?' : ''}`;
    text = scaleLabel.text;
    size = scaleLabel.size;
  } else if (pixelsPerMeter === -2) {
    text = 'unknown';
  }

  let uncertaintyText = false;
  if (typeof pixelsPerMeterUncertainty === 'number' && pixelsPerMeterUncertainty >= 0) {
    uncertaintyText = `+/- ${formatWithUnit((1 / pixelsPerMeterUncertainty) * size, 'm', 0)}`;
  }

  const rootClasses = classNames({
    [className]: typeof className !== 'undefined',
    [scalebarStyles.root]: true,
    [scalebarStyles.drag]: drag,
    [scalebarStyles.draggable]: draggable,
    [scalebarStyles.hidden]: hidden,
  });
  const uncertaintyClasses = classNames({
    [scalebarStyles.uncertaintyWrapper]: true,
    [scalebarStyles.uncertaintyHidden]: !uncertaintyText || drag || pixelsPerMeter < 0,
  });
  const warningClasses = classNames({
    [scalebarStyles.warningWrapper]: true,
    [scalebarStyles.warningHidden]: !!uncertaintyText || !approximate || drag || pixelsPerMeter < 0,
  });

  return (
    <div className={rootClasses}>
      <div className={scalebarStyles.scaleWrapper} style={{ width: `${size}px` }}>
        <div className={scalebarStyles.outerBoarder} />
        <div className={scalebarStyles.innerBoarder} />
      </div>
      <span className={scalebarStyles.label}>{drag ? '--' : text}</span>
      {draggable && (
        <div nodrag="true" className={scalebarStyles.buttonWrapper}>
          <Tooltip overlay={pinned ? 'Pin to Screen' : 'Pin to Image'} placement="top">
            <Button
              aria-label={pinned ? 'Pin to Screen' : 'Pin to Image'}
              placement="top"
              className={scalebarStyles.button}
              icon={pinned ? <PinCrossedIcon /> : <PinIcon />}
              type="button"
              variant="icon"
              onClick={togglePinned}
            />
          </Tooltip>
          <Tooltip overlay="Add Scalebar" placement="top">
            <Button
              aria-label="Add Scalebar"
              className={scalebarStyles.button}
              icon={<PlusIcon />}
              type="button"
              variant="icon"
              onClick={addScalebar}
            />
          </Tooltip>
          <Tooltip overlay="Remove Scalebar" placement="top">
            <Button
              aria-label="Remove Scalebar"
              className={scalebarStyles.button}
              icon={<TrashIcon />}
              type="button"
              variant="icon"
              onClick={removeScalebar}
            />
          </Tooltip>
        </div>
      )}
      <Tooltip overlay="Scale derived from focus motor count, use caution when interpreting results" placement="bottom">
        <div nodrag="true" className={uncertaintyClasses}>
          {approximate ? <WarningIcon className={scalebarStyles.warningIcon} /> : null}
          <span className={scalebarStyles.uncertaintyLabel}>{uncertaintyText}</span>
        </div>
      </Tooltip>
      <Tooltip
        overlay="Poor scale estimation method available, use caution when interpreting results"
        placement="bottom"
      >
        <div nodrag="true" className={warningClasses}>
          <WarningIcon className={scalebarStyles.warningIcon} />
          <span className={scalebarStyles.warningLabel}>high uncertainty</span>
        </div>
      </Tooltip>
    </div>
  );
}

Scalebar.propTypes = {
  pixelsPerMeter: PropTypes.number,
  pixelsPerMeterUncertainty: PropTypes.number,
  hidden: PropTypes.bool,
  drag: PropTypes.bool,
  draggable: PropTypes.bool,
  approximate: PropTypes.bool,
  pinned: PropTypes.bool,
  togglePinned: PropTypes.func,
  addScalebar: PropTypes.func,
  removeScalebar: PropTypes.func,
  size: PropTypes.number,
  className: PropTypes.string,
};

export default Scalebar;
