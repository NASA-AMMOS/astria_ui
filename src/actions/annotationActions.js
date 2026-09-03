import moment from 'moment';
import { ACTIVE_PRODUCT_TAB_INDICES } from 'src/components/activeProduct/ActiveProductSidebar';
import * as telemetry from 'src/utils/telemetryUtils';
import { USING_CSSO } from '../constants/api';
import { DeepDiffMapper, openSupportEmail } from '../utils';
import { datadriveGetOCSObjectDownloadPath } from '../utils/endpoints';
import { generateAnnotationId } from '../utils/osd/osdUtils';
import { getPropFromProduct } from '../utils/sharedUtils';
import { locallyAddAnnotation, locallyRemoveAnnotation, locallyUpdateAnnotation } from './activeSearchProduct';
import { hideAlert, showAlert } from './alertActions';
import { toggleOverlaysVisible } from './imageLayers';
import { resetRotation } from './imageViewer';
import { setImageTab, setProductDetailsSidebarOpen } from './sidebarState';

import config from 'config.js';
export const setInteractionMode = (interactionMode) => (dispatch, getState) => {
  const state = getState();
  const osdRefs = state.imageViewer.osdRefs;
  const { osdWrapper } = osdRefs;

  osdWrapper.setViewMode(interactionMode);

  dispatch({
    type: 'SET_VIEW_MODE',
    interactionMode,
  });
};

export const addMeasurement = (id, point1, point2) => {
  return {
    type: 'ADD_MEASUREMENT',
    id,
    point1,
    point2,
  };
};

export const addMeasurementExternally = (point1, point2) => async (dispatch, getState) => {
  // Add measure directly to OSD, this will eventually get added to state via a raised OSD event
  const state = getState();
  const osdRefs = state.imageViewer.osdRefs;
  const { osdWrapper } = osdRefs;
  osdWrapper.addMeasurement({ lsPoint1: point1, lsPoint2: point2 });
};

export const updateMeasurement = (id, point1, point2) => {
  return {
    type: 'UPDATE_MEASUREMENT',
    id,
    point1,
    point2,
  };
};

export const removeMeasurement = (id) => {
  return {
    type: 'REMOVE_MEASUREMENT',
    id,
  };
};

export const clearMeasurements = () => (dispatch, getState) => {
  const state = getState();
  const osdRefs = state.imageViewer.osdRefs;
  const { osdWrapper } = osdRefs;
  osdWrapper.clearMeasurements();

  dispatch({
    type: 'CLEAR_MEASUREMENTS',
  });
};

export const addInitialMeasurement = (point1, point2) => {
  return {
    type: 'ADD_INITIAL_MEASUREMENT',
    point1,
    point2,
  };
};

export const addScalebar = (id, point, pinToScreen = true) => {
  return {
    type: 'ADD_SCALEBAR',
    id,
    point,
    pinToScreen,
  };
};

export const addScalebarExternally =
  (point, pinToScreen = true) =>
  async (dispatch, getState) => {
    // Add scalebar directly to OSD, this will eventually get added to state via a raised OSD event
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;
    osdWrapper.addScalebar(point, pinToScreen);
  };

export const updateScalebar = (id, point, pinToScreen) => {
  return {
    type: 'UPDATE_SCALEBAR',
    id,
    point,
    pinToScreen,
  };
};

export const removeScalebar = (id) => {
  return {
    type: 'REMOVE_SCALEBAR',
    id,
  };
};

export const addInitialScalebar = (point, pinToScreen) => {
  return {
    type: 'ADD_INITIAL_SCALEBAR',
    point,
    pinToScreen,
  };
};

export const shapeSelected = (shape) => (dispatch) => {
  // Avoid setting interaction mode back to edit for pen tool. Can't use state's interactionMode for this check
  // because if you select another drawing shape before hitting escape pen is no longer the mode.
  if (shape.length === 1 && shape[0].shapeType !== 'pen') {
    // dispatch(setAnnotationEditorOpen(true));
    dispatch(setInteractionMode(config.interaction_modes.edit));
  }
  dispatch({
    type: 'SHAPE_SELECTED',
    shape,
  });
};

