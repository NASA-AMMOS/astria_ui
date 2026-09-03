import { connect } from 'react-redux';
import ImageFinder from 'src/components/activeProduct/ImageFinder';
import { addLayer, removeLayer } from 'src/actions/imageLayers';
import { setDataCursor, setDataCursorExternally } from 'src/actions/dataCursor';
import { openHelpArticle } from 'src/actions/helpActions';
import { setActiveSearchProduct } from 'src/actions/activeSearchProduct';

const mapStateToProps = (state) => {
  return {
    overlays: state.imageLayers.layers,
    ocsPackages: state.search.ocsPackages,
    fetchingGroups: state.loading.fetchingGroups,
    osdWrapper: state.imageViewer.osdRefs.osdWrapper,
    preferredImageForType: state.imageLayers.preferredImageForType,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    addDataCursor(product, sample, line) {
      dispatch(setDataCursorExternally({ active: true, product, line, sample, cursorOrigin: 'IMAGE' }));
    },
    addOverlay(item, opacity) {
      dispatch(addLayer(item, opacity));
    },
    removeOverlay(item) {
      dispatch(removeLayer(item));
    },
    openHelpArticle(key) {
      dispatch(openHelpArticle(key));
    },
    setActiveSearchProduct(item) {
      dispatch(setActiveSearchProduct(item, true, true));
    },
    setDataCursor(options) {
      dispatch(setDataCursor(options));
    },
  };
};

const ImageFinderContainer = connect(mapStateToProps, mapDispatchToProps)(ImageFinder);

export default ImageFinderContainer;
