import config from 'config.js';
import { combineReducers } from 'redux';
import {
  ACTIVE_LAYERS,
  ACTIVE_SEARCH_PRODUCT,
  ASSOCIATED_MOSAICS_STATE,
  DEFAULT_ALERT_STATE,
  DEFAULT_ANNOTATION_MODE,
  DEFAULT_APP,
  DEFAULT_DATA_CURSOR,
  DEFAULT_DEBUG,
  DEFAULT_HELP,
  DEFAULT_IMAGE_ADJUSTMENTS_STATE,
  DEFAULT_IMAGE_DATA_EXPLORER,
  DEFAULT_IMAGE_VIEWER,
  DEFAULT_LOADING_STATE,
  DEFAULT_SEARCH_STATE,
  DEFAULT_SIDEBAR,
  DEFAULT_VIEWER_STATE,
  EXPORT_IMAGES,
  SOURCE_IMAGES_STATE,
  TARGETS_STATE,
} from 'src/reducers/constants';
import { assign } from 'src/reducers/utils';
import { getIDForLayer, isTarget } from 'src/utils';
import { getPropFromProduct } from 'src/utils/sharedUtils';

const dataCursor = (state = DEFAULT_DATA_CURSOR, action) => {
  switch (action.type) {
    case 'SET_DATA_CURSOR':
      return assign(state, action.options);
    case 'CLEAR_DATA_CURSOR':
      return DEFAULT_DATA_CURSOR;
    default:
      return state;
  }
};

const app = (state = DEFAULT_APP, action) => {
  switch (action.type) {
    case 'SET_USER':
      return assign(state, {
        user: action.user,
      });
    case 'SET_PRODUCT_DESCRIPTIONS':
      return assign(state, {
        productDescriptions: action.productDescriptions,
      });
    case 'SET_STARRED_METADATA_FIELDS':
      localStorage.setItem('starredMetadataFields', JSON.stringify(action.fields));
      return assign(state, {
        starredMetadataFields: action.fields,
      });
    default:
      return state;
  }
};

const activeSearchProduct = (state = ACTIVE_SEARCH_PRODUCT, action) => {
  switch (action.type) {
    case 'SET_ACTIVE_SEARCH_PRODUCT':
      return assign(state, {
        searchProduct: action.searchProduct,
        isCustomProduct: action.isCustomProduct,
        isAnnotatableProduct: action.isAnnotatableProduct,
      });
    case 'SET_GROUPS':
      return assign(state, {
        groups: action.groups,
      });
    case 'APPEND_TO_GROUPS':
      return assign(state, {
        groups: state.groups.concat(action.groups),
      });
    case 'CLEAR_ITEMS_FROM_GROUPS':
      return assign(state, {
        groups: state.groups.filter((item) => item[action.key] !== action.value),
      });
    case 'LOCALLY_UPDATE_ANNOTATION':
      return assign(state, {
        groups: state.groups.map((x) => {
          if (x.annotation_id === action.annotation.annotation_id) {
            return action.annotation;
          }
          return x;
        }),
      });
    case 'LOCALLY_REMOVE_ANNOTATION':
      const newGroups = state.groups.filter((el) => el.annotation_id !== action.annotation.annotation_id);
      return assign(state, {
        groups: newGroups,
      });
    case 'LOCALLY_ADD_ANNOTATION':
      return assign(state, {
        groups: [...state.groups, action.annotation],
      });
    case 'SET_ACTIVE_PRODUCT_HAS_PARTIAL_METADATA':
      return assign(state, {
        hasPartialMetadata: action.hasPartialMetadata,
      });
    case 'CLEAR_VIEWING_HISTORY':
      localStorage.removeItem('imageViewingHistory');
      return assign(state, {
        imageHistory: [],
      });
    case 'ADD_PRODUCT_TO_VIEWING_HISTORY':
      // Get history from localstorage to account for other instances of ASTRIA that may have modified history
      let imageHistoryIDs = [];
      try {
        imageHistoryIDs = JSON.parse(localStorage.getItem('imageViewingHistory')) || [];
      } catch (err) {}

      // Check if product exists in history
      const index = imageHistoryIDs.findIndex((x) => x === getPropFromProduct(action.product, config.es_mappings.id));

      // Remove old instance of product if found
      if (index > -1) imageHistoryIDs.splice(index, 1);

      // Add the s3Path of the product to the top of the list
      imageHistoryIDs.unshift(getPropFromProduct(action.product, config.es_mappings.id));

      // Limit the list to 100 items
      imageHistoryIDs = imageHistoryIDs.slice(0, 100);

      // Add set of s3Paths to localstorage
      localStorage.setItem('imageViewingHistory', JSON.stringify(imageHistoryIDs));

      // Transform existing imageHistory into map for quick metadata access
      const existingMetadata = state.imageHistory.reduce((metadataMap, entry) => {
        const possibleMetadata = Object.values(entry)[0];
        if (possibleMetadata) {
          metadataMap[Object.keys(entry)[0]] = possibleMetadata;
        }
        return metadataMap;
      }, {});

      // Transform s3Path list into s3Path -> optional metadata list
      // Also preserve any metadata from the old state
      const newImageHistory = imageHistoryIDs.map((id) => {
        let metadata = null;
        if (id === getPropFromProduct(action.product, config.es_mappings.id)) metadata = action.product;
        else if (existingMetadata[id]) metadata = existingMetadata[id];
        return { [id]: metadata };
      });

      // Where imageHistory is a list of objects, each mapping s3Key -> optional partial search metadata
      return assign(state, {
        imageHistory: newImageHistory,
      });
    case 'UPDATE_LAYER':
      const groups = state.groups.map((x) => {
        if (getIDForLayer(x) === getIDForLayer(action.layer)) {
          return action.layer;
        }
        return x;
      });
      return assign(state, {
        groups,
      });
    case 'SET_FRESHER_PRODUCT':
      return assign(state, {
        fresherProduct: action.product,
      });
    case 'CLEAR_MOSAIC_FRESHNESS':
      return assign(state, {
        fresherProduct: null,
      });
    default:
      return state;
  }
};

