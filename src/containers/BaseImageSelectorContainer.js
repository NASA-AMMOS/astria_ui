import { connect } from 'react-redux';
import BaseImageSelector from '../components/activeProduct/BaseImageSelector';
import { setBaseLayer } from '../actions/imageLayers';

const mapStateToProps = (state) => {
  return {
    groups: state.activeSearchProduct.groups,
    activeProduct: state.imageLayers.layers[0],
    isCustomProduct: state.activeSearchProduct.isCustomProduct,
    fetchingGroups: state.loading.fetchingGroups,
  };
};

const matchDispatchToProps = (dispatch) => {
  return {
    setBaseLayer(item) {
      dispatch(setBaseLayer(item));
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps)(BaseImageSelector);