export const shapeDeselected = (shape) => {
  return {
    type: 'SHAPE_DESELECTED',
    shape,
  };
};

export const detectUnsavedChanges = (keySet) => (dispatch, getState) => {
  const state = getState();
  const activeAnnotation = state.annotationState.activeAnnotation;
  const savedAnnotationRef = state.annotationState.savedAnnotationRef;

  if (typeof keySet === 'undefined') {
    if (getPropFromProduct(activeAnnotation, config.es_mappings.object_type) === 'm20-mv-annotation') {
      keySet = ['title', 'description'];
    } else if (getPropFromProduct(activeAnnotation, config.es_mappings.object_type) === 'm20-image-feature') {
      keySet = ['feature_science_intent_keyword_id', 'feature_notes', 'feature_confidence_level'];
    } else {
      keySet = ['title', 'description'];
    }
  }

  // Do not perform diff if annotation no longer exists
  const annotationExists = state.annotationState.annotations.find(
    (x) => x.annotation_id === activeAnnotation.annotation_id
  );
  if (!annotationExists) return;
  const annotationJSON = state.imageViewer.osdRefs.osdWrapper.annotationToJSON(activeAnnotation.annotation_id, false);
  const annotationRef = keySet.reduce(
    (acc, k) => {
      acc[k] = activeAnnotation[k];
      return acc;
    },
    { annotationJSON }
  );

  const compAnnotation = keySet.reduce(
    (acc, k) => {
      acc[k] = savedAnnotationRef[k];
      return acc;
    },
    { annotationJSON: savedAnnotationRef.annotationJSON }
  );

  const differ = new DeepDiffMapper();
  const diff = differ.map(annotationRef, compAnnotation, ['opacity', 'annOpacityLimit', 'disableShapeEdit']);

  if (activeAnnotation.annotation_id) {
    // Update the title and description of the annotation object and store a reference to the previous
    // version to revert to if user doesn't save current version
    const newAnnotationObj = {
      ...activeAnnotation,
      isUnsaved: diff.changed,
    };
    dispatch(locallyUpdateAnnotation(newAnnotationObj));

    // Update state with new object
    dispatch(updateAnnotation(newAnnotationObj));
  }
};

export const editAnnotation = (annotation) => (dispatch, getState) => {
  // Add the annotation
  const state = getState();
  const currentActiveAnnotation = state.annotationState.activeAnnotation;
  dispatch(addAnnotationToDisplay(annotation, true)).then((annotationJSON) => {
    // Set the annotation active and open the editor
    dispatch(setActiveAnnotation(annotation, true));

    // Update the ref only if this is not the active annotation, should be the
    // original annotation without any unsaved changes so should be safe
    if (currentActiveAnnotation.annotation_id !== annotation.annotation_id) {
      dispatch(
        setSavedAnnotationRef({
          title: annotation.title,
          description: annotation.description,
          annotationJSON,
          annotation_id: annotation.annotation_id,
        })
      );
    }
  });
};

