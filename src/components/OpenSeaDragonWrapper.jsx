import classNames from 'classnames';
import PropTypes from 'prop-types';
import { Component } from 'react';
import openSeaDragonStyles from 'src/styles/OpenSeaDragon.module.css';
import { openSupportEmail } from 'src/utils';
import { OSDWrapper } from 'src/utils/osd/osdWrapper';
import { getPropFromProduct } from 'src/utils/sharedUtils';

import { getConfig } from 'src/utils/configRegistry';
export const INVALID_POINT = -1;

class OpenSeaDragonWrapper extends Component {
  componentDidMount() {
    const {
      debugMode,
      transformImage,
      enableImageSmoothing,
      onMouseMove,
      onFirstImageLoaded,
      onViewportChange,
      setViewerLoading,
    } = this.props;

    this.osdWrapper = new OSDWrapper({
      debugMode,
      transformImage,
      imageSmoothingEnabled: enableImageSmoothing,
    });

    // external callbacks
    this.osdWrapper.on('firstimageloaded', () => onFirstImageLoaded());
    this.osdWrapper.on('layererror', (layer) => this.onLayerError(layer));
    this.osdWrapper.on('viewportchange', (viewport) => onViewportChange(viewport));
    this.osdWrapper.on('mousemove', ({ x, y }) => onMouseMove(x, y));
    this.osdWrapper.on('viewerloadstatechange', (loadingState) =>
      setViewerLoading(loadingState.loading, loadingState.layers)
    );

    // internal callbacks
    this.osdWrapper.on('shapesselected', this.handleShapeSelected);
    this.osdWrapper.on('shapesdeselected', this.handleShapeDeselected);
    this.osdWrapper.on('shapeclicked', this.handleShapeClicked);
    this.osdWrapper.on('noshapeclicked', this.handleNoShapeClicked);
    this.osdWrapper.on('measurementadded', this.handleMeasurementAdded);
    this.osdWrapper.on('measurementremoved', this.handleMeasurementRemoved);
    this.osdWrapper.on('measurementupdated', this.handleMeasurementUpdated);
    this.osdWrapper.on('scalebaradded', this.handleScalebarAdded);
    this.osdWrapper.on('scalebarremoved', this.handleScalebarRemoved);
    this.osdWrapper.on('scalebarupdated', this.handleScalebarUpdated);
    this.osdWrapper.on('datacursoradded', this.handleDataCursorAdded);
    this.osdWrapper.on('targetselected', this.handleTargetSelected);
    this.osdWrapper.on('footprintselected', this.handleFootprintSelected);
    this.osdWrapper.on('footprintdeselected', this.handleFootprintDeselected);

    this.props.setOSDRefs({
      osdWrapper: this.osdWrapper,
    });
  }

  shouldComponentUpdate(nextProps) {
    this.osdWrapper.update(nextProps, this.props);
    return this.props.osdHidden !== nextProps.osdHidden;
  }

  componentWillUnmount() {
    if (this.osdWrapper) {
      this.osdWrapper.destroy();
    }
  }

  onLayerError(layer) {
    const config = getConfig();
    this.props.showAlert({
      title: 'Error',
      message:
        'Unable to load the requested layer. Please verify that the image file exists and contact support if you continue to encounter this error.',
      primaryAction: this.props.hideAlert,
      secondaryAction: () => {
        openSupportEmail({
          subject: `${config.app_title} Help`,
          message: `Unable to load layer: ${getPropFromProduct(layer, config.es_mappings.id)}`,
          url: window.location.toString(),
        });
        this.props.hideAlert();
      },
    });
  }

  setPictureZoom(picZoom, picCenter, immediately = true) {
    this.osdWrapper.setPictureZoom(picZoom, picCenter, immediately);
  }

  /***** Measurements ******/
  startMeasuring() {
    this.osdWrapper.startMeasuring();
  }

  stopMeasuring() {
    this.osdWrapper.stopMeasuring();
  }

  addMeasurement(lsPoint1, lsPoint2) {
    this.osdWrapper.startMeasuring();
    this.osdWrapper.addMeasurement({ lsPoint1, lsPoint2 }).then(() => {
      this.osdWrapper.stopMeasuring();
    });
  }

  clearAllMeasurements() {
    this.osdWrapper.clearMeasurements();
  }

  handleMeasurementAdded = (measurement) => {
    this.props.addMeasurement(measurement.measureId, measurement.lsPoint1, measurement.lsPoint2);
    this.props.resetViewOnlyMode();
  };

  handleMeasurementRemoved = (measurement) => {
    this.props.removeMeasurement(measurement.measureId);
  };

  handleMeasurementUpdated = (measurement) => {
    this.props.updateMeasurement(measurement.measureId, measurement.lsPoint1, measurement.lsPoint2);
  };

  addScalebar(point, pinToScreen) {
    this.osdWrapper.addScalebar(point, pinToScreen);
  }

  handleScalebarAdded = (scalebar) => {
    this.props.addScalebar(scalebar.id, scalebar.point, scalebar.pinToScreen);
  };

  handleScalebarRemoved = (scalebar) => {
    this.props.removeScalebar(scalebar.id);
  };

