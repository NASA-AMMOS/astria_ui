import { connect } from 'react-redux';

import {
  backendStretchBaseImage,
  toggleResetStretch,
  updateImageStretch,
  updatePercentStretch,
  updateStretchMode,
} from '../actions/imageStretch';
import ImageStretch from '../components/activeProduct/ImageStretch';

const mapStateToProps = (state) => {
  return {
    stretchMin: state.imageAdjustments.stretchMin,
    stretchMax: state.imageAdjustments.stretchMax,
    histogram: state.imageAdjustments.histogram,
    resetStretch: state.imageAdjustments.resetStretch,
    stretchLow: state.imageAdjustments.stretchLow,
    stretchHigh: state.imageAdjustments.stretchHigh,
    percentLow: state.imageAdjustments.percentLow,
    percentHigh: state.imageAdjustments.percentHigh,
    percentMin: state.imageAdjustments.percentMin,
    percentMax: state.imageAdjustments.percentMax,
    histogramLow: state.imageAdjustments.histogramLow,
    histogramHigh: state.imageAdjustments.histogramHigh,
    stretchBackend: state.imageAdjustments.stretchMode,
    baseImage: state.imageLayers.layers[0],
    isCustomProduct: state.activeSearchProduct.isCustomProduct,
    isAnnotatableProduct: state.activeSearchProduct.isAnnotatableProduct,
    loading: state.imageAdjustments.loading,
    fetchingInitialData: state.loading.fetchingInitialData,
    extrema: state.imageAdjustments.extrema,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    onImageStretch(stretchMin, stretchMax) {
      dispatch(updateImageStretch(stretchMin, stretchMax));
    },
    onPercentStretch(stretchMin, stretchMax) {
      dispatch(updatePercentStretch(stretchMin, stretchMax));
    },
    onToggleResetStretch() {
      dispatch(toggleResetStretch());
    },
    onUpdateStretchMode(stretchMode) {
      dispatch(updateStretchMode(stretchMode));
    },
    onDispatchStretch(isDNStretch, low, high) {
      dispatch(backendStretchBaseImage(isDNStretch, low, high));
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ImageStretch);
