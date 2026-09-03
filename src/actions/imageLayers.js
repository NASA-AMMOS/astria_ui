import { clearDisplayState } from 'src/actions/activeSearchProduct';
import { hideAlert, showAlert } from 'src/actions/alertActions';
import {
  addImageFeatureAnnotationToDisplay,
  confirmDiscardAction,
  setAnnotationOpacity,
} from 'src/actions/annotationActions';
import { setDataCursor } from 'src/actions/dataCursor';
import { backendStretchBaseImage, fetchImageHistogram, resetImageStretch } from 'src/actions/imageStretch';
import { resetRotation } from 'src/actions/imageViewer';
import {
  getIDForLayer,
  isAnnotatableProduct,
  isFeature,
  isOSDViewableFileType,
  isTarget,
  openSupportEmail,
} from 'src/utils';
import {
  fetchESDataForProduct,
  fetchFreshestProduct,
  fetchProductGroupItems,
  getAssociatedMosaicsForImage,
  getLatestVersionsByType,
  getSourceImageFootprintsForImage,
  getSourceProductsForImage,
  getTargetsForImage,
} from 'src/utils/dataQuery';
import { getNormalizeImageLabel } from 'src/utils/labels';
import * as telemetry from 'src/utils/telemetryUtils';
import { getPropFromProduct } from '../utils/sharedUtils';

import config from 'config.js';
let metadataController = null;
let animationTimeout = null;

export const incrementDisplayState = () => {
  return { type: 'INCREMENT_DISPLAY_STATE' };
};

export const setBaseLayer = (
  newBaseLayer,
  fetchAdditional = true,
  beforeFetchAdditional = () => {},
  normalizeLabel = true
) => {
  return (dispatch, getState) => {
    return new Promise(async (resolve) => {
      // pull relevant state
      let state = getState();
      let currLayers = state.imageLayers.layers;
      const currentAnnotation = state.annotationState.activeAnnotation;
      const preserveOverlays = state.imageLayers.preserveRDRs;
      const preserveActiveTargets = state.imageLayers.preserveTargets;
      const autoShowImageFeatures = state.imageLayers.autoShowImageFeatures;
      const showSourceFootprints = state.imageLayers.showSourceImageFootprints;
      const baseLayerHasSameOverlayID =
        currLayers.length > 0
          ? getPropFromProduct(currLayers[0], config.es_mappings.overlay_id) ===
            getPropFromProduct(newBaseLayer, config.es_mappings.overlay_id)
          : false;

      // wrapper for dealing with annotations
      const handleBaseLayer = async () => {
        if (baseLayerHasSameOverlayID) {
          // If the base layer is loaded as a custom overlay we can remove it to prevent layer confusion downstream
          const matchingCustomBaseLayer =
            currLayers.length > 0
              ? currLayers.find(
                  (l) =>
                    getPropFromProduct(l, config.es_mappings.id) ===
                      getPropFromProduct(newBaseLayer, config.es_mappings.id) && l._isCustom
                )
              : false;

          if (matchingCustomBaseLayer) dispatch(removeLayer(matchingCustomBaseLayer));

          // If the base image has the same overlay ID
          // we won't clear display state. Instead we'll remove the current base image
          // and replace it with new base layer and move it to the front of the list.
          // dispatch(removeLayer(currLayers[0]));
          // dispatch(addLayer(newBaseLayer));
          // dispatch(moveLayer(newBaseLayer, currLayers.length - 1, 0));
          dispatch(replaceLayerAtIndex(newBaseLayer, 0));
          dispatch(incrementDisplayState());
        } else {
          dispatch(clearDisplayState());
          dispatch(addLayer(newBaseLayer));
          dispatch(incrementDisplayState());

          // refresh RDRs if appropriate
          if (preserveOverlays) dispatch(preserveRDRs(currLayers, newBaseLayer));
          else dispatch(clearOperatorControls());

          // show image features if appropriate
          if (autoShowImageFeatures) dispatch(showAllImageFeatures(newBaseLayer));
        }

        // Fetch a new histogram for image stretch purposes if the product is an image product
        if (isAnnotatableProduct(newBaseLayer)) {
          dispatch(fetchImageHistogram(newBaseLayer));
        }

        // refresh state after some updates
        state = getState();

        // update the stretch display
        if (state.imageAdjustments.resetStretch) {
          dispatch(resetImageStretch());
        } else if (state.imageAdjustments.stretchMode === 'backend') {
          if (!state.imageAdjustments.extrema) {
            dispatch(
              backendStretchBaseImage(false, state.imageAdjustments.percentMin, state.imageAdjustments.percentMax)
            );
          } else if (state.imageAdjustments.extrema) {
            dispatch(
              backendStretchBaseImage(true, state.imageAdjustments.stretchMin, state.imageAdjustments.stretchMax)
            );
          }
        }

        // refresh state after some updates
        state = getState();

        // update the data cursor
        if (state.dataCursor.active) dispatch(setDataCursor({ ...state.dataCursor, product: newBaseLayer }));

        beforeFetchAdditional();
        if (fetchAdditional) {
          // fetch associated mosaics
          // TODO we could technically ignore this for certain properties that
          // don't affect associated mosaics list but might be too much of a bother?
          dispatch(updateAssociatedMosaics(newBaseLayer));
          dispatch(updateProductFreshness(newBaseLayer));

          await Promise.all([
            // fetch source images for mosaics and reconstructed images
            dispatch(updateSourceImages(newBaseLayer)),

            // fetch targets and add them to the listing
            dispatch(updateTargetListing(newBaseLayer)),
          ]);
          // fetch source image footprints
          await dispatch(updateSourceImageFootprints(newBaseLayer));

          // show source image footprints if appropriate
          if (showSourceFootprints) dispatch(showSourceImageFootprints());

          if (preserveActiveTargets) {
            dispatch(preserveTargets(currLayers, newBaseLayer));
          }
        }

        // normalize the label for things like scalebar
        if (normalizeLabel && !newBaseLayer.vicar_label) {
          const label = await getNormalizeImageLabel(newBaseLayer);
          if (label) {
            newBaseLayer = { ...newBaseLayer, vicar_label: label };
            dispatch({ type: 'UPDATE_LAYER', layer: newBaseLayer });
          }
        }

        resolve(newBaseLayer);
      };

      // Before changing the display, check if current annotation is unsaved and that the base image
      // is from a different overlayID
      if (!baseLayerHasSameOverlayID && (currentAnnotation.isLocal || currentAnnotation.isUnsaved)) {
        await dispatch(confirmDiscardAction(handleBaseLayer));
      } else {
        await handleBaseLayer();
      }
    });
  };
};

