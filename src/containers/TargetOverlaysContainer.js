import { connect } from 'react-redux';
import TargetOverlays from 'src/components/activeProduct/overlays/TargetOverlays';
import {
  addTargetLayer,
  removeTargetLayer,
  setTargetMetadataOpen,
  zoomToTarget,
  highlightTarget,
  unhighlightTarget,
  togglePreserveTargets,
} from 'src/actions/imageLayers';
import { openHelpArticle } from 'src/actions/helpActions';

const mapStateToProps = (state) => {
  return {
    activeProduct: state.imageLayers.layers[0],
    preserveTargets: state.imageLayers.preserveTargets,
    layers: state.imageLayers.layers,
    groups: state.activeSearchProduct.groups,
    fetchingTargets: state.targets.fetchingTargets,
  };
};

const matchDispatchToProps = (dispatch) => {
  return {
    handleAddTarget(item, opacity) {
      dispatch(addTargetLayer(item, true, opacity)); // add all targets and force them to be visible
    },
    handleRemoveTarget(item) {
      dispatch(removeTargetLayer(item));
    },
    setTargetMetadataOpen(target) {
      dispatch(setTargetMetadataOpen(target));
    },
    zoomToTarget(targetId) {
      dispatch(zoomToTarget(targetId));
    },
    highlightTarget(targetId) {
      dispatch(highlightTarget(targetId));
    },
    unhighlightTarget(targetId) {
      dispatch(unhighlightTarget(targetId));
    },
    handleTogglePreserveTargets() {
      dispatch(togglePreserveTargets());
    },
    openHelpArticle(key) {
      dispatch(openHelpArticle(key));
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps)(TargetOverlays);