export const setAnnotationEditorOpen = (open) => (dispatch, getState) => {
  // If we're closing the editor, check for unsaved changes
  if (!open) dispatch(detectUnsavedChanges());
  else dispatch(setProductDetailsSidebarOpen(true)); // otherwise ensure sidebar is open

  if (open) {
    // Reset OSD rotation
    dispatch(resetRotation(true));
    dispatch(setInteractionMode(config.interaction_modes.edit));

    // Open up the drawing tab
    dispatch(setImageTab(ACTIVE_PRODUCT_TAB_INDICES.DRAW));
  } else dispatch(setInteractionMode(config.interaction_modes.view_only));

  dispatch({ type: 'SET_ANNOTATION_EDITOR_OPEN', open });

  // If open, start a new annotation if:
  // - One does not yet exist
  // - The existing annotation is owned by someone else
  const state = getState();
  const baseImage = state.imageLayers.layers[0];
  let activeAnnotation = state.annotationState.activeAnnotation;
  if (
    open &&
    (!getPropFromProduct(activeAnnotation, config.es_mappings.overlay_id) ||
      (getPropFromProduct(activeAnnotation, config.es_mappings.created_by) &&
        state.app.user.username !== getPropFromProduct(activeAnnotation, config.es_mappings.created_by)))
  ) {
    const annoId = generateAnnotationId(
      state.app.user.username,
      getPropFromProduct(baseImage, config.es_mappings.overlay_id)
    );
    activeAnnotation = {
      annotation_id: annoId,
      [config.es_mappings.updated_at.key]: moment.now(),
      [config.es_mappings.created_by.key]: state.app.user.username,
      [config.es_mappings.overlay_id.key]: getPropFromProduct(baseImage, config.es_mappings.overlay_id),
      [config.es_mappings.group_id.key]: getPropFromProduct(baseImage, config.es_mappings.group_id),

      base_id: getPropFromProduct(baseImage, config.es_mappings.id),
      base_group_id: getPropFromProduct(baseImage, config.es_mappings.group_id),
      overlay_id: getPropFromProduct(baseImage, config.es_mappings.overlay_id),
      group_id: annoId,
      annotation_schema_version: '2',

      [config.es_mappings.object_type.key]: 'm20-mv-annotation',
      isLocal: true,
      isUnsaved: true,
      title: '',
      description: '',
    };
    dispatch(setActiveAnnotation(activeAnnotation));
    dispatch(locallyAddAnnotation(activeAnnotation));
    dispatch(addAnnotationToDisplay(activeAnnotation));
  }
};

export const addAnnotationToDisplay =
  (annotation, interactable = false) =>
  async (dispatch, getState) => {
    const state = getState();
    const baseImage = state.imageLayers.layers[0];
    if (
      getPropFromProduct(baseImage, config.es_mappings.overlay_id) !==
      getPropFromProduct(annotation, config.es_mappings.overlay_id)
    ) {
      dispatch(
        showAlert({
          title: 'Error',
          message:
            'The requested drawing cannot be added. The required properties of this overlay do not match the properties of the base image. Try first loading a base image within the same eye and geometry group as this layer.',
          primaryAction: hideAlert,
          secondaryAction: () => {
            openSupportEmail({
              subject: `${config.app_title} Help`,
              message: `Unable to view overlay: ${getPropFromProduct(annotation, config.es_mappings.id)}`,
              url: window.location.toString(),
            });
            hideAlert();
          },
        })
      );
    } else {
      dispatch(toggleOverlaysVisible(true, true)); // display overlays as visible again

      const annotationLoaded = state.annotationState.annotations.find(
        (x) => x.annotation_id === annotation.annotation_id
      );
      if (annotationLoaded) {
        const annotationJSON = state.imageViewer.osdRefs.osdWrapper.annotationToJSON(annotation.annotation_id, false);
        return annotationJSON;
      }

      // Add the annotation to state (will have a loading status)
      dispatch({ type: 'ADD_ANNOTATION', annotation });

      // If the annotation is local it is already loaded
      if (annotation.isLocal) {
        dispatch({ type: 'SET_ANNOTATION_LOADING', annotation, loading: false });
        return {};
      }

      try {
        // Download annotation
        const url = datadriveGetOCSObjectDownloadPath(annotation);
        const response = await fetch(url, { ...(USING_CSSO ? { credentials: 'include' } : null), cache: 'no-store' });
        const annotationJSON = await response.json();
        await state.imageViewer.osdRefs.osdWrapper.addAnnotation(
          annotationJSON,
          annotation.annotation_id,
          interactable
        );
        dispatch(setAnnotationOpacity(annotation, annotation.opacity || 1));

        // Signal annotation is done loading
        dispatch({ type: 'SET_ANNOTATION_LOADING', annotation, loading: false });
        return annotationJSON;
      } catch (err) {
        telemetry.logError('Unable to add drawing', err);
        // Remove annotation if it cannot be added
        dispatch({ type: 'REMOVE_ANNOTATION', annotation });
        dispatch(
          showAlert({
            title: 'Warning',
            message: `Unable to add drawing.`,
          })
        );
        return {};
      }
    }
  };