export const addLayer = (newLayer, opacity = 1, index) => {
  return (dispatch, getState) => {
    const state = getState();
    // Check geometry of it vs base, if it is not the same throw error.
    const layers = state.imageLayers.layers;
    if (
      !newLayer._isCustom &&
      layers.length > 0 &&
      getPropFromProduct(layers[0], config.es_mappings.overlay_id) !==
        getPropFromProduct(newLayer, config.es_mappings.overlay_id)
    ) {
      dispatch(
        showAlert({
          title: 'Error',
          message:
            'The requested overlay cannot be added. The required properties of this overlay do not match the properties of the active overlays. Try first loading a base image within the same eye and geometry group as this layer.',
          primaryAction: hideAlert,
          secondaryAction: () => {
            openSupportEmail({
              subject: `${config.app_title} Help`,
              message: `Unable to view overlay: ${getPropFromProduct(newLayer, config.es_mappings.id)}`,
              url: window.location.toString(),
            });
            hideAlert();
          },
        })
      );
    } else {
      dispatch(toggleOverlaysVisible(true, true)); // display overlays as visible again
      dispatch(appendLayer(newLayer, opacity, index));
      dispatch(changeOpacity(newLayer, opacity));
    }
  };
};

export const appendLayer = (layer, opacity, index) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    // Only add the layer if it is a supportable file type
    if (isOSDViewableFileType(layer)) {
      let operatorControls = null;
      const operatorControlsMap = state.imageLayers.operatorControlsMap;
      operatorControls = operatorControlsMap[getPropFromProduct(layer, config.es_mappings.product_type)];
      operatorControls = operatorControls ? operatorControls.queryStrings : null;

      osdWrapper.addLayer({
        layer,
        opacity,
        type: 'tile',
        operatorControls,
        ...(typeof index === 'number' && { index }),
      });
      /*
        TODO would be good to track opacity separately from the actual ES object
        so that we aren't just shoving in opacity on top of the ES object. Could have
        potential namespace collisions..
      */
      layer.opacity = opacity;
    }

    dispatch({ type: 'APPEND_LAYER', layer });
  };
};

export const replaceLayerAtIndex = (layer, index) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    // Get the old layer
    if (index > state.imageLayers.layers.length - 1) {
      dispatch(
        showAlert({
          title: 'Error',
          message: 'Unable to replace layer.',
          primaryAction: hideAlert,
          secondaryAction: () => {
            openSupportEmail({
              subject: `${config.app_title} Help`,
              message: `Layer replacement failed: ${getPropFromProduct(layer, config.es_mappings.id)}`,
              url: window.location.toString(),
            });
            hideAlert();
          },
        })
      );
      return;
    }

    // Remove the old layer
    const oldLayer = state.imageLayers.layers[index];
    osdWrapper.removeLayer(getIDForLayer(oldLayer));

    // Add the new layer and preserve several old layer properties
    osdWrapper.addLayer({
      index,
      layer,
      opacity: layer.opacity,
      type: 'tile',
      stretchMode: layer.stretchMode,
      isDNStretch: layer.isDNStretch,
      stretchLow: layer.stretchLow,
      stretchHigh: layer.stretchHigh,
      operatorControls: layer.operatorControls,
    });

    dispatch({ type: 'REPLACE_LAYER', layer, index });
  };
};

export const removeLayer = (layer) => {
  return async (dispatch, getState) => {
    const state = getState();
    const layerId = getIDForLayer(layer);
    const baseLayerId = getIDForLayer(state.imageLayers.layers[0]);
    const stateLayer = state.imageLayers.layers.find((x) => getIDForLayer(x) === layerId);
    if (stateLayer) {
      if (isTarget(stateLayer)) {
        dispatch(removeTargetLayer(layer));
      } else {
        const osdRefs = state.imageViewer.osdRefs;
        const { osdWrapper } = osdRefs;
        osdWrapper.removeLayer(layerId);

        await dispatch({ type: 'SET_OPACITY', layer, opacity: 1 }); // always reset to 1 on removal
        dispatch({ type: 'REMOVE_LAYER', layer });
      }
    }
    // If all image layers have been removed, stop the animation
    const imageLayers = getState().imageLayers.layers.filter((x) => {
      const xID = getIDForLayer(x);
      return xID !== layerId && xID !== baseLayerId && !isTarget(x);
    });
    if (imageLayers.length < 1) dispatch(stopLayerAnimation()); // only stop if we're not stopped
  };
};

export const removeAllOverlays = () => {
  return (dispatch, getState) => {
    const state = getState();
    const layers = state.imageLayers.layers;
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    // check that there are overlays to remove
    if (layers.length > 1) {
      layers.slice(1).forEach((l) => {
        if (isTarget(l)) {
          dispatch(removeTargetLayer(l));
        } else {
          osdWrapper.removeLayer(getIDForLayer(l));
          dispatch({ type: 'SET_OPACITY', l, opacity: 1 }); // always reset to 1 on removal
        }
      });

      dispatch({ type: 'REMOVE_ALL_OVERLAYS' });
    }
    dispatch(stopLayerAnimation());
  };
};

