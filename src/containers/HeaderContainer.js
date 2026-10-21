import { connect } from 'react-redux';
import { hideAlert, showAlert } from 'src/actions/alertActions';
import {
  clearMeasurements,
  setActiveAnnotation,
  setAnnotationEditorOpen,
  setInteractionMode,
} from 'src/actions/annotationActions';
import { openHelpArticle, setHelpOpen } from 'src/actions/helpActions';
import { exportImage } from 'src/actions/imageSave';
import { performSearch, setPackage } from 'src/actions/searchActions';
import Header from 'src/components/Header';
import { populateSearchValues } from '../actions/activeSearchProduct';
import { clearBrowseValues, clearFacetSearchValues } from '../actions/searchActions';
import { getPropFromProduct } from '../utils/sharedUtils';

import { getConfig } from 'src/utils/configRegistry';
const mapStateToProps = (state) => {
  const config = getConfig();
  return {
    activeSearchProductId: getPropFromProduct(state.activeSearchProduct.searchProduct, config.es_mappings.id),
    imageHistory: state.activeSearchProduct.imageHistory,
    baseImage: state.imageLayers.layers[0],
    groups: state.activeSearchProduct.groups,
    fetchingGroups: state.loading.fetchingGroups,
    annotationEditorOpen: state.annotationState.annotationEditorOpen,
    imageFeatureEditorOpen: state.annotationState.imageFeatureEditorOpen,
    interactionMode: state.annotationState.interactionMode,
    ocsPackages: state.search.ocsPackages,
    osdWrapper: state.imageViewer.osdRefs.osdWrapper,
    helpOpen: state.help.open,
    facetSearchValues: state.search.facetSearchValues,
    browseSearchValues: state.search.browseValues,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    clearMeasurements() {
      dispatch(clearMeasurements());
    },
    exportImage(options) {
      dispatch(exportImage(options));
    },
    setInteractionMode(interactionMode) {
      dispatch(setInteractionMode(interactionMode));
    },
    setAnnotationEditorOpen(open) {
      dispatch(setAnnotationEditorOpen(open));
    },
    setPackage(ocsPackage) {
      dispatch(setPackage(ocsPackage));
    },
    setHelpOpen(open) {
      dispatch(setHelpOpen(open));
    },
    openHelpArticle(key) {
      dispatch(openHelpArticle(key));
    },
    clearAndPopulateSearchValues(search) {
      dispatch(clearFacetSearchValues());
      dispatch(clearBrowseValues());
      dispatch(populateSearchValues(search));
      dispatch(performSearch());
    },
    showAlert(title = 'Error', message = 'An error has occurred.') {
      dispatch(
        showAlert({
          title,
          message,
          primaryAction: hideAlert,
        })
      );
    },
    newImageFeature() {
      dispatch(setActiveAnnotation({}, false, true));
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Header);
