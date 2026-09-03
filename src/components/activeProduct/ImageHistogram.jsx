import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import ImageHistogramStyles from 'src/styles/ImageHistogram.module.css';
import { VictoryArea, VictoryChart, VictoryLine } from 'victory';

class ImageHistogram extends React.Component {
  shouldComponentUpdate(nextProps) {
    return nextProps.imageID !== this.props.imageID;
  }

  render() {
    const { histogram, histogramLow, histogramHigh, className } = this.props;

    const noHistogram = histogram === undefined || histogram.length === 0;
    const histogramClass = classNames({
      [ImageHistogramStyles.histogram]: true,
      [ImageHistogramStyles.noHistogram]: noHistogram,
      [className]: typeof className !== 'undefined',
    });

    if (noHistogram) {
      return <div className={histogramClass}>No Histogram Available</div>;
    }

    const firstLineColor = histogram.length > 1 ? '#EC4C4C' : 'white';
    return (
      <div className={histogramClass}>
        <VictoryChart
          aria-label="image-histogram"
          padding={{ top: 0, bottom: 0 }}
          domainPadding={{ y: 10 }}
          width={600}
        >
          {histogram[2] && (
            <VictoryArea
              x="value"
              y="count"
              style={{
                data: { fill: 'rgba(79, 183, 242, 0.49)' },
              }}
              data={histogram[2]}
            />
          )}

          {histogram[1] && (
            <VictoryLine
              x="value"
              y="count"
              style={{
                data: { stroke: '#76EF74' },
              }}
              data={histogram[1]}
            />
          )}
          {histogram[0] && (
            <VictoryLine
              x="value"
              y="count"
              style={{
                data: { stroke: firstLineColor },
              }}
              data={histogram[0]}
            />
          )}
        </VictoryChart>
        <div className={ImageHistogramStyles.histogramLabels}>
          <div>{histogramLow}</div>
          <div>Original Histogram</div>
          <div>{histogramHigh}</div>
        </div>
      </div>
    );
  }
}

ImageHistogram.defaultProps = {
  histogramLow: 0,
  histogramHigh: 0,
  className: '',
};

ImageHistogram.propTypes = {
  histogramLow: PropTypes.number,
  histogramHigh: PropTypes.number,
  histogram: PropTypes.array.isRequired,
  imageID: PropTypes.string.isRequired,
  className: PropTypes.string,
};

export default ImageHistogram;
