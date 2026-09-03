import classNames from 'classnames';
import PropTypes from 'prop-types';
import IconDropDownStyles from '../../styles/IconDropDown.module.css';
import Button from './Button';
import ControlsOverlay from './ControlsOverlay';
import { ChevronDownIcon } from './Icons';
import Tooltip from './Tooltip';

const IconDropDown = ({
  icon,
  onClick = () => {},
  children = null,
  className,
  overlayPlacement = 'bottom',
  buttonTooltip = '',
  menuTooltip = '',
  active = false,
}) => {
  const rootClasses = classNames({
    [IconDropDownStyles.root]: true,
    [IconDropDownStyles.noChildren]: !children,
    [IconDropDownStyles.active]: active,
    [className]: typeof className !== 'undefined',
  });

  const dropdownIcon = (
    <Tooltip overlay={menuTooltip} placement="top">
      <ChevronDownIcon />
    </Tooltip>
  );

  return (
    <div className={rootClasses}>
      <Tooltip overlay={buttonTooltip} placement="top">
        <Button
          aria-label={buttonTooltip}
          className={IconDropDownStyles.mainBtn}
          icon={icon}
          variant="icon"
          onClick={onClick}
        />
      </Tooltip>
      {children && (
        <ControlsOverlay
          noPadding
          closeOnClick
          full={false}
          overlayPlacement={overlayPlacement}
          className={IconDropDownStyles.secondaryBtn}
          icon={dropdownIcon}
        >
          {children}
        </ControlsOverlay>
      )}
    </div>
  );
};

IconDropDown.propTypes = {
  icon: PropTypes.element,
  onClick: PropTypes.func,
  className: PropTypes.string,
  active: PropTypes.bool,
  buttonTooltip: PropTypes.string,
  menuTooltip: PropTypes.string,
  overlayPlacement: PropTypes.string,
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.array]),
};

export default IconDropDown;
