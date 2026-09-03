import { connect } from 'react-redux';
import { hideAlert, showAlert } from 'src/actions/alertActions';
import {
  addMeasurement,
  addScalebar,
  clearMeasurements,
  noShapeClicked,
  removeMeasurement,
  removeScalebar,
  setActiveAnnotation,
  setInteractionMode,
  setSavedAnnotationRef,
  shapeClicked,
  shapeDeselected,
  shapeSelected,
  updateMeasurement,
  updateScalebar,
} from 'src/actions/annotationActions';
import { clearDataCursor, setDataCursor, updateLineSample } from 'src/actions/dataCursor';
import {
  clearSelectedFootprint,
  highlightTarget,
  setSelectedFootprint,
  setTargetMetadataOpen,
} from 'src/actions/imageLayers';
import {
  handleFirstImageLoaded,
  setDefaultZoom,
  setOSDRefs,
  setViewerLoading,
  updateViewport,
} from 'src/actions/imageViewer';
import {
  setProductDetailsSidebarOpen as _setProductDetailsSidebarOpen,
  setProductSearchSidebarOpen as _setProductSearchSidebarOpen,
} from 'src/actions/sidebarState';
import { INVALID_POINT } from 'src/components/OpenSeaDragonWrapper';
import RenderedImagePane from 'src/components/RenderedImagePane';

import config from 'config.js';
const mapStateToProps = (state) => {
  return {
    stretchMin: state.imageAdjustments.stretchMin,
    stretchMax: state.imageAdjustments.stretchMax,
    stretchMode: state.imageAdjustments.stretchMode,
    debugMode: state.debugMode,
    cursorActive: state.dataCursor.active,
    cursorLine: state.dataCursor.line,
    cursorSample: state.dataCursor.sample,
    cursorOrigin: state.dataCursor.cursorOrigin,
    fetchingGroups: state.loading.fetchingGroups,
    defaultZoom: state.imageViewer.defaultZoom,
    zoom: state.imageViewer.zoom,
    rotation: state.imageViewer.rotation,
    center: state.imageViewer.center,
    initialZoom: state.imageViewer.initialZoom,
    initialRotation: state.imageViewer.initialRotation,
    initialCenter: state.imageViewer.initialCenter,
    viewerLoading: state.imageViewer.viewerLoading,
    layerLoadingStates: state.imageViewer.layerLoadingStates,
    activeSearchProduct: state.activeSearchProduct.searchProduct,
    groups: state.activeSearchProduct.groups,
    activeOverlays: state.imageLayers.layers,
    productSearchSidebarOpen: state.sidebarState.productSearchSidebarOpen,
    productDetailsSidebarOpen: state.sidebarState.productDetailsSidebarOpen,
    interactionMode: state.annotationState.interactionMode,
    initialMeasurements: state.annotationState.initialMeasurements,
    initialScalebars: state.annotationState.initialScalebars,
    activeAnnotation: state.annotationState.activeAnnotation,
    baseImage: state.imageLayers.layers[0] ? state.imageLayers.layers[0] : {},
    anyAnnotationsActive: state.annotationState.annotations.length > 0 || state.imageLayers.showSourceImageFootprints,
    currentSample: state.viewerState.currentSample,
    currentLine: state.viewerState.currentLine,
    preferredImageForType: state.imageLayers.preferredImageForType,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    addDataCursor(product, imageX, imageY) {
      if (parseInt(imageX) !== INVALID_POINT && parseInt(imageY) !== INVALID_POINT) {
        dispatch(
          setDataCursor({
            active: true,
            product,
            line: parseInt(imageY),
            sample: parseInt(imageX),
            cursorOrigin: 'IMAGE',
          })
        );
      } else {
        dispatch(clearDataCursor());
      }
    },
    onMouseMove(imageX, imageY) {
      dispatch(updateLineSample(imageY, imageX));
    },
    updateViewport(viewport, force, immediate) {
      dispatch(updateViewport(viewport, force, immediate));
    },
    setProductSearchSidebarOpen(open) {
      dispatch(_setProductSearchSidebarOpen(open));
    },
    setProductDetailsSidebarOpen(open) {
      dispatch(_setProductDetailsSidebarOpen(open));
    },
    resetInteractionMode() {
      dispatch(setInteractionMode(config.interaction_modes.edit));
    },
    resetViewOnlyMode() {
      dispatch(setInteractionMode(config.interaction_modes.view_only));
    },
    addMeasurement(id, lsPoint1, lsPoint2) {
      dispatch(addMeasurement(id, lsPoint1, lsPoint2));
    },
    updateMeasurement(id, lsPoint1, lsPoint2) {
      dispatch(updateMeasurement(id, lsPoint1, lsPoint2));
    },
    removeMeasurement(id) {
      dispatch(removeMeasurement(id));
    },
    addScalebar(id, lsPoint, pinToScreen) {
      dispatch(addScalebar(id, lsPoint, pinToScreen));
    },
    updateScalebar(id, lsPoint, pinToScreen) {
      dispatch(updateScalebar(id, lsPoint, pinToScreen));
    },
    removeScalebar(id) {
      dispatch(removeScalebar(id));
    },
    clearAllMeasurements() {
      dispatch(clearMeasurements());
    },
    shapeSelected(shape) {
      dispatch(shapeSelected(shape));
    },
    shapeDeselected(shape) {
      dispatch(shapeDeselected(shape));
    },
    setActiveAnnotation(activeAnnotation) {
      dispatch(setActiveAnnotation(activeAnnotation));
    },
    shapeClicked(shape) {
      dispatch(shapeClicked(shape));
    },
    noShapeClicked() {
      dispatch(noShapeClicked());
    },
    targetSelected(targetId) {
      dispatch(highlightTarget(targetId));
      dispatch(setTargetMetadataOpen(targetId));
    },
    setOSDRefs(osdRefs) {
      dispatch(setOSDRefs(osdRefs));
    },
    setSavedAnnotationRef(annotationData) {
      dispatch(setSavedAnnotationRef(annotationData));
    },
    onFirstImageLoaded() {
      dispatch(handleFirstImageLoaded());
    },
    setViewerLoading(loading, layerStates) {
      dispatch(setViewerLoading(loading, layerStates));
    },
    showAlert(alert) {
      dispatch(showAlert(alert));
    },
    hideAlert() {
      dispatch(hideAlert());
    },
    footprintSelected(footprint) {
      dispatch(setSelectedFootprint(footprint));
    },
    footprintDeselected() {
      dispatch(clearSelectedFootprint());
    },
    setDefaultZoom(zoom) {
      dispatch(setDefaultZoom(zoom));
    },
  };
};

const RenderedImageContainer = connect(mapStateToProps, mapDispatchToProps)(RenderedImagePane);

export default RenderedImageContainer;
