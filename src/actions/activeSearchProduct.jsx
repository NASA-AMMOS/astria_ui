import { hideAlert, showAlert } from 'src/actions/alertActions';
import {
  addAnnotationToDisplay,
  addImageFeatureAnnotationToDisplay,
  addInitialMeasurement,
  addInitialScalebar,
  addMeasurementExternally,
  addScalebarExternally,
  clearActiveAnnotation,
  clearMeasurements,
  confirmDiscardAction,
  detectUnsavedChanges,
  removeAllAnnotations,
  setAnnotationEditorOpen,
  setAnnotationOpacity,
  setImageFeatureEditorOpen,
  setInteractionMode,
} from 'src/actions/annotationActions';
import { clearDataCursor, setDataCursor, setDataCursorExternally } from 'src/actions/dataCursor';
import {
  addLayer,
  addTargetLayer,
  changeOpacity,
  clearAssociatedMosaics,
  clearOperatorControls,
  clearPreferredImages,
  clearProductFreshness,
  clearSourceImageFootprints,
  clearSourceImages,
  clearTargetListing,
  pauseLayerAnimation,
  playLayerAnimation,
  preserveRDRs,
  preserveTargets,
  removeAllLayers,
  setAnimationSpeed,
  setBaseLayer,
  setFeatureMetadataOpen,
  setOperatorControlsForProduct,
  setPreferredImageForType,
  setProductMetadataOpen,
  setTargetMetadataOpen,
  showAllImageFeatures,
  showSourceImageFootprints,
  stopLayerAnimation,
  toggleOverlaysVisible,
  updateAssociatedMosaics,
  updateProductFreshness,
  updateSourceImageFootprints,
  updateSourceImages,
  updateTargetListing,
} from 'src/actions/imageLayers';
import {
  backendStretchBaseImage,
  fetchImageHistogram,
  updateImageStretch,
  updatePercentStretch,
  updateStretchMode,
} from 'src/actions/imageStretch';
import { addFirstImageLoadCallback, updateViewport } from 'src/actions/imageViewer';
import {
  setActiveMosaicBrowseCategory,
  setBrowseInverted,
  setBrowseValue,
  setFacetSearchInverted,
  setFacetSearchValue,
  setPackage,
  setRDRSearchValue,
  setTargetSearchValue,
} from 'src/actions/searchActions';
import { setImageTab, setSearchTab } from 'src/actions/sidebarState';
import { USING_CSSO } from 'src/constants/api';
import {
  capitalize,
  getDefaultOperatorControls,
  getQueryStringForOperatorControl,
  getURLParams,
  isAnnotatableProduct,
  isAnnotation,
  isCustomProduct,
  isFeature,
  isTarget as isTargetFN,
  openSupportEmail,
  performElasticSearchQuery,
} from 'src/utils';
import {
  abortRequestControllers,
  fetchESDataForProduct,
  fetchProductGroupItems,
  getLatestVersionsByType,
} from 'src/utils/dataQuery';
import { astriaGetProductDescriptions, campGetAllCampaigns } from 'src/utils/endpoints';
import { getShortTargetID } from 'src/utils/osd/osdUtils';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import * as telemetry from 'src/utils/telemetryUtils';
import urlJoin from 'url-join';
import { setProductDescriptions } from './appActions';

import config from 'config.js';
import { ACTIVE_PRODUCT_TAB_INDICES } from 'src/components/activeProduct/ActiveProductSidebar';
import { getNormalizeImageLabel } from 'src/utils/labels';

let controller; // request abort controller for groups request

export const setFetchingInitialData = (isFetching) => {
  return {
    type: 'SET_FETCHING_INITIAL_DATA',
    isFetching,
  };
};

export const setFetchingGroups = (isFetching) => {
  return {
    type: 'SET_FETCHING_GROUPS',
    isFetching,
  };
};

export const setGroups = (groups) => {
  return {
    type: 'SET_GROUPS',
    groups,
  };
};

export const locallyUpdateAnnotation = (annotation) => {
  return {
    type: 'LOCALLY_UPDATE_ANNOTATION',
    annotation,
  };
};

export const locallyRemoveAnnotation = (annotation) => {
  return {
    type: 'LOCALLY_REMOVE_ANNOTATION',
    annotation,
  };
};

export const locallyAddAnnotation = (annotation) => {
  return {
    type: 'LOCALLY_ADD_ANNOTATION',
    annotation,
  };
};

export const setActiveSearchProduct = (
  searchProduct,
  showImage = true,
  hasPartialMetadata = false,
  fetchAdditional = true,
  ignorePreserveRDRs = false
) => {
  return async (dispatch, getState) => {
    // wrapper for dealing with annotations
    const handleProduct = async () => {
      // check if we need to fetch the base product for this annotation
      const isImageAnnotation = isAnnotation(searchProduct);
      const isImageFeature = isFeature(searchProduct);
      if (isImageAnnotation) {
        await dispatch(setSearchProductAnnotation(searchProduct));
      } else if (isImageFeature) {
        await dispatch(setSearchProductImageFeature(searchProduct));
      } else {
        await dispatch(
          setSearchProductImage(searchProduct, showImage, hasPartialMetadata, fetchAdditional, ignorePreserveRDRs)
        );
      }
      const filename = getPropFromProduct(searchProduct, config.es_mappings.filename);
      const time1 = getPropFromProduct(searchProduct, config.es_mappings.time1);
      const objectType = getPropFromProduct(searchProduct, config.es_mappings.object_type);
      const instrument = getPropFromProduct(searchProduct, config.es_mappings.instrument_id);
      telemetry.searchProductClicked(filename, time1, objectType, instrument);
    };

    // Before changing search product check if current annotation is unsaved - if it is unsaved prompt user
    dispatch(detectUnsavedChanges());
    const currentAnnotation = getState().annotationState.activeAnnotation;
    if (currentAnnotation.isLocal || currentAnnotation.isUnsaved) {
      dispatch(confirmDiscardAction(handleProduct));
    } else {
      await handleProduct();
    }
  };
};

