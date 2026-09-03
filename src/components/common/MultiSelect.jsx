import classNames from 'classnames';
import PropTypes from 'prop-types';
import multiSelectStyles from 'src/styles/MultiSelect.module.css';

const MultiSelect = ({
  options = [],
  selectedValue = '',
  onChange = () => {},
  label = '',
  className = '',
  ...other
}) => {
  const multiSelectClass = classNames({
    [multiSelectStyles.multiSelect]: true,
    [className]: typeof className !== 'undefined',
  });
  const onOptionClick = (value) => {
    if (value !== selectedValue) onChange(value);
  };
  const renderOption = (option) => {
    const optionClass = classNames({
      [multiSelectStyles.option]: true,
      [multiSelectStyles.selected]: option.value === selectedValue,
    });
    return (
      <button type="button" onClick={() => onOptionClick(option.value)} key={option.value} className={optionClass}>
        <div className={multiSelectStyles.optionText}>{option.label}</div>
      </button>
    );
  };
  return (
    <div className={multiSelectClass} {...other}>
      {label && <div className={multiSelectStyles.label}>{label}</div>}
      <div className={multiSelectStyles.options}>{options.map((option) => renderOption(option))}</div>
    </div>
  );
};

MultiSelect.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }).isRequired
  ).isRequired,
  selectedValue: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  className: PropTypes.string,
};

export default MultiSelect;
