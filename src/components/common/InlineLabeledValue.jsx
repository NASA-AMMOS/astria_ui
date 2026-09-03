import classNames from 'classnames';
import PropTypes from 'prop-types';
import inlineLabeledValueStyles from '../../styles/InlineLabeledValue.module.css';

const InlineLabeledValue = ({
  label = 'Unknown Label',
  value = 'Unknown Value',
  valueMissing = false,
  valueIsError = false,
  labelWidth = 8 * 12,
  noHover = false,
  tooltip = '',
  leftButton,
  className,
}) => {
  const containerClass = classNames({
    [inlineLabeledValueStyles.container]: true,
    [inlineLabeledValueStyles.noHover]: noHover,
    [inlineLabeledValueStyles.valueMissing]: valueMissing,
    [inlineLabeledValueStyles.valueIsError]: valueIsError,
    [className]: typeof className !== 'undefined',
  });

  const labelStyles = { maxWidth: `${labelWidth}px`, minWidth: `${labelWidth}px` };
  return (
    <div className={containerClass}>
      {!!leftButton && leftButton}
      <div className={inlineLabeledValueStyles.label} style={labelStyles} title={tooltip}>
        {label}:
      </div>
      <div className={inlineLabeledValueStyles.value}>{value}</div>
    </div>
  );
};

InlineLabeledValue.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.element]),
  className: PropTypes.string,
  valueMissing: PropTypes.bool,
  valueIsError: PropTypes.bool,
  labelWidth: PropTypes.number,
  noHover: PropTypes.bool,
  tooltip: PropTypes.string,
  leftButton: PropTypes.element,
};

export default InlineLabeledValue;