const imageViewer = (state = DEFAULT_VIEWER_STATE, action) => {
  switch (action.type) {
    case 'UPDATE_VIEWPORT':
      return assign(state, {
        zoom: action.zoom || state.zoom,
        rotation: typeof action.rotation === 'number' ? action.rotation : state.rotation,
        center: action.center || state.center,
        imageBounds: action.imageBounds || state.imageBounds,
        initialZoom: action.initialZoom || state.initialZoom,
        initialRotation: action.initialRotation || state.initialRotation,
        initialCenter: action.initialCenter || state.initialCenter,
      });
    case 'SET_OSD_REFS':
      return assign(state, {
        osdRefs: action.osdRefs,
      });
    case 'SET_FIRST_IMAGE_LOADED':
      return assign(state, {
        firstImageLoaded: true,
      });
    case 'ADD_FIRST_IMAGE_LOAD_CALLBACK':
      return assign(state, {
        firstImageLoadCallbacks: state.firstImageLoadCallbacks.concat([action.callback]),
      });
    case 'SET_VIEWER_LOADING':
      return assign(state, {
        viewerLoading: action.loading,
        layerLoadingStates: action.layerStates,
      });
    case 'SET_DEFAULT_ZOOM':
      if (typeof action.zoom === 'number') {
        localStorage.setItem('defaultZoom', action.zoom);
      } else {
        localStorage.removeItem('defaultZoom');
      }
      return assign(state, {
        defaultZoom: action.zoom,
      });
    default:
      return state;
  }
};

const viewerState = (state = DEFAULT_IMAGE_VIEWER, action) => {
  switch (action.type) {
    case 'UPDATE_LINE_SAMPLE':
      return assign(state, {
        currentLine: action.line,
        currentSample: action.sample,
      });
    default:
      return state;
  }
};

