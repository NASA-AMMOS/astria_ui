import classNames from 'classnames';
import React from 'react';
import Button from 'src/components/common/Button';
import { CloseIcon } from 'src/components/common/Icons';
import SidebarOverlayStyles from 'src/styles/SidebarOverlay.module.css';

class SidebarOverlay extends React.Component {
  handleClose = () => {
    this.props.handleClose();
  };

  render() {
    const { isOpen, label } = this.props;
    const rootClasses = classNames({
      [SidebarOverlayStyles.root]: true,
      [SidebarOverlayStyles.rootOpen]: isOpen,
    });

    const text = `Close ${label || 'Metadata Panel'}`;

    return (
      <div className={rootClasses}>
        <div className={SidebarOverlayStyles.header}>
          <Button
            aria-label="Close"
            variant="tertiary"
            text={text}
            icon={<CloseIcon />}
            onClick={this.handleClose}
            className={SidebarOverlayStyles.closeBtn}
          />
        </div>
        {this.props.children}
      </div>
    );
  }
}

export default SidebarOverlay;
