import { connect } from 'react-redux';
import FeatureOverlays from 'src/components/activeProduct/overlays/FeatureOverlays';
import {
  setImageFeatureEditorOpen,
  addImageFeatureAnnotationToDisplay,
  removeAnnotation,
  editImageFeatureAnnotation,
  setAnnotationOpacity,
  setActiveAnnotation,
  zoomToFeature,
  toggleAutoShowImageFeatures,
  showFeatureOutline,
  hideFeatureOutline,
} from 'src/actions/annotationActions';
import { setFeatureMetadataOpen } from 'src/actions/imageLayers';
import { resetRotation } from 'src/actions/imageViewer';

const mapStateToProps = (state) => {
  return {
    user: state.app.user,
    groups: state.activeSearchProduct.groups,
    keywordsMap: state.search.keywordsMap,
    autoShowImageFeatures: state.imageLayers.autoShowImageFeatures,
    allActiveAnnotations: state.annotationState.annotations,
  };
};

const matchDispatchToProps = (dispatch) => {
  return {
    handleAutoShowImageFeatures() {
      dispatch(toggleAutoShowImageFeatures());
    },
    handleFeatureAdd(item) {
      dispatch(resetRotation(true));
      dispatch(addImageFeatureAnnotationToDisplay(item));
    },
    handleFeatureRemove(item) {
      dispatch(removeAnnotation(item));
    },
    handleFeatureEdit(item) {
      dispatch(editImageFeatureAnnotation(item));
    },
    setImageFeatureEditorOpen(open) {
      dispatch(setImageFeatureEditorOpen(open));
    },
    newFeature() {
      dispatch(setActiveAnnotation({}, false, true));
    },
    handleFeatureChangeOpacity(item, opacity) {
      dispatch(setAnnotationOpacity(item, opacity));
    },
    setFeatureMetadataOpen(feature) {
      dispatch(setFeatureMetadataOpen(feature));
    },
    handleZoomToFeature(feature) {
      dispatch(zoomToFeature(feature));
    },
    showFeatureOutline(feature) {
      dispatch(showFeatureOutline(feature));
    },
    hideFeatureOutline(feature) {
      dispatch(hideFeatureOutline(feature));
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps)(FeatureOverlays);
