import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import NewWindow from 'react-new-window';
import Button from 'src/components/common/Button';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ClosePopoutIcon,
  HelpOutlineIcon,
  PopoutIcon,
} from 'src/components/common/Icons';
import Tooltip from 'src/components/common/Tooltip';
import panelStyles from 'src/styles/Panel.module.css';

/* Taken from ASTTRO w/modifications
   https://github.jpl.nasa.gov/OnSight/OnSight/blob/master/web/asttronsight/script/app/components/presentational/nav/panel.jsx

   Figma component:
   https://www.figma.com/file/zkXv6FZeHRzwFQJ2cNvNR1/UI-Components?node-id=1%3A4177
 */
class Panel extends React.Component {
  constructor(props) {
    super(props);

    this.LOCALSTORAGE_KEY = `panel_state_${props.id}`;
    let expanded = props.expanded || props.defaultExpanded;
    if (props.preserveToggledStateLocally) {
      if (localStorage.getItem(this.LOCALSTORAGE_KEY)) {
        expanded = localStorage.getItem(this.LOCALSTORAGE_KEY) === 'true';
      }
    }
    this.state = {
      expanded: expanded,
      poppedout: false,
    };
    this.bodyContainer = React.createRef();
    this.onToggle = this.onToggle.bind(this);
    this.togglePopout = this.togglePopout.bind(this);
    this.toggleExpansion = this.toggleExpansion.bind(this);
    this.transitionEnd = this.transitionEnd.bind(this);
  }

  componentDidMount() {
    this.toggleExpansion(this.state.expanded, true);
    window.addEventListener('beforeunload', () => {
      this.setState({ poppedout: false });
    });
  }

  componentDidUpdate(prevProps, prevState) {
    const { expanded: propsExpanded } = this.props;
    const { expanded: stateExpanded } = this.state;
    if (prevProps.expanded !== propsExpanded) this.toggleExpansion(propsExpanded);
    else if (prevState.expanded !== stateExpanded) this.toggleExpansion(stateExpanded);
  }

  onToggle() {
    const { expanded } = this.state;
    this.setState({ expanded: !expanded });
    if (this.props.preserveToggledStateLocally) localStorage.setItem(this.LOCALSTORAGE_KEY, !expanded);
  }

  toggleExpansion(expanded, immediate) {
    const bodyContainer = this.bodyContainer.current;
    const contentHeight = bodyContainer.scrollHeight;

    if (!expanded) {
      bodyContainer.style.height = `${contentHeight}px`;
      bodyContainer.removeEventListener('transitionend', this.transitionEnd);
      if (immediate) {
        bodyContainer.style.height = '0px';
        bodyContainer.style.overflow = 'hidden';
      } else {
        window.requestAnimationFrame(() => {
          bodyContainer.style.height = '0px';
          bodyContainer.style.overflow = 'hidden';
        });
      }
    } else {
      if (immediate) {
        this.transitionEnd();
      } else {
        bodyContainer.style.height = `${contentHeight}px`;
        bodyContainer.addEventListener('transitionend', this.transitionEnd);
      }
    }
  }

  transitionEnd() {
    const { expanded } = this.state;
    const bodyContainer = this.bodyContainer.current;

    if (expanded) {
      bodyContainer.style.removeProperty('height');
      bodyContainer.style.removeProperty('overflow');
      bodyContainer.removeEventListener('transitionend', this.transitionEnd);
    }
  }

  togglePopout(e) {
    e.stopPropagation();
    const { poppedout } = this.state;
    this.setState({ poppedout: !poppedout });
  }

  renderToggle() {
    const { onToggle, expanded: propsExpanded } = this.props;
    const { expanded: stateExpanded, poppedout } = this.state;

    if (poppedout) return null;

    // If expand/collapse are driven by props use prop values to determine icon. Otherwise, use state.
    const expanded = onToggle ? propsExpanded : stateExpanded;
    const icon = expanded ? <ChevronUpIcon /> : <ChevronDownIcon />;
    const overlay = expanded ? 'Collapse' : 'Expand';
    return (
      <Tooltip placement="topLeft" overlay={overlay}>
        <Button variant="icon" icon={icon} aria-label={overlay} />
      </Tooltip>
    );
  }

