import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import NewWindow from 'react-new-window';
import { ClosePopoutIcon, CollapseIcon, FocusIcon, HelpIcon, PopoutIcon } from 'src/components/common/Icons';
import tabPanelContentStyles from 'src/styles/TabPanelContent.module.css';
import Button from './common/Button';
import Tooltip from './common/Tooltip';

function addPropsToReactElement(element, props) {
  if (React.isValidElement(element)) {
    return React.cloneElement(element, props);
  }
  return element;
}

function addPropsToChildren(children, props) {
  if (!Array.isArray(children)) {
    return addPropsToReactElement(children, props);
  }
  return children.map((childElement) => addPropsToReactElement(childElement, props));
}

class TabPanelContent extends React.Component {
  constructor(props) {
    super(props);

    this.ref = React.createRef();

    this.state = {
      poppedout: false,
    };
  }

  componentDidMount() {
    window.addEventListener('beforeunload', () => {
      this.setState({ poppedout: false });
    });
  }

  togglePopout = (e) => {
    e.stopPropagation();
    const { poppedout } = this.state;
    this.setState({ poppedout: !poppedout });
  };

  focusPopout = () => {
    if (this.ref.current) {
      try {
        this.ref.current.window.focus();
      } catch (_err) {
        /* ignore */
      }
    }
  };

  renderPopoutButton() {
    const { poppedout } = this.state;
    const buttonClass = classNames({});
    return (
      <Tooltip
        key="tab-panel-container-popout-tooltip"
        trigger={['click', 'hover']}
        placement="top"
        overlay={poppedout ? 'Return Window' : 'Pop Out'}
      >
        <Button
          aria-label={poppedout ? 'Return Window' : 'Pop Out'}
          onClick={(e) => this.togglePopout(e)}
          className={buttonClass}
          variant="icon"
          icon={poppedout ? <ClosePopoutIcon /> : <PopoutIcon />}
        />
      </Tooltip>
    );
  }

  renderHeaderRow(isPopout) {
    const { title, subtitle, onClose, helpArticle, openHelpArticle, allowPopout } = this.props;
    const { poppedout } = this.state;
    return (
      <div className={tabPanelContentStyles.headerRow}>
        <div className={tabPanelContentStyles.headerTopRow}>
          <div className={tabPanelContentStyles.title}>{title}</div>
          <div className={tabPanelContentStyles.headerButtons}>
            {!!helpArticle && (
              <Tooltip trigger={['click', 'hover']} placement="top" overlay="Help">
                <Button
                  aria-label="Help"
                  variant="icon"
                  icon={<HelpIcon />}
                  onClick={() => openHelpArticle(helpArticle)}
                />
              </Tooltip>
            )}
            {!isPopout && poppedout && (
              <Tooltip trigger={['click', 'hover']} placement="top" overlay="Focus">
                <Button aria-label="Focus" variant="icon" icon={<FocusIcon />} onClick={this.focusPopout} />
              </Tooltip>
            )}
            {allowPopout && this.renderPopoutButton()}
            {!isPopout && (
              <Tooltip trigger={['click', 'hover']} placement="top" overlay="Collapse">
                <Button aria-label="Collapse" variant="icon" icon={<CollapseIcon />} onClick={onClose} />
              </Tooltip>
            )}
          </div>
        </div>
        <div className={tabPanelContentStyles.subtitle}>{subtitle}</div>
      </div>
    );
  }

  render() {
    const { children, title } = this.props;
    const { poppedout } = this.state;

    const updateChildrenWithProps = addPropsToChildren(children, { poppedout });

    return (
      <div className={tabPanelContentStyles.root}>
        {this.renderHeaderRow()}
        {poppedout && (
          <NewWindow
            ref={this.ref}
            center="parent"
            features={{ dependent: true, width: 500, height: 800 }}
            title={title}
            onUnload={() => this.setState({ poppedout: false })}
          >
            <div className={tabPanelContentStyles.popoutChildrenContainer}>
              {this.renderHeaderRow(true)}
              {updateChildrenWithProps}
            </div>
          </NewWindow>
        )}
        {updateChildrenWithProps}
      </div>
    );
  }
}

TabPanelContent.defaultProps = {
  title: '',
  subtitle: '',
  children: null,
  helpArticle: '',
  allowPopout: true,
};

TabPanelContent.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  children: PropTypes.node,
  helpArticle: PropTypes.string,
  allowPopout: PropTypes.bool,
};

export default TabPanelContent;