const setSearchProductImage =
  (searchProduct, showImage = true, hasPartialMetadata = false, fetchAdditional = true, ignorePreserveRDRs = false) =>
  async (dispatch, getState) => {
    // Cancel any previous requests by checking for an existing abort controller
    if (controller) controller.abort();
    const state = getState();
    const currLayers = state.imageLayers.layers;
    const preserveOverlays = state.imageLayers.preserveRDRs;
    const preserveActiveTargets = state.imageLayers.preserveTargets;
    const autoShowImageFeatures = state.imageLayers.autoShowImageFeatures;
    const showSourceFootprints = state.imageLayers.showSourceImageFootprints;
    const ocsPackages = state.search.ocsPackages;
    const initDisplayCounter = state.imageLayers.displayCounter;

    // Re-assign abort controller so it can be canceled if necessary by another setActiveSearchProduct
    controller = new AbortController();
    const signal = controller.signal;

    console.log('Setting active image:', searchProduct);

    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
      // if this is a user upload we'll skip fetching groups as user uploaded products
      // will not need groups and the query is likely to fail given mismatched metadata.
      const newEDRIsCustomProduct = isCustomProduct(searchProduct);
      const newEDRIsAnnotatableProduct = isAnnotatableProduct(searchProduct);

      // If this is a custom annotatable product it will not have an overlay id so we will copy over the group id
      if (newEDRIsAnnotatableProduct && !getPropFromProduct(searchProduct, config.es_mappings.overlay_id)) {
        setPropForProduct(
          searchProduct,
          config.es_mappings.overlay_id,
          getPropFromProduct(searchProduct, config.es_mappings.group_id)
        );
      }

      // Add product to image viewing history
      dispatch(addProductToViewingHistory(searchProduct));

      // Set partial metadata flag
      dispatch(setActiveProductHasPartialMetadata(hasPartialMetadata));

      // clear the current search product and associated display
      dispatch(clearSearchProductState());

      // Signal that we're starting to fetch groups
      dispatch(setFetchingGroups(true));

      const groupFetchingStartTime = Date.now();
      const filename = getPropFromProduct(searchProduct, config.es_mappings.filename);
      const time1 = getPropFromProduct(searchProduct, config.es_mappings.time1);
      const objectType = getPropFromProduct(searchProduct, config.es_mappings.object_type);

      // skip setting base layer if requested, useful when we want to
      // hold off on setting base layer when loading from URL params
      if (showImage) {
        // if setting the base layer, skip updating source images
        // and target items as we'll do that later
        await dispatch(setBaseLayer(searchProduct, false, () => {}, false));
      }
      // update state
      dispatch({
        type: 'SET_ACTIVE_SEARCH_PRODUCT',
        isCustomProduct: newEDRIsCustomProduct,
        isAnnotatableProduct: newEDRIsAnnotatableProduct,
        searchProduct,
      });
      // nothing to do for a custom, non-annotatable product that has complete metadata
      if (newEDRIsCustomProduct && !newEDRIsAnnotatableProduct && !hasPartialMetadata) {
        dispatch(setFetchingGroups(false));
        telemetry.imageGroupLoaded(filename, time1, objectType, Date.now() - groupFetchingStartTime, true);
        resolve();
      } else {
        try {
          // fetch all related products for display
          dispatch(setFetchingGroups(true));
          const groups = await fetchProductGroupItems(searchProduct, signal, ocsPackages);

          // normalize the label for things like scalebar
          if (!searchProduct.vicar_label) {
            const label = await getNormalizeImageLabel(searchProduct);
            if (label) {
              searchProduct = { ...searchProduct, vicar_label: label };
              dispatch({
                type: 'SET_ACTIVE_SEARCH_PRODUCT',
                isCustomProduct: newEDRIsCustomProduct,
                isAnnotatableProduct: newEDRIsAnnotatableProduct,
                searchProduct,
              });
              dispatch({ type: 'UPDATE_LAYER', layer: searchProduct });
            }
          }

          // put all overlay types into a single list
          const flatGroups = groups.flat();
          flatGroups.forEach((item) => {
            // Add needed properties to various objects

            // For annotations, add opacity and store an unchanged ref to original object
            if (item.annotation_id) {
              item.opacity = 1;
              item.temp_ref = { ...item };
            }

            // For annotatable quicklooks and images, copy the base group id into the overlay id
            // which the object type does not have in it's schema
            if (
              newEDRIsCustomProduct &&
              newEDRIsAnnotatableProduct &&
              !getPropFromProduct(item, config.es_mappings.overlay_id)
            ) {
              setPropForProduct(
                item,
                config.es_mappings.overlay_id,
                getPropFromProduct(item, config.es_mappings.group_id)
              );
            }
          });

          // Give activeSearchProduct object the full set of metadata from the matching group object if needed.
          // Sometimes activeSearchProduct will be set from search in which case we may not have the full result set
          // (for search performance reasons)
          const activeSearchProductId = getPropFromProduct(searchProduct, config.es_mappings.id);
          const matchingProduct = flatGroups.find(
            (x) => activeSearchProductId === getPropFromProduct(x, config.es_mappings.id)
          );
          if (matchingProduct && hasPartialMetadata) {
            // Merge matching product full metadata into search product
            searchProduct = { ...searchProduct, ...matchingProduct };

            // update active search product and base layer metadata
            dispatch({
              type: 'SET_ACTIVE_SEARCH_PRODUCT',
              isCustomProduct: newEDRIsCustomProduct,
              isAnnotatableProduct: newEDRIsAnnotatableProduct,
              searchProduct,
            });
            dispatch({ type: 'UPDATE_LAYER', layer: searchProduct });
          }

          // If this is an annotatable custom product we'll need to fake the overlay id
          if (newEDRIsCustomProduct) {
            setPropForProduct(
              matchingProduct,
              config.es_mappings.overlay_id,
              getPropFromProduct(matchingProduct, config.es_mappings.group_id)
            );
          }

          dispatch({ type: 'APPEND_TO_GROUPS', groups: flatGroups });

          // Also only fetch these products if fetchAdditional = true
          if (!newEDRIsCustomProduct && fetchAdditional) {
            // fetch mosaics and reconstructed images the product is used in
            dispatch(updateAssociatedMosaics(searchProduct));
            dispatch(updateProductFreshness(searchProduct));

            await Promise.all([
              // fetch source images for mosaics and reconstructed images
              dispatch(updateSourceImages(searchProduct)),

              // fetch targets and add them to the listing
              dispatch(updateTargetListing(searchProduct)),
            ]);

            await dispatch(updateSourceImageFootprints(searchProduct));

            // show source image footprints if appropriate
            const footprints = getState().sourceImages.sourceImageFootprints;
            if (showSourceFootprints) {
              if (footprints && footprints.length) {
                dispatch(showSourceImageFootprints());
              }
            }
          }

          // Catch stale request after group load has finished
          if (getState().imageLayers.displayCounter === initDisplayCounter) {
            resolve();
          }

          dispatch(setFetchingGroups(false));
          telemetry.imageGroupLoaded(filename, time1, objectType, Date.now() - groupFetchingStartTime, true);

          // re-activate RDRs if appropriate
          if (!ignorePreserveRDRs && preserveOverlays) dispatch(preserveRDRs(currLayers, searchProduct));
          else dispatch(clearOperatorControls());

          // re-activate targets if appropriate
          if (preserveActiveTargets) dispatch(preserveTargets(currLayers, searchProduct));

          // show image features if appropriate
          if (autoShowImageFeatures) dispatch(showAllImageFeatures(searchProduct));

          // Set default zoom if one found
          const defaultZoom = getState().imageViewer.defaultZoom;
          if (typeof defaultZoom === 'number') {
            dispatch(updateViewport({ zoom: defaultZoom }, true, true));
          }
          resolve();
        } catch (err) {
          telemetry.logError(
            `Unable to load overlays and additional product metadata for ${getPropFromProduct(
              searchProduct,
              config.es_mappings.id
            )}`,
            err
          );

          telemetry.imageGroupLoaded(filename, time1, objectType, Date.now() - groupFetchingStartTime, false);

          // Since we don't have full label, delete the partial one to avoid confusion
          delete searchProduct[config.label_key];

          dispatch(setGroups([])); // clear groups just in case we have a partial (bad) list
          dispatch(setFetchingGroups(false));
          dispatch(
            showAlert({
              title: 'Error',
              message:
                'Unable to load overlays and additional product metadata. Overlays and the VICAR label for this product will not be viewable. Please try again later and contact support if you continue to encounter this error.',
              primaryAction: hideAlert,
              secondaryAction: () => {
                openSupportEmail({
                  subject: `${config.app_title} Error`,
                  message: 'Unable to load product groups',
                  url: window.location.toString(),
                });
                hideAlert();
              },
            })
          );
          resolve();
        }
      }
    });
  };