  renderPopoutButton() {
    const { poppedout } = this.state;
    const buttonClass = classNames({
      [panelStyles.popoutButton]: true,
      [panelStyles.panelButton]: true,
    });
    const overlay = poppedout ? 'Return Window' : 'Pop Out';
    return (
      <Tooltip key="panel-popout-tooltip" trigger={['click', 'hover']} placement="top" overlay={overlay}>
        <Button
          aria-label={overlay}
          onClick={(e) => this.togglePopout(e)}
          className={buttonClass}
          variant="icon"
          icon={poppedout ? <ClosePopoutIcon /> : <PopoutIcon />}
        />
      </Tooltip>
    );
  }

  renderSecondaryButton() {
    const { secondaryButton } = this.props;
    return (
      secondaryButton && (
        <span className={panelStyles.panelButton} onClick={(e) => e.stopPropagation()}>
          {secondaryButton}
        </span>
      )
    );
  }

  renderTooltip() {
    const { tooltip } = this.props;
    const tooltipIconClass = classNames({
      [panelStyles.panelButton]: true,
      [panelStyles.tooltip]: true,
    });
    return (
      tooltip && (
        <Tooltip placement="top" overlay={tooltip}>
          <span className={tooltipIconClass}>
            <HelpOutlineIcon />
          </span>
        </Tooltip>
      )
    );
  }

  render() {
    const {
      title,
      children,
      doublePadding,
      onToggle: propsOnToggle,
      popoutTitle: propsPopoutTitle,
      allowPopout,
      className,
      sticky,
      activeBadge,
      noPadding,
    } = this.props;
    const { poppedout } = this.state;

    // If a toggle method is provided as a prop, use that.
    // Otherwise, use the default provided method in this class.
    const onToggle = propsOnToggle || this.onToggle;

    const popoutTitle = propsPopoutTitle || title;

    const panelClass = classNames({
      [panelStyles.panel]: true,
      [panelStyles.poppedout]: poppedout,
      [className]: typeof className !== 'undefined',
    });

    const panelBodyInnerClass = classNames({
      [panelStyles.panelBodyInner]: !noPadding,
      [panelStyles.doublePadding]: doublePadding,
    });

    const panelHeaderClass = classNames({
      [panelStyles.panelHeader]: true,
      [panelStyles.sticky]: sticky,
    });

    return (
      <div className={panelClass}>
        <div className={panelHeaderClass} onClick={() => onToggle(title)}>
          <div className={panelStyles.panelTitle}>
            {activeBadge && <div className={panelStyles.activeBadge} />}
            {title}
          </div>
          <div className={panelStyles.panelButtons}>
            {this.renderTooltip()}
            {allowPopout && this.renderPopoutButton()}
            {this.renderSecondaryButton()}
            {this.renderToggle()}
          </div>
        </div>
        <div ref={this.bodyContainer} className={panelStyles.panelBody}>
          <div className={panelBodyInnerClass}>
            {poppedout && (
              <NewWindow
                features={{ dependent: true, width: 500, height: 800, center: 'parent' }}
                title={popoutTitle}
                onUnload={() => this.setState({ poppedout: false })}
              >
                <div className={panelStyles.popoutChildrenContainer}>
                  <div className={panelStyles.popoutTitle}>{title}</div>
                  {children}
                </div>
              </NewWindow>
            )}
            {!poppedout && children}
          </div>
        </div>
      </div>
    );
  }
}

Panel.propTypes = {
  onToggle: PropTypes.func,
  title: PropTypes.string,
  popoutTitle: PropTypes.string,
  tooltip: PropTypes.string,
  activeBadge: PropTypes.bool,
  children: PropTypes.node,
  expanded: PropTypes.bool,
  defaultExpanded: PropTypes.bool,
  allowPopout: PropTypes.bool,
  sticky: PropTypes.bool,
  doublePadding: PropTypes.bool,
  noPadding: PropTypes.bool,
  secondaryButton: PropTypes.element,
  id: PropTypes.string,
  preserveToggledStateLocally: PropTypes.bool,
  className: PropTypes.string,
};

Panel.defaultProps = {
  onToggle: null,
  title: '',
  popoutTitle: '',
  tooltip: '',
  activeBadge: false,
  children: null,
  expanded: false,
  defaultExpanded: true,
  allowPopout: false,
  sticky: true,
  doublePadding: false,
  noPadding: false,
  secondaryButton: null,
  id: '',
  preserveToggledStateLocally: false,
  className: '',
};

export default Panel;
