import classNames from 'classnames';
import PropTypes from 'prop-types';
import RadioButtonStyles from '../../styles/RadioButton.module.css';

const RadioButton = ({ selected = false, label = '', labelRight = '', onClick = () => {}, ...props }) => {
  const radioButtonClass = classNames({
    [RadioButtonStyles.radioButton]: true,
    [RadioButtonStyles.radioButtonSelected]: selected,
  });
  return (
    <button type="button" className={RadioButtonStyles.container} onClick={onClick}>
      <div className={radioButtonClass} {...props} />
      {label && <div className={RadioButtonStyles.label}>{label}</div>}
      {labelRight && <div className={RadioButtonStyles.labelRight}>{labelRight}</div>}
    </button>
  );
};

RadioButton.propTypes = {
  onClick: PropTypes.func,
  selected: PropTypes.bool,
  label: PropTypes.string,
  labelRight: PropTypes.string,
};

export default RadioButton;
