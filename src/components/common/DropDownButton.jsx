import classNames from 'classnames';
import PropTypes from 'prop-types';
import Button from 'src/components/common/Button';
import ControlsOverlay from 'src/components/common/ControlsOverlay';
import { ChevronDownIcon } from 'src/components/common/Icons';
import Tooltip from 'src/components/common/Tooltip';
import DropDownButtonStyles from 'src/styles/DropDownButton.module.css';

const DropDownButton = (props) => {
  const {
    icon,
    text,
    onClick = () => {},
    children = null,
    className,
    overlayPlacement = 'bottom',
    activeType = '',
    buttonTooltipProps = {},
    menuTooltipProps = {},
    active = false,
    disabled = false,
  } = props;

  const hasLabel = typeof text !== 'undefined';

  const rootClasses = classNames({
    [DropDownButtonStyles.root]: true,
    [DropDownButtonStyles.noChildren]: !children,
    [DropDownButtonStyles.active]: active,
    [DropDownButtonStyles.dark]: activeType === 'dark',
    [DropDownButtonStyles.labeled]: hasLabel,
    [className]: typeof className !== 'undefined',
  });

  const dropdownIcon = (
    <Tooltip placement="top" {...menuTooltipProps}>
      <ChevronDownIcon />
    </Tooltip>
  );

  const variant = hasLabel ? 'lineButton' : 'icon';
  return (
    <div className={rootClasses}>
      <Tooltip placement="top" {...buttonTooltipProps}>
        <div className={disabled ? DropDownButtonStyles.disabledButtonWrapper : ''}>
          <Button
            aria-label={text || menuTooltipProps.overlay}
            className={DropDownButtonStyles.mainBtn}
            text={text}
            icon={icon}
            variant={variant}
            onClick={onClick}
            disabled={disabled}
          />
        </div>
      </Tooltip>
      {children && (
        <ControlsOverlay
          noPadding
          closeOnClick
          full={false}
          overlayPlacement={overlayPlacement}
          className={DropDownButtonStyles.secondaryBtn}
          icon={dropdownIcon}
          iconLabel={menuTooltipProps.overlay}
          disabled={disabled}
        >
          {children}
        </ControlsOverlay>
      )}
    </div>
  );
};

DropDownButton.propTypes = {
  icon: PropTypes.element,
  label: PropTypes.string,
  onClick: PropTypes.func,
  className: PropTypes.string,
  active: PropTypes.bool,
  overlayPlacement: PropTypes.string,
  buttonTooltipProps: PropTypes.object,
  menuTooltipProps: PropTypes.object,
  disabled: PropTypes.bool,
  text: PropTypes.string,
  activeType: PropTypes.string,
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.array]),
};

export default DropDownButton;
