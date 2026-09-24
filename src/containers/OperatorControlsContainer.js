import { connect } from 'react-redux';
import {
  resetOperatorControlsForProduct,
  selectNewRDRVersion,
  setOperatorControlsForProduct,
  setOperatorControlsProduct,
} from 'src/actions/imageLayers';
import OperatorControls from 'src/components/activeProduct/OperatorControls';
import { getPropFromProduct } from 'src/utils/sharedUtils';

import { getConfig } from 'src/utils/configRegistry';
const mapStateToProps = (state) => {
  const config = getConfig();
  return {
    product: state.imageLayers.operatorControlsProduct
      ? state.imageLayers.layers.find(
          (l) => getPropFromProduct(l, config.es_mappings.id) === state.imageLayers.operatorControlsProduct
        )
      : null,
    operatorControlsMap: state.imageLayers.operatorControlsMap,
    productDescriptions: state.app.productDescriptions,
    groups: state.activeSearchProduct.groups,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setOperatorControlsProduct(product) {
      dispatch(setOperatorControlsProduct(product));
    },
    setOperatorControlsForProduct(product, controlOptions, queryStrings) {
      dispatch(setOperatorControlsForProduct(product, controlOptions, queryStrings));
    },
    resetOperatorControlsForProduct(product) {
      dispatch(resetOperatorControlsForProduct(product));
    },
    selectNewRDRVersion(oldProduct, newProduct) {
      dispatch(selectNewRDRVersion(oldProduct, newProduct));
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(OperatorControls);