const setSearchProductAnnotation = (searchProduct) => async (dispatch) => {
  // if this isn't the right schema version, do nothing
  // old annos should be removed from DB
  if (parseInt(searchProduct.annotation_schema_version) >= 2) {
    try {
      const data = await fetchESDataForProduct(searchProduct.base_id);
      await dispatch(setSearchProductImage(data)); // assume anno was specified as base layer
      dispatch(addAnnotationToDisplay(searchProduct));
    } catch (err) {
      telemetry.logError('Failed to get base image for annotation', err);
    }
  }
};

const setSearchProductImageFeature = (searchProduct) => async (dispatch, getState) => {
  try {
    const data = await fetchESDataForProduct(searchProduct.base_id);
    const state = getState();
    const osdWrapper = state.imageViewer.osdRefs.osdWrapper;
    if (osdWrapper) {
      const callback = () => {
        osdWrapper.off('layeradded', callback);
        window.requestAnimationFrame(() => dispatch(addImageFeatureAnnotationToDisplay(searchProduct)));
      };
      osdWrapper.on('layeradded', callback);
    }
    await dispatch(setSearchProductImage(data)); // assume anno was specified as base layer
  } catch (err) {
    telemetry.logError('Failed to get base image for image feature', err);
  }
};

const addProductToViewingHistory = (searchProduct) => {
  // Search product is assumed to have partial metadata as to not store the entire product
  // in localstorage
  return {
    type: 'ADD_PRODUCT_TO_VIEWING_HISTORY',
    product: searchProduct,
  };
};

export const clearViewingHistory = () => {
  return {
    type: 'CLEAR_VIEWING_HISTORY',
  };
};

export const setActiveProductHasPartialMetadata = (hasPartialMetadata) => {
  return {
    type: 'SET_ACTIVE_PRODUCT_HAS_PARTIAL_METADATA',
    hasPartialMetadata,
  };
};

export const clearSearchProductState = () => (dispatch) => {
  dispatch(clearDisplayState());
  dispatch(setGroups([]));
};

export const clearDisplayState = () => (dispatch) => {
  dispatch(stopLayerAnimation());
  dispatch(clearPreferredImages());
  dispatch(setProductMetadataOpen(null));
  dispatch(removeAllLayers());
  dispatch(clearDataCursor());
  dispatch(clearMeasurements());
  dispatch(clearActiveAnnotation());
  dispatch(removeAllAnnotations());
  dispatch(setAnnotationEditorOpen(false));
  dispatch(setImageFeatureEditorOpen(false));
  dispatch(setTargetMetadataOpen());
  dispatch(setFeatureMetadataOpen());
  dispatch(setInteractionMode(config.interaction_modes.view_only));
  dispatch(clearSourceImageFootprints());
  dispatch(clearAssociatedMosaics());
  dispatch(clearSourceImages());
  dispatch(clearTargetListing());
  dispatch(clearProductFreshness());

  abortRequestControllers();
};

export const populateSearchValues = (URLParams) => {
  return (dispatch) => {
    config.search_config.facet_search.facets.forEach((facet) => {
      // Look for URL param for this facet
      const key = `FS_${facet.key}`;
      if (URLParams[key]) {
        const rawValue = URLParams[key];
        const values = typeof rawValue === 'string' ? [rawValue] : rawValue;
        dispatch(setFacetSearchValue(values, key));
      } else if (facet.defaults) {
        // Look for a default
        dispatch(setFacetSearchValue(facet.defaults, key));
      }
    });

    // Set Campaign facet
    // TODO should actually be able to convert these to be config driven
    // using custom facet types
    const campaignKey = 'FS_Campaign'; // TODO abstract these keys out
    if (URLParams[campaignKey]) {
      const rawValue = URLParams[campaignKey];
      const values = typeof rawValue === 'string' ? [rawValue] : rawValue;
      dispatch(setFacetSearchValue(values, campaignKey));
    }

    // Set Goal facet
    const goalKey = 'FS_GoalID';
    if (URLParams[goalKey]) {
      const rawValue = URLParams[goalKey];
      const values = typeof rawValue === 'string' ? [rawValue] : rawValue;
      dispatch(setFacetSearchValue(values, goalKey));
    }
    // Set Task facet
    const taskKey = 'FS_TaskID';
    if (URLParams[taskKey]) {
      const rawValue = URLParams[taskKey];
      const values = typeof rawValue === 'string' ? [rawValue] : rawValue;
      dispatch(setFacetSearchValue(values, taskKey));
    }

    config.search_config.time_search.facets.forEach((facet) => {
      // Look for URL param for this facets
      const key = `B_${facet.key}`;
      if (URLParams[key]) {
        const rawValue = URLParams[key];
        const values = typeof rawValue === 'string' ? [rawValue] : rawValue;
        dispatch(setBrowseValue(values, key));
      } else if (facet.defaults) {
        // Look for a default
        dispatch(setBrowseValue(facet.defaults, key));
      }
    });

    if (config.feature_flags.search.enable_target_search) {
      config.search_config.target_search_1.facets.forEach((facet) => {
        // Look for URL param for this facets
        const key = `TS_${facet.key}`;
        if (URLParams[key]) {
          const rawValue = URLParams[key];
          const values = typeof rawValue === 'string' ? [rawValue] : rawValue;
          dispatch(setTargetSearchValue(values, key));
        } else if (facet.defaults) {
          // Look for a default
          dispatch(setTargetSearchValue(facet.defaults, key));
        }
      });
    }

    if (config.feature_flags.search.enable_rdr_search) {
      config.search_config.rdr_search.facets.forEach((facet) => {
        // Look for URL param for this facets
        const key = `RS_${facet.key}`;
        if (URLParams[key]) {
          const rawValue = URLParams[key];
          const values = typeof rawValue === 'string' ? [rawValue] : rawValue;
          dispatch(setRDRSearchValue(values, key));
        } else if (facet.defaults) {
          // Look for a default
          dispatch(setRDRSearchValue(facet.defaults, key));
        }
      });
    }
  };
};