export const setAnnotationOpacity = (annotation, opacity) => async (dispatch, getState) => {
  const state = getState();
  const osdRefs = state.imageViewer.osdRefs;
  const { osdWrapper } = osdRefs;

  osdWrapper.setAnnotationOpacity(annotation.annotation_id, opacity);

  dispatch({
    type: 'SET_ANNOTATION_OPACITY',
    annotation,
    opacity,
  });
};

export const zoomToAnnotation = (annotation) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    osdWrapper.zoomToAnnotation(annotation.annotation_id);
  };
};

export const removeAnnotation =
  (annotation, confirm = true) =>
  async (dispatch, getState) => {
    const state = getState();
    const remove = () => {
      // Remove annotation from canvas
      state.imageViewer.osdRefs.osdWrapper.removeAnnotation(annotation.annotation_id);

      // Remove annotation from state annotations list (tracks which annotations are added to canvas)
      dispatch({
        type: 'REMOVE_ANNOTATION',
        annotation,
      });

      // If the annotation is active, clear active annotation
      const isActiveAnnotation = annotation.annotation_id === state.annotationState.activeAnnotation.annotation_id;

      if (isActiveAnnotation) dispatch(clearActiveAnnotation());
    };

    // If our current annotation is local, warn user that it will be discarded if they continue
    if (annotation.isLocal) {
      const removeLocal = () => {
        dispatch(locallyRemoveAnnotation(annotation)); // remove from groups listing
        remove();
      };
      if (confirm) dispatch(confirmDiscardAction(removeLocal));
      else removeLocal();
    } else if (annotation.isUnsaved) {
      const removeUnsaved = () => {
        const restoredReference = annotation.temp_ref;
        dispatch(locallyUpdateAnnotation({ ...restoredReference, temp_ref: restoredReference, isUnsaved: false }));
        remove();
      };
      if (confirm) dispatch(confirmDiscardAction(removeUnsaved));
      else removeUnsaved();
    } else remove();
  };

export const confirmDiscardAction = (onDiscard, message) => (dispatch) => {
  dispatch(
    showAlert({
      title: 'Warning',
      message: message
        ? message
        : 'Your current drawing has not been saved. Any unsaved changes will be discarded if you proceed.',
      primaryActionLabel: 'Ok',
      primaryAction: () => onDiscard(),
      secondaryActionLabel: 'Cancel',
      secondaryAction: () => hideAlert(),
    })
  );
};

export const handlePageUnload = (event) => (dispatch, getState) => {
  dispatch(detectUnsavedChanges());

  // Get new annotation state
  const isUnsaved = getState().annotationState.activeAnnotation.isUnsaved;
  if (isUnsaved) {
    // See https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onbeforeunload
    // for details
    event.preventDefault(); // force confirmation dialog in firefox
    event.returnValue = 'You have unsaved changes'; // chrome requires any string value to be set
  }
};

export const updateAnnotation = (newObj) => (dispatch, getState) => {
  // Update active annotation if it's active
  const state = getState();
  const isActiveAnnotation = newObj.annotation_id === state.annotationState.activeAnnotation.annotation_id;
  if (isActiveAnnotation) {
    dispatch({
      type: 'SET_ACTIVE_ANNOTATION',
      activeAnnotation: newObj,
    });
  }

  // Update canvas annotation object tracker
  dispatch({
    type: 'UPDATE_ANNOTATION',
    annotation: newObj,
  });
};