export const removeAllLayers = () => {
  return (dispatch, getState) => {
    // remove overlays
    dispatch(removeAllOverlays());

    // remove everything from OSD (redundant)
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;
    osdWrapper.removeAll();

    // remove everything from state
    dispatch({ type: 'REMOVE_ALL_LAYERS' });
  };
};

export const moveLayer = (layer, currIndex, newIndex) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    osdWrapper.moveLayer(getIDForLayer(layer), newIndex);

    dispatch({
      type: 'MOVE_LAYER',
      layer,
      firstIndex: currIndex,
      secondIndex: newIndex,
    });
  };
};

export const moveLayerUp = (layer) => {
  return (dispatch, getState) => {
    const layers = getState().imageLayers.layers;
    const currIndex = layers.indexOf(layer);
    const newIndex = currIndex + 1;

    if (newIndex >= 1 && newIndex <= layers.length - 1) {
      dispatch(moveLayer(layer, currIndex, newIndex));
    }
  };
};

export const moveLayerDown = (layer) => {
  return (dispatch, getState) => {
    const layers = getState().imageLayers.layers;
    const currIndex = layers.indexOf(layer);
    const newIndex = currIndex - 1;

    if (newIndex >= 1 && newIndex <= layers.length - 1) {
      dispatch(moveLayer(layer, currIndex, newIndex));
    }
  };
};

export const changeOpacity = (layer, opacity) => {
  return (dispatch, getState) => {
    // setting opacity to some level of visibility
    if (opacity !== 0) {
      // fix the current display and toggle
      dispatch(toggleOverlaysVisible(true, true));
    }

    if (isTarget(layer)) {
      const { layers } = getState().imageLayers.layers;
      dispatch(setTargetsOpacity(layers, opacity));
    } else {
      const state = getState();
      const osdRefs = state.imageViewer.osdRefs;
      const { osdWrapper } = osdRefs;

      osdWrapper.setLayerOpacity(getIDForLayer(layer), opacity);
    }

    dispatch({ type: 'SET_OPACITY', layer, opacity });
  };
};

export const toggleOverlaysVisible = (visible, setDisplay = false) => {
  return (dispatch, getState) => {
    const state = getState();
    const currVisible = state.imageLayers.overlaysVisible;
    if (typeof visible !== 'boolean') visible = !currVisible;

    const allLayers = state.imageLayers.layers;
    const annotations = state.annotationState.annotations;

    // Separate out target layers and all other layers since targets
    // need to be handled specially since they are many layers acting as
    // a single layer
    const layers = [];
    const targets = [];
    allLayers.forEach((layer) => {
      if (isTarget(layer)) {
        targets.push(layer);
      } else {
        layers.push(layer);
      }
    });

    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    if (setDisplay) {
      // image layers
      if (layers.length > 1) {
        layers.slice(1).forEach((l) => {
          const opacity = currVisible || l.opacityOverridesVisibility ? l.opacity : 0;
          if (opacity !== l.opacity) {
            dispatch(changeOpacity(l, currVisible || l.opacityOverridesVisibility ? l.opacity : 0));
          }
        });
      }

      // annotations
      annotations.forEach((annotation) => {
        // If layer is currently visible or has opacityOverridesVisibility
        // use that opacity, otherwise the layer should be at 0 opacity
        let opacity = 0;
        if (currVisible || annotation.opacityOverridesVisibility) {
          opacity = annotation.opacity;
        }
        if (opacity !== annotation.opacity) {
          dispatch(setAnnotationOpacity(annotation, opacity));
        }
      });

      // targets
      // If layer is currently visible or has opacityOverridesVisibility
      // use that opacity, otherwise the layer should be at 0 opacity
      if (targets.length > 0) {
        let opacity = 0;
        if (currVisible || (targets.length > 0 && targets[0].opacityOverridesVisibility)) {
          if (targets.length) opacity = targets[0].opacity;
        }
        if (targets.length > 0 && opacity !== targets[0].opacity) {
          dispatch(setTargetsOpacity(targets));
        }
      }
    } else {
      // image layers
      if (layers.length > 1) {
        layers.slice(1).forEach((l) => {
          const opacity = !visible ? 0 : l.opacity;
          osdWrapper.setLayerOpacity(getIDForLayer(l), opacity);
        });
      }

      // annotations
      annotations.forEach((annotation) => {
        const opacity = !visible ? 0 : annotation.opacity;
        osdWrapper.setAnnotationOpacity(annotation.annotation_id, opacity);
      });

      // targets
      if (targets.length > 0) {
        const opacity = !visible ? 0 : targets[0].opacity;
        const targetIds = targets.map((layer) => layer.target.content.id);
        osdWrapper.setTargetsOpacity(targetIds, opacity);
      }
    }

    dispatch({ type: 'TOGGLE_OVERLAYS_VISIBLE', visible });
    dispatch({ type: 'TOGGLE_ANNOTATIONS_VISIBLE', visible });
  };
};

export const updateSourceImages = (baseImage) => (dispatch, getState) => {
  if (!config.feature_flags.active_product.enable_related_images) return;
  return new Promise(async (resolve) => {
    const initDisplayCounter = getState().imageLayers.displayCounter;
    dispatch(clearSourceImages());
    dispatch({ type: 'SET_SOURCE_IMAGES_LOADING', loading: true });

    const sourceProducts = await getSourceProductsForImage(baseImage);

    // Only set data if the base image is not stale
    if (getState().imageLayers.displayCounter === initDisplayCounter) {
      if (sourceProducts) dispatch({ type: 'SET_SOURCE_IMAGES', sourceImages: sourceProducts });
      dispatch({ type: 'SET_SOURCE_IMAGES_LOADING', loading: false });
    }
    resolve();
  });
};

