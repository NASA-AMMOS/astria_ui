import { connect } from 'react-redux';
import {
  setInteractionMode,
  setAnnotationEditorOpen,
  setActiveAnnotation,
  clearActiveAnnotation,
  setSavedAnnotationRef,
  updateAnnotation,
  removeAnnotation,
  handlePageUnload,
} from '../actions/annotationActions';
import AnnotationEditor from '../components/AnnotationEditor';
import { locallyUpdateAnnotation, locallyRemoveAnnotation, locallyAddAnnotation } from '../actions/activeSearchProduct';
import { exportImage } from 'src/actions/imageSave';

const mapStateToProps = (state) => {
  return {
    username: state.app.user.username,
    selectedShapes: state.annotationState.selectedShapes,
    interactionMode: state.annotationState.interactionMode,
    annotationEditorOpen: state.annotationState.annotationEditorOpen,
    layers: state.imageLayers.layers,
    activeAnnotation: state.annotationState.activeAnnotation,
    osdWrapper: state.imageViewer.osdRefs.osdWrapper,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setInteractionMode(interactionMode) {
      dispatch(setInteractionMode(interactionMode));
    },
    setAnnotationEditorOpen(open) {
      dispatch(setAnnotationEditorOpen(open));
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
    exportImage(options) {
      dispatch(exportImage(options));
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(AnnotationEditor);