export const setActiveAnnotation =
  (activeAnnotation = {}, openAnnotationEditor = false, openFeatureEditor = false) =>
  (dispatch, getState) => {
    const state = getState();
    const currentAnnotation = state.annotationState.activeAnnotation;
    const isDiffAnnotation = activeAnnotation.annotation_id !== currentAnnotation.annotation_id;

    // If our current annotation is local, warn user that it will be discarded if they continue
    if ((currentAnnotation.isLocal || currentAnnotation.isUnsaved) && isDiffAnnotation) {
      dispatch(
        confirmDiscardAction(async () => {
          dispatch(clearActiveAnnotation());

          // Remove current annotation from canvas
          state.imageViewer.osdRefs.osdWrapper.removeAnnotation(currentAnnotation.annotation_id);

          if (currentAnnotation.isLocal) {
            // Remove annotation from state annotations list (tracks which annotations are added to canvas)
            dispatch({
              type: 'REMOVE_ANNOTATION',
              annotation: currentAnnotation,
            });
            dispatch(locallyRemoveAnnotation(currentAnnotation));
          } else if (currentAnnotation.isUnsaved) {
            const restoredReference = currentAnnotation.temp_ref;
            dispatch(locallyUpdateAnnotation({ ...restoredReference, temp_ref: restoredReference, isUnsaved: false }));

            try {
              // Add unaltered annotation to canvas
              await state.imageViewer.osdRefs.osdWrapper.addAnnotation(
                state.annotationState.savedAnnotationRef.annotationJSON,
                currentAnnotation.annotation_id,
                false
              );
            } catch (err) {
              telemetry.logError('Unable to add annotation to canvas', err);
            }
          }

          state.imageViewer.osdRefs.osdWrapper.setActiveAnnotationId(activeAnnotation.annotation_id);
          dispatch({
            type: 'SET_ACTIVE_ANNOTATION',
            activeAnnotation,
          });
          if (openAnnotationEditor) dispatch(setAnnotationEditorOpen(true));
          if (openFeatureEditor) dispatch(setImageFeatureEditorOpen(true));
        })
      );
    } else {
      state.imageViewer.osdRefs.osdWrapper.setActiveAnnotationId(activeAnnotation.annotation_id);
      dispatch({
        type: 'SET_ACTIVE_ANNOTATION',
        activeAnnotation,
      });
      if (openAnnotationEditor) dispatch(setAnnotationEditorOpen(true));
      if (openFeatureEditor) dispatch(setImageFeatureEditorOpen(true));
    }
  };

export const clearActiveAnnotation = () => (dispatch, getState) => {
  const state = getState();
  state.imageViewer.osdRefs.osdWrapper.setActiveAnnotationId(null);
  dispatch({ type: 'CLEAR_ACTIVE_ANNOTATION' });
};

export const removeAllAnnotations = () => async (dispatch, getState) => {
  const state = getState();

  const activeAnnotation = state.annotationState.activeAnnotation;

  const removeAll = () => {
    try {
      state.imageViewer.osdRefs.osdWrapper.removeAllShapes();
      dispatch({ type: 'REMOVE_ALL_ANNOTATIONS' });
    } catch (err) {
      telemetry.logError('Unable to remove all drawings', err);
      dispatch(
        showAlert({
          title: 'Warning',
          message: `Unable to remove all drawings.`,
        })
      );
    }
  };

  const removeLocal = () => {
    dispatch(locallyRemoveAnnotation(activeAnnotation)); // remove from groups listing
    removeAll();
  };

  const removeUnsaved = () => {
    const restoredReference = activeAnnotation.temp_ref;
    dispatch(locallyUpdateAnnotation({ ...restoredReference, temp_ref: restoredReference, isUnsaved: false }));
    removeAll();
  };

  if (activeAnnotation.isLocal) {
    dispatch(confirmDiscardAction(removeLocal));
  } else if (activeAnnotation.isUnsaved) {
    dispatch(confirmDiscardAction(removeUnsaved));
  } else {
    removeAll();
  }
};

export const setSavedAnnotationRef = (annotationData) => {
  return {
    type: 'SET_SAVED_ANNOTATION_REF',
    annotationData,
  };
};

// FEATURE TAGGING

