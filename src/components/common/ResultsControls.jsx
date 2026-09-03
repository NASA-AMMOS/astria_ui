import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import { FilterIcon, SortIcon, ViewIcon } from 'src/components/common/Icons';
import { PopoverClose } from 'src/components/common/Popover';
import ExportResultsButtonContainer from 'src/containers/ExportResultsButtonContainer';
import ResultsControlsStyles from 'src/styles/ResultsControls.module.css';
import ControlsOverlay from './ControlsOverlay';

class ResultsControls extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      width: 400,
    };
    this.containerNodeRef = React.createRef();
    this.viewOverlayNodeRef = React.createRef();
    this.sortOverlayNodeRef = React.createRef();
    this.filterOverlayNodeRef = React.createRef();
    this.resizeObserver = null;
  }

  componentDidMount() {
    this.connectResizeObserver();
    if (this.containerNodeRef.current) {
      this.setState({ width: this.containerNodeRef.current.clientWidth });
    }
  }

  componentWillUnmount() {
    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  connectResizeObserver() {
    this.resizeObserver = new ResizeObserver((entries) => {
      window.requestAnimationFrame(() => {
        const width = entries[0].contentRect.width;
        if (width > 0) this.setState({ width });
      });
    });

    // Observe our wrapper element for changes in size
    this.resizeObserver.observe(this.containerNodeRef.current);
  }

  render() {
    const {
      className,
      loading,
      results,
      resultStatsLabel,
      viewControls,
      sortControls,
      filterControls,
      viewLabel,
      sortLabel,
      filterLabel,
      filterCount,
      compactWidth,
      noExport,
      renderTargets,
    } = this.props;
    const { width } = this.state;

    const compact = width < compactWidth;

    const hasViewControls = viewControls.length > 0;
    const hasSortControls = sortControls.length > 0;
    const hasFilterControls = filterControls.length > 0;
    const hasControls = hasViewControls || hasSortControls || hasFilterControls;

    const containerClass = classNames({
      [ResultsControlsStyles.resultsControls]: true,
      [ResultsControlsStyles.hidden]: !hasControls && Object.keys(renderTargets).length > 0,
      [className]: typeof className !== 'undefined',
    });

    const controlsOverlayClass = classNames({
      [ResultsControlsStyles.resultsControlsOverlayButtonCompact]: compact,
    });

    const resultsCounterTargetNode =
      !!renderTargets.resultsCounter && document.getElementById(renderTargets.resultsCounter);

    const resultsCounter = (
      <div className={ResultsControlsStyles.resultStatsContainer}>
        <div className={ResultsControlsStyles.resultStats}>{resultStatsLabel}</div>
        {!loading && !noExport && <ExportResultsButtonContainer results={results} />}
      </div>
    );

    return (
      <div className={containerClass} ref={this.containerNodeRef}>
        {hasControls && (
          <div className={ResultsControlsStyles.resultsControlsOverlays}>
            {hasViewControls && (
              <ControlsOverlay
                className={controlsOverlayClass}
                ref={this.viewOverlayNodeRef}
                label={!compact ? 'View' : ''}
                overlayPlacement="bottom-start"
                icon={<ViewIcon />}
                {...(compact ? { tooltipProps: { overlay: viewLabel, placement: 'top' } } : {})}
              >
                <div className={ResultsControlsStyles.resultControlsOverlayHeader}>
                  <div>{viewLabel}</div>
                  <PopoverClose />
                </div>
                {viewControls}
              </ControlsOverlay>
            )}

            {hasSortControls && (
              <ControlsOverlay
                className={controlsOverlayClass}
                ref={this.sortOverlayNodeRef}
                label={!compact ? 'Sort' : ''}
                overlayPlacement="bottom-start"
                icon={<SortIcon />}
                {...(compact ? { tooltipProps: { overlay: sortLabel, placement: 'top' } } : {})}
              >
                <div className={ResultsControlsStyles.resultControlsOverlayHeader}>
                  <div>{sortLabel}</div>
                  <PopoverClose />
                </div>
                {sortControls}
              </ControlsOverlay>
            )}

            {hasFilterControls && (
              <ControlsOverlay
                className={controlsOverlayClass}
                ref={this.filterOverlayNodeRef}
                label={!compact ? 'Filter' : ''}
                overlayPlacement="bottom-start"
                icon={<FilterIcon />}
                badge={filterCount > 0 ? filterCount : undefined}
                {...(compact ? { tooltipProps: { overlay: filterLabel, placement: 'top' } } : {})}
              >
                <div className={ResultsControlsStyles.resultControlsOverlayHeader}>
                  <div>{filterLabel}</div>
                  <PopoverClose />
                </div>
                {filterControls}
              </ControlsOverlay>
            )}
          </div>
        )}
        {resultsCounterTargetNode ? ReactDOM.createPortal(resultsCounter, resultsCounterTargetNode) : resultsCounter}
      </div>
    );
  }
}

ResultsControls.propTypes = {
  viewControls: PropTypes.array,
  sortControls: PropTypes.array,
  filterControls: PropTypes.array,
  viewLabel: PropTypes.string,
  sortLabel: PropTypes.string,
  filterLabel: PropTypes.string,
  resultStatsLabel: PropTypes.string,
  filterCount: PropTypes.number,
  compactWidth: PropTypes.number,
  className: PropTypes.string,
  renderTargets: PropTypes.object,
  noExport: PropTypes.bool,
};

ResultsControls.defaultProps = {
  viewControls: [],
  sortControls: [],
  filterControls: [],
  viewLabel: '',
  sortLabel: '',
  filterLabel: '',
  resultStatsLabel: '',
  filterCount: 0,
  compactWidth: 340,
  className: '',
  renderTargets: {},
  noExport: false,
};

export default ResultsControls;
