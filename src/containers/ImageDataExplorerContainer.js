import { connect } from 'react-redux';
import ImageDataExplorer from '../components/activeProduct/ImageDataExplorer';
import { clearDataCursor } from '../actions/dataCursor';
import { toggleAutoAddRDRs } from '../actions/imageLayers';

const mapStateToProps = (state) => {
  return {
    cursor: state.dataCursor,
    ocsPackages: state.search.ocsPackages,
    activeOverlays: state.imageLayers.layers,
    autoAddRDRs: state.dataExplorerState.autoAddRDRs,
    preferredImageForType: state.imageLayers.preferredImageForType,
  };
};

const matchDispatchToProps = (dispatch) => {
  return {
    clearDataCursor() {
      dispatch(clearDataCursor());
    },
    handleToggleAutoAddRDRs() {
      dispatch(toggleAutoAddRDRs());
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps)(ImageDataExplorer);