const annotationState = (state = DEFAULT_ANNOTATION_MODE, action) => {
  switch (action.type) {
    case 'SET_VIEW_MODE':
      return assign(state, {
        interactionMode: action.interactionMode,
      });
    case 'ADD_MEASUREMENT':
      return assign(state, {
        measurements: [
          ...state.measurements,
          {
            id: action.id,
            point1: action.point1,
            point2: action.point2,
          },
        ],
      });
    case 'UPDATE_MEASUREMENT':
      const index = state.measurements.findIndex((m) => m.id === action.id);
      const measurements = [...state.measurements];
      measurements[index].point1 = action.point1;
      measurements[index].point2 = action.point2;
      return index >= 0
        ? assign(state, {
            measurements,
          })
        : state;
    case 'REMOVE_MEASUREMENT':
      const newMeasurements = state.measurements.filter((m) => m.id !== action.id);
      return assign(state, {
        measurements: newMeasurements,
      });
    case 'CLEAR_MEASUREMENTS':
      return assign(state, {
        measurements: [],
      });
    case 'ADD_INITIAL_MEASUREMENT':
      return assign(state, {
        initialMeasurements: [
          ...state.initialMeasurements,
          {
            point1: action.point1,
            point2: action.point2,
          },
        ],
      });
    case 'ADD_SCALEBAR':
      return assign(state, {
        scalebars: [
          ...state.scalebars,
          {
            id: action.id,
            point: action.point,
            pinToScreen: action.pinToScreen,
          },
        ],
      });
    case 'UPDATE_SCALEBAR':
      let scalebarIndex = state.scalebars.findIndex((s) => s.id === action.id);
      const scalebars = [...state.scalebars];
      if (scalebarIndex < 0) {
        scalebars.push({ id: action.id, point: action.point, pinToScreen: action.pinToScreen });
        scalebarIndex = scalebars.length - 1;
      }
      scalebars[scalebarIndex].point = action.point;
      scalebars[scalebarIndex].pinToScreen = action.pinToScreen;
      return scalebarIndex >= 0
        ? assign(state, {
            scalebars,
          })
        : state;
    case 'REMOVE_SCALEBAR':
      const newScalebars = state.scalebars.filter((s) => s.id !== action.id);
      return assign(state, {
        scalebars: newScalebars,
      });
    case 'ADD_INITIAL_SCALEBAR':
      return assign(state, {
        initialScalebars: [
          ...state.initialScalebars,
          {
            point: action.point,
            pinToScreen: action.pinToScreen,
          },
        ],
      });
    case 'SHAPE_SELECTED':
      return assign(state, {
        selectedShapes: action.shape,
      });
    case 'SHAPE_DESELECTED':
      return assign(state, {
        selectedShapes: [],
      });
    case 'SET_ANNOTATION_EDITOR_OPEN':
      return assign(state, {
        annotationEditorOpen: action.open,
      });
    case 'SET_IMAGE_FEATURE_EDITOR_OPEN':
      return assign(state, {
        imageFeatureEditorOpen: action.open,
      });
    case 'SET_ACTIVE_ANNOTATION':
      return assign(state, {
        activeAnnotation: action.activeAnnotation,
      });
    case 'UPDATE_ACTIVE_ANNOTATION':
      return assign(state, {
        activeAnnotation: action.activeAnnotation,
      });
    case 'ADD_ANNOTATION':
      return assign(state, {
        annotations: [...state.annotations, { ...action.annotation, loading: true }],
      });
    case 'SET_ANNOTATION_LOADING':
      return assign(state, {
        annotations: state.annotations.map((annotation) => {
          if (annotation.annotation_id === action.annotation.annotation_id) {
            annotation.loading = action.loading;
          }
          return annotation;
        }),
      });
    case 'REMOVE_ANNOTATION':
      const newAnnotations = state.annotations.filter((el) => el.annotation_id !== action.annotation.annotation_id);
      return assign(state, {
        annotations: newAnnotations,
      });
    case 'UPDATE_ANNOTATION':
      return assign(state, {
        annotations: state.annotations.map((el) => {
          if (el.annotation_id === action.annotation.annotation_id) {
            el = action.annotation;
          }
          return el;
        }),
      });
    case 'SET_ANNOTATION_OPACITY':
      return assign(state, {
        annotations: state.annotations.map((el) => {
          if (el.annotation_id === action.annotation.annotation_id) {
            el.opacity = action.opacity;
            el.visible = true;
            el.opacityOverridesVisibility = !state.overlaysVisible;
          }
          return el;
        }),
      });
    case 'TOGGLE_ANNOTATIONS_VISIBLE':
      // if action defines visibility use that, otherwise just toggle the visibility
      // const annotationsVisible = action.hasOwnProperty('visible') ? action.visible : !state.overlaysVisible;
      return assign(state, {
        // annotationsVisible,
        annotations: state.annotations.map((el) => {
          el.opacityOverridesVisibility = false;
          return el;
        }),
      });
    case 'REMOVE_ALL_ANNOTATIONS':
      return assign(state, {
        annotations: [],
      });
    case 'CLEAR_ACTIVE_ANNOTATION':
      return assign(state, {
        activeAnnotation: {},
      });
    case 'SET_SAVED_ANNOTATION_REF':
      return assign(state, {
        savedAnnotationRef: action.annotationData,
      });
    case 'SET_DELETE_ANNOTATION_MODAL_OPEN':
      return assign(state, {
        deleteModalOpen: action.open,
      });
    case 'SET_ANNOTATION_TO_DELETE':
      return assign(state, {
        annotationToDelete: action.annotationToDelete,
      });
    case 'SET_CLICKED_SHAPE':
      return assign(state, {
        clickedShape: action.shape,
      });
    default:
      return state;
  }
};

