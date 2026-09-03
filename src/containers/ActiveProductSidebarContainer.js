import { connect } from 'react-redux';
import { setImageTab } from 'src/actions/sidebarState';
import ActiveProductSidebar from 'src/components/activeProduct/ActiveProductSidebar';

const mapStateToProps = (state) => {
  return {
    tabIndex: state.sidebarState.imageTabIndex,
    fetchingGroups: state.loading.fetchingGroups,
    groups: state.activeSearchProduct.groups,
    product: state.imageLayers.layers[0],
    overlays: state.imageLayers.layers,
    annotations: state.annotationState.annotations,
    numSourceImages: state.sourceImages.sourceImages.length,
    numAssociatedMosaics: state.associatedMosaics.associatedMosaics.length,
    preferredImageForType: state.imageLayers.preferredImageForType,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setImageTab(tabIndex) {
      dispatch(setImageTab(tabIndex));
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ActiveProductSidebar);
