import classNames from 'classnames';
import PropTypes from 'prop-types';
import toggleStyles from 'src/styles/Toggle.module.css';

const Toggle = ({ on = false, label = '', onChange = () => {}, disabled = false, ...rest }) => {
  const toggleClass = classNames({
    [toggleStyles.toggle]: true,
    [toggleStyles.toggleOn]: on,
    [toggleStyles.toggleOff]: !on,
    [toggleStyles.disabled]: disabled,
  });

  const onclick = () => {
    if (disabled) {
      return;
    }
    onChange(!on);
  };

  const onKeyUp = (evt) => {
    if (evt.keyCode === 13) onclick();
  };

  return (
    <div
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onKeyUp={onKeyUp}
      className={toggleClass}
      onClick={() => onclick()}
      {...rest}
    >
      <div className={toggleStyles.toggleLabel}>{label}</div>
      <div className={toggleStyles.toggleBar}>
        <div className={toggleStyles.toggleBall} />
      </div>
    </div>
  );
};

Toggle.propTypes = {
  on: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  disabled: PropTypes.bool,
};

export default Toggle;
