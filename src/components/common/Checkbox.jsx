import classNames from 'classnames';
import PropTypes from 'prop-types';
import CheckboxStyles from '../../styles/Checkbox.module.css';

const Checkbox = ({
  className = '',
  checked,
  onChange,
  value,
  label = '',
  labelRight = '',
  disabled = false,
  ...props
}) => {
  const containerClass = classNames({
    [className]: typeof className === 'string',
    [CheckboxStyles.container]: true,
  });
  const styledCheckboxContainerClass = classNames({
    [CheckboxStyles.styledCheckboxContainer]: true,
    [CheckboxStyles.checked]: checked,
    [CheckboxStyles.disabled]: disabled,
  });
  return (
    <label className={containerClass}>
      <input
        type="checkbox"
        className={CheckboxStyles.hiddenCheckbox}
        checked={checked}
        value={value}
        onChange={onChange}
        disabled={disabled}
        {...props}
      />
      <div className={styledCheckboxContainerClass}>
        <div className={CheckboxStyles.styledCheckbox}>
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M7 1L2.875 5L1 3.18182"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        {label.toString() && <div className={CheckboxStyles.label}>{label}</div>}
        {labelRight.toString() && <div className={CheckboxStyles.labelRight}>{labelRight}</div>}
      </div>
    </label>
  );
};

Checkbox.propTypes = {
  checked: PropTypes.bool.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  label: PropTypes.string,
  labelRight: PropTypes.string,
  disabled: PropTypes.bool,
  onChange: PropTypes.func,
  className: PropTypes.string,
};

export default Checkbox;
