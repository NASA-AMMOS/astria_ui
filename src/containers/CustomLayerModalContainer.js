import { connect } from 'react-redux';
import CustomLayerModal from '../components/CustomLayerModal';
import { addLayer, setCustomLayerModalOpen } from 'src/actions/imageLayers';

const mapStateToProps = (state) => {
  return {
    customLayerModalOpen: state.imageLayers.customLayerModalOpen,
    groups: state.activeSearchProduct.groups,
    ocsPackages: state.search.ocsPackages,
  };
};

const matchDispatchToProps = (dispatch) => {
  return {
    addLayer(item) {
      dispatch(addLayer(item));
    },
    close() {
      dispatch(setCustomLayerModalOpen(false));
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps)(CustomLayerModal);