export const clearSourceImages = () => {
  return { type: 'CLEAR_SOURCE_IMAGES' };
};

export const updateSourceImageFootprints = (baseImage) => (dispatch, getState) => {
  if (!config.feature_flags.active_product.enable_map) return;
  return new Promise(async (resolve) => {
    const initDisplayCounter = getState().imageLayers.displayCounter;
    dispatch(clearSourceImageFootprints());
    dispatch(clearSelectedFootprint());
    dispatch({ type: 'SET_SOURCE_IMAGE_FOOTPRINTS_LOADING', loading: true });

    const sourceImageFootprints = await getSourceImageFootprintsForImage(baseImage);

    // Populate more information from sourceImages
    const sourceImages = getState().sourceImages.sourceImages;
    const sourceImageMap = sourceImages.reduce((acc, product) => {
      const key = getPropFromProduct(product, config.es_mappings.filename, null);
      if (!acc[key]) {
        acc[key] = product;
      }
      return acc;
    }, {});

    // TODO move to config
    function getColorForFootprint(product) {
      const colorMap = {
        LR: 'rgb(255,0,0)',
        NL: 'rgb(0,255,0)',
        NR: 'rgb(0,255,0)',
        FL: 'rgb(0,0,255)',
        FR: 'rgb(0,0,255)',
        BL: 'rgb(0,0,255)',
        BR: 'rgb(0,0,255)',
        RL: 'rgb(0,0,255)',
        RR: 'rgb(0,0,255)',
        '110.0': 'rgb(255,0,255)',
        '100.0': 'rgb(255,255,0)',
        '79.0': 'rgb(34,139,34)',
        '63.0': 'rgb(18,227,239)',
        '48.0': 'rgb(30,144,255)',
        '34.0': 'rgb(138,43,226)',
        '26.0': 'rgb(255,0,0)',
      };

      let color = '';
      const id = getPropFromProduct(product, config.es_mappings.instrument_id);
      if (id === 'ZL') {
        color = colorMap[product.vicar_label.INSTRUMENT_STATE_PARMS.FOCAL_LENGTH];
      } else {
        color = colorMap[getPropFromProduct(product, config.es_mappings.instrument_id)];
      }
      if (!color) color = 'rgb(0,0,255)';
      return color;
    }

    sourceImageFootprints.forEach((footprint) => {
      const match = sourceImageMap[getPropFromProduct(footprint, config.es_mappings.filename)];
      if (match) {
        footprint.color = getColorForFootprint(match);
        footprint.instrument_id = match.instrument_id;
        footprint.vicar_label = match.vicar_label;
      } else {
        // TODO what to do here
        console.log('Warning: No matching product for footprint:', footprint);
      }
    });

    // perform stale check
    if (getState().imageLayers.displayCounter === initDisplayCounter) {
      dispatch({ type: 'SET_SOURCE_IMAGE_FOOTPRINTS_LOADING', loading: false });
      if (sourceImageFootprints) dispatch({ type: 'SET_SOURCE_IMAGE_FOOTPRINTS', sourceImageFootprints });
    }
    resolve();
  });
};

export const clearSourceImageFootprints = () => (dispatch, getState) => {
  // Clear source image footprints from OSD
  const state = getState();
  const osdRefs = state.imageViewer.osdRefs;
  const { osdWrapper } = osdRefs;
  osdWrapper.clearFootprints();

  // Clear all footprints in store
  return { type: 'CLEAR_SOURCE_IMAGE_FOOTPRINTS' };
};

export const setSelectedSourceImageFootprint = (footprint) => {
  return { type: 'SET_SELECTED_SOURCE_IMAGE_FOOTPRINT', footprint };
};

export const updateAssociatedMosaics = (baseImage) => (dispatch, getState) => {
  if (!config.feature_flags.active_product.enable_related_images) return;
  return new Promise(async (resolve) => {
    const initDisplayCounter = getState().imageLayers.displayCounter;
    dispatch(clearAssociatedMosaics());
    dispatch({ type: 'SET_ASSOCIATED_MOSAICS_LOADING', loading: true });

    const ocsPackages = getState().search.ocsPackages;
    const associatedMosaics = await getAssociatedMosaicsForImage(baseImage, ocsPackages);

    // Only set data if the base image is not stale
    if (getState().imageLayers.displayCounter === initDisplayCounter) {
      if (associatedMosaics.results) {
        dispatch({ type: 'SET_ASSOCIATED_MOSAICS', associatedMosaics: associatedMosaics.results });
      }
      dispatch({ type: 'SET_ASSOCIATED_MOSAICS_LOADING', loading: false });
    }

    resolve();
  });
};

export const clearAssociatedMosaics = () => {
  return { type: 'CLEAR_ASSOCIATED_MOSAICS' };
};

export const updateProductFreshness = (baseImage) => (dispatch, getState) => {
  if (!config.feature_flags.active_product.enable_product_freshness) return;
  return new Promise(async (resolve) => {
    const initDisplayCounter = getState().imageLayers.displayCounter;
    dispatch(clearProductFreshness());

    const ocsPackages = getState().search.ocsPackages;
    const freshestProduct = await fetchFreshestProduct(baseImage, ocsPackages);
    // Only set data if the base image is not stale
    if (getState().imageLayers.displayCounter === initDisplayCounter) {
      if (freshestProduct.product) {
        dispatch({ type: 'SET_FRESHER_PRODUCT', product: freshestProduct.product });
      } else {
        dispatch(clearProductFreshness());
      }
    }
    resolve();
  });
};