const dataExplorerState = (state = DEFAULT_IMAGE_DATA_EXPLORER, action) => {
  switch (action.type) {
    case 'TOGGLE_AUTO_ADD_RDRS':
      return assign(state, {
        autoAddRDRs: !state.autoAddRDRs,
      });
    default:
      return state;
  }
};

const debugMode = (state = DEFAULT_DEBUG, action) => {
  switch (action.type) {
    case 'TOGGLE_DEBUG':
      return assign(state, {
        debugState: !state.debugState,
      });
    default:
      return state;
  }
};

const sidebarState = (state = DEFAULT_SIDEBAR, action) => {
  switch (action.type) {
    case 'SET_PRODUCT_SEARCH_SIDEBAR_OPEN':
      localStorage.setItem('productSearchSidebarOpen', action.open);
      return assign(state, {
        productSearchSidebarOpen: action.open,
      });
    case 'SET_PRODUCT_DETAILS_SIDEBAR_OPEN':
      localStorage.setItem('productDetailsSidebarOpen', action.open);
      return assign(state, {
        productDetailsSidebarOpen: action.open,
      });
    case 'STORE_EDR_LIST':
      return assign(state, {
        edrListRows: action.activeRows,
      });
    case 'SET_SEARCH_TAB':
      return assign(state, {
        searchTabIndex: action.tabIndex,
      });
    case 'SET_IMAGE_TAB':
      return assign(state, {
        imageTabIndex: action.tabIndex,
      });
    default:
      return state;
  }
};

// const imageHistogram = (state = DEFAULT_HISTOGRAM, action) => {
//   switch (action.type) {
//     case 'UPDATE_HISTOGRAM':
//       return assign(state, {
//         rVals: state.rVals.concat(action.rVals),
//         gVals: state.gVals.concat(action.gVals),
//         bVals: state.bVals.concat(action.bvals),
//       });
//     default:
//       return state;
//   }
// };

const alert = (state = DEFAULT_ALERT_STATE, action) => {
  switch (action.type) {
    case 'SHOW_ALERT':
      return assign(state, {
        open: true,
        title: action.title,
        message: action.message,
        primaryAction: action.primaryAction,
        secondaryAction: action.secondaryAction,
        primaryActionLabel: action.primaryActionLabel,
        secondaryActionLabel: action.secondaryActionLabel,
        escapable: action.escapable,
        onDismiss: action.onDismiss,
        hasSecondaryAction: action.hasSecondaryAction,
      });
    case 'HIDE_ALERT':
      return assign(state, DEFAULT_ALERT_STATE);
    default:
      return state;
  }
};

const loading = (state = DEFAULT_LOADING_STATE, action) => {
  switch (action.type) {
    case 'SET_FETCHING_INITIAL_DATA':
      return assign(state, {
        fetchingInitialData: action.isFetching,
      });
    case 'SET_FETCHING_GROUPS':
      return assign(state, {
        fetchingGroups: action.isFetching,
      });
    default:
      return state;
  }
};

