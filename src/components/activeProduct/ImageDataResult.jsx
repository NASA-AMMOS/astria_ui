import PropTypes from 'prop-types';
import React from 'react';
import Button from 'src/components/common/Button';
import InlineLabeledValue from 'src/components/common/InlineLabeledValue';
import imageDataExplorerStyles from 'src/styles/ImageDataExplorer.module.css';
import { round } from '../../utils';
import { ChevronDownIcon, ChevronRightIcon, CloseIcon } from '../common/Icons';

const labelWidth = 8 * 14;
class ImageDataResult extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      expanded: true,
    };
  }

  toggleProductExpanded = () => {
    this.setState({ expanded: !this.state.expanded });
  };

  render() {
    const { product, onRemove, roundNum, footer } = this.props;
    const { expanded } = this.state;
    const labelStr = product.label || 'Unknown';

    const renderDataPoint = (key, value) => {
      const displayValue = roundNum && typeof value === 'number' ? round(value, roundNum) : value;
      return (
        <InlineLabeledValue
          key={labelStr + key}
          label={key}
          value={<div className={imageDataExplorerStyles.inlineLabeledValue}>{displayValue}</div>}
          labelWidth={labelWidth}
        />
      );
    };

    return (
      <div className={imageDataExplorerStyles.productResult}>
        <div className={imageDataExplorerStyles.productResultHeader}>
          <div className={imageDataExplorerStyles.productCollapse}>
            <Button
              aria-label={expanded ? 'Collapse' : 'Expand'}
              variant="icon"
              onClick={this.toggleProductExpanded}
              icon={expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
            />
            {labelStr}
          </div>
          {!product.permanent && (
            <Button variant="icon" aria-label="Close" icon={<CloseIcon />} onClick={() => onRemove(product.label)} />
          )}
        </div>
        <div className={imageDataExplorerStyles.dataPoints}>
          {expanded && Object.entries(product.data).map(([key, value]) => renderDataPoint(key, value))}
        </div>
        {footer ? <div className={imageDataExplorerStyles.dataResultFooter}>{footer}</div> : null}
      </div>
    );
  }
}

ImageDataResult.defaultProps = {
  product: {},
  onRemove: () => {},
  roundNum: null,
};

ImageDataResult.propTypes = {
  product: PropTypes.object.isRequired,
  onRemove: PropTypes.func.isRequired,
  roundNum: PropTypes.number,
};

export default ImageDataResult;