export const clearProductFreshness = () => {
  return { type: 'CLEAR_MOSAIC_FRESHNESS' };
};

export const updateTargetListing = (baseImage) => (dispatch, getState) => {
  if (!config.feature_flags.active_product.enable_targets) return;
  return new Promise(async (resolve) => {
    const initDisplayCounter = getState().imageLayers.displayCounter;

    // clear previous target listings
    dispatch(clearTargetListing());
    dispatch({ type: 'SET_TARGETS_LOADING', loading: true });

    try {
      // fetch targets and add them to the listing
      const targets = await getTargetsForImage(baseImage);

      // Only set data if the base image is not stale
      if (getState().imageLayers.displayCounter === initDisplayCounter) {
        dispatch({ type: 'APPEND_TO_GROUPS', groups: targets });
        dispatch({ type: 'SET_TARGETS_LOADING', loading: false });
      }
      resolve();
    } catch (err) {
      telemetry.logError('Unable to fetch targets', err);
      dispatch({ type: 'SET_TARGETS_LOADING', loading: false });
      resolve();
    }
  });
};

export const clearTargetListing = () => {
  return { type: 'CLEAR_ITEMS_FROM_GROUPS', key: config.es_mappings.object_type.key, value: 'm20-target' };
};

export const addAllTargets = (layers, toggleVisible, opacity = 1) => {
  return (dispatch) => {
    layers.forEach((layer) => dispatch(addTargetLayer(layer, toggleVisible, opacity)));
  };
};

export const removeAllTargets = (layers) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    // Clear all targets in OSD
    osdWrapper.clearTargets();

    // Remove all targets from layers state
    layers.forEach((layer) => dispatch({ type: 'REMOVE_LAYER', layer }));
  };
};

export const addTargetLayer = (layer, toggleVisible, opacity = 1) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const currVisible = state.imageLayers.overlaysVisible;
    const { osdWrapper } = osdRefs;

    // Display overlays as visible again if requested.
    // This option is not used when adding targets from URL.
    let finalOpacity = opacity;
    if (toggleVisible) {
      dispatch(toggleOverlaysVisible(true, true));
      if (!currVisible) {
        // If overlays are not visible set final opacity to 1 to match the other target opacity behavior
        finalOpacity = 1;
      }
    }

    osdWrapper.addTarget({
      line: layer.target.pixelLocation.pixel.y,
      sample: layer.target.pixelLocation.pixel.x,
      accurate: layer.target.pixelLocation.accurate,
      id: layer.target.content.id,
      text: layer.title,
      opacity: finalOpacity,
    });

    dispatch({ type: 'APPEND_LAYER', layer: { ...layer, opacity } });
  };
};

export const removeTargetLayer = (layer) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    osdWrapper.removeTarget(layer.target.content.id);

    dispatch({ type: 'REMOVE_LAYER', layer });
  };
};

export const setTargetsOpacity = (layers, opacity) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    osdWrapper.setTargetsOpacity(
      layers.map((layer) => layer.target.content.id),
      opacity
    );

    layers.forEach((layer) => {
      dispatch({ type: 'SET_OPACITY', layer, opacity });
    });
  };
};

export const setTargetMetadataOpen = (targetObjOrId) => {
  return (dispatch, getState) => {
    let target = targetObjOrId;
    if (typeof targetObjOrId === 'string') {
      const state = getState();
      const matchingTargets = state.imageLayers.layers.filter(
        (layer) => isTarget(layer) && layer.target.content.id === targetObjOrId
      );
      if (matchingTargets.length < 1) return;
      target = matchingTargets[0].target;
    }

    // If a target is specified, set target active (e.g. permament highlight) in OSD
    if (target) dispatch(setTargetActive(target.content.id));
    else dispatch(deactivateTarget()); // Otherwise deactivate target since we're closing metadata

    // Show metadata panel for target
    dispatch({
      type: 'SET_TARGET_METADATA_OPEN',
      target,
    });
  };
};

export const setFeatureMetadataOpen = (featureObjOrId) => {
  return (dispatch, getState) => {
    let feature = featureObjOrId;
    if (typeof featureObjOrId === 'string') {
      const state = getState();
      const matchingFeatures = state.imageLayers.layers.filter(
        (layer) => isFeature(layer) && layer.target.content.id === featureObjOrId
      );
      if (matchingFeatures.length < 1) return;
      feature = matchingFeatures[0].target;
    }

    // TODO If a feature is specified, set feature active (e.g. permament highlight) in OSD
    if (feature) dispatch(addImageFeatureAnnotationToDisplay(feature));
    // else dispatch(deactivateFeature()); // Otherwise deactivate feature since we're closing metadata

    // Show metadata panel for target
    dispatch({
      type: 'SET_FEATURE_METADATA_OPEN',
      feature,
    });
  };
};

export const zoomToTarget = (targetId) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    osdWrapper.zoomToTarget(targetId);
  };
};

export const setTargetActive = (targetId) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    osdWrapper.setTargetActive(targetId);
  };
};

export const deactivateTarget = () => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    osdWrapper.deactivateTarget();
  };
};

export const highlightTarget = (targetId) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    osdWrapper.setTargetActiveStyle(targetId);
  };
};

export const unhighlightTarget = (targetId) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    osdWrapper.resetTargetStyle(targetId);
  };
};

export function updateLayer(layer) {
  return { type: 'UPDATE_LAYER', layer };
}

