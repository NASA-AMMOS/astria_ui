import classNames from 'classnames';
import PropTypes from 'prop-types';
import RCTooltip from 'rc-tooltip';
import 'rc-tooltip/assets/bootstrap_white.css';
import typographyStyles from 'src/styles/common/typography.module.css';
import tooltipStyles from 'src/styles/Tooltip.module.css';

const Tooltip = ({
  className = '',
  children = null,
  overlay = '',
  shortcut = '',
  learnMore = null,
  mouseEnterDelay = 0.5,
  mouseLeaveDelay = 0,
  autoPlacement = false,
  placement = 'left',
  invisible = false,
  ...restProps
}) => {
  /*
    The primary props of rc-tooltip - overlay and placement - are included in
    this component for ease of use, ...restProps passes in all other props
    for rc-tooltip
  */
  const tooltipClass = classNames({
    [tooltipStyles.tooltip]: true,
    [tooltipStyles.invisible]: invisible,
    [className]: typeof className !== 'undefined',
  });
  if (children && children.props.disabled) return children;
  let overlayContent = overlay;
  if (shortcut) {
    overlayContent = (
      <div className={tooltipStyles.overlayContent}>
        {overlay}
        <span className={tooltipStyles.keyboardShortcut}>{shortcut}</span>
      </div>
    );
  }
  if (learnMore) {
    overlayContent = (
      <div>
        {overlayContent}
        <div className={tooltipStyles.learnMoreContainer}>
          <button type="button" onClick={() => learnMore()} className={typographyStyles.learnMore}>
            Learn More
          </button>
        </div>
      </div>
    );
  }
  const placementProp = !autoPlacement ? { placement } : {};

  return (
    <RCTooltip
      mouseEnterDelay={mouseEnterDelay}
      mouseLeaveDelay={mouseLeaveDelay}
      overlayClassName={tooltipClass}
      prefixCls="rc-tooltip"
      overlay={overlayContent}
      {...placementProp}
      {...restProps}
    >
      {children}
    </RCTooltip>
  );
};

Tooltip.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  overlay: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  shortcut: PropTypes.string,
  learnMore: PropTypes.func,
  invisible: PropTypes.bool,
  placement: PropTypes.string,
  autoPlacement: PropTypes.bool,
  mouseEnterDelay: PropTypes.number,
  mouseLeaveDelay: PropTypes.number,
};

export default Tooltip;
