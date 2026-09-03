import classNames from 'classnames';
import PropTypes from 'prop-types';
import TipStyles from 'src/styles/Tip.module.css';
import { HelpIcon } from './Icons';

const Tip = ({ children = null, className = '' }) => {
  const tipClass = classNames({
    [TipStyles.tip]: true,
    [className]: typeof className !== 'undefined',
  });
  return (
    <div className={tipClass}>
      <HelpIcon />
      <div className={TipStyles.tipText}>{children}</div>
    </div>
  );
};

Tip.propTypes = {
  children: PropTypes.oneOfType([PropTypes.string, PropTypes.element, PropTypes.node]),
  className: PropTypes.string,
};

export default Tip;
