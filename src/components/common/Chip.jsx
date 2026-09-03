import classNames from 'classnames';
import PropTypes from 'prop-types';
import chipStyles from '../../styles/Chip.module.css';
import { CloseIcon } from './Icons';

const Chip = ({ leftLabel = '', label = '', value = '', onClick = () => {}, className = '', ...props }) => {
  const buttonClass = classNames({
    [chipStyles.chip]: true,
    [chipStyles.chipPadded]: !leftLabel,
    [className]: typeof className !== 'undefined',
  });

  const mainChipContent = (
    <>
      <div className={chipStyles.label}>{label}:</div>
      <div className={chipStyles.value}>{value}</div>
      <CloseIcon className={chipStyles.icon} />
    </>
  );

  return (
    <button className={buttonClass} {...props} onClick={onClick}>
      {leftLabel && (
        <>
          <div className={chipStyles.leftLabel}>{leftLabel}</div>
          <div className={chipStyles.paddedChipContent}>{mainChipContent}</div>
        </>
      )}
      {!leftLabel && mainChipContent}
    </button>
  );
};

Chip.propTypes = {
  leftLabel: PropTypes.string,
  label: PropTypes.string,
  value: PropTypes.string,
  onClick: PropTypes.func,
  className: PropTypes.string,
};

export default Chip;
