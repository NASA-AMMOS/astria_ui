import { connect } from 'react-redux';
import {
  addLayer,
  changeOpacity,
  removeLayer,
  setOperatorControlsProduct,
  setProductMetadataOpen,
  togglePreserveRDRs,
} from 'src/actions/imageLayers';
import ImageOverlays from 'src/components/activeProduct/overlays/ImageOverlays';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import * as telemetry from 'src/utils/telemetryUtils';

import { getConfig } from 'src/utils/configRegistry';
const mapStateToProps = (state) => {
  const config = getConfig();
  return {
    activeProductOverlayID: getPropFromProduct(state.imageLayers.layers[0], config.es_mappings.overlay_id, null),
    activeProductSpecFlag: getPropFromProduct(state.imageLayers.layers[0], config.es_mappings.spec_flag, null),
    imageBounds: state.imageViewer.imageBounds,
    preserveRDRs: state.imageLayers.preserveRDRs,
    operatorControlsMap: state.imageLayers.operatorControlsMap,
    productDescriptions: state.app.productDescriptions,
    layers: state.imageLayers.layers,
    groups: state.activeSearchProduct.groups,
    preferredImageForType: state.imageLayers.preferredImageForType,
  };
};

const matchDispatchToProps = (dispatch) => {
  return {
    handleOverlayAdd(item) {
      const config = getConfig();
      dispatch(addLayer(item, item.opacity));
      const filename = getPropFromProduct(item, config.es_mappings.filename);
      const instrument = getPropFromProduct(item, config.es_mappings.instrument_id);
      const productType = getPropFromProduct(item, config.es_mappings.product_type);
      telemetry.rdrOverlayAdded(filename, instrument, productType);
    },
    handleOverlayRemove(item) {
      dispatch(removeLayer(item));
    },
    handleDisplayProductMetadata(product) {
      dispatch(setProductMetadataOpen(product));
    },
    handleTogglePreserveRDRs() {
      dispatch(togglePreserveRDRs());
    },
    setOperatorControlsProduct(product) {
      dispatch(setOperatorControlsProduct(product));
    },
    handleOverlayChangeOpacity(item, opacity) {
      dispatch(changeOpacity(item, opacity));
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps)(ImageOverlays);
