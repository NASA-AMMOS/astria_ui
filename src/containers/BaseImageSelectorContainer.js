import { connect } from 'react-redux';
import { setBaseLayer } from '../actions/imageLayers';
import BaseImageSelector from '../components/activeProduct/BaseImageSelector';

const mapStateToProps = (state) => {
  return {
    groups: state.activeSearchProduct.groups,
    activeProduct: state.imageLayers.layers[0],
    isCustomProduct: state.activeSearchProduct.isCustomProduct,
    fetchingGroups: state.loading.fetchingGroups,
    imageConfigDescriptions: state.app.imageConfigDescriptions,
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
