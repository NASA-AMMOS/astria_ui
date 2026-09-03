import { connect } from 'react-redux';
import { ProductDetails } from 'src/components/activeProduct/ProductDetails';
import {
  addStarredMetadataField,
  clearStarredMetadataFields,
  removeStarredMetadataField,
} from 'src/actions/appActions';
import { setActiveSearchProduct } from 'src/actions/activeSearchProduct';

const mapStateToProps = (state) => {
  return {
    fetchingInitialData: state.loading.fetchingInitialData,
    isCustomProduct: state.activeSearchProduct.isCustomProduct,
    product: state.imageLayers.layers[0],
    fresherProduct: state.activeSearchProduct.fresherProduct,
    fetchingGroups: state.loading.fetchingGroups,
    hasPartialMetadata: state.activeSearchProduct.hasPartialMetadata,
    groups: state.activeSearchProduct.groups,
    campaigns: state.search.campaigns,
    productDescriptions: state.app.productDescriptions,
    starredMetadataFields: state.app.starredMetadataFields,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    addStarredMetadataField(field, isVicar) {
      dispatch(addStarredMetadataField(field, isVicar));
    },
    removeStarredMetadataField(field, isVicar) {
      dispatch(removeStarredMetadataField(field, isVicar));
    },
    clearStarredMetadataFields() {
      dispatch(clearStarredMetadataFields());
    },
    setActiveSearchProduct(item) {
      dispatch(setActiveSearchProduct(item));
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ProductDetails);
