import { connect } from 'react-redux';
import {
  addAnnotationToDisplay,
  editAnnotation,
  editImageFeatureAnnotation,
  hideFeatureOutline,
  removeAllAnnotations,
  removeAnnotation,
  setAnnotationDeleteModalOpen,
  setAnnotationOpacity,
  setAnnotationToDelete,
  showFeatureOutline,
  zoomToAnnotation,
  zoomToFeature,
} from 'src/actions/annotationActions';
import {
  changeOpacity,
  moveLayer,
  nextLayerAnimationFrame,
  pauseLayerAnimation,
  playLayerAnimation,
  previousLayerAnimationFrame,
  removeAllOverlays,
  removeAllTargets,
  removeLayer,
  setAnimationSpeed,
  setCustomLayerModalOpen,
  setFeatureMetadataOpen,
  setOperatorControlsProduct,
  setProductMetadataOpen,
  setTargetsOpacity,
  stopLayerAnimation,
  toggleOverlaysVisible,
} from 'src/actions/imageLayers';
import ActiveOverlays from 'src/components/activeProduct/overlays/ActiveOverlays';

const mapStateToProps = (state) => {
  return {
    user: state.app.user,
    activeProduct: state.imageLayers.layers[0],
    groups: state.activeSearchProduct.groups,
    annotations: state.annotationState.annotations,
    isCustomProduct: state.activeSearchProduct.isCustomProduct,
    fetchingInitialData: state.loading.fetchingInitialData,
    fetchingGroups: state.loading.fetchingGroups,
    overlays: state.imageLayers.layers,
    overlaysVisible: state.imageLayers.overlaysVisible,
    operatorControlsMap: state.imageLayers.operatorControlsMap,
    animationPlayerState: state.imageLayers.animationPlayerState,
    animationFrameGapMS: state.imageLayers.animationFrameGapMS,
    productDescriptions: state.app.productDescriptions,
    keywordsMap: state.search.keywordsMap,
  };
};

const matchDispatchToProps = (dispatch) => {
  return {
    handleAddCustomLayer() {
      dispatch(setCustomLayerModalOpen(true));
    },
    playLayerAnimation() {
      dispatch(playLayerAnimation());
    },
    pauseLayerAnimation() {
      dispatch(pauseLayerAnimation());
    },
    stopLayerAnimation() {
      dispatch(stopLayerAnimation());
    },
    nextLayerAnimationFrame() {
      dispatch(nextLayerAnimationFrame());
    },
    previousLayerAnimationFrame() {
      dispatch(previousLayerAnimationFrame());
    },
    setAnimationSpeed(ms) {
      dispatch(setAnimationSpeed(ms));
    },
    handleAnnotationAdd(item) {
      dispatch(addAnnotationToDisplay(item));
    },
    handleAnnotationEdit(item) {
      dispatch(editAnnotation(item));
    },
    handleAnnotationDelete(item) {
      dispatch(setAnnotationToDelete(item));
      dispatch(setAnnotationDeleteModalOpen(true));
    },
    handleAnnotationChangeOpacity(item, opacity) {
      dispatch(setAnnotationOpacity(item, opacity));
    },
    handleAnnotationRemove(item) {
      dispatch(removeAnnotation(item));
    },
    handleRemoveAllAnnotations() {
      dispatch(removeAllAnnotations());
    },
    handleZoomToAnnotation(annotation) {
      dispatch(zoomToAnnotation(annotation));
    },
    handleZoomToFeature(feature) {
      dispatch(zoomToFeature(feature));
    },
    handleFeatureEdit(feature) {
      dispatch(editImageFeatureAnnotation(feature));
    },
    handleRemoveAllTargets(targets) {
      dispatch(removeAllTargets(targets));
    },
    handleTargetsChangeOpacity(targets, opacity) {
      dispatch(setTargetsOpacity(targets, opacity));
    },
    handleOverlayRemove(item) {
      dispatch(removeLayer(item));
    },
    handleRemoveAllOverlays() {
      dispatch(removeAllOverlays());
    },
    handleOverlayChangeOpacity(item, opacity) {
      dispatch(changeOpacity(item, opacity));
    },
    handleToggleOverlaysVisible(visible) {
      dispatch(toggleOverlaysVisible(visible));
    },
    handleOverlayMove(item, currIndex, newIndex) {
      dispatch(moveLayer(item, currIndex, newIndex));
    },
    handleDisplayProductMetadata(product, fetchMetadata) {
      dispatch(setProductMetadataOpen(product, fetchMetadata));
    },
    handleSetFeatureMetadataOpen(feature) {
      dispatch(setFeatureMetadataOpen(feature));
    },
    setOperatorControlsProduct(product) {
      dispatch(setOperatorControlsProduct(product));
    },
    showFeatureOutline(feature) {
      dispatch(showFeatureOutline(feature));
    },
    hideFeatureOutline(feature) {
      dispatch(hideFeatureOutline(feature));
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps)(ActiveOverlays);
