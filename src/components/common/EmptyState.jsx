import classNames from 'classnames';
import PropTypes from 'prop-types';
import emptyStateStyles from '../../styles/EmptyState.module.css';

const EmptyState = ({ text = '', icon = null, className }) => {
  const emptyStateClass = classNames({
    [emptyStateStyles.root]: true,
    [className]: typeof className !== 'undefined',
  });
  return (
    <div className={emptyStateClass}>
      {icon && <div className={emptyStateStyles.icon}>{icon}</div>}
      <span className={emptyStateStyles.text}>{text}</span>
    </div>
  );
};

EmptyState.propTypes = {
  text: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  icon: PropTypes.element,
  className: PropTypes.string,
};

export default EmptyState;