const search = (state = DEFAULT_SEARCH_STATE, action) => {
  switch (action.type) {
    case 'SET_CAMPAIGNS':
      return assign(state, {
        campaigns: action.campaigns,
      });
    case 'SET_GOALS':
      return assign(state, {
        goals: action.goals,
      });
    case 'SET_TASKS':
      return assign(state, {
        tasks: action.tasks,
      });
    case 'SET_KEYWORDS':
      const keywordsMap = action.keywords.reduce((keywordsMap, keyword) => {
        keywordsMap[keyword.id] = keyword;
        return keywordsMap;
      }, {});
      return assign(state, {
        keywords: action.keywords,
        keywordsMap: keywordsMap,
      });
    case 'SET_ACTIVE_MOSAIC_BROWSE_CATEGORY':
      return assign(state, {
        activeMosaicBrowseCategory: action.activeMosaicBrowseCategory,
      });
    case 'SET_ACTIVE_CATEGORY_SEARCH_CATEGORY':
      return assign(state, {
        activeCategorySearchCategory: action.activeCategorySearchCategory,
      });
    case 'SET_FACET_SEARCH_VALUE':
      const facetSearchValues = { ...state.facetSearchValues };
      const facetSearchInversions_ = { ...state.facetSearchInversions };
      if (action.clearInversion) delete facetSearchInversions_[action.componentId];

      if (action.values && action.values.length) facetSearchValues[action.componentId] = [...action.values];
      else delete facetSearchValues[action.componentId];
      return {
        ...state,
        facetSearchValues,
        facetSearchInversions: facetSearchInversions_,
      };
    case 'SET_FACET_SEARCH_COMPONENT_INVERTED':
      const facetSearchInversions = { ...state.facetSearchInversions };
      if (action.inverted) facetSearchInversions[action.componentId] = true;
      else delete facetSearchInversions[action.componentId];
      return {
        ...state,
        facetSearchInversions,
      };
    case 'CLEAR_FACET_SEARCH_VALUES':
      // If we aren't passed any componentIds we'll clear everything
      if (!action.componentIds)
        return {
          ...state,
          facetSearchValues: {},
        };

      const existingFacetSearchValues = { ...state.facetSearchValues };
      action.componentIds.forEach((componentId) => delete existingFacetSearchValues[componentId]);
      return {
        ...state,
        facetSearchValues: existingFacetSearchValues,
      };
    case 'SET_BROWSE_VALUE':
      const browseValues = { ...state.browseValues };
      if (action.values && action.values.length) browseValues[action.componentId] = action.values;
      else delete browseValues[action.componentId];
      return {
        ...state,
        browseValues,
      };
    case 'CLEAR_BROWSE_VALUES':
      // If we aren't passed any componentIds we'll clear everything
      if (!action.componentIds)
        return {
          ...state,
          browseValues: {},
        };
      const existingBrowseValues = { ...state.browseValues };
      action.componentIds.forEach((componentId) => delete existingBrowseValues[componentId]);
      return {
        ...state,
        browseValues: existingBrowseValues,
      };
    case 'SET_BROWSE_COMPONENT_INVERTED':
      const browseInversions = { ...state.browseInversions };
      if (action.inverted) browseInversions[action.componentId] = true;
      else delete browseInversions[action.componentId];
      return {
        ...state,
        browseInversions,
      };
    case 'SET_TARGET_SEARCH_VALUE':
      const targetSearchValues = { ...state.targetSearchValues };
      if (action.values && action.values.length) targetSearchValues[action.componentId] = action.values;
      else delete targetSearchValues[action.componentId];
      return {
        ...state,
        targetSearchValues,
      };
    case 'CLEAR_TARGET_SEARCH_VALUES':
      // If we aren't passed any componentIds we'll clear everything
      if (!action.componentIds)
        return {
          ...state,
          targetSearchValues: {},
        };
      const existingTargetSearchValues = { ...state.targetSearchValues };
      action.componentIds.forEach((componentId) => delete existingTargetSearchValues[componentId]);
      return {
        ...state,
        targetSearchValues: existingTargetSearchValues,
      };
    case 'SET_TARGET_SEARCH_COMPONENT_INVERTED':
      const targetSearchInversions = { ...state.targetSearchInversions };
      if (action.inverted) targetSearchInversions[action.componentId] = true;
      else delete targetSearchInversions[action.componentId];
      return {
        ...state,
        targetSearchInversions,
      };
    case 'SET_TARGET_SEARCH_VIEW_OPTION':
      return {
        ...state,
        targetSearchViewOptions: {
          ...state.targetSearchViewOptions,
          [action.key]: action.value,
        },
      };
    case 'SET_RDR_SEARCH_VALUE':
      const rdrSearchValues = { ...state.rdrSearchValues };
      if (action.values && action.values.length) rdrSearchValues[action.componentId] = action.values;
      else delete rdrSearchValues[action.componentId];
      return {
        ...state,
        rdrSearchValues,
      };
    case 'CLEAR_RDR_SEARCH_VALUES':
      // If we aren't passed any componentIds we'll clear everything
      if (!action.componentIds)
        return {
          ...state,
          targetSearchValues: {},
        };
      const existinRDRSearchValues = { ...state.rdrSearchValues };
      action.componentIds.forEach((componentId) => delete existinRDRSearchValues[componentId]);
      return {
        ...state,
        rdrSearchValues: existinRDRSearchValues,
      };
    case 'SET_RDR_SEARCH_COMPONENT_INVERTED':
      const rdrSearchInversions = { ...state.rdrSearchInversions };
      if (action.inverted) rdrSearchInversions[action.componentId] = true;
      else delete rdrSearchInversions[action.componentId];
      return {
        ...state,
        rdrSearchInversions,
      };
    case 'SET_RDR_SEARCH_VIEW_OPTION':
      return {
        ...state,
        rdrSearchViewOptions: {
          ...state.rdrSearchViewOptions,
          [action.key]: action.value,
        },
      };
    case 'SET_PACKAGE':
      return assign(state, {
        ocsPackages: { base: state.ocsPackages.base, active: action.ocsPackage },
      });
    case 'PERFORM_SEARCH':
      return assign(state, { storeQueryID: state.storeQueryID + 1 });
    case 'SET_RESULTS_EXPORT_OPEN':
      return assign(state, { resultsExportOpen: action.open, resultsExportItems: action.results });
    default:
      return state;
  }
};

