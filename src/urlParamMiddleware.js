import throttle from 'lodash.throttle';
import { constructFullURLWithParams, isTarget } from 'src/utils';
import { getShortTargetID } from 'src/utils/osd/osdUtils';
import { getPropFromProduct } from 'src/utils/sharedUtils';

const CONFIG_PARAM = new URLSearchParams(window.location.search).get('config');

const updateUrl = (store) => {
  const state = store.getState();
  const config = state.config;

  // If we're loading initial data, skip updating URL
  if (state.loading.fetchingInitialData) return;

  const parsed = {};

  if (CONFIG_PARAM) parsed['config'] = CONFIG_PARAM;

  const searchProductKey = config.url_keys.searchProduct;
  const overlaysKey = config.url_keys.overlays;
  const overlaysVisibleKey = config.url_keys.overlaysVisible;
  const opacityKey = config.url_keys.transformations.opacity;
  const opControlsKey = config.url_keys.opControls;
  const targetsKey = config.url_keys.targets;
  const allExceptKey = config.url_keys.transformations.allExcept;
  const opacityOverridesVisibilityKey = config.url_keys.transformations.opacityOverridesVisibility;
  const customImageLayerKey = config.url_keys.transformations.customImageLayer;
  const dataCursorKey = config.url_keys.dataCursor;
  const dataCursorOrbitalKey = config.url_keys.dataCursorOrbital;
  const dataCursorOriginKey = config.url_keys.dataCursorOrigin;
  const zoomKey = config.url_keys.zoom;
  const rotationKey = config.url_keys.rotation;
  const centerKey = config.url_keys.center;
  const measurementsKey = config.url_keys.measurements;
  const scalebarsKey = config.url_keys.scalebars;
  const packageKey = config.url_keys.package;
  const selectedTargetKey = config.url_keys.selectedTarget;
  const annotationKey = config.url_keys.annotation;
  const localStretchKey = config.url_keys.stretch.localStretch;
  const percentStretchKey = config.url_keys.stretch.percentStretch;
  const DNStretchKey = config.url_keys.stretch.DNStretch;
  const searchTabIndex = config.url_keys.searchTabIndex;
  const imageTabIndex = config.url_keys.imageTabIndex;
  const activeMosaicBrowseCategory = config.url_keys.activeMosaicBrowseCategory;
  const facetSearchInversionsKey = config.url_keys.facetSearchInversions;
  const browseInversionsKey = config.url_keys.browseInversions;
  const animationStateKey = config.url_keys.animationState;
  const animationSpeedKey = config.url_keys.animationSpeed;

  parsed[searchProductKey] = getPropFromProduct(state.activeSearchProduct.searchProduct, config.es_mappings.id);

  parsed[searchTabIndex] = state.sidebarState.searchTabIndex;
  parsed[imageTabIndex] = state.sidebarState.imageTabIndex;

  // Active mosaic browse category
  if (state.search.activeMosaicBrowseCategory)
    parsed[activeMosaicBrowseCategory] = state.search.activeMosaicBrowseCategory;

  // Overlay visibility defaults to true
  if (state.imageLayers.overlaysVisible) delete parsed[overlaysVisibleKey];
  else parsed[overlaysVisibleKey] = false;

  const overlays = [];
  state.imageLayers.layers.forEach((layer) => {
    // Skip targets as we'll handle them separately
    if (isTarget(layer)) return;

    let layerId = getPropFromProduct(layer, config.es_mappings.filename);

    // collect image operations, currently just opacity and base image hist stretch
    const imageOperations = [];

    // opacity
    const opacity = layer.hasOwnProperty('opacity') ? (layer.opacity !== 1 ? layer.opacity : null) : null;
    if (typeof opacity === 'number') imageOperations.push(`${opacityKey}=${opacity}`);

    // opacity that overrides visibility
    if (layer.opacityOverridesVisibility) imageOperations.push(`${opacityOverridesVisibilityKey}=${true}`);

    // custom layer
    const isCustom = !!layer._isCustom;
    if (isCustom) imageOperations.push(`${customImageLayerKey}=${true}`);

    const imageOperationsString = imageOperations.length ? `(${imageOperations.join('|')})` : '';
    overlays.push(`${layerId}${imageOperationsString}`);
  });
  if (overlays.length) parsed[overlaysKey] = overlays.join(',');
  else delete parsed[overlaysKey];

  let opControlsString = '';
  if (state.imageLayers.operatorControlsMap && Object.keys(state.imageLayers.operatorControlsMap).length) {
    try {
      const activeValuesByType = {};
      Object.keys(state.imageLayers.operatorControlsMap).forEach((key) => {
        const obj = state.imageLayers.operatorControlsMap[key];
        obj.controls.forEach((controlObj) => {
          controlObj.controls.forEach((control) => {
            // Check if control has default values
            if (JSON.stringify(control.default) !== JSON.stringify(control.value)) {
              if (!activeValuesByType[key]) activeValuesByType[key] = {};
              if (!activeValuesByType[key][controlObj.key]) activeValuesByType[key][controlObj.key] = [];
              activeValuesByType[key][controlObj.key].push({ k: control.key, v: control.value });
            }
          });
        });
      });
      opControlsString = JSON.stringify(activeValuesByType);
    } catch (err) {
      console.error('Unable to add operator controls to the URL:', err);
    }
  }
  if (opControlsString) parsed[opControlsKey] = opControlsString;
  else delete parsed[opControlsKey];

  const activeTargets = state.imageLayers.layers.filter((layer) => isTarget(layer));
  if (activeTargets.length) {
    /*
      Targets are stored individually using a slice of their UUIDs as the IDs which
      should provide sufficient uniqueness without overloading the ASTRIA URL.
      Target schema is as follows:

      targets=ID1,ID2,ID3(allExcept=true|opacity=1) where the operations are optional and are defined as follows:
      - allExcept: This flag is used to indicate that the list of targetIDs is the list of targets to *not* show.
                  This is used when there are more than 50% of targets active, meaning it is more space efficient to exclude than include inactive targets.
                  If not present it can be assumed that fewer than 50% of targets are active.
      - opacity: The opacity for all of the targets. Individual target opacity cannot be modified.
      - opacityOverridesVisibility: True if target opacity overrides global visibility.
    */
    let targetIDs = [];
    let numInactiveTargets = state.activeSearchProduct.groups.filter((p) => isTarget(p)).length - activeTargets.length;

    activeTargets.forEach((target) => {
      // Use the first 8 chars of the UUID for URL storage
      targetIDs.push(getShortTargetID(getPropFromProduct(target, config.es_mappings.filename)));
    });
    let targetURLStr = '';
    const options = [];
    if (activeTargets.length > numInactiveTargets) {
      let inactiveTargets = state.activeSearchProduct.groups.filter(
        (product) =>
          isTarget(product) &&
          !activeTargets.find(
            (activeTarget) =>
              getPropFromProduct(product, config.es_mappings.filename) === activeTarget.target.content.id
          )
      );
      targetURLStr = `${inactiveTargets.map((x) => getShortTargetID(x.target.content.id)).join(',')}`;
      options.push(`${allExceptKey}=true`); // TODO make this a config item like the others
    } else {
      targetURLStr = targetIDs.join(',');
    }

    // Account for opacity
    let representativeTargetOpacity = activeTargets[0].opacity;
    if (typeof representativeTargetOpacity === 'number' && representativeTargetOpacity !== 1) {
      options.push(`${opacityKey}=${representativeTargetOpacity}`);
    }

    // Account for opacityOverridesVisibility
    if (activeTargets[0].opacityOverridesVisibility) options.push(`${opacityOverridesVisibilityKey}=${true}`);

    // If we have any options, add them
    if (options.length) targetURLStr += `(${options.join('|')})`;

    parsed[targetsKey] = targetURLStr;
  } else delete parsed[targetsKey];

  // Search values from Browse and Facet Search
  const objToArr = (o) =>
    Object.keys(o).map((k) => {
      return { [k]: o[k] };
    });
  const filters = objToArr(state.search.facetSearchValues)
    .concat(objToArr(state.search.browseValues))
    .concat(objToArr(state.search.targetSearchValues))
    .concat(objToArr(state.search.rdrSearchValues));
  filters.forEach((filter) => {
    const componentId = Object.keys(filter)[0];
    const value = filter[componentId];
    if (value && typeof value === 'object') {
      if (value.length) parsed[componentId] = value.join(',');
      else delete parsed[componentId];
    } else if (typeof value === 'string') {
      if (value) parsed[componentId] = value;
      else delete parsed[componentId];
    } else if (typeof value === 'number') {
      if (!isNaN(value)) parsed[componentId] = value;
      else delete parsed[componentId];
    }
  });

  // Browse search inversions
  const browseInversions = Object.keys(state.search.browseInversions);
  if (browseInversions.length) {
    parsed[browseInversionsKey] = browseInversions;
  } else delete parsed[browseInversionsKey];

  // Facet search inversions
  const facetSearchInversions = Object.keys(state.search.facetSearchInversions);
  if (facetSearchInversions.length) {
    parsed[facetSearchInversionsKey] = facetSearchInversions;
  } else delete parsed[facetSearchInversionsKey];

  // Image Stretching
  const {
    stretchMode,
    stretchMin,
    stretchMax,
    stretchLow,
    stretchHigh,
    percentMin,
    percentMax,
    percentLow,
    percentHigh,
    extrema,
  } = state.imageAdjustments;
  if (stretchMode === 'local' && (stretchMin !== 0 || stretchMax !== 255)) {
    parsed[localStretchKey] = [stretchMin, stretchMax].join('_');
    [percentStretchKey, DNStretchKey].forEach((e) => delete parsed[e]);
  } else if (stretchMode === 'backend' && !extrema && (percentMin !== percentLow || percentMax !== percentHigh)) {
    parsed[percentStretchKey] = [percentMin, percentMax].join('_');
    [localStretchKey, DNStretchKey].forEach((e) => delete parsed[e]);
  } else if (stretchMode === 'backend' && extrema && (stretchMin !== stretchLow || stretchMax !== stretchHigh)) {
    parsed[DNStretchKey] = [stretchMin, stretchMax].join('_');
    [localStretchKey, percentStretchKey].forEach((e) => delete parsed[e]);
  } else {
    [localStretchKey, percentStretchKey, DNStretchKey].forEach((e) => delete parsed[e]);
  }

  // Data Cursor
  if (state.dataCursor && state.dataCursor.active) {
    parsed[dataCursorKey] = [state.dataCursor.line, state.dataCursor.sample].join('_');
    // Store map lon and lat if found
    if (state.dataCursor.mapLon !== -1 && state.dataCursor.mapLat !== -1) {
      parsed[dataCursorOrbitalKey] = [state.dataCursor.mapLon, state.dataCursor.mapLat].join('_');
    } else delete parsed[dataCursorOrbitalKey];
    // Only store data cursor origin if it is not the IMAGE default
    if (state.dataCursor.cursorOrigin !== 'IMAGE') parsed[dataCursorOriginKey] = state.dataCursor.cursorOrigin;
    else delete parsed[dataCursorOriginKey];
  } else {
    delete parsed[dataCursorKey];
    delete parsed[dataCursorOriginKey];
  }

  // Zoom, Center, and Rotation
  if (state.imageViewer.zoom && typeof state.imageViewer.zoom === 'number') {
    parsed[zoomKey] = state.imageViewer.zoom.toFixed(5);
  } else delete parsed[zoomKey];

  if (
    state.imageViewer.center &&
    typeof state.imageViewer.center === 'object' &&
    state.imageViewer.center.length === 2
  ) {
    parsed[centerKey] = state.imageViewer.center.map((x) => x.toFixed(5)).join(',');
  } else delete parsed[centerKey];

  if (
    state.imageViewer.rotation &&
    typeof state.imageViewer.rotation === 'number' &&
    state.imageViewer.rotation !== 0
  ) {
    // Only set rotation in URL if it is not 0
    parsed[rotationKey] = state.imageViewer.rotation;
  } else delete parsed[rotationKey];

  // Measurements
  const measurements = state.annotationState.measurements.map((measurement) => {
    const point1 = measurement.point1;
    const point2 = measurement.point2;
    return `${point1.line}+${point1.sample}_${point2.line}+${point2.sample}`;
  });
  if (measurements.length) parsed[measurementsKey] = measurements.join(',');
  else delete parsed[measurementsKey];

  // Scalebars
  const scalebars = state.annotationState.scalebars.map((scalebar) => {
    const point = scalebar.point;
    const pinToScreen = scalebar.pinToScreen;
    return `${point.line}+${point.sample}_${pinToScreen.toString()}`;
  });
  if (scalebars.length) parsed[scalebarsKey] = scalebars.join(',');
  else delete parsed[scalebarsKey];

  // Selected Target
  const selectedTarget = state.imageLayers.selectedTarget;
  if (selectedTarget) parsed[selectedTargetKey] = selectedTarget.content.id;
  else delete parsed[selectedTargetKey];

  // OCS Package
  const activeOCSPackage = state.search.ocsPackages.active;
  if (activeOCSPackage !== config.search_config.default_package) parsed[packageKey] = activeOCSPackage;
  else delete parsed[packageKey];

  // Animation
  const animationActive =
    state.imageLayers.animationPlayerState === 'playing' || state.imageLayers.animationPlayerState === 'paused';
  const animationSpeed = state.imageLayers.animationFrameGapMS;
  if (animationActive) {
    parsed[animationStateKey] = state.imageLayers.animationPlayerState;
    parsed[animationSpeedKey] = animationSpeed;
  } else {
    delete parsed[animationStateKey];
    delete parsed[animationSpeedKey];
  }

  // Annotation Layers
  const annotations = state.annotationState.annotations.map((annotation) => {
    const annoId = annotation.annotation_id;

    // collect image operations, currently just opacity
    const imageOperations = [];

    // opacity
    const opacity = annotation.opacity
      ? annotation.opacity !== 1
        ? annotation.opacity
        : null
      : annotation.opacity === 0
      ? 0
      : null;
    if (typeof opacity === 'number') imageOperations.push(`${opacityKey}=${opacity}`);

    // opacity that overrides visibility
    if (annotation.opacityOverridesVisibility) imageOperations.push(`${opacityOverridesVisibilityKey}=${true}`);

    const imageOperationsString = imageOperations.length ? `(${imageOperations.join('|')})` : '';
    return `${annoId}${imageOperationsString}`;
  });
  if (annotations.length) parsed[annotationKey] = annotations.join(',');
  else delete parsed[annotationKey];

  const newurl = constructFullURLWithParams(parsed);

  window.history.replaceState({ path: newurl }, '', newurl);
};

