import { connect } from 'react-redux';
import AnnotationDeletionModal from '../components/AnnotationDeletionModal';
import { removeAnnotation, setAnnotationDeleteModalOpen, setAnnotationToDelete } from '../actions/annotationActions';
import { locallyRemoveAnnotation } from 'src/actions/activeSearchProduct';

const mapStateToProps = (state) => {
  return {
    annotationToDelete: state.annotationState.annotationToDelete,
    deleteModalOpen: state.annotationState.deleteModalOpen,
  };
};

const matchDispatchToProps = (dispatch) => {
  return {
    removeAnnotation(item, confirm) {
      dispatch(removeAnnotation(item, confirm));
    },
    locallyRemoveAnnotation(annotation) {
      dispatch(locallyRemoveAnnotation(annotation));
    },
    close() {
      dispatch(setAnnotationDeleteModalOpen());
      dispatch(setAnnotationToDelete());
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps)(AnnotationDeletionModal);