const imageAdjustments = (state = DEFAULT_IMAGE_ADJUSTMENTS_STATE, action) => {
  switch (action.type) {
    case 'UPDATE_IMAGE_STRETCH':
      return assign(state, {
        stretchMin: action.stretchMin,
        stretchMax: action.stretchMax,
      });
    case 'UPDATE_PERCENT_STRETCH':
      return assign(state, {
        percentMin: action.percentMin,
        percentMax: action.percentMax,
      });
    case 'SET_IMAGE_STRETCH_METADATA':
      return assign(state, {
        histogram: action.histogram,
        DNStretchLow: action.DNStretchLow,
        DNStretchHigh: action.DNStretchHigh,
        histogramLow: action.histogramLow,
        histogramHigh: action.histogramHigh,
        percentLow: action.percentLow,
        percentHigh: action.percentHigh,
        loading: action.loading,
      });
    case 'TOGGLE_RESET_STRETCH':
      return assign(state, {
        resetStretch: !state.resetStretch,
      });
    case 'UPDATE_STRETCH_MODE':
      return assign(state, {
        stretchMode: action.stretchMode,
        stretchLow: action.stretchLow,
        stretchHigh: action.stretchHigh,
        stretchMin: action.stretchMin,
        stretchMax: action.stretchMax,
      });
    case 'UPDATE_EXTREMA':
      return assign(state, {
        extrema: action.extrema,
      });
    default:
      return state;
  }
};

