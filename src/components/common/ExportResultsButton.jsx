import PropTypes from 'prop-types';
import Button from './Button';
import { Download } from './Icons';
import Tooltip from './Tooltip';

const ExportResultsButton = ({ className = '', results = [], ...props }) => {
  return (
    <Tooltip placement="top" overlay="Export Result Metadata">
      <Button
        aria-label="Export Result Metadata"
        disabled={results.length === 0}
        className={className}
        variant="icon"
        onClick={() => props.exportResults(results)}
        icon={<Download />}
      />
    </Tooltip>
  );
};

ExportResultsButton.propTypes = {
  results: PropTypes.array,
  className: PropTypes.string,
  exportResults: PropTypes.func,
};

export default ExportResultsButton;
