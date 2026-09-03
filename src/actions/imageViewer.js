import { setTargetActive } from 'src/actions/imageLayers';

export const updateViewport = (viewport, force = false, immediate = false) => {
  return (dispatch, getState) => {
    const { initialZoom, initialCenter, initialRotation } = viewport;
    let { zoom, center, rotation, imageBounds } = viewport;

    const state = getState();
    if (force) {
      const osdRefs = state.imageViewer.osdRefs;
      const { osdWrapper } = osdRefs;
      osdWrapper.setPictureZoom(zoom, center, immediate);
      if (rotation) osdWrapper.setRotation(rotation);

      const view = osdWrapper.getView();
      zoom = view.zoom;
      center = view.center;
      rotation = view.rotation;
    }

    // Remove and re-add targets, measurements, annotations?, az/el?
    // so that they are correctly rotated.
    if (rotation !== state.imageViewer.rotation) {
      const osdRefs = state.imageViewer.osdRefs;
      const { osdWrapper } = osdRefs;

      /* Handle targets */
      // Remove and re-add targets
      const existingTargets = { ...osdWrapper._targets };
      osdWrapper.clearTargets();

      for (const targetId in existingTargets) {
        const target = existingTargets[targetId];
        osdWrapper.addTarget({
          line: target.lsPoint.line,
          sample: target.lsPoint.sample,
          id: target.targetId,
          text: target.text,
          opacity: target.fabricObjs[0].opacity,
        });
      }

      // If we have a selected target, set it to be selected again
      if (state.imageLayers.selectedTarget) {
        const target = state.imageLayers.selectedTarget;
        requestAnimationFrame(() => {
          dispatch(setTargetActive(target.content.id));
        });
      }

      /* Handle measurements */
      const existingMeasurements = { ...osdWrapper._measurements };
      osdWrapper.clearMeasurements();

      for (const measureId in existingMeasurements) {
        const measurement = existingMeasurements[measureId];
        // Reload measurement values since we have to clear the measurements before
        // so if any measurements were in flight they wouldn't get updated if we just passed in
        // existing text
        osdWrapper.addMeasurement({
          lsPoint1: measurement.lsPoint1,
          lsPoint2: measurement.lsPoint2,
        });
      }
    }

    dispatch({
      type: 'UPDATE_VIEWPORT',
      zoom,
      center,
      rotation,
      imageBounds,
      initialZoom,
      initialCenter,
      initialRotation,
    });
  };
};

export const setOSDRefs = (refs) => {
  const { osdWrapper } = refs;

  return {
    type: 'SET_OSD_REFS',
    osdRefs: {
      osdWrapper,
    },
  };
};

export const resetRotation = (redrawObjects = false) => {
  return (dispatch, getState) => {
    // This reset rotation is intended to be used when changing images
    // so it will not trigger a re-rendering of various fabric items
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;
    osdWrapper.resetRotation();

    if (redrawObjects) {
      dispatch(updateViewport({ rotation: 0 }));
    } else {
      dispatch({
        type: 'UPDATE_VIEWPORT',
        rotation: 0,
      });
    }
  };
};

export const addFirstImageLoadCallback = (callback) => {
  return { type: 'ADD_FIRST_IMAGE_LOAD_CALLBACK', callback };
};

export const handleFirstImageLoaded = () => {
  return (dispatch, getState) => {
    // handle buffered callbacks
    const state = getState();
    const callbacks = state.imageViewer.firstImageLoadCallbacks;
    callbacks.forEach((callback) => {
      callback();
    });

    // update state
    dispatch({
      type: 'SET_FIRST_IMAGE_LOADED',
    });
  };
};

export const setViewerLoading = (loading, layerStates) => {
  return { type: 'SET_VIEWER_LOADING', loading, layerStates };
};

export const setDefaultZoom = (zoom = null) => {
  return { type: 'SET_DEFAULT_ZOOM', zoom };
};