const imageLayers = (state = ACTIVE_LAYERS, action) => {
  switch (action.type) {
    case 'REPLACE_LAYER':
      // Replace layer at index
      const allLayers = state.layers.map((x, i) => {
        if (i === action.index) return action.layer;
        return x;
      });
      return assign(state, {
        layers: allLayers,
      });
    case 'APPEND_LAYER':
      const layerPresent = !!state.layers.find((x) => getIDForLayer(x) === getIDForLayer(action.layer));
      if (!layerPresent) {
        return assign(state, {
          layers: [...state.layers, action.layer],
        });
      }
      return state;
    case 'REMOVE_LAYER':
      const newLayers = state.layers.filter((el) => getIDForLayer(el) !== getIDForLayer(action.layer));
      return assign(state, {
        layers: newLayers,
      });
    case 'REMOVE_ALL_OVERLAYS':
      return assign(state, {
        layers: [state.layers[0]],
      });
    case 'REMOVE_ALL_LAYERS':
      return assign(state, {
        layers: [],
      });
    case 'UPDATE_LAYER':
      const layers = state.layers.map((x) => {
        if (getIDForLayer(x) === getIDForLayer(action.layer)) {
          return action.layer;
        }
        return x;
      });
      return assign(state, {
        layers,
      });
    case 'MOVE_LAYER':
      // filter out non-image layers
      const tempArrImages = [...state.layers].filter((l) => !isTarget(l));
      const tempArrNonImages = [...state.layers].filter((l) => isTarget(l));
      tempArrImages.splice(action.firstIndex, 1);
      tempArrImages.splice(action.secondIndex, 0, action.layer);
      return assign(state, { layers: tempArrImages.concat(tempArrNonImages) });
    case 'SET_OPACITY':
      return assign(state, {
        layers: state.layers.map((el) => {
          if (getIDForLayer(el) === getIDForLayer(action.layer)) {
            el.opacity = action.opacity;
            el.visible = true;
            el.opacityOverridesVisibility = !state.overlaysVisible;
          }
          return el;
        }),
      });
    case 'TOGGLE_OVERLAYS_VISIBLE':
      // if action defines visibility use that, otherwise just toggle the visibility
      const overlaysVisible = action.hasOwnProperty('visible') ? action.visible : !state.overlaysVisible;
      return assign(state, {
        overlaysVisible,
        layers: state.layers.map((el) => {
          el.opacityOverridesVisibility = false;
          return el;
        }),
      });
    case 'SET_PRODUCT_METADATA_OPEN':
      return assign(state, {
        metadataProduct: action.product,
        metadataProductIsPartial: !!action.hasPartialMetadata,
        metadataProductGroups: action.groups,
      });
    case 'SET_TARGET_METADATA_OPEN':
      return assign(state, {
        selectedTarget: action.target,
      });
    case 'SET_FEATURE_METADATA_OPEN':
      return assign(state, {
        selectedFeature: action.feature,
      });
    case 'TOGGLE_PRESERVE_RDRS':
      return assign(state, {
        preserveRDRs: !state.preserveRDRs,
      });
    case 'TOGGLE_PRESERVE_TARGETS':
      return assign(state, {
        preserveTargets: !state.preserveTargets,
      });
    case 'TOGGLE_AUTO_SHOW_IMAGE_FEATURES':
      return assign(state, {
        autoShowImageFeatures: !state.autoShowImageFeatures,
      });
    case 'SET_OPERATOR_CONTROLS_PRODUCT':
      return assign(state, {
        operatorControlsProduct: action.product ? getPropFromProduct(action.product, config.es_mappings.id) : null,
      });
    case 'SET_OPERATOR_CONTROLS_FOR_IMAGE_TYPE':
      return assign(state, {
        operatorControlsMap: {
          ...state.operatorControlsMap,
          [action.imageType]: { controls: action.controlOptions, queryStrings: action.queryStrings },
        },
      });
    case 'RESET_OPERATOR_CONTROLS_FOR_IMAGE_TYPE':
      const newOpControlMap = {
        ...state.operatorControlsMap,
        [action.imageType]: null,
      };
      delete newOpControlMap[action.imageType];
      return assign(state, {
        operatorControlsMap: newOpControlMap,
      });
    case 'CLEAR_OPERATOR_CONTROLS':
      return assign(state, {
        operatorControlsProduct: null,
        operatorControlsMap: {},
      });
    case 'SET_PREFERRED_IMAGE_FOR_TYPE':
      return assign(state, {
        preferredImageForType: {
          ...state.preferredImageForType,
          [getPropFromProduct(action.product, config.es_mappings.product_type)]: action.product,
        },
      });
    case 'CLEAR_PREFERRED_IMAGES':
      return assign(state, {
        preferredImageForType: {},
      });
    case 'SHOW_SOURCE_IMAGE_FOOTPRINTS':
      return assign(state, {
        showSourceImageFootprints: action.show,
      });
    case 'SET_SOURCE_IMAGE_FOOTPRINTS_FILTER':
      return assign(state, {
        sourceImageFootprintsFilter: action.filter,
      });
    case 'SET_SELECTED_FOOTPRINT':
      return assign(state, {
        selectedFootprint: action.footprint,
      });
    case 'SET_CUSTOM_LAYER_MODAL_OPEN':
      return assign(state, {
        customLayerModalOpen: action.open,
      });
    case 'SET_ANIMATION_STATE':
      return assign(state, {
        animationPlayerState: action.animationState,
      });
    case 'SET_ANIMATION_FRAME_INDEX':
      return assign(state, {
        animationPlayerFrameIndex: action.index,
      });
    case 'SET_ANIMATION_SPEED':
      return assign(state, {
        animationFrameGapMS: action.ms,
      });
    case 'INCREMENT_DISPLAY_STATE':
      return assign(state, {
        displayCounter: state.displayCounter + 1,
      });
    default:
      return state;
  }
};

