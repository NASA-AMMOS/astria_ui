import {
  addStarredMetadataField,
  clearStarredMetadataFields,
  removeStarredMetadataField,
} from 'src/actions/appActions';
import { connect } from 'react-redux';
import { setProductMetadataOpen } from '../actions/imageLayers';
import ProductMetadata from '../components/activeProduct/ProductMetadata';

const mapStateToProps = (state) => {
  return {
    product: state.imageLayers.metadataProduct,
    hasPartialMetadata: state.imageLayers.metadataProductIsPartial,
    groups: state.imageLayers.metadataProductGroups,
    cursor: state.dataCursor,
    productDescriptions: state.app.productDescriptions,
    starredMetadataFields: state.app.starredMetadataFields,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    handleDisplayProductMetadata(product) {
      dispatch(setProductMetadataOpen(product));
    },
    addStarredMetadataField(field, isVicar) {
      dispatch(addStarredMetadataField(field, isVicar));
    },
    removeStarredMetadataField(field, isVicar) {
      dispatch(removeStarredMetadataField(field, isVicar));
    },
    clearStarredMetadataFields() {
      dispatch(clearStarredMetadataFields());
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ProductMetadata);
