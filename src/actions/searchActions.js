export const setFacetSearchInverted = (inverted, componentId) => {
  return {
    type: 'SET_FACET_SEARCH_COMPONENT_INVERTED',
    inverted,
    componentId,
  };
};

export const setFacetSearchValue = (values, componentId, clearInversion = false) => {
  return {
    type: 'SET_FACET_SEARCH_VALUE',
    values,
    componentId,
    clearInversion,
  };
};

export const clearFacetSearchValues = () => {
  return {
    type: 'CLEAR_FACET_SEARCH_VALUES',
  };
};

export const setBrowseInverted = (inverted, componentId) => {
  return {
    type: 'SET_BROWSE_COMPONENT_INVERTED',
    inverted,
    componentId,
  };
};

export const setBrowseValue = (values, componentId) => {
  return {
    type: 'SET_BROWSE_VALUE',
    values,
    componentId,
  };
};

export const clearBrowseValues = (componentIds) => {
  return {
    type: 'CLEAR_BROWSE_VALUES',
    componentIds,
  };
};

export const setTargetSearchInverted = (inverted, componentId) => {
  return {
    type: 'SET_TARGET_SEARCH_COMPONENT_INVERTED',
    inverted,
    componentId,
  };
};

export const setTargetSearchValue = (values, componentId) => {
  return {
    type: 'SET_TARGET_SEARCH_VALUE',
    values,
    componentId,
  };
};

export const clearTargetSearchValues = (componentIds) => {
  return {
    type: 'CLEAR_TARGET_SEARCH_VALUES',
    componentIds,
  };
};

export const setTargetSearchViewOption = (key, value) => {
  return {
    type: 'SET_TARGET_SEARCH_VIEW_OPTION',
    key,
    value,
  };
};

export const setRDRSearchValue = (values, componentId) => {
  return {
    type: 'SET_RDR_SEARCH_VALUE',
    values,
    componentId,
  };
};

export const clearRDRSearchValues = (componentIds) => {
  return {
    type: 'CLEAR_RDR_SEARCH_VALUES',
    componentIds,
  };
};

export const setRDRSearchInverted = (inverted, componentId) => {
  return {
    type: 'SET_RDR_SEARCH_COMPONENT_INVERTED',
    inverted,
    componentId,
  };
};

export const setRDRSearchViewOption = (key, value) => {
  return {
    type: 'SET_RDR_SEARCH_VIEW_OPTION',
    key,
    value,
  };
};

export const setActiveMosaicBrowseCategory = (activeMosaicBrowseCategory) => {
  return {
    type: 'SET_ACTIVE_MOSAIC_BROWSE_CATEGORY',
    activeMosaicBrowseCategory,
  };
};

export const setActiveCategorySearchCategory = (activeCategorySearchCategory) => {
  return {
    type: 'SET_ACTIVE_CATEGORY_SEARCH_CATEGORY',
    activeCategorySearchCategory,
  };
};

export const setPackage = (ocsPackage) => {
  return {
    type: 'SET_PACKAGE',
    ocsPackage,
  };
};

export const performSearch = () => {
  return {
    type: 'PERFORM_SEARCH',
  };
};

export const setResultsExportOpen = (open, results = []) => {
  return {
    type: 'SET_RESULTS_EXPORT_OPEN',
    open,
    results,
  };
};
