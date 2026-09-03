import classNames from 'classnames';
import PropTypes from 'prop-types';
import ReactSelect, { components } from 'react-select';
import selectStyles from '../../styles/Select.module.css';

const Select = ({
  disabled = false,
  multi = false,
  searchable = true,
  clearable = false,
  label = '',
  labelPosition = 'top',
  labelWidth = 100,
  labelClass = '',
  className = '',
  components: propComponents,
  ...rest
}) => {
  const innerLabel = labelPosition === 'inner';

  const containerClass = classNames({
    [selectStyles.container]: true,
    [selectStyles.labelTop]: labelPosition === 'top',
    [selectStyles.labelLeft]: labelPosition === 'left',
    [selectStyles.labelInner]: innerLabel,
    [selectStyles.noLabel]: !label,
    'prevent-controls-overlay-close': true,
    [className]: typeof className !== 'undefined',
  });

  const SingleValue = innerLabel
    ? ({ children, ...props }) => {
        return (
          <components.SingleValue {...props}>
            <span className={selectStyles.innerLabel}>{label}:</span>
            {children}
          </components.SingleValue>
        );
      }
    : ({ children, ...props }) => <components.SingleValue {...props}>{children}</components.SingleValue>;

  const selectComponents = Object.assign({}, { SingleValue }, propComponents);

  const labelWidthStyle = typeof labelWidth === 'number' ? `${labelWidth}px` : labelWidth;
  const labelClasses = classNames({
    [selectStyles.label]: true,
    [labelClass]: typeof labelClass !== 'undefined',
  });
  return (
    <div className={containerClass}>
      {label && !innerLabel && (
        <div className={labelClasses} style={{ width: labelWidthStyle }}>
          {label}
        </div>
      )}
      <ReactSelect
        {...rest}
        aria-label={label}
        components={selectComponents}
        isMulti={multi}
        isDisabled={disabled}
        isSearchable={searchable}
        isClearable={clearable}
        classNamePrefix="select-drop-down"
        className={selectStyles.selectRoot}
      />
    </div>
  );
};

Select.propTypes = {
  options: PropTypes.arrayOf(PropTypes.object).isRequired,
  className: PropTypes.string,
  multi: PropTypes.bool,
  searchable: PropTypes.bool,
  disabled: PropTypes.bool,
  clearable: PropTypes.bool,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  labelPosition: PropTypes.oneOf(['top', 'left', 'inner']),
  labelWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  labelClass: PropTypes.string,
  components: PropTypes.any,
};

export default Select;