export const setProductMetadataOpen = (product, fetchMetadata = true) => {
  return (dispatch, getState) => {
    if (product && fetchMetadata) {
      // abort previous requests
      if (metadataController) {
        metadataController.abort();
        metadataController = null;
      }

      metadataController = new AbortController();
      const signal = metadataController.signal;

      let searchProduct = product;
      const isBaseLayer = !getPropFromProduct(searchProduct, config.es_mappings.overlayable, false);

      dispatch({ type: 'SET_PRODUCT_METADATA_OPEN', product: searchProduct, hasPartialMetadata: true });

      const ocsPackages = getState().search.ocsPackages;
      const productProm = fetchESDataForProduct(getPropFromProduct(searchProduct, config.es_mappings.id), signal);
      // if this is an overlay then we don't care about other group items
      const groupProm = isBaseLayer
        ? fetchProductGroupItems(searchProduct, signal, ocsPackages)
        : new Promise((resolve) => resolve([searchProduct]));
      Promise.all([productProm, groupProm])
        .then((dataBundles) => {
          const fullProduct = dataBundles[0];
          const groups = dataBundles[1];

          // ignore this update if we've changed products while loading
          if (
            getPropFromProduct(getState().imageLayers.metadataProduct, config.es_mappings.id) ===
            getPropFromProduct(fullProduct, config.es_mappings.id)
          ) {
            dispatch({ type: 'SET_PRODUCT_METADATA_OPEN', product: fullProduct, groups });
          }
        })
        .catch((err) => {
          telemetry.logWarning(
            `Error fetching OCS Data for product: ${getPropFromProduct(searchProduct, config.es_mappings.id)}, ${err}`
          );
        });
    } else {
      // if we're closing the panel, abort any lingering requests
      if (!product && metadataController) {
        metadataController.abort();
        metadataController = null;
      }
      dispatch({
        type: 'SET_PRODUCT_METADATA_OPEN',
        product,
      });
    }
  };
};

export const toggleAutoAddRDRs = () => {
  return {
    type: 'TOGGLE_AUTO_ADD_RDRS',
  };
};

export const preserveRDRs = (oldLayers, newBaseLayer) => {
  return (dispatch, getState) => {
    const state = getState();
    const groups = state.activeSearchProduct.groups;

    // get a list of appropriate overlays to preserve
    const overlayIdProducts = groups.filter(
      (x) =>
        getPropFromProduct(x, config.es_mappings.overlay_id) ===
          getPropFromProduct(newBaseLayer, config.es_mappings.overlay_id) &&
        getPropFromProduct(x, config.es_mappings.object_type) !== 'm20-mv-annotation' &&
        getPropFromProduct(x, config.es_mappings.object_type) !== 'm20-image-feature' &&
        getPropFromProduct(x, config.es_mappings.object_type) !== 'm20-target'
    );
    const latestVersionProducts = getLatestVersionsByType(
      overlayIdProducts,
      state.imageLayers.preferredImageForType,
      getPropFromProduct(newBaseLayer, config.es_mappings.spec_flag, null)
    );

    // filter out non-overlayable layers (base image)
    // add layer with same product_type as previous layer if it exists
    oldLayers.forEach((layer) => {
      let productToAdd;
      let opacity = 1;
      if (getPropFromProduct(layer, config.es_mappings.overlayable)) {
        latestVersionProducts.every((p) => {
          if (
            getPropFromProduct(p, config.es_mappings.product_type) ===
            getPropFromProduct(layer, config.es_mappings.product_type)
          ) {
            productToAdd = p;
            opacity = layer.opacity; // preserve opacity
            return false;
          }
          return true;
        });
      }
      if (productToAdd) {
        dispatch(addLayer(productToAdd, opacity, getState().imageLayers.layers.length));
      }
    });
  };
};

export const preserveTargets = (oldLayers, newBaseLayer) => {
  return (dispatch, getState) => {
    const state = getState();
    const groups = state.activeSearchProduct.groups;

    // get a list of appropriate overlays to preserve
    const targets = groups.filter(
      (x) =>
        getPropFromProduct(x, config.es_mappings.overlay_id) ===
          getPropFromProduct(newBaseLayer, config.es_mappings.overlay_id) &&
        getPropFromProduct(x, config.es_mappings.object_type) === 'm20-target'
    );

    // find active targets and re-add if found in the new list of targets
    oldLayers
      .filter((l) => getPropFromProduct(l, config.es_mappings.object_type) === 'm20-target')
      .forEach((layer) => {
        let productToAdd;
        let opacity = 1;
        targets.forEach((p) => {
          if (p.target.content.id === layer.target.content.id) {
            productToAdd = p;
            opacity = layer.opacity; // preserve opacity
            return false;
          }
          return true;
        });
        if (productToAdd) dispatch(addTargetLayer(productToAdd, true, opacity));
      });
  };
};

export const showAllImageFeatures = (newBaseLayer) => {
  return (dispatch, getState) => {
    const state = getState();
    const groups = state.activeSearchProduct.groups;

    // get a list of appropriate features to add
    groups
      .filter(
        (x) =>
          getPropFromProduct(x, config.es_mappings.overlay_id) ===
            getPropFromProduct(newBaseLayer, config.es_mappings.overlay_id) &&
          getPropFromProduct(x, config.es_mappings.object_type) === 'm20-image-feature'
      )
      .forEach((feature) => dispatch(addImageFeatureAnnotationToDisplay(feature)));
  };
};

export const togglePreserveRDRs = () => {
  return {
    type: 'TOGGLE_PRESERVE_RDRS',
  };
};

export const togglePreserveTargets = () => {
  return {
    type: 'TOGGLE_PRESERVE_TARGETS',
  };
};

export const setOperatorControlsProduct = (product) => {
  return { type: 'SET_OPERATOR_CONTROLS_PRODUCT', product };
};

