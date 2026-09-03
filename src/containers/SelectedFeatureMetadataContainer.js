import { connect } from 'react-redux';
import { setFeatureMetadataOpen } from 'src/actions/imageLayers';
import { zoomToFeature } from 'src/actions/annotationActions';
import SelectedFeatureMetadata from 'src/components/activeProduct/SelectedFeatureMetadata';

const mapStateToProps = (state) => {
  return {
    selectedFeature: state.imageLayers.selectedFeature,
    keywordsMap: state.search.keywordsMap,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setFeatureMetadataOpen(feature) {
      dispatch(setFeatureMetadataOpen(feature));
    },
    zoomToFeature(feature) {
      dispatch(zoomToFeature(feature));
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(SelectedFeatureMetadata);
