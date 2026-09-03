import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from 'src/components/common/Popover';
import controlsOverlayStyles from '../../styles/ControlsOverlay.module.css';
import Button from './Button';
import Tooltip from './Tooltip';

/*
   TODO this component is a mishmash of the old ControlsOverlay behavior which was build off react-popper 2x and the
   new @floating-ui/react successor library. Should do a proper rewrite of this at some point.
*/
class ControlsOverlay extends React.Component {
  constructor(props) {
    super(props);
    this.buttonRef = React.createRef();
    this.overlayRef = null;
    this.id = props.label + Math.random();
    this.hasUpdatedPosition = false;

    this.state = {
      open: false,
    };
  }

  componentDidMount() {
    window.addEventListener('keydown', this.handleWindowKeyPress);
    window.addEventListener('click', this.handleWindowClick);
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.handleWindowKeyPress);
    window.removeEventListener('click', this.handleWindowClick);
  }

  toggleOpen = (evt) => {
    const { noPropagation } = this.props;
    if (evt && noPropagation) {
      evt.stopPropagation();
    }
    const { open } = this.state;
    this.setOpen(!open);
  };

  setOpen(open) {
    this.setState({ open });
  }

  handleOpenChange(open, evt) {
    if (open || !evt) return;
    if (evt.target.ariaLabel === 'Close popover') {
      this.setOpen(false);
    } else if (
      !this.buttonRef.current.contains(evt.target) &&
      !this.overlayRef.contains(evt.target) &&
      !evt.composedPath().some((x) => {
        // check for a utility class to signal click ignore and if that fails
        // last resort is to crawl through the evt path and look for the unique ID we've assigned to this component
        return x.id === this.id || (x.classList && x.classList.contains('prevent-controls-overlay-close'));
      })
    ) {
      this.setOpen(false);
    }
  }

  handleWindowClick = (evt) => {
    const { closeOnClick } = this.props;
    const { open } = this.state;

    if (!open) return;
    evt = evt || window.event;

    if (closeOnClick && this.overlayRef.contains(evt.target)) {
      this.setOpen(false);
    }
  };

  handleWindowKeyPress = (evt) => {
    const { open } = this.state;

    if (!open) return;
    evt = evt || window.event;
    let isEscape = false;
    if ('key' in evt) isEscape = evt.key === 'Escape' || evt.key === 'Esc';
    else isEscape = evt.keyCode === 27;
    if (isEscape) this.toggleOpen();
  };

  render() {
    const { open } = this.state;
    const {
      label,
      button,
      icon,
      iconLabel,
      disabled,
      badge,
      full,
      noPadding,
      className,
      classNameOpen,
      overlayClassName,
      tooltipProps,
      children,
      overlayPlacement,
    } = this.props;
    const controlsOverlayButtonClass = classNames({
      [controlsOverlayStyles.controlsOverlayButton]: true,
      [controlsOverlayStyles.controlsOverlayButtonOpen]: open,
      [classNameOpen]: open,
      [className]: typeof className !== 'undefined',
    });
    const controlsOverlayCustomButtonClass = classNames({
      [controlsOverlayStyles.controlsOverlayButton]: true,
      [controlsOverlayStyles.controlsOverlayButtonOpenCustom]: open,
    });
    const controlsOverlayClass = classNames({
      [controlsOverlayStyles.overlay]: true,
      [controlsOverlayStyles.overlayFull]: full,
      [controlsOverlayStyles.controlsOverlayButtonNoPadding]: noPadding,
      [overlayClassName]: typeof className !== 'undefined',
    });
    const badgeNum = badge > 0 ? badge : null;
    let buttonComponent;
    if (button) {
      buttonComponent = (
        <span className={controlsOverlayCustomButtonClass} onClick={this.toggleOpen}>
          {button}
        </span>
      );
    } else {
      buttonComponent = (
        <Button
          aria-label={iconLabel ?? tooltipProps.overlay}
          disabled={disabled}
          badge={badgeNum}
          onClick={this.toggleOpen}
          text={label}
          icon={icon}
          variant={label ? 'tertiary' : 'icon'}
          className={controlsOverlayButtonClass}
        />
      );
    }

    return (
      <>
        <Popover
          placement={overlayPlacement}
          open={open}
          onOpenChange={(open, evt) => this.handleOpenChange(open, evt)}
        >
          <PopoverTrigger asChild>
            <span ref={this.buttonRef}>
              {Object.keys(tooltipProps).length ? (
                <Tooltip invisible={open} {...tooltipProps}>
                  {buttonComponent}
                </Tooltip>
              ) : (
                buttonComponent
              )}
            </span>
          </PopoverTrigger>
          <PopoverContent className={controlsOverlayStyles.Popover} ref={(node) => (this.overlayRef = node)}>
            <div className={controlsOverlayClass}>{children}</div>
          </PopoverContent>
        </Popover>
      </>
    );
  }
}

ControlsOverlay.defaultProps = {
  className: '',
  classNameOpen: '',
  overlayClassName: '',
  children: [],
  badge: null,
  icon: null,
  full: true,
  noPadding: false,
  overlayPlacement: 'bottom',
  tooltipProps: {},
  label: '',
  button: null,
  disabled: false,
  closeOnClick: false,
};

ControlsOverlay.propTypes = {
  tooltipProps: PropTypes.object,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  button: PropTypes.element,
  icon: PropTypes.element,
  overlayPlacement: PropTypes.string,
  overlayClassName: PropTypes.string,
  className: PropTypes.string,
  classNameOpen: PropTypes.string,
  children: PropTypes.oneOfType([PropTypes.element, PropTypes.array]),
  badge: PropTypes.number,
  full: PropTypes.bool,
  noPadding: PropTypes.bool,
  disabled: PropTypes.bool,
  closeOnClick: PropTypes.bool,
};

export default ControlsOverlay;