export const setOperatorControlsForProduct = (product, controlOptions, queryStrings) => {
  return (dispatch, getState) => {
    dispatch({
      type: 'SET_OPERATOR_CONTROLS_FOR_IMAGE_TYPE',
      imageType: getPropFromProduct(product, config.es_mappings.product_type),
      controlOptions,
      queryStrings,
    });

    // replace layer in OSD
    const state = getState();
    const layers = state.imageLayers.layers;
    if (layers.length > 0) {
      const osdRefs = state.imageViewer.osdRefs;
      const { osdWrapper } = osdRefs;

      // set up listeners for load events
      dispatch(updateLayer({ ...product, loading: true }));
      const productId = getIDForLayer(product);
      const index = layers.findIndex((l) => getIDForLayer(l) === productId);
      const handleLoad = (layer) => {
        if (layer._astriaId === productId) {
          dispatch(updateLayer({ ...product, loading: false }));
          osdWrapper.off('layeradded', handleLoad);
          osdWrapper.off('layererror', handleError);
        }
      };
      const handleError = (layer) => {
        if (getIDForLayer(layer) === productId) {
          dispatch(updateLayer({ ...product, loading: false }));
          dispatch(
            showAlert({
              title: 'Error',
              message: 'The requested overlay could not be generated.',
              primaryAction: hideAlert,
              secondaryAction: () => {
                openSupportEmail({
                  subject: `${config.app_title} Help`,
                  message: `Operator Controls Failed: ${getIDForLayer(layer)}`,
                  url: window.location.toString(),
                });
                hideAlert();
              },
            })
          );
          osdWrapper.off('layererror', handleLoad);
          osdWrapper.off('layeradded', handleError);
        }
      };

      osdWrapper.on('layeradded', handleLoad);
      osdWrapper.on('layererror', handleError);

      // removing and adding the same layer to recreate the tile source with a different url
      osdWrapper.removeLayer(productId);
      osdWrapper.addLayer({
        layer: product,
        index: index,
        replace: false,
        type: 'tile',
        operatorControls: queryStrings,
      });
    }
  };
};

export const resetOperatorControlsForProduct = (product) => {
  return (dispatch, getState) => {
    dispatch({
      type: 'RESET_OPERATOR_CONTROLS_FOR_IMAGE_TYPE',
      imageType: getPropFromProduct(product, config.es_mappings.product_type),
    });

    // replace layer in OSD
    const state = getState();
    const layers = state.imageLayers.layers;
    if (layers.length > 0) {
      const osdRefs = state.imageViewer.osdRefs;
      const { osdWrapper } = osdRefs;

      // set up listeners for load events
      dispatch(updateLayer({ ...product, loading: true }));
      const productId = getPropFromProduct(product, config.es_mappings.id);
      const index = layers.findIndex((l) => getPropFromProduct(l, config.es_mappings.id) === productId);
      const handleLoad = (layer) => {
        if (layer._astriaId === productId) {
          dispatch(updateLayer({ ...product, loading: false }));
          osdWrapper.off('layeradded', handleLoad);
          osdWrapper.off('layererror', handleError);
        }
      };
      const handleError = (layer) => {
        if (getPropFromProduct(layer, config.es_mappings.id) === productId) {
          dispatch(updateLayer({ ...product, loading: false }));
          dispatch(
            showAlert({
              title: 'Error',
              message: 'The requested overlay could not be generated.',
              primaryAction: hideAlert,
              secondaryAction: () => {
                openSupportEmail({
                  subject: `${config.app_title} Help`,
                  message: `Operator Controls Failed: ${getPropFromProduct(layer, config.es_mappings.id)}`,
                  url: window.location.toString(),
                });
                hideAlert();
              },
            })
          );
          osdWrapper.off('layererror', handleLoad);
          osdWrapper.off('layeradded', handleError);
        }
      };

      osdWrapper.on('layeradded', handleLoad);
      osdWrapper.on('layererror', handleError);

      // removing and adding the same layer to recreate the tile source with a different url
      osdWrapper.removeLayer(productId);
      osdWrapper.addLayer({
        layer: product,
        index: index,
        replace: false,
        type: 'tile',
      });
    }
  };
};

export const clearOperatorControls = () => {
  return { type: 'CLEAR_OPERATOR_CONTROLS' };
};

export const selectNewRDRVersion = (oldProduct, newProduct) => {
  return (dispatch, getState) => {
    dispatch(setPreferredImageForType(newProduct));

    const oldProductId = getPropFromProduct(oldProduct, config.es_mappings.id);

    const state = getState();
    const layers = state.imageLayers.layers;
    const index = layers.findIndex((l) => getPropFromProduct(l, config.es_mappings.id) === oldProductId);
    dispatch(replaceLayerAtIndex(newProduct, index));
    dispatch(setOperatorControlsProduct(newProduct)); // re-open the panel
  };
};

export const setPreferredImageForType = (product) => {
  return { type: 'SET_PREFERRED_IMAGE_FOR_TYPE', product };
};

export const clearPreferredImages = () => {
  return { type: 'CLEAR_PREFERRED_IMAGES' };
};

export const showSourceImageFootprints = () => {
  return (dispatch, getState) => {
    const state = getState();
    const initDisplayCounter = state.imageLayers.displayCounter;
    const footprints = state.sourceImages.sourceImageFootprints;
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    // Show source image footprints if the base image is loaded.
    // Otherwise show it when the base image loads.
    if (osdWrapper) {
      const addFootprints = () => {
        window.requestAnimationFrame(() => {
          // Check for stale data
          if (getState().imageLayers.displayCounter === initDisplayCounter) {
            // Reset rotation
            dispatch(resetRotation(true));

            // Clear selected footprint
            dispatch(clearSelectedFootprint());

            // Hide any previous footprints
            osdWrapper.clearFootprints();

            // Add footprints
            osdWrapper.addFootprints(footprints);
          }
        });
      };

      const callback = () => {
        osdWrapper.off('layeradded', callback);
        addFootprints();
      };

      const anyLayerLoaded = osdWrapper.osdViewer.world.getItemCount() > 0;
      if (anyLayerLoaded) addFootprints();
      else {
        osdWrapper.on('layeradded', callback);
      }
    }

    dispatch({ type: 'SHOW_SOURCE_IMAGE_FOOTPRINTS', show: true });
  };
};

