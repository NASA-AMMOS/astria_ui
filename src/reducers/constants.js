const getImageViewingHistory = () => {
  try {
    // Array of objects mapping s3 paths to optional metadata
    const item = localStorage.getItem('imageViewingHistory');
    if (!item) return [];
    if (typeof item !== 'string') throw Error('Bad image viewing history data');
    const s3Paths = JSON.parse(item);
    return s3Paths.map((x) => ({ [x]: null })); // No metadata initially
  } catch (err) {
    console.log(err, ' ...resetting image history.');
    localStorage.removeItem('imageViewingHistory');
    return [];
  }
};

export const createDefaultStarredMetadataFieldsValue = (config) => ({ ocs: [], [config.label_key]: [] });

const getStarredMetadataFieldsWithDefault = (defaultVal) => {
  try {
    const item = localStorage.getItem('starredMetadataFields');
    if (!item) return defaultVal;
    if (typeof item !== 'string') throw Error('Bad starred metadata fields data');
    const fields = JSON.parse(item);
    if (fields && Array.isArray(fields.ocs)) {
      return fields;
    } else throw Error('Bad starred metadata fields data');
  } catch (err) {
    console.log(err, ' ...resetting starred metadata fields.');
    localStorage.removeItem('starredMetadataFields');
    return defaultVal;
  }
};

export const DEFAULT_DEBUG = {
  debugState: false,
};

export const DEFAULT_SIDEBAR = {
  productSearchSidebarOpen: localStorage.getItem('productSearchSidebarOpen') !== 'false',
  productDetailsSidebarOpen: localStorage.getItem('productDetailsSidebarOpen') !== 'false',
  searchTabIndex: localStorage.getItem('leftPaneTabIndex') ? parseInt(localStorage.getItem('leftPaneTabIndex')) : 0,
  imageTabIndex: localStorage.getItem('rightPaneTabIndex') ? parseInt(localStorage.getItem('rightPaneTabIndex')) : 0,
};

export const createDefaultSidebar = (config) => ({
  productSearchSidebarOpen: localStorage.getItem('productSearchSidebarOpen') !== 'false',
  productDetailsSidebarOpen: localStorage.getItem('productDetailsSidebarOpen') !== 'false',
  searchTabIndex: localStorage.getItem('leftPaneTabIndex')
    ? parseInt(localStorage.getItem('leftPaneTabIndex'))
    : config.search_config.default_search_tab === 'facet_search'
    ? 1
    : 0,
  imageTabIndex: localStorage.getItem('rightPaneTabIndex') ? parseInt(localStorage.getItem('rightPaneTabIndex')) : 0,
});

export const DEFAULT_VIEWER_STATE = {
  defaultZoom: localStorage.getItem('defaultZoom') ? parseInt(localStorage.getItem('defaultZoom')) : null,
  zoom: null,
  rotation: 0, // rotation of image viewer in degrees
  center: null, // image center in [x,y] TODO should this be line/sample or pixel? Probably pixel for now.
  initialZoom: null,
  initialRotation: null,
  initialCenter: null, // image center in [x,y] TODO should this be line/sample or pixel? Probably pixel for now.
  imageBounds: null, // image top/left height/width
  osdRefs: {}, // set of OpenSeaDragon extension refs
  firstImageLoaded: false, // true when the first image has loaded
  firstImageLoadCallbacks: [], // array of functions to call when firstImageLoaded is set to true
  viewerLoading: false,
  layerLoadingStates: {},
};

export const DEFAULT_HISTOGRAM = {
  rVals: [],
  gVals: [],
  bVals: [],
};

export const DEFAULT_DATA_CURSOR = {
  active: false,
  product: null,
  line: -1,
  sample: -1,
  mapLon: -1,
  mapLat: -1,
  cursorOrigin: '',
};

export const DEFAULT_IMAGE_VIEWER = {
  currentLine: -1,
  currentSample: -1,
};

export const DEFAULT_ANNOTATION_MODE = {
  interactionMode: 'view_only',
  measurements: [],
  initialMeasurements: [],
  scalebars: [],
  initialScalebars: [],
  selectedShapes: [],
  annotationEditorOpen: false,
  annotations: [], // structure { obj: { annotation object }, loading: true/false }
  activeAnnotation: {}, // annotation being edited
  savedAnnotationRef: {},
  imageFeatureEditorOpen: false,
  annotationToDelete: null,
  deleteModalOpen: false,
  clickedShape: null,
};

export const createDefaultAnnotationMode = (config) => ({
  interactionMode: config.interaction_modes.view_only,
  measurements: [],
  initialMeasurements: [],
  scalebars: [],
  initialScalebars: [],
  selectedShapes: [],
  annotationEditorOpen: false,
  annotations: [],
  activeAnnotation: {},
  savedAnnotationRef: {},
  imageFeatureEditorOpen: false,
  annotationToDelete: null,
  deleteModalOpen: false,
  clickedShape: null,
});

