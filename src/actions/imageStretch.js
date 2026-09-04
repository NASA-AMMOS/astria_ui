import { pdsGetS3PathForImage } from 'src/utils/endpoints';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import * as telemetry from 'src/utils/telemetryUtils';
import { buildImageHistogramURL } from '../utils/osd/osdUtils';

export const fetchImageHistogram = (product) => {
  return async (dispatch, getState) => {
    const state = getState();
    const { config } = state;
    // Clear out old histogram
    dispatch({
      type: 'SET_IMAGE_STRETCH_METADATA',
      histogram: [],
      DNStretchHigh: null,
      DNStretchLow: null,
      histogramLow: null,
      histogramHigh: null,
      percentLow: null,
      percentHigh: null,
      loading: true,
    });

    // Fetch new histogram
    let metadata = {};
    try {
      // TODO fetch this url once during active image load
      if (config.data_provider_type === 'pds' && !product._pdsURL) {
        // const url = await pdsFetchDownloadPath(product);
        product._pdsURL = pdsGetS3PathForImage(product);
      }
      const res = await fetch(buildImageHistogramURL(product), {
        credentials: 'include',
      });
      metadata = await res.json();
    } catch (err) {
      const productId = getPropFromProduct(product, config.es_mappings.id);
      telemetry.logError(`Unable to fetch histogram metadata for product: ${productId}`, err);
      console.warn(product);
    }
    dispatch({
      type: 'SET_IMAGE_STRETCH_METADATA',
      histogram: metadata.histogram,
      DNStretchHigh: metadata.stretch_high,
      DNStretchLow: metadata.stretch_low,
      histogramLow: metadata.histogram_low_inclusive,
      histogramHigh: metadata.histogram_high_exclusive,
      percentLow: metadata.stretch_low_percent,
      percentHigh: metadata.stretch_high_percent ? 100 - metadata.stretch_high_percent : metadata.stretch_high_percent,
      loading: false,
    });

    if (state.imageAdjustments.stretchMode === 'backend' && state.imageAdjustments.resetStretch) {
      dispatch(updatePercentStretch(state.imageAdjustments.percentLow, state.imageAdjustments.percentHigh));
      dispatch(updateImageStretch(state.imageAdjustments.DNStretchLow, state.imageAdjustments.DNStretchHigh));
      dispatch(updateStretchMode('backend'));
    }
  };
};

export const updateImageStretch = (stretchMin, stretchMax) => {
  return (dispatch, getState) => {
    dispatch({
      type: 'UPDATE_IMAGE_STRETCH',
      stretchMin,
      stretchMax,
    });

    const state = getState();

    // only reset world for local stretch since backend doesn't stretch until requested
    if (state.imageAdjustments.stretchMode === 'local') {
      const osdRefs = state.imageViewer.osdRefs;
      const { osdWrapper } = osdRefs;

      osdWrapper.resetWorld();
    }
  };
};

export const updatePercentStretch = (stretchMin, stretchMax) => {
  return {
    type: 'UPDATE_PERCENT_STRETCH',
    percentMin: stretchMin,
    percentMax: stretchMax,
  };
};

// Restore image stretch to it's bounds
export const resetImageStretch = () => {
  return (dispatch, getState) => {
    const state = getState();

    dispatch(updatePercentStretch(state.imageAdjustments.percentLow, state.imageAdjustments.percentHigh));

    dispatch({
      type: 'UPDATE_IMAGE_STRETCH',
      stretchMin: state.imageAdjustments.stretchLow,
      stretchMax: state.imageAdjustments.stretchHigh,
    });

    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    osdWrapper.resetWorld();
  };
};

export const toggleResetStretch = () => {
  return {
    type: 'TOGGLE_RESET_STRETCH',
  };
};

export const updateStretchMode = (stretchMode) => {
  return (dispatch, getState) => {
    const state = getState();
    let stretchLow = 0;
    let stretchHigh = 255;

    if (stretchMode === 'backend') {
      stretchLow = state.imageAdjustments.DNStretchLow;
      stretchHigh = state.imageAdjustments.DNStretchHigh;
      dispatch(updatePercentStretch(state.imageAdjustments.percentLow, state.imageAdjustments.percentHigh));
    }

    // update mode and bounds. reset stretch vals to the bounds
    // don't need to modify percent as it only applies to one mode
    dispatch({
      type: 'UPDATE_STRETCH_MODE',
      stretchMode: stretchMode,
      stretchLow: stretchLow,
      stretchHigh: stretchHigh,
      stretchMin: stretchLow,
      stretchMax: stretchHigh,
    });

    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;
    osdWrapper.resetWorld();

    // restore the image back to the unstretched image
    if (stretchMode === 'local') {
      dispatch(backendStretchBaseImage(true, state.imageAdjustments.stretchMin, state.imageAdjustments.stretchMax));
    }
  };
};

export const backendStretchBaseImage = (isDNStretch, low, high) => {
  return (dispatch, getState) => {
    const { config } = getState();
    dispatch({
      type: 'UPDATE_EXTREMA',
      extrema: isDNStretch,
    });

    // Percent values are both in terms of stretch from the bounds
    if (!isDNStretch) {
      high = 100 - high;
    }

    const state = getState();
    const layers = state.imageLayers.layers;
    if (layers.length > 0) {
      const osdRefs = state.imageViewer.osdRefs;
      const { osdWrapper } = osdRefs;

      // removing and adding the same layer to recreate the tile source with a different url
      const baseLayer = layers[0];
      osdWrapper.removeLayer(getPropFromProduct(baseLayer, config.es_mappings.id));
      osdWrapper.addLayer({
        layer: baseLayer,
        index: 0,
        replace: false,
        type: 'tile',
        stretchMode: state.imageAdjustments.stretchMode,
        isDNStretch: isDNStretch,
        stretchLow: low,
        stretchHigh: high,
      });
    }
  };
};
