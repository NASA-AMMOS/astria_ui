import { connect } from 'react-redux';
import {
  startImageFeatureAnnotation,
  setImageFeatureEditorOpen,
  setActiveAnnotation,
  clearActiveAnnotation,
  setSavedAnnotationRef,
  updateAnnotation,
  removeAnnotation,
  handlePageUnload,
  setInteractionMode,
  addImageFeatureAnnotationToDisplay,
} from 'src/actions/annotationActions';
import {
  locallyUpdateAnnotation,
  locallyRemoveAnnotation,
  locallyAddAnnotation,
} from 'src/actions/activeSearchProduct';
import ImageFeatureEditor from 'src/components/ImageFeatureEditor';

const mapStateToProps = (state) => {
  return {
    username: state.app.user.username,
    selectedShapes: state.annotationState.selectedShapes,
    interactionMode: state.annotationState.interactionMode,
    imageFeatureEditorOpen: state.annotationState.imageFeatureEditorOpen,
    layers: state.imageLayers.layers,
    activeAnnotation: state.annotationState.activeAnnotation,
    osdWrapper: state.imageViewer.osdRefs.osdWrapper,
    keywords: state.search.keywords,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    updateFeature(feature) {
      dispatch(updateAnnotation(feature));
    },
    setInteractionMode(interactionMode) {
      dispatch(setInteractionMode(interactionMode));
    },
    startImageFeatureAnnotation() {
      dispatch(startImageFeatureAnnotation());
    },
    setImageFeatureEditorOpen(open) {
      dispatch(setImageFeatureEditorOpen(open));
    },
    setActiveAnnotation(activeAnnotation) {
      dispatch(setActiveAnnotation(activeAnnotation));
    },
    updateAnnotation(annotation) {
      dispatch(updateAnnotation(annotation));
    },
    locallyUpdateAnnotation(annotation) {
      dispatch(locallyUpdateAnnotation(annotation));
    },
    locallyAddAnnotation(annotation) {
      dispatch(locallyAddAnnotation(annotation));
    },
    locallyRemoveAnnotation(annotation) {
      dispatch(locallyRemoveAnnotation(annotation));
    },
    removeAnnotation(annotation, confirm) {
      dispatch(removeAnnotation(annotation, confirm));
    },
    setSavedAnnotationRef(annotationData) {
      dispatch(setSavedAnnotationRef(annotationData));
    },
    clearActiveAnnotation() {
      dispatch(clearActiveAnnotation());
    },
    onBeforeUnload(ev) {
      dispatch(handlePageUnload(ev));
    },
    addImageFeatureAnnotationToDisplay(annotation, interactable = false) {
      dispatch(addImageFeatureAnnotationToDisplay(annotation, interactable));
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ImageFeatureEditor);