const throttledUpdateUrl = throttle(updateUrl, 150, {
  leading: true,
  trailing: true,
});

const actionsTriggeringURLUpdate = {
  SET_ACTIVE_SEARCH_PRODUCT: true,
  REPLACE_LAYER: true,
  APPEND_LAYER: true,
  UPDATE_LAYER: true,
  REMOVE_LAYER: true,
  REMOVE_ALL_OVERLAYS: true,
  MOVE_LAYER: true,
  SET_OPACITY: true,
  TOGGLE_OVERLAYS_VISIBLE: true,
  UPDATE_IMAGE_STRETCH: true,
  UPDATE_STRETCH_MODE: true,
  UPDATE_PERCENT_STRETCH: true,
  UPDATE_EXTREMA: true,
  SET_FACET_SEARCH_VALUE: true,
  SET_FACET_SEARCH_COMPONENT_INVERTED: true,
  SET_TARGET_SEARCH_VALUE: true,
  SET_TARGET_SEARCH_COMPONENT_INVERTED: true,
  SET_RDR_SEARCH_VALUE: true,
  SET_RDR_SEARCH_COMPONENT_INVERTED: true,
  CLEAR_FACET_SEARCH_VALUES: true,
  SET_BROWSE_VALUE: true,
  SET_BROWSE_COMPONENT_INVERTED: true,
  CLEAR_BROWSE_VALUES: true,
  SET_DATA_CURSOR: true,
  CLEAR_DATA_CURSOR: true,
  UPDATE_VIEWPORT: true,
  ADD_MEASUREMENT: true,
  UPDATE_MEASUREMENT: true,
  REMOVE_MEASUREMENT: true,
  CLEAR_MEASUREMENTS: true,
  ADD_SCALEBAR: true,
  UPDATE_SCALEBAR: true,
  REMOVE_SCALEBAR: true,
  SET_PACKAGE: true,
  ADD_ANNOTATION: true,
  REMOVE_ANNOTATION: true,
  SET_ACTIVE_ANNOTATION: true,
  CLEAR_ACTIVE_ANNOTATION: true,
  REMOVE_ALL_ANNOTATIONS: true,
  SET_ANNOTATION_OPACITY: true,
  SET_SEARCH_TAB: true,
  SET_IMAGE_TAB: true,
  SET_TARGET_METADATA_OPEN: true,
  SET_FEATURE_METADATA_OPEN: true,
  SET_ACTIVE_MOSAIC_BROWSE_CATEGORY: true,
  SET_ACTIVE_CATEGORY_SEARCH_CATEGORY: true,
  SET_OPERATOR_CONTROLS_FOR_IMAGE_TYPE: true,
  RESET_OPERATOR_CONTROLS_FOR_IMAGE_TYPE: true,
  SET_ANIMATION_STATE: true,
  SET_ANIMATION_SPEED: true,
};

export const urlParamMiddleware = (store) => (next) => (action) => {
  const returnValue = next(action);
  if (actionsTriggeringURLUpdate[action.type]) {
    throttledUpdateUrl(store);
  }
  return returnValue;
};