export const fetchAllCampaigns = async () => {
  const url = campGetAllCampaigns();
  try {
    const response = await fetch(url, { ...(USING_CSSO ? { credentials: 'include' } : null) });
    if (!response || !response.ok) throw Error('Bad CAMP response');
    const json = await response.json();
    if (json.status !== 'success' || !json.body || !json.body.results) {
      throw Error('Bad CAMP response');
    }
    return { results: json.body.results, error: '' };
  } catch (error) {
    telemetry.logError('Unable to fetch all campaigns from CAMP', error);
    return { results: [], error };
  }
};

export const fetchAllScienceIntentItems = async (type) => {
  try {
    const url = urlJoin(config.api_endpoints.ScienceIntent.API, `${type}?sort=created_at`);
    const response = await fetch(url, { ...(USING_CSSO ? { credentials: 'include' } : null) });
    if (!response || !response.ok) throw Error('Bad Science Intent response');
    const json = await response.json();
    if (!json.data) throw Error('Bad Science Intent response');
    return { results: json.data, error: '' };
  } catch (error) {
    telemetry.logError(`Unable to fetch all science intent items: ${type}`, error);
    return { results: [], error };
  }
};

export const setCampaigns = (campaigns) => {
  return {
    type: 'SET_CAMPAIGNS',
    campaigns,
  };
};

export const setGoals = (goals) => {
  return {
    type: 'SET_GOALS',
    goals,
  };
};

export const setTasks = (tasks) => {
  return {
    type: 'SET_TASKS',
    tasks,
  };
};

export const setKeywords = (keywords) => {
  const filteredKeywords = keywords
    .filter((k) => k.name !== 'ROOT')
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    .map((k) => {
      k.name = capitalize(typeof k.name === 'string' ? k.name : 'Unknown');
      return k;
    });
  return {
    type: 'SET_KEYWORDS',
    keywords: filteredKeywords,
  };
};

export const loadCampaignsAndScienceIntents = () => (dispatch) => {
  return new Promise(async (resolve) => {
    // Fetch Campaigns, Science Intent Goals and Tasks (without connections)
    const results = await Promise.all([
      fetchAllCampaigns(),
      fetchAllScienceIntentItems('goals'),
      fetchAllScienceIntentItems('tasks'),
      fetchAllScienceIntentItems('keywords'),
    ]);
    const problematicFields = [];
    if (!results[0].error) dispatch(setCampaigns(results[0].results));
    else problematicFields.push('Campaigns');
    if (!results[1].error) dispatch(setGoals(results[1].results));
    else problematicFields.push('Science Intent Goals');
    if (!results[2].error) dispatch(setTasks(results[2].results));
    else problematicFields.push('Science Intent Tasks');
    if (!results[3].error) dispatch(setKeywords(results[3].results));
    else problematicFields.push('Science Intent Keywords');

    if (problematicFields.length) {
      const fieldsString = problematicFields.join(', ');
      dispatch(
        showAlert({
          title: 'Error',
          message: `Unable to load data for ${fieldsString}. Some related capabilities may be degraded. If this issue persists please contact support.`,
          primaryAction: hideAlert,
          secondaryAction: () => {
            openSupportEmail({
              subject: `${config.app_title} Error`,
              message: `Unable to load data for ${fieldsString}.`,
            });
            hideAlert();
          },
        })
      );
    }

    resolve();
  });
};

export const loadProductDescriptions = () => {
  return async (dispatch) => {
    try {
      const response = await fetch(astriaGetProductDescriptions(), {
        credentials: 'include',
      });

      const text = await response.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'application/xml');
      const descriptions = {};
      if (!xml.getElementsByTagName('image_descriptions')) {
        throw new Error('Malformed Image Descriptions');
      }
      const descriptionNodes = xml
        .getElementsByTagName('image_descriptions')[0]
        .getElementsByTagName('image_description');
      Array.from(descriptionNodes).forEach((node) => {
        if (node.children.length) {
          const productDescription = {};
          Array.from(node.children).forEach((child) => {
            let text = '';
            try {
              // Strip newlines but preserve all "list" newlines
              if (child.textContent && child.textContent.trim()) {
                text = child.textContent
                  ? child.textContent
                      .replaceAll('\n:', '__________')
                      .replaceAll('\n', '')
                      .replaceAll('__________', '\n:')
                      .split('\n')
                      .map((x, i) => <div key={i}>{x}</div>)
                  : '';
              }
            } catch (err) {
              text = child.textContent;
            }
            productDescription[child.nodeName] = text;
          });
          descriptions[node.id] = productDescription;
        }
      });
      dispatch(setProductDescriptions(descriptions));
    } catch (error) {
      telemetry.logError('Unable to fetch product descriptions', error);
    }
  };
};

