import { connect } from 'react-redux';
import { setTargetMetadataOpen, zoomToTarget } from 'src/actions/imageLayers';
import SelectedTargetMetadata from 'src/components/activeProduct/SelectedTargetMetadata';

const mapStateToProps = (state) => {
  return {
    selectedTarget: state.imageLayers.selectedTarget,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setTargetMetadataOpen(target) {
      dispatch(setTargetMetadataOpen(target));
    },
    zoomToTarget(targetId) {
      dispatch(zoomToTarget(targetId));
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(SelectedTargetMetadata);