export const startImageFeatureAnnotation = () => (dispatch, getState) => {
  // Start tracking a new annotation object in state
  const state = getState();
  const baseImage = state.imageLayers.layers[0];
  let activeAnnotation = state.annotationState.activeAnnotation;
  const annoId = generateAnnotationId(
    state.app.user.username,
    getPropFromProduct(baseImage, config.es_mappings.overlay_id)
  );
  activeAnnotation = {
    [config.es_mappings.updated_at.key]: moment.now(),
    [config.es_mappings.created_by.key]: state.app.user.username,
    [config.es_mappings.overlay_id.key]: getPropFromProduct(baseImage, config.es_mappings.overlay_id),
    [config.es_mappings.instrument_id.key]: getPropFromProduct(baseImage, config.es_mappings.instrument_id),
    [config.es_mappings.instrument_category.key]: getPropFromProduct(baseImage, config.es_mappings.instrument_category),

    base_id: getPropFromProduct(baseImage, config.es_mappings.id),
    base_group_id: getPropFromProduct(baseImage, config.es_mappings.group_id),
    group_id: annoId,

    feature_schema_version: '1',
    [config.es_mappings.object_type.key]: 'm20-image-feature',
    feature_science_intent_keyword_id: '',
    feature_notes: '',
    feature_confidence_level: '',
    annotation_id: annoId, // this will be translated to feature_id

    isLocal: true,
    isUnsaved: true,
  };
  dispatch(setActiveAnnotation(activeAnnotation));
  dispatch(locallyAddAnnotation(activeAnnotation));
  dispatch(addImageFeatureAnnotationToDisplay(activeAnnotation));

  dispatch(setInteractionMode(config.interaction_modes.edit));
};

export const editImageFeatureAnnotation = (annotation) => (dispatch, getState) => {
  // Add the annotation
  const state = getState();
  const currentActiveAnnotation = state.annotationState.activeAnnotation;
  dispatch(addImageFeatureAnnotationToDisplay(annotation, true)).then((annotationJSON) => {
    // Set the annotation active and open the editor
    dispatch(setActiveAnnotation(annotation, false, true));

    // Update the ref only if this is not the active annotation, should be the
    // original annotation without any unsaved changes so should be safe
    if (currentActiveAnnotation.annotation_id !== annotation.annotation_id) {
      dispatch(
        setSavedAnnotationRef({
          annotation_id: annotation.annotation_id,
          feature_science_intent_keyword_id: annotation.feature_science_intent_keyword_id,
          feature_notes: annotation.feature_notes,
          feature_confidence_level: annotation.feature_confidence_level,
          annotationJSON,
        })
      );
    }
  });
};

export const setImageFeatureEditorOpen = (open) => (dispatch, getState) => {
  // If we're closing the editor, check for unsaved changes
  if (!open) {
    dispatch(detectUnsavedChanges());
  } else dispatch(setProductDetailsSidebarOpen(true)); // otherwise ensure sidebar is open

  // If we're opening the editor, start a new annotation that we will use to gather any drawn features
  if (open) {
    dispatch(removeActiveAnnotation());

    // Reset OSD rotation
    dispatch(resetRotation(true));
    dispatch(setInteractionMode(config.interaction_modes.edit));
  } else {
    dispatch(setInteractionMode(config.interaction_modes.view_only));
    // dispatch(clearActiveAnnotation());
  }

  dispatch({ type: 'SET_IMAGE_FEATURE_EDITOR_OPEN', open });

  // If open, start a new annotation if:
  // - One does not yet exist
  // - The existing annotation is owned by someone else
  const state = getState();
  let activeAnnotation = state.annotationState.activeAnnotation;
  if (
    open &&
    (!getPropFromProduct(activeAnnotation, config.es_mappings.overlay_id) ||
      (getPropFromProduct(activeAnnotation, config.es_mappings.created_by) &&
        state.app.user.username !== getPropFromProduct(activeAnnotation, config.es_mappings.created_by)))
  ) {
    dispatch(startImageFeatureAnnotation());
  }
};

