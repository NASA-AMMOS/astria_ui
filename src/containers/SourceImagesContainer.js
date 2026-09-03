import { connect } from 'react-redux';
import SourceImages from 'src/components/activeProduct/SourceImages';
import {
  addLayer,
  clearSelectedFootprint,
  hideSourceImageFootprints,
  highlightFootprint,
  removeLayer,
  setSourceImageFootprintsFilter,
  showSourceImageFootprints,
  unhighlightFootprint,
  zoomToFootprint,
} from 'src/actions/imageLayers';
import { openHelpArticle } from 'src/actions/helpActions';
import { setActiveSearchProduct } from 'src/actions/activeSearchProduct';
import { clearDataCursor } from 'src/actions/dataCursor';

const mapStateToProps = (state) => {
  return {
    overlays: state.imageLayers.layers,
    ocsPackages: state.search.ocsPackages,
    preferredImageForType: state.imageLayers.preferredImageForType,
    showFootprints: state.imageLayers.showSourceImageFootprints,
    sourceImageFootprintsFilter: state.imageLayers.sourceImageFootprintsFilter,
    sourceImageFootprints: state.sourceImages.sourceImageFootprints,
    selectedFootprint: state.imageLayers.selectedFootprint,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    addOverlay(item, opacity) {
      dispatch(addLayer(item, opacity));
    },
    removeOverlay(item) {
      dispatch(removeLayer(item));
    },
    showSourceImageFootprints() {
      dispatch(showSourceImageFootprints());
    },
    hideSourceImageFootprints() {
      dispatch(hideSourceImageFootprints());
    },
    setSourceImageFootprintsFilter(filter) {
      dispatch(setSourceImageFootprintsFilter(filter));
    },
    openHelpArticle(key) {
      dispatch(openHelpArticle(key));
    },
    setActiveSearchProduct(item) {
      dispatch(setActiveSearchProduct(item, true, true));
    },
    highlightFootprint(id) {
      dispatch(highlightFootprint(id));
    },
    unhighlightFootprint(id) {
      dispatch(unhighlightFootprint(id));
    },
    zoomToFootprint(id) {
      dispatch(zoomToFootprint(id));
    },
    clearSelectedFootprint(footprint) {
      dispatch(clearSelectedFootprint(footprint));
    },
    removeDataCursor() {
      dispatch(clearDataCursor());
    },
  };
};

const SourceImagesContainer = connect(mapStateToProps, mapDispatchToProps)(SourceImages);

export default SourceImagesContainer;
