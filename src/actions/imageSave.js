import { getPropFromProduct } from 'src/utils/sharedUtils';
import * as telemetry from 'src/utils/telemetryUtils';

export const exportImage = (options) => {
  return (dispatch, getState) => {
    const state = getState();
    const { config } = state;
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    const { callback, progressCallback } = options;

    // Collect telemetry metadata
    const startTime = Date.now();
    const baseImage = state.imageLayers.layers.length ? state.imageLayers.layers[0] : '';
    const filename = baseImage ? getPropFromProduct(baseImage, config.es_mappings.filename) : 'No base image';

    // setup progress callback
    const progWrapper = (data) => progressCallback(data);
    if (progressCallback) {
      osdWrapper.on('exportprogress', progWrapper);
    }

    osdWrapper
      .exportImage(options)
      .then((metadata) => {
        // clear progress wrapper
        if (progressCallback) {
          osdWrapper.off('exportprogress', progWrapper);
        }

        if (callback) {
          callback(metadata);
        }

        const exportedImageDimensions = { width: metadata.fullFrameWidth, height: metadata.fullFrameHeight };
        telemetry.imageExported(filename, options, Date.now() - startTime, exportedImageDimensions);
      })
      .catch((err) => {
        if (callback) {
          callback(false);
        }
        telemetry.logError(`Unable to export image: ${filename}.`, err);
      });

    // no need to dispatch state update
  };
};
