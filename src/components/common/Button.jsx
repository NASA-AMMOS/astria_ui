import classNames from 'classnames';
import PropTypes from 'prop-types';
import { forwardRef } from 'react';
import buttonStyles from '../../styles/Button.module.css';

const Button = forwardRef((props, ref) => {
  const { text, variant, progress, icon, full, active, badge, className, type, rightIcon, ...other } = props;
  const buttonClass = classNames({
    [buttonStyles.button]: true,
    [buttonStyles.buttonPrimary]: variant === 'primary',
    [buttonStyles.full]: full,
    [buttonStyles.active]: active,
    [buttonStyles.buttonSecondary]: variant === 'secondary',
    [buttonStyles.buttonTertiary]: variant === 'tertiary',
    [buttonStyles.progressButton]: variant === 'progress',
    [buttonStyles.iconButton]: variant === 'icon',
    [buttonStyles.buttonText]: variant === 'text',
    [buttonStyles.lineButton]: variant === 'lineButton',
    [buttonStyles.floating]: variant === 'floating',
    [buttonStyles.menuItemButton]: variant === 'menuItem',
    [buttonStyles.actionButton]: variant === 'actionButton',
    [buttonStyles.toggleButton]: variant === 'toggleButton',
    [buttonStyles.buttonDelete]: variant === 'delete',
    [buttonStyles.includesText]: !!text,
    [buttonStyles.includesIcon]: !!icon,
    [className]: typeof className !== 'undefined',
  });
  const textClass = classNames({
    [buttonStyles.text]: variant !== 'text',
  });
  return (
    <button ref={ref} type={type} className={buttonClass} {...other}>
      {icon && <span className={buttonStyles.icon}>{icon}</span>}
      <div className={buttonStyles.textContainer}>
        <span className={textClass}>{text}</span>
        {typeof badge === 'number' && <span className={buttonStyles.badge}>{badge}</span>}
      </div>
      {rightIcon && <span className={buttonStyles.rightIcon}>{rightIcon}</span>}
      {variant === 'progress' && <div className={buttonStyles.progressBar} style={{ width: `${progress}%` }} />}
    </button>
  );
});

Button.defaultProps = {
  text: '',
  type: 'button',
  progress: 0,
  badge: null,
  className: '',
  icon: null,
  rightIcon: null,
  full: false,
  variant: 'primary',
  active: false,
};

Button.displayName = 'Button';

Button.propTypes = {
  text: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  type: PropTypes.string,
  progress: PropTypes.number, // 0-100
  badge: PropTypes.number,
  className: PropTypes.string,
  icon: PropTypes.element,
  rightIcon: PropTypes.element,
  full: PropTypes.bool,
  active: PropTypes.bool,
  variant: PropTypes.oneOf([
    'primary',
    'secondary',
    'progress',
    'tertiary',
    'menuItem',
    'icon',
    'text',
    'lineButton',
    'floating',
    'actionButton',
    'toggleButton',
    'delete',
  ]),
};

export default Button;