export const addImageFeatureAnnotationToDisplay =
  (annotation, interactable = false) =>
  async (dispatch, getState) => {
    const state = getState();
    const baseImage = state.imageLayers.layers[0];
    if (
      getPropFromProduct(baseImage, config.es_mappings.overlay_id) !==
      getPropFromProduct(annotation, config.es_mappings.overlay_id)
    ) {
      dispatch(
        showAlert({
          title: 'Error',
          message:
            'The requested feature tag cannot be added. The required properties of this overlay do not match the properties of the base image. Try first loading a base image within the same eye and geometry group as this layer.',
          primaryAction: hideAlert,
          secondaryAction: () => {
            openSupportEmail({
              subject: `${config.app_title} Help`,
              message: `Unable to view feature tag: ${getPropFromProduct(annotation, config.es_mappings.id)}`,
              url: window.location.toString(),
            });
            hideAlert();
          },
        })
      );
    } else {
      // copy the feature_id into the annotation_id because each feature is now its own annotation
      annotation.annotation_id = annotation.feature_id || annotation.annotation_id;

      dispatch(toggleOverlaysVisible(true, true)); // display overlays as visible again

      const annotationLoaded = state.annotationState.annotations.find(
        (x) => x.annotation_id === annotation.annotation_id
      );
      if (annotationLoaded) {
        const annotationJSON = state.imageViewer.osdRefs.osdWrapper.annotationToJSON(annotation.annotation_id, false);
        return annotationJSON;
      }

      // Add the annotation to state (will have a loading status)
      dispatch({ type: 'ADD_ANNOTATION', annotation });

      // If the annotation is local it is already loaded
      if (annotation.isLocal) {
        dispatch({ type: 'SET_ANNOTATION_LOADING', annotation, loading: false });
        return {};
      }

      try {
        // pull annotation shapes
        const keywordsMap = state.search.keywordsMap;
        const featureLabel = keywordsMap[annotation.feature_science_intent_keyword_id]
          ? keywordsMap[annotation.feature_science_intent_keyword_id].name
          : 'Unknown';
        await state.imageViewer.osdRefs.osdWrapper.addImageFeatures(
          { ...annotation, feature_label: featureLabel },
          interactable
        );
        dispatch(setAnnotationOpacity(annotation, annotation.opacity || 1));

        // Signal annotation is done loading
        dispatch({ type: 'SET_ANNOTATION_LOADING', annotation, loading: false });

        // Return annotation JSON from ref
        return state.imageViewer.osdRefs.osdWrapper.annotationToJSON(annotation.annotation_id, false);
      } catch (err) {
        telemetry.logError('Unable to add feature tag', err);
        // Remove annotation if it cannot be added
        dispatch({ type: 'REMOVE_ANNOTATION', annotation });
        dispatch(
          showAlert({
            title: 'Warning',
            message: `Unable to add feature tag.`,
          })
        );
        return {};
      }
    }
  };

export const removeActiveImageFeature = () => (dispatch, getState) => {
  const state = getState();
  const activeAnnotation = state.annotationState.activeAnnotation;
  if (activeAnnotation && activeAnnotation.feature_schema_version) {
    dispatch(removeAnnotation(activeAnnotation));
  }
};

export const removeActiveAnnotation = () => (dispatch, getState) => {
  const state = getState();
  const activeAnnotation = state.annotationState.activeAnnotation;
  if (activeAnnotation && activeAnnotation.annotation_schema_version) {
    dispatch(removeAnnotation(activeAnnotation));
  }
};

export const zoomToFeature = (feature) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    osdWrapper.zoomToFeature(feature.feature_id);
  };
};

export const toggleAutoShowImageFeatures = () => {
  return {
    type: 'TOGGLE_AUTO_SHOW_IMAGE_FEATURES',
  };
};

export const showFeatureOutline = (feature) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    if (feature[config.es_mappings.image_feature.feature_geometry.key]) {
      osdWrapper.addPolygonOutlineWKT(feature[config.es_mappings.image_feature.feature_geometry.key]);
    }
  };
};

export const hideFeatureOutline = (feature) => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    if (feature[config.es_mappings.image_feature.feature_geometry.key]) {
      osdWrapper.removePolygonOutlineWKT(feature[config.es_mappings.image_feature.feature_geometry.key]);
    }
  };
};

export const setAnnotationDeleteModalOpen = (open) => {
  return {
    type: 'SET_DELETE_ANNOTATION_MODAL_OPEN',
    open,
  };
};

export const setAnnotationToDelete = (annotationToDelete) => {
  return {
    type: 'SET_ANNOTATION_TO_DELETE',
    annotationToDelete,
  };
};

export const shapeClicked = (shape) => {
  return (dispatch) => {
    // clear current clicked state
    dispatch(noShapeClicked());
    dispatch({ type: 'SET_CLICKED_SHAPE', shape });
  };
};

export const noShapeClicked = () => {
  return (dispatch) => {
    dispatch({ type: 'SET_CLICKED_SHAPE' });
  };
};
