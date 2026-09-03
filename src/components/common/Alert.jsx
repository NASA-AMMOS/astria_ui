import PropTypes from 'prop-types';
import Modal from 'react-modal';
import alertStyles from '../../styles/Alert.module.css';
import Button from './Button';
import { CloseIcon } from './Icons';

Modal.setAppElement('#root');

const Alert = ({
  open = false,
  title = '',
  message = '',
  doPrimaryAction = () => {},
  doSecondaryAction = () => {},
  close = () => {},
  escapable = true,
  hasSecondaryAction = false,
  primaryActionLabel = 'Dismiss',
  secondaryActionLabel = 'Support',
  onDismiss = null,
}) => (
  <Modal
    overlayClassName={{
      base: alertStyles.overlayBase,
      afterOpen: alertStyles.afterOpen,
      beforeClose: alertStyles.beforeClose,
    }}
    className={alertStyles.alert}
    isOpen={open}
    onRequestClose={() => {
      close();
      if (onDismiss) onDismiss();
    }}
    contentLabel={title}
    shouldCloseOnOverlayClick={escapable}
    shouldCloseOnEsc={escapable}
  >
    <div className={alertStyles.headerContainer}>
      <div className={alertStyles.title}>{title}</div>
      {escapable && (
        <Button
          aria-label="Close"
          variant="icon"
          icon={<CloseIcon />}
          onClick={() => {
            close();
            if (onDismiss) onDismiss();
          }}
        />
      )}
    </div>
    <div className={alertStyles.message}>{message}</div>
    <div className={alertStyles.actionRow}>
      {hasSecondaryAction && <Button variant="secondary" text={secondaryActionLabel} onClick={doSecondaryAction} />}
      <Button variant="primary" text={primaryActionLabel} onClick={doPrimaryAction} />
    </div>
  </Modal>
);

Alert.propTypes = {
  open: PropTypes.bool.isRequired,
  doPrimaryAction: PropTypes.func.isRequired,
  doSecondaryAction: PropTypes.func.isRequired,
  close: PropTypes.func.isRequired,
  hasSecondaryAction: PropTypes.bool,
  message: PropTypes.string,
  title: PropTypes.string,
  primaryActionLabel: PropTypes.string,
  secondaryActionLabel: PropTypes.string,
  escapable: PropTypes.bool,
  onDismiss: PropTypes.func,
};

export default Alert;