export const loadInitialData = () => {
  return async (dispatch, getState) => {
    // Get url from window location
    const parsed = getURLParams();

    // Set Package
    if (parsed[config.url_keys.package]) {
      dispatch(setPackage(parsed[config.url_keys.package]));
    }

    // Set image tab
    if (parsed[config.url_keys.imageTabIndex]) {
      const imageTab = parseInt(parsed[config.url_keys.imageTabIndex]);
      if (Object.values(ACTIVE_PRODUCT_TAB_INDICES).indexOf(imageTab) > -1) {
        dispatch(setImageTab(imageTab));
      }
    }

    // Fetch campaign and science intent data
    if (config.feature_flags.active_product.enable_science_intent_metadata) {
      await dispatch(loadCampaignsAndScienceIntents());
    }

    // Fetch RDR descriptions
    await dispatch(loadProductDescriptions());

    dispatch(populateSearchValues(parsed));

    // Set facet search inversions
    const parsedFacetSearchInversionsValue = parsed[config.url_keys.facetSearchInversions];
    let parsedFacetSearchInversions = [];
    if (parsedFacetSearchInversions) {
      if (typeof parsedFacetSearchInversionsValue === 'string') {
        parsedFacetSearchInversions = [parsedFacetSearchInversionsValue];
      } else if (typeof parsedFacetSearchInversionsValue === 'object') {
        parsedFacetSearchInversions = parsedFacetSearchInversionsValue;
      }
      parsedFacetSearchInversions.forEach((x) => dispatch(setFacetSearchInverted(true, x)));
    }

    // Set browse inversions
    const parsedBrowseInversionsValue = parsed[config.url_keys.browseInversions];
    let parsedBrowseInversions = [];
    if (parsedBrowseInversions) {
      if (typeof parsedBrowseInversionsValue === 'string') {
        parsedBrowseInversions = [parsedBrowseInversionsValue];
      } else if (typeof parsedBrowseInversionsValue === 'object') {
        parsedBrowseInversions = parsedBrowseInversionsValue;
      }
      parsedBrowseInversions.forEach((x) => dispatch(setBrowseInverted(true, x)));
    }

    // Set search tab
    if (parsed[config.url_keys.searchTabIndex]) {
      dispatch(setSearchTab(parseInt(parsed[config.url_keys.searchTabIndex])));
    }

    // Set active mosaic browse category
    if (parsed[config.url_keys.activeMosaicBrowseCategory]) {
      dispatch(setActiveMosaicBrowseCategory(parsed[config.url_keys.activeMosaicBrowseCategory]));
    }

    // If we don't have a search product in the URL we're done
    if (!parsed[config.url_keys.searchProduct]) {
      dispatch(setFetchingInitialData(false));
      telemetry.initialDataLoaded();
      return;
    }

    try {
      // fetch OCS data for initial search product
      const json = await performElasticSearchQuery({
        query: {
          match: {
            [config.es_mappings.id.key]: parsed[config.url_keys.searchProduct],
          },
        },
        size: 1,
      });

      // sanity check response
      if (!json.hits || !json.hits.hits || !json.hits.hits.length) {
        throw Error('Bad response');
      } else {
        const esResult = json.hits.hits[0]._source;

        // Set base image from activeSearchProduct if we have no overlays in our URL params or the product is a custom product.
        const isCustom = isCustomProduct(esResult);
        const isAnnotatable = isAnnotatableProduct(esResult);
        const noOverlays = !parsed[config.url_keys.overlays];
        const setBaseImage = noOverlays || (isCustom && !isAnnotatable); // TODO bug when no overlays but is annotatable
        await dispatch(setActiveSearchProduct(esResult, setBaseImage, false, noOverlays));

        // pull state and groups after update
        const state = getState();
        let groups = state.activeSearchProduct.groups;
        let activeSearchProduct = state.activeSearchProduct.searchProduct;

        // Set Zoom, Rotation, Image Center
        if (parsed.zoom || parsed.center || parsed.rotation) {
          const setView = () => {
            const defaultZoom = getState().imageViewer.defaultZoom;
            const zoom = parsed.zoom ? parseFloat(parsed.zoom) : defaultZoom;
            const rotation = parsed.rotation ? parseInt(parsed.rotation) : null;
            const center =
              parsed.center && typeof parsed.center === 'object' && parsed.center.length === 2
                ? [parseFloat(parsed.center[0]), parseFloat(parsed.center[1])]
                : null;
            dispatch(updateViewport({ zoom, center, rotation }, true, true));
          };

          // wait for the first tile to load in before setting the view
          if (state.imageViewer.firstImageLoaded) requestAnimationFrame(() => setView());
          else dispatch(addFirstImageLoadCallback(() => requestAnimationFrame(() => setView())));
        }

        // Set scalebars
        const parsedScalebarsValue = parsed[config.url_keys.scalebars];
        let parsedScalebars = [];
        if (parsedScalebarsValue) {
          if (typeof parsedScalebarsValue === 'string') parsedScalebars = [parsedScalebarsValue];
          else if (typeof parsedScalebarsValue === 'object') parsedScalebars = parsedScalebarsValue;

          parsedScalebars.forEach((scalebarString) => {
            const [lsPoint, pinToScreenStr] = scalebarString.split('_');
            const vals = lsPoint.replace(' ', '+').split('+'); // '+' is occasionally parsed out to ' '?
            const point = { line: parseFloat(vals[0]), sample: parseFloat(vals[1]) };
            const pinToScreen = pinToScreenStr === 'true';
            // If the image is already loaded we want to directly add the scalebar
            if (state.imageViewer.firstImageLoaded) {
              dispatch(addScalebarExternally(point, pinToScreen));
            } else {
              // Otherwise queue up the measurement to be added to OSD once the initial image has loaded
              dispatch(addInitialScalebar(point, pinToScreen));
            }
          });
        }

        // parse op controls
        let opControls = {};
        const parsedOpControlsString = parsed[config.url_keys.opControls];
        if (parsedOpControlsString) {
          const parsedOpControls = JSON.parse(parsedOpControlsString);
          Object.keys(parsedOpControls).forEach((productType) => {
            if (!opControls[productType])
              opControls[productType] = {
                controls: [],
                queryStrings: '',
              };

            const controlGroup = parsedOpControls[productType];
            const getControlsByImageType = (imageType) => {
              const imageControlKey = Object.keys(controlGroup)[0];
              const urlControlSet = controlGroup[imageControlKey];
              const defaultControls = getDefaultOperatorControls(imageType);
              const controls = defaultControls.map((defaultControlSet) => {
                const newControlSet = JSON.parse(JSON.stringify(defaultControlSet));
                newControlSet.controls.forEach((control) => {
                  const activeValueControl = urlControlSet.find((x) => x.k === control.key);
                  if (activeValueControl) {
                    control.key = activeValueControl.k;
                    control.value = activeValueControl.v;
                  }
                });
                return newControlSet;
              });
              return controls;
            };

            opControls[productType].getControlsByImageType = getControlsByImageType;
          });
        }

        // parse overlays from the URL
        // parse overlay string:
        // <overlay_filename>([img_operations]),...
        //   where the img_operations array can contain
        //   a, for opacity, which should be a single float value range[0-1]
        //   f, if opacity of the layer should override global visibility
        let parsedOverlays = [];
        const parsedOverlaysValue = parsed[config.url_keys.overlays];
        if (parsedOverlaysValue) {
          if (typeof parsedOverlaysValue === 'string') parsedOverlays = [parsedOverlaysValue];
          else if (typeof parsedOverlaysValue === 'object') parsedOverlays = parsedOverlaysValue;
        }
        const overlays = [];
        parsedOverlays.forEach((overlayString) => {
          const splits = overlayString.split('(');
          let filename = splits[0];
          let opacity = 1;
          let opacityOverridesVisibility = false;
          let anyOperationFound = false;
          let isCustom = false;
          if (splits.length > 1) {
            // We potentially have image operations
            // However the filename could have been something like: text (1).png
            // so if we find no operations in the center of the parentheses we will
            // assume those parentheses are part of the filename
            const splitRest = splits[1];
            const splitMiddle = splitRest.split(')');

            // but operations could be empty
            if (splitMiddle.length > 1) {
              // Check for all operations
              const operations = splitMiddle[0].split('|');
              operations.forEach((operation) => {
                const operationSplits = operation.split('=');
                if (operationSplits.length > 1) {
                  const operationType = operationSplits[0];
                  const operationData = operationSplits[1];
                  if (operationType === config.url_keys.transformations.opacity) {
                    opacity = parseFloat(operationData);
                    anyOperationFound = true;
                  } else if (operationType === config.url_keys.transformations.opacityOverridesVisibility) {
                    opacityOverridesVisibility = true;
                    anyOperationFound = true;
                  } else if (operationType === config.url_keys.transformations.customImageLayer) {
                    isCustom = true;
                    anyOperationFound = true;
                  }
                }
              });
            }
          }
          if (!anyOperationFound) filename = overlayString;
          if (filename) {
            overlays.push({
              filename,
              opacity,
              opacityOverridesVisibility,
              isCustom,
            });
          }
        });

        const parseTargets = () => {
          // Separately gather list of targets as they are stored separately with a different schema but ultimately
          // activated in the same way as seen below
          const parseTargetsValue = parsed[config.url_keys.targets];
          let parsedTargets = [];
          if (parseTargetsValue) {
            if (typeof parseTargetsValue === 'string') parsedTargets = [parseTargetsValue];
            else if (typeof parseTargetsValue === 'object') parsedTargets = parseTargetsValue;
          }
          let targets = [];
          const legacyAllTargets = parsedOverlays.indexOf('allTargets(targets=true)') > -1;
          if (parsedTargets.length || legacyAllTargets) {
            let opacity = 1;
            let opacityOverridesVisibility = false;
            let allExcept = false;
            let urlTargetIDs = [];

            // Process target list if not in legacy mode
            if (!legacyAllTargets) {
              // Last target will potentially contain operations
              const lastTarget = parsedTargets[parsedTargets.length - 1];
              const splits = lastTarget.split('(');
              let lastTargetID = splits[0];

              if (splits.length > 1) {
                // We potentially have target operations
                const splitRest = splits[1];
                const splitMiddle = splitRest.split(')');

                // but operations could be empty
                if (splitMiddle.length > 1) {
                  // Check for all operations
                  const operations = splitMiddle[0].split('|');
                  operations.forEach((operation) => {
                    const operationSplits = operation.split('=');
                    if (operationSplits.length > 1) {
                      const operationType = operationSplits[0];
                      const operationData = operationSplits[1];
                      if (operationType === config.url_keys.transformations.opacity) {
                        opacity = parseFloat(operationData);
                      } else if (operationType === config.url_keys.transformations.opacityOverridesVisibility) {
                        opacityOverridesVisibility = true;
                      } else if (operationType === config.url_keys.transformations.allExcept) {
                        allExcept = true;
                      }
                    }
                  });
                }
              }
              urlTargetIDs = [...parsedTargets.slice(0, parsedTargets.length - 1), lastTargetID].map(
                (x) => getShortTargetID(x) // ensure target IDs are short, could be long due to legacy URLs.
              );
            }

            let targetIDs = [];

            // If allExcept is found set the list of targets to be the targets not in the list
            // Additionally support the legacy allTargets URL param from pre-G7.4
            if (allExcept || legacyAllTargets) {
              // Get targets from state
              targetIDs = groups
                .filter((x) => isTargetFN(x) && urlTargetIDs.indexOf(getShortTargetID(x.target.content.id)) === -1)
                .map((x) => getShortTargetID(x.target.content.id));
            } else targetIDs = urlTargetIDs;

            if (targetIDs.length) {
              targets = targetIDs.map((id) => {
                return {
                  filename: id,
                  opacity,
                  opacityOverridesVisibility,
                  isTarget: true,
                };
              });
            }
          }
          return targets;
        };

        // Activate overlays and targets w/order and operations
        let latestVersions = getLatestVersionsByType(
          groups,
          {},
          getPropFromProduct(activeSearchProduct, config.es_mappings.spec_flag, null)
        );

        async function loadOverlay(overlay, isBaseImage) {
          // Find filename in our store groups
          const filename = overlay.filename;
          const opacity = overlay.opacity;
          const opacityOverridesVisibility = overlay.opacityOverridesVisibility;
          const isTarget = overlay.isTarget;
          const isCustom = overlay.isCustom;

          // Find the product in groups, targets need special handling due to their shortened UUID
          let item;
          if (!isTarget) {
            item = groups.find((x) => filename === getPropFromProduct(x, config.es_mappings.filename));
          } else {
            item = groups.find((x) => isTargetFN(x) && getShortTargetID(x.target.content.id) === filename);
          }

          if (isCustom) {
            if (item) item._isCustom = true;
            else {
              try {
                item = await fetchESDataForProduct(filename, null, config.es_mappings.filename.key);
                item._isCustom = true;
                dispatch({ type: 'APPEND_TO_GROUPS', groups: [item] });
              } catch (err) {
                console.log('Unable to load custom layer', err, filename);
              }
            }
          }

          // Handle layers that are not annotations or features
          if (
            item &&
            (getPropFromProduct(item, config.es_mappings.object_type) !== 'm20-mv-annotation' ||
              getPropFromProduct(item, config.es_mappings.object_type) !== 'm20-image-feature')
          ) {
            if (isBaseImage) {
              // add this as the base image
              try {
                // Base layer image stretch, applied to base image before
                // waiting for various additional data to load
                const beforeFetchAdditional = () => {
                  if (parsed[config.url_keys.stretch.localStretch]) {
                    const stretch = parsed[config.url_keys.stretch.localStretch].split('_');
                    dispatch(updateImageStretch(parseInt(stretch[0]), parseInt(stretch[1])));
                  } else if (parsed[config.url_keys.stretch.percentStretch]) {
                    const stretch = parsed[config.url_keys.stretch.percentStretch].split('_');
                    dispatch(fetchImageHistogram(item)).then(() => {
                      const min = parseFloat(stretch[0]);
                      const max = parseFloat(stretch[1]);
                      dispatch(updateStretchMode('backend'));
                      dispatch(updatePercentStretch(min, max));
                      dispatch(backendStretchBaseImage(false, min, max));
                    });
                  } else if (parsed[config.url_keys.stretch.DNStretch]) {
                    const stretch = parsed[config.url_keys.stretch.DNStretch].split('_');
                    const min = parseInt(stretch[0]);
                    const max = parseInt(stretch[1]);
                    dispatch(fetchImageHistogram(item)).then(() => {
                      dispatch(updateStretchMode('backend'));
                      dispatch(updateImageStretch(min, max));
                      dispatch(backendStretchBaseImage(true, min, max));
                    });
                  }
                };

                item = await dispatch(setBaseLayer(item, !noOverlays, beforeFetchAdditional));

                // pull state and groups after update
                groups = getState().activeSearchProduct.groups;
                latestVersions = getLatestVersionsByType(
                  groups,
                  {},
                  getPropFromProduct(item, config.es_mappings.spec_flag, null)
                );
              } catch (err) {
                telemetry.logError('Failed to set base layer or stretch parameters', err);
              }
            } else {
              const firstImageLoaded = getState().imageViewer.firstImageLoaded;
              if (isTarget) {
                if (firstImageLoaded) {
                  dispatch(addTargetLayer(item, false, opacity));
                } else {
                  dispatch(addFirstImageLoadCallback(() => dispatch(addTargetLayer(item, false, opacity))));
                }
              } else {
                // if this overlay is not the latest version, assume this is the preferred version
                const itemIsLatest = !!latestVersions.find((prod) => {
                  return (
                    getPropFromProduct(prod, config.es_mappings.id) === getPropFromProduct(item, config.es_mappings.id)
                  );
                });
                if (!itemIsLatest) {
                  dispatch(setPreferredImageForType(item));
                }
                dispatch(addLayer(item, opacity));
              }
              if (opacityOverridesVisibility) dispatch(changeOpacity(item, opacity));

              // Check if there are any operator controls to apply
              const itemProductType = getPropFromProduct(item, config.es_mappings.product_type);
              const itemImageType = getPropFromProduct(item, config.es_mappings.image_type);
              if (opControls[itemProductType]) {
                // Compute queryString now that we have a image type
                const queryStrings = [];
                opControls[itemProductType].controls =
                  opControls[itemProductType].getControlsByImageType(itemImageType);
                opControls[itemProductType].controls.forEach((controlSet) => {
                  controlSet.controls.forEach((control) => {
                    queryStrings.push(getQueryStringForOperatorControl(control, itemImageType));
                  });
                });
                const queryString = queryStrings.length > 0 ? queryStrings.filter((x) => x).join('&') : null;
                dispatch(setOperatorControlsForProduct(item, opControls[itemProductType].controls, queryString));
              }
            }
          }
        }

        // Add non-target overlays
        for (let i = 0; i < overlays.length; i++) {
          const overlay = overlays[i];
          await loadOverlay(overlay, i === 0);
        }

        // Parse targets now that we've loaded our base image (required)
        const targets = parseTargets();

        // Add target overlays
        for (let i = 0; i < targets.length; i++) {
          const target = targets[i];
          await loadOverlay(target, false);
        }

        // parse annotations and anno view settings
        let parsedAnnotations = [];
        const parsedAnnotationsValue = parsed[config.url_keys.annotation];
        if (parsedAnnotationsValue) {
          if (typeof parsedAnnotationsValue === 'string') parsedAnnotations = [parsedAnnotationsValue];
          else if (typeof parsedAnnotationsValue === 'object') parsedAnnotations = parsedAnnotationsValue;
        }

        const annotations = [];
        parsedAnnotations.forEach((annotationString) => {
          const splits = annotationString.split('(');
          const annotationId = splits[0];
          let opacity = 1;
          let opacityOverridesVisibility = false;
          if (splits.length > 1) {
            // we know we have image operations
            const splitRest = splits[1];
            const splitMiddle = splitRest.split(')');

            // but operations could be empty
            if (splitMiddle.length > 1) {
              // Check for all operations
              const operations = splitMiddle[0].split('|');
              operations.forEach((operation) => {
                const operationSplits = operation.split('=');
                if (operationSplits.length > 1) {
                  const operationType = operationSplits[0];
                  const operationData = operationSplits[1];
                  if (operationType === config.url_keys.transformations.opacity) {
                    opacity = parseFloat(operationData);
                  } else if (operationType === config.url_keys.transformations.opacityOverridesVisibility) {
                    opacityOverridesVisibility = true;
                  }
                }
              });
            }
          }
          if (annotationId) {
            annotations.push({
              annotationId,
              opacity,
              opacityOverridesVisibility,
            });
          }
        });

        const firstImageLoaded = getState().imageViewer.firstImageLoaded;

        // Activate annotations w/order and operations
        let annoError = false;
        annotations.forEach((item) => {
          // Find filename in our store groups
          const annotationId = item.annotationId;
          const opacity = item.opacity;
          const opacityOverridesVisibility = item.opacityOverridesVisibility;
          let isFeature = false;
          const annotation = groups.find((x) => {
            if (annotationId === x.annotation_id) {
              const objectType = getPropFromProduct(x, config.es_mappings.object_type);
              if (objectType === 'm20-image-feature') {
                isFeature = true;
              }
              return true;
            }
            return false;
          });

          if (annotation) {
            annotation.opacity = opacity;
            annotation.opacityOverridesVisibility = opacityOverridesVisibility;
            let addAction = isFeature ? addImageFeatureAnnotationToDisplay : addAnnotationToDisplay;
            const addAnnotation = () =>
              dispatch(addAction(annotation)).then(() => {
                if (opacityOverridesVisibility) dispatch(setAnnotationOpacity(annotation, opacity));
              });
            if (firstImageLoaded) requestAnimationFrame(() => addAnnotation());
            else dispatch(addFirstImageLoadCallback(() => requestAnimationFrame(() => addAnnotation())));
          } else {
            telemetry.logWarning(`Unable to load annotation: ${annotationId} from URL`);
            annoError = true;
          }
        });

        // only show error modal once for annotations
        if (annoError) {
          dispatch(
            showAlert({
              title: 'Error',
              message:
                'Unable to load requested annotation(s) from URL. Please contact support if you continue to encounter this error.',
              primaryAction: hideAlert,
              secondaryAction: () => {
                openSupportEmail({
                  subject: `${config.app_title} Error`,
                  message: 'Unable to load annotation from URL',
                  url: window.location.toString(),
                });
                hideAlert();
              },
            })
          );
        }

        // Set selected target
        if (parsed[config.url_keys.selectedTarget]) {
          const selectedTargetId = parsed[config.url_keys.selectedTarget];
          // Attempt to find target in groups list
          const targetLayer = groups.find((x) => isTargetFN(x) && x.target.content.id === selectedTargetId);
          if (targetLayer) {
            // Use rAF to wait a frame until targets have been added to fabric so that the
            // fabric target selection can succeed
            if (firstImageLoaded) {
              requestAnimationFrame(() => dispatch(setTargetMetadataOpen(targetLayer.target.content.id)));
            } else {
              dispatch(
                addFirstImageLoadCallback(() =>
                  requestAnimationFrame(() => dispatch(setTargetMetadataOpen(targetLayer.target.content.id)))
                )
              );
            }
          }
        }

        // Set Data Cursor
        if (parsed[config.url_keys.dataCursor] || parsed[config.url_keys.dataCursorOrbital]) {
          // Get Data Cursor origin
          const cursorOrigin = parsed[config.url_keys.dataCursorOrigin] || 'IMAGE';

          // Parse DN and/or orbital values
          let dnValues = [-1, -1];
          let orbitalValues = [-1, -1];
          if (parsed[config.url_keys.dataCursor]) {
            const splitDNCursor = parsed[config.url_keys.dataCursor].split('_'); // separate into both values
            if (splitDNCursor.length === 2) {
              dnValues = [parseInt(splitDNCursor[0]), parseInt(splitDNCursor[1])];
            }
          }
          if (parsed[config.url_keys.dataCursorOrbital]) {
            const splitOrbitalCursor = parsed[config.url_keys.dataCursorOrbital].split('_'); // separate into both values
            if (splitOrbitalCursor.length === 2) {
              orbitalValues = [parseFloat(splitOrbitalCursor[0]), parseFloat(splitOrbitalCursor[1])];
            }
          }
          const options = {
            active: true,
            line: dnValues[0],
            sample: dnValues[1],
            mapLon: orbitalValues[0],
            mapLat: orbitalValues[1],
            cursorOrigin,
          };
          if (firstImageLoaded) {
            // If the image is already loaded we want to directly add the data cursor
            dispatch(setDataCursorExternally(options));
          } else {
            // Otherwise queue up the data cursor to be added to OSD once the initial image has loaded
            dispatch(setDataCursor(options));
          }
        }

        // Set measurements
        const parsedMeasurementsValue = parsed[config.url_keys.measurements];
        let parsedMeasurements = [];
        if (parsedMeasurementsValue) {
          if (typeof parsedMeasurementsValue === 'string') parsedMeasurements = [parsedMeasurementsValue];
          else if (typeof parsedMeasurementsValue === 'object') parsedMeasurements = parsedMeasurementsValue;

          parsedMeasurements.forEach((measurementString) => {
            const lsPoints = measurementString.split('_');
            const points = lsPoints.map((point) => {
              const vals = point.replace(' ', '+').split('+'); // '+' is occasionally parsed out to ' '?
              return { line: parseFloat(vals[0]), sample: parseFloat(vals[1]) };
            });
            // If the image is already loaded we want to directly add the measurement
            if (firstImageLoaded) {
              dispatch(addMeasurementExternally(points[0], points[1]));
            } else {
              // Otherwise queue up the measurement to be added to OSD once the initial image has loaded
              dispatch(addInitialMeasurement(points[0], points[1]));
            }
          });
        }

        // toggle everything off if needed
        if (parsed[config.url_keys.overlaysVisible] === 'false') {
          // Use rAF to wait for the target layers to be added to Fabric canvas
          // before hiding them. This could be improved as it can cause the targets to
          // flash on and then off if overlays are not visible and targets are active
          // when loading from URL.
          requestAnimationFrame(() => {
            dispatch(toggleOverlaysVisible(false));
          });
        }

        // start animation if requested
        const parsedAnimationState = parsed[config.url_keys.animationState];
        if (parsedAnimationState === 'playing' || parsedAnimationState === 'paused') {
          const parsedAnimationSpeed = parseInt(parsed[config.url_keys.animationSpeed]);
          if (parsedAnimationState === 'playing') {
            dispatch(playLayerAnimation());
          } else {
            dispatch(pauseLayerAnimation());
          }
          dispatch(setAnimationSpeed(parsedAnimationSpeed));
        }
      }

      // done loading initial state from URL
      dispatch(setFetchingInitialData(false));
    } catch (err) {
      // failed to fetch appropriate data for initial state
      telemetry.logError('Error fetching search product from url:', err);
      dispatch(
        showAlert({
          title: 'Error',
          message:
            'Unable to load requested image from URL. Please verify that the image name in the URL is valid and contact support if you continue to encounter this error.',
          onDismiss: () => dispatch(setFetchingInitialData(false)),
          primaryAction: () => {
            dispatch(setFetchingInitialData(false));
          },
          secondaryAction: () => {
            openSupportEmail({
              subject: `${config.app_title} Error`,
              message: 'Unable to load image from URL',
            });
            dispatch(setFetchingInitialData(false));
          },
        })
      );
    } finally {
      telemetry.initialDataLoaded();
    }
  };
};
