import { connect } from 'react-redux';
import AnnotationOverlays from 'src/components/activeProduct/overlays/AnnotationOverlays';
import {
  setActiveAnnotation,
  addAnnotationToDisplay,
  removeAnnotation,
  editAnnotation,
  setAnnotationOpacity,
  zoomToAnnotation,
  setAnnotationDeleteModalOpen,
  setAnnotationToDelete,
} from 'src/actions/annotationActions';
import { resetRotation } from 'src/actions/imageViewer';
import { locallyRemoveAnnotation } from 'src/actions/activeSearchProduct';

const mapStateToProps = (state) => {
  return {
    user: state.app.user,
    groups: state.activeSearchProduct.groups,
    allActiveAnnotations: state.annotationState.annotations,
    // deletingAnnotation: state.annotationState.deletingAnnotation,
    // deletionSuccess: state.annotationState.deletionSuccess,
    // deletionAttempted: state.annotationState.deletionAttempted,
    // isDeleteModalOpen: state.annotationState.isDeleteModalOpen,
  };
};

const matchDispatchToProps = (dispatch) => {
  return {
    handleAnnotationAdd(item) {
      dispatch(resetRotation(true));
      dispatch(addAnnotationToDisplay(item));
    },
    handleAnnotationDelete(item) {
      dispatch(setAnnotationToDelete(item));
      dispatch(setAnnotationDeleteModalOpen(true));
    },
    locallyRemoveAnnotation(annotation) {
      dispatch(locallyRemoveAnnotation(annotation));
    },
    handleAnnotationRemove(item) {
      dispatch(removeAnnotation(item));
    },
    handleAnnotationEdit(item) {
      dispatch(editAnnotation(item));
    },
    newAnnotation() {
      dispatch(setActiveAnnotation({}, true));
    },
    handleAnnotationChangeOpacity(item, opacity) {
      dispatch(setAnnotationOpacity(item, opacity));
    },
    handleZoomToAnnotation(annotation) {
      dispatch(zoomToAnnotation(annotation));
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps)(AnnotationOverlays);
