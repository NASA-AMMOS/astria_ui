import { connect } from 'react-redux';
import { RelatedImages } from '../components/activeProduct/RelatedImages';

const mapStateToProps = (state) => {
  return {
    fetchingInitialData: state.loading.fetchingInitialData,
    isCustomProduct: state.activeSearchProduct.isCustomProduct,
    fetchingGroups: state.loading.fetchingGroups,
    groups: state.activeSearchProduct.groups,
    sourceImages: state.sourceImages.sourceImages,
    associatedMosaics: state.associatedMosaics.associatedMosaics,
    cursor: state.dataCursor,
    overlays: state.imageLayers.layers,
    fetchingSourceImages: state.sourceImages.fetchingSourceImages,
    fetchingSourceImageFootprints: state.sourceImages.fetchingSourceImageFootprints,
    fetchingAssociatedMosaics: state.associatedMosaics.fetchingAssociatedMosaics,
  };
};

export default connect(mapStateToProps, null)(RelatedImages);