  handleScalebarUpdated = (scalebar) => {
    this.props.updateScalebar(scalebar.id, scalebar.point, scalebar.pinToScreen);
  };

  /***** Annotations ******/
  enableShapeInteractions(annotationId) {
    this.osdWrapper.enableShapeInteractions(true, annotationId);
  }

  disableShapeInteractions() {
    this.osdWrapper.enableShapeInteractions(false);
  }

  startDrawing(drawMode, annotationId, opacity) {
    this.osdWrapper.startAnnotating(drawMode, annotationId, opacity);
  }

  stopDrawing() {
    this.osdWrapper.stopAnnotating();
  }

  clearAllShapes() {
    this.osdWrapper.clearShapes();
  }

  /***** Image Footprints ******/
  enableFootprintInteractions() {
    this.osdWrapper.enableFootprintInteractions(true);
  }

  disableFootprintInteractions() {
    this.osdWrapper.enableFootprintInteractions(false);
  }

  /***** Scalebar ******/
  showScalebars() {
    this.osdWrapper.showScalebars();
  }

  hideScalebars() {
    this.osdWrapper.hideScalebars();
  }

  resetScalebars() {
    this.osdWrapper.resetScalebars();
  }

  /***** Data Cursor ******/
  handleDataCursorAdded = (pointInfo) => {
    const { baseImage, addDataCursor } = this.props;
    const { valid, lsPoint } = pointInfo;
    if (valid) {
      addDataCursor(baseImage, parseInt(lsPoint.sample), parseInt(lsPoint.line));
    } else {
      addDataCursor(INVALID_POINT, INVALID_POINT);
    }
  };

  addDataCursor(lsPoint, cursorOrigin) {
    this.osdWrapper.addDataCursor({ lsPoint, cursorOrigin });
  }

  removeDataCursor() {
    this.osdWrapper.removeDataCursor();
  }

  /***** Fabric Shapes ******/
  handleShapeSelected = (shape) => {
    if (this.props.shapeSelected) {
      this.props.shapeSelected(shape);
    }
  };

  handleShapeDeselected = (shape) => {
    if (this.props.shapeDeselected) {
      this.props.shapeDeselected(shape);
    }
  };

  handleShapeClicked = (shape) => {
    if (this.props.shapeClicked) {
      this.props.shapeClicked(shape);
    }
  };

  handleNoShapeClicked = () => {
    if (this.props.noShapeClicked) {
      this.props.noShapeClicked();
    }
  };

  /***** Az/El rulers ******/
  addRulers() {
    this.osdWrapper.addRulers();
  }

  removeRulers() {
    this.osdWrapper.removeRulers();
  }

  /***** Targets ******/
  handleTargetSelected = (targetId) => {
    this.props.targetSelected(targetId);
  };

  render() {
    const { osdHidden } = this.props;

    const osdClass = classNames({
      [openSeaDragonStyles.osdViewer]: true,
      [openSeaDragonStyles.osdHidden]: osdHidden,
    });

    return <div id="osd-viewer" className={osdClass} />;
  }

  /* Footprints */
  handleFootprintSelected = (footprint) => {
    this.props.footprintSelected(footprint);
  };

  handleFootprintDeselected = (footprint) => {
    this.props.footprintDeselected(footprint);
  };

  /* Settings */
  setImageSmoothingEnabled = (enable) => {
    this.osdWrapper.setImageSmoothingEnabled(enable);
  };
}

OpenSeaDragonWrapper.defaultProps = {
  activeSearchProduct: undefined,
  baseImage: undefined,
  enableImageSmoothing: false,
  osdHidden: false,
  transformImage: () => {},
  onFirstImageLoaded: () => {},
  shapeSelected: () => {},
  shapeDeselected: () => {},
  setViewerLoading: () => {},
};

OpenSeaDragonWrapper.propTypes = {
  transformImage: PropTypes.func,
  enableImageSmoothing: PropTypes.bool,
  onMouseMove: PropTypes.func.isRequired,
  onViewportChange: PropTypes.func.isRequired,
  addDataCursor: PropTypes.func.isRequired,
  onFirstImageLoaded: PropTypes.func,
  activeSearchProduct: PropTypes.object,
  baseImage: PropTypes.object,
  groups: PropTypes.arrayOf(PropTypes.object),
  resetViewOnlyMode: PropTypes.func.isRequired,
  addMeasurement: PropTypes.func,
  updateMeasurement: PropTypes.func,
  removeMeasurement: PropTypes.func,
  addScalebar: PropTypes.func,
  updateScalebar: PropTypes.func,
  removeScalebar: PropTypes.func,
  addShape: PropTypes.func,
  removeShape: PropTypes.func,
  shapeSelected: PropTypes.func,
  shapeDeselected: PropTypes.func,
  osdHidden: PropTypes.bool,
  setViewerLoading: PropTypes.func,
  preferredImageForType: PropTypes.object.isRequired,
  showAlert: PropTypes.func.isRequired,
  hideAlert: PropTypes.func.isRequired,
  footprintSelected: PropTypes.func.isRequired,
  footprintDeselected: PropTypes.func.isRequired,
};

export default OpenSeaDragonWrapper;