export const hideSourceImageFootprints = () => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;
    osdWrapper.clearFootprints();

    dispatch({ type: 'SHOW_SOURCE_IMAGE_FOOTPRINTS', show: false });
  };
};

export const setSourceImageFootprintsFilter = (filter) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;
    osdWrapper.filterFootprints(filter);

    dispatch({ type: 'SET_SOURCE_IMAGE_FOOTPRINTS_FILTER', filter });
  };
};

export const setSelectedFootprint = (product, setInOSD = false) => {
  return (dispatch, getState) => {
    if (setInOSD) {
      const state = getState();
      const osdRefs = state.imageViewer.osdRefs;
      const { osdWrapper } = osdRefs;

      osdWrapper.setSelectedFootprintForFilename(getPropFromProduct(product, config.es_mappings.filename, null));
    }

    dispatch({ type: 'SET_SELECTED_FOOTPRINT', footprint: product });
  };
};

export const clearSelectedFootprint = () => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    osdWrapper.clearActiveFootprintStyles(false);
    dispatch({ type: 'SET_SELECTED_FOOTPRINT', footprint: null });
  };
};

export const highlightFootprint = (product) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    osdWrapper.setFootprintHighlightStyleByOCSName(
      getPropFromProduct(product, config.es_mappings.filename, null),
      true
    );
  };
};

export const unhighlightFootprint = (product) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;
    osdWrapper.setFootprintHighlightStyleByOCSName(
      getPropFromProduct(product, config.es_mappings.filename, null),
      false
    );
  };
};

export const zoomToFootprint = (product) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    /* TODO maybe it's better to have SourceImages have the list of source image footprints and just find and pass in the footprint? */
    // Pass in footprints here in case footprints haven't been added to the viewer
    osdWrapper.zoomToFootprintByOCSName(
      getPropFromProduct(product, config.es_mappings.filename, null),
      state.sourceImages.sourceImageFootprints
    );
  };
};

export const setCustomLayerModalOpen = (open = true) => {
  return {
    type: 'SET_CUSTOM_LAYER_MODAL_OPEN',
    open,
  };
};

export const animateFrame = (activeFrameIndex) => {
  return (dispatch, getState) => {
    const state = getState();
    // Filter out targets as we won't animate those
    const layers = state.imageLayers.layers.filter((l) => !isTarget(l));
    layers.forEach((layer, i) => {
      if (i !== 0) {
        const opacity = activeFrameIndex === i ? 1 : 0;
        if (layer.opacity !== opacity) {
          dispatch(changeOpacity(layer, activeFrameIndex === i ? 1 : 0));
        }
      }
    });
  };
};

export const playLayerAnimation = () => {
  return (dispatch, getState) => {
    if (animationTimeout) {
      clearTimeout(animationTimeout);
    }

    const animate = () => {
      const state = getState();
      let index = state.imageLayers.animationPlayerFrameIndex;
      dispatch(animateFrame(index));
      animationTimeout = setTimeout(() => {
        dispatch(nextLayerAnimationFrame());
        animate();
      }, state.imageLayers.animationFrameGapMS);
    };
    animate();

    dispatch({ type: 'SET_ANIMATION_STATE', animationState: 'playing' });
  };
};

export const pauseLayerAnimation = () => {
  return (dispatch) => {
    if (animationTimeout) {
      clearTimeout(animationTimeout);
    }

    dispatch({ type: 'SET_ANIMATION_STATE', animationState: 'paused' });
  };
};

export const stopLayerAnimation = () => {
  return (dispatch, getState) => {
    if (animationTimeout) {
      clearTimeout(animationTimeout);
    }

    const state = getState();
    // only stop if we're not already stopped
    if (state.imageLayers.animationPlayerState !== 'stopped') {
      // Reset opacities
      const layers = state.imageLayers.layers.filter((l) => !isTarget(l));
      layers.forEach((layer, i) => {
        if (i !== 0) {
          if (layer.opacity !== 1) {
            dispatch(changeOpacity(layer, 1));
          }
        }
      });

      dispatch({ type: 'SET_ANIMATION_FRAME_INDEX', index: 1 });
      dispatch({ type: 'SET_ANIMATION_STATE', animationState: 'stopped' });
    }
  };
};

export const nextLayerAnimationFrame = () => {
  return (dispatch, getState) => {
    const imageLayers = getState().imageLayers;
    const layers = imageLayers.layers.filter((l) => !isTarget(l));
    const nextIndex = (imageLayers.animationPlayerFrameIndex + 1) % layers.length;
    dispatch({ type: 'SET_ANIMATION_FRAME_INDEX', index: nextIndex });
    dispatch(animateFrame(nextIndex));
  };
};

export const previousLayerAnimationFrame = () => {
  return (dispatch, getState) => {
    const imageLayers = getState().imageLayers;
    const layers = imageLayers.layers.filter((l) => !isTarget(l));
    let nextIndex = (imageLayers.animationPlayerFrameIndex - 1) % layers.length;
    if (nextIndex < 0) nextIndex = layers.length - 1;
    dispatch({ type: 'SET_ANIMATION_FRAME_INDEX', index: nextIndex });
    dispatch(animateFrame(nextIndex));
  };
};

export const setAnimationSpeed = (ms) => {
  return (dispatch) => {
    dispatch({ type: 'SET_ANIMATION_SPEED', ms });
  };
};
