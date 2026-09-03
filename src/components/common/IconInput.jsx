import classNames from 'classnames';
import PropTypes from 'prop-types';
import IconInputStyles from '../../styles/IconInput.module.css';

const IconInput = ({ className = '', units = '', icon = null, ...props }) => {
  const rootClasses = classNames({
    [IconInputStyles.root]: true,
    [className]: typeof className !== 'undefined',
  });

  return (
    <div className={rootClasses}>
      <div className={IconInputStyles.icon}>{icon}</div>
      <input className={IconInputStyles.input} {...props} />
      {units && <div className={IconInputStyles.units}>{units}</div>}
    </div>
  );
};

IconInput.propTypes = {
  className: PropTypes.string,
  units: PropTypes.string,
  icon: PropTypes.element,
};

export default IconInput;