export const ACTIVE_SEARCH_PRODUCT = {
  searchProduct: {},
  groups: [],
  isCustomProduct: false,
  isAnnotatableProduct: false,
  hasPartialMetadata: false,
  cursor: DEFAULT_DATA_CURSOR,
  imageHistory: getImageViewingHistory(),
  fresherProduct: null,
};

export const SOURCE_IMAGES_STATE = {
  sourceImages: [],
  fetchingSourceImages: false,
  sourceImageFootprints: [],
  fetchingSourceImageFootprints: false,
};

export const ASSOCIATED_MOSAICS_STATE = {
  associatedMosaics: [],
  fetchingAssociatedMosaics: false,
};

export const TARGETS_STATE = {
  fetchingTargets: false,
};

export const DEFAULT_LOADING_STATE = {
  fetchingInitialData: true,
  fetchingGroups: true,
};

export const DEFAULT_SEARCH_STATE = {
  campaigns: [],
  goals: [],
  tasks: [],
  keywords: [],
  keywordsMap: {},
  facetSearchValues: {},
  defaultFacetSearchValues: {},
  browseValues: {},
  defaultBrowseValues: {},
  facetSearchInversions: {},
  browseInversions: {},
  targetSearchValues: {},
  defaultTargetSearchValues: {},
  targetSearchInversions: {},
  targetSearchViewOptions: {},
  rdrSearchValues: {},
  defaultRDRSearchValues: {},
  rdrSearchInversions: {},
  rdrSearchViewOptions: {},
  ocsPackages: {
    base: [],
    active: null,
  },
  storeQueryID: 0,
  resultsExportOpen: false,
  resultsExportItems: [],
};

export const DEFAULT_IMAGE_ADJUSTMENTS_STATE = {
  histogram: [],
  DNStretchLow: null,
  DNStretchHigh: null,
  stretchLow: 0,
  stretchHigh: 255,
  percentLow: 0,
  percentHigh: 100,
  stretchMin: 0,
  stretchMax: 255,
  percentMin: 0,
  percentMax: 100,
  resetStretch: true,
  stretchMode: 'local',
  loading: true,
  extrema: false,
};

export const DEFAULT_IMAGE_DATA_EXPLORER = {
  autoAddRDRs: true,
};

export const DEFAULT_ALERT_STATE = {
  open: false,
  title: null,
  message: null,
  primaryAction: null,
  secondaryAction: null,
  primaryActionLabel: '',
  secondaryActionLabel: '',
};

export const ACTIVE_LAYERS = {
  layers: [],
  overlaysVisible: true,
  metadataProduct: null,
  metadataProductIsPartial: false,
  selectedTarget: null,
  selectedFeature: null,
  preserveRDRs: true,
  preserveTargets: true,
  showSourceImageFootprints: false,
  selectedFootprint: null,
  customLayerModalOpen: false,
  animationPlayerState: 'stopped',
  animationPlayerFrameIndex: 0,
  animationFrameGapMS: 166,
  sourceImageFootprintsFilter: () => true,
  autoShowImageFeatures: false,
  operatorControlsProduct: null,
  operatorControlsMap: {},
  preferredImageForType: {},
  displayCounter: 0,
};

export const EXPORT_IMAGES = {
  preserve: false,
  exporting: false,
};

export const DEFAULT_HELP = {
  open: false,
  activeArticleKey: '',
};

export const DEFAULT_APP = {
  user: {},
  productDescriptions: {},
  starredMetadataFields: { ocs: [] },
};

export const createDefaultSearchState = (config) => {
  const defaultFacetSearchValues = config.search_config.facet_search.facets.reduce((acc, el) => {
    acc[el.key] = el.defaults || [];
    return acc;
  }, {});
  const defaultTimeSearchValues = config.search_config.time_search.facets.reduce((acc, el) => {
    acc[el.key] = el.defaults || [];
    return acc;
  }, {});
  return {
    campaigns: [],
    goals: [],
    tasks: [],
    keywords: [],
    keywordsMap: {},
    facetSearchValues: {},
    defaultFacetSearchValues,
    browseValues: {},
    defaultBrowseValues: defaultTimeSearchValues,
    facetSearchInversions: {},
    browseInversions: {},
    targetSearchValues: {},
    defaultTargetSearchValues: {},
    targetSearchInversions: {},
    targetSearchViewOptions: {},
    rdrSearchValues: {},
    defaultRDRSearchValues: {},
    rdrSearchInversions: {},
    rdrSearchViewOptions: {},
    ocsPackages: {
      base: [config.image_upload.pkg_name, config.annotation_upload.pkg_name],
      active: config.search_config.default_package,
    },
    storeQueryID: 0,
    resultsExportOpen: false,
    resultsExportItems: [],
  };
};

export const createDefaultApp = (config) => ({
  user: {},
  productDescriptions: {},
  starredMetadataFields: getStarredMetadataFieldsWithDefault(createDefaultStarredMetadataFieldsValue(config)),
});
