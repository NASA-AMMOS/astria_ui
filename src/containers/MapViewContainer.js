import { connect } from 'react-redux';
import { MapView } from 'src/components/activeProduct/MapView';
import { clearDataCursor, setDataCursorExternally } from 'src/actions/dataCursor';
import { setTargetMetadataOpen } from 'src/actions/imageLayers';

const mapStateToProps = (state) => {
  return {
    ocsPackages: state.search.ocsPackages,
    fetchingInitialData: state.loading.fetchingInitialData,
    isCustomProduct: state.activeSearchProduct.isCustomProduct,
    product: state.imageLayers.layers[0],
    cursor: state.dataCursor,
    fetchingGroups: state.loading.fetchingGroups,
    hasPartialMetadata: state.activeSearchProduct.hasPartialMetadata,
    groups: state.activeSearchProduct.groups,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setDataCursorExternally(options) {
      dispatch(setDataCursorExternally(options));
    },
    clearDataCursor() {
      dispatch(clearDataCursor());
    },
    setTargetMetadataOpen(target) {
      dispatch(setTargetMetadataOpen(target));
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps, null, { forwardRef: true })(MapView);
