import classNames from 'classnames';
import PropTypes from 'prop-types';
import Modal from 'react-modal';
import alertStyles from '../styles/Alert.module.css';
import keyboardShortcutsStyles from '../styles/KeyboardShortcuts.module.css';
import Button from './common/Button';
import { CloseIcon } from './common/Icons';

const shortcutSections = [
  {
    title: 'Image Search',
    shortcuts: [
      { text: 'Previous Image', keys: ['['] },
      { text: 'Next Image', keys: [']'] },
      { text: 'Open Image in New Tab', keys: ['ctrl/cmd', 'click'] },
      { text: 'Open Image in New Window', keys: ['shift', 'click'] },
    ],
  },
  {
    title: 'Image Viewing',
    shortcuts: [
      { text: 'Pan Image Up', keys: ['w'], alternate: ['↑'] },
      { text: 'Pan Image Down', keys: ['s'], alternate: ['↓'] },
      { text: 'Pan Image Left', keys: ['a'], alternate: ['←'] },
      { text: 'Pan Image Right', keys: ['d'], alternate: ['→'] },
      { text: 'Zoom In', keys: ['='], alternate: ['shift', '↑'] },
      { text: 'Zoom Out', keys: ['-'], alternate: ['shift', '↓'] },
      { text: 'Zoom to Fit', keys: ['0'] },
      { text: 'Zoom to 100%', keys: ['1'] },
    ],
  },
  {
    title: 'Image Data Explorer',
    shortcuts: [{ text: 'Place Cursor', keys: ['ctrl', 'click'] }],
  },
  {
    title: 'Measurement Tool',
    shortcuts: [
      { text: 'New Measurement', keys: ['m'] },
      { text: 'Pan While Placing Measurement', keys: ['alt'], alternate: ['option'] },
    ],
  },
  {
    title: 'Drawing Tool',
    shortcuts: [
      { text: 'Copy Selected Objects', keys: ['ctrl', 'c'] },
      { text: 'Paste Selected Objects', keys: ['ctrl', 'v'] },
    ],
  },
];

const renderKeys = (shortcut) => {
  const keys = shortcut.keys || [];
  const alternate = shortcut.alternate || [];
  const elements = [];
  keys.forEach((key, i) => {
    elements.push(
      <span key={`${key}_key`} className={keyboardShortcutsStyles.sectionShortcutKey}>
        {key}
      </span>
    );
    if (i !== keys.length - 1 && !alternate.length)
      elements.push(
        <span key={`${key}_separator`} className={keyboardShortcutsStyles.sectionShortcutKeySeparator}>
          +
        </span>
      );
  });
  if (alternate.length) {
    elements.push(
      <span key={`${shortcut.title}_alternate`} className={keyboardShortcutsStyles.sectionShortcutAlternateSeparator}>
        or
      </span>
    );
  }
  alternate.forEach((key, i) => {
    elements.push(
      <span key={`${key}_alternate_key`} className={keyboardShortcutsStyles.sectionShortcutKey}>
        {key}
      </span>
    );
    if (i !== alternate.length - 1)
      elements.push(
        <span key={`${key}_alterate_separator`} className={keyboardShortcutsStyles.sectionShortcutKeySeparator}>
          +
        </span>
      );
  });
  return elements;
};

const renderShortcut = (shortcut) => (
  <div className={keyboardShortcutsStyles.sectionShortcut} key={shortcut.text}>
    <div className={keyboardShortcutsStyles.sectionShortcutTitle}>{shortcut.text}</div>
    <div className={keyboardShortcutsStyles.sectionShortcutKeys}>{renderKeys(shortcut)}</div>
  </div>
);

const renderSection = (section) => (
  <div className={keyboardShortcutsStyles.section} key={section.title}>
    <div className={keyboardShortcutsStyles.sectionTitle}>{section.title}</div>
    <div className={keyboardShortcutsStyles.sectionShortcuts}>
      {section.shortcuts.map((shortcut) => renderShortcut(shortcut))}
    </div>
  </div>
);

const KeyboardShortcuts = ({ open = false, onClose = null }) => (
  <Modal
    overlayClassName={{
      base: alertStyles.overlayBase,
      afterOpen: alertStyles.afterOpen,
      beforeClose: alertStyles.beforeClose,
    }}
    className={classNames({
      [alertStyles.alert]: true,
      [keyboardShortcutsStyles.modal]: true,
    })}
    isOpen={open}
    onRequestClose={onClose}
    contentLabel="Keyboard Shortcuts"
    shouldCloseOnOverlayClick
    shouldCloseOnEsc
  >
    <div
      className={classNames({
        [alertStyles.headerContainer]: true,
        [keyboardShortcutsStyles.headerContainer]: true,
      })}
    >
      <div className={alertStyles.title}>Keyboard Shortcuts</div>
      <Button aria-label="Close" variant="icon" icon={<CloseIcon />} onClick={onClose} />
    </div>
    <div className={keyboardShortcutsStyles.content}>{shortcutSections.map((section) => renderSection(section))}</div>
  </Modal>
);

KeyboardShortcuts.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
};

export default KeyboardShortcuts;