const targets = (state = TARGETS_STATE, action) => {
  switch (action.type) {
    case 'SET_TARGETS_LOADING':
      return assign(state, { fetchingTargets: action.loading });
    default:
      return state;
  }
};

const associatedMosaics = (state = ASSOCIATED_MOSAICS_STATE, action) => {
  switch (action.type) {
    case 'CLEAR_ASSOCIATED_MOSAICS':
      return assign(state, {
        associatedMosaics: [],
      });
    case 'SET_ASSOCIATED_MOSAICS':
      return assign(state, {
        associatedMosaics: action.associatedMosaics,
      });
    case 'SET_ASSOCIATED_MOSAICS_LOADING':
      return assign(state, {
        fetchingAssociatedMosaics: action.loading,
      });
    default:
      return state;
  }
};

const sourceImages = (state = SOURCE_IMAGES_STATE, action) => {
  switch (action.type) {
    case 'CLEAR_SOURCE_IMAGES':
      return assign(state, {
        sourceImages: [],
      });
    case 'SET_SOURCE_IMAGES':
      return assign(state, {
        sourceImages: action.sourceImages,
      });
    case 'SET_SOURCE_IMAGES_LOADING':
      return assign(state, {
        fetchingSourceImages: action.loading,
      });
    case 'CLEAR_SOURCE_IMAGE_FOOTPRINTS':
      return assign(state, {
        sourceImageFootprints: [],
      });
    case 'SET_SOURCE_IMAGE_FOOTPRINTS':
      return assign(state, {
        sourceImageFootprints: action.sourceImageFootprints,
      });
    case 'SET_SELECTED_SOURCE_IMAGE_FOOTPRINT':
      return assign(state, {
        selectedSourceImageFootprint: action.footprint,
      });
    case 'SET_SOURCE_IMAGE_FOOTPRINTS_LOADING':
      return assign(state, {
        fetchingSourceImageFootprints: action.loading,
      });
    default:
      return state;
  }
};

const exportImages = (state = EXPORT_IMAGES, action) => {
  switch (action.type) {
    case 'EXPORT_CURR_VIEW':
      return assign(state, {
        preserve: true,
        exporting: !state.exporting,
      });
    case 'EXPORT_FULL_IMAGE':
      return assign(state, {
        preserve: false,
        exporting: !state.exporting,
      });
    default:
      return state;
  }
};

const help = (state = DEFAULT_HELP, action) => {
  switch (action.type) {
    case 'SET_HELP_OPEN':
      return assign(state, {
        open: action.open,
        activeArticleKey: !action.open ? '' : state.activeArticleKey, // reset page on close
      });
    case 'SET_HELP_ARTICLE':
      return assign(state, {
        activeArticleKey: action.key,
      });
    default:
      return state;
  }
};

export default combineReducers({
  app,
  activeSearchProduct,
  dataCursor,
  imageViewer,
  debugMode,
  targets,
  sidebarState,
  viewerState,
  annotationState,
  alert,
  loading,
  search,
  imageAdjustments,
  imageLayers,
  sourceImages,
  associatedMosaics,
  exportImages,
  dataExplorerState,
  help,
});
