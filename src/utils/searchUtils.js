import { DeepDiffMapper, getDefined } from 'src/utils';
import { getConfig } from 'src/utils/configRegistry';
import { getAlias, getPropFromProduct } from 'src/utils/sharedUtils';
import * as telemetry from 'src/utils/telemetryUtils';

/**
 * Determine differences between filenames by comparing characters at each index
 * @param {Array<string>} filenames - Array of filenames to compare
 * @returns {Object} Map of indices where differences occur
 */
export function determineFilenameDiffs(filenames) {
  const charAtIndexMap = {};
  let minSize = filenames[0].length;
  filenames.forEach((filename) => {
    if (filename.length < minSize) minSize = filename.length;
    Array.from(filename).forEach((char, index) => {
      if (!charAtIndexMap[index]) charAtIndexMap[index] = {};
      charAtIndexMap[index][char] = true;
    });
  });
  const indexDiffMap = {};
  Object.keys(charAtIndexMap).forEach((index) => {
    const intIndex = parseInt(index);
    if (intIndex > minSize || Object.keys(charAtIndexMap[index]).length > 1) {
      indexDiffMap[index] = true;
    }
  });
  return indexDiffMap;
}

/**
 * Format a filename string with highlighted segments based on diff map
 * @param {string} string - The filename string to format
 * @param {Object} indexDiffMap - Map of indices to highlight
 * @returns {Array} Array of React elements and strings
 */
export function formatFilenameLabel(string, indexDiffMap, highlightClassName) {
  if (!string.length) return '';
  if (!indexDiffMap) return indexDiffMap;
  const elements = [];
  let accum = [];
  const isHighlight = (index) => indexDiffMap[index.toString()];
  let accumType;

  const finishSegment = (accType, key) => {
    if (accType === 'highlight') {
      elements.push({
        type: 'highlight',
        key,
        text: accum.join(''),
        className: highlightClassName,
      });
    } else {
      elements.push(accum.join(''));
    }
  };

  const processChar = (char, index) => {
    const nextAccumType = isHighlight(index) ? 'highlight' : 'string';
    if (accumType && nextAccumType !== accumType) {
      finishSegment(accumType, index);
      accum = [];
    }
    accum.push(char);
    accumType = nextAccumType;
  };

  Array.from(string).forEach((char, index) => processChar(char, index));
  finishSegment(accumType, string.length - 1);
  return elements;
}

/**
 * Generate localStorage key for search options
 * @param {string} urlPrefix - URL prefix from search config
 * @param {string} optionName - Name of the option
 * @returns {string} LocalStorage key
 */
export function getLocalStorageSearchKey(urlPrefix, optionName) {
  return `${urlPrefix}_${optionName}`;
}

/**
 * Format facet value for display in active facet chips
 * @param {Object} facet - Facet configuration object
 * @param {*} value - Facet value(s)
 * @param {Object} goalsMap - Map of goals by ID
 * @param {Object} tasksMap - Map of tasks by ID
 * @returns {string} Formatted value string
 */
export function formatFacetValueForDisplay(facet, value, goalsMap = {}, tasksMap = {}) {
  let valueStr = '';

  if (['multilist', 'radiomultilist'].indexOf(facet.type) !== -1 && value.length) {
    valueStr = value.map((x) => getAlias(facet.key, x)).join(', ');
  } else if (facet.type === 'range') {
    valueStr = value.map((x) => getAlias(facet.key, x)).join('–');
  } else if (facet.type === 'range-select') {
    valueStr =
      value
        .slice(1, value.length)
        .map((x) => getAlias(facet.key, x))
        .join('–') || '-';
  } else if (facet.type === 'input') {
    valueStr = value[0];
  } else if (facet.type === 'scienceIntent') {
    if (facet.scienceIntentItem === 'CAMPAIGN') {
      valueStr = value.join(', ');
    } else {
      const resultMap = facet.scienceIntentItem === 'GOAL' ? goalsMap : tasksMap;
      const matchingItem = resultMap[value[0]];
      if (matchingItem) {
        valueStr = matchingItem.title;
      } else {
        telemetry.logWarning(`Unable to find ${facet.scienceIntentItem} with ID ${value[0]} in global list.`);
        console.warn('ResultMap', resultMap);
        valueStr = `ID=${value[0]}`;
      }
    }
  } else if (facet.type === 'datetime') {
    valueStr = value.filter((v) => v).join(' - ');
  } else if (facet.type === 'scilo-footprint') {
    valueStr = `${value[0].slice(0, 14)}...`;
  } else if (facet.type === 'multivalueinput') {
    valueStr = value.map((v) => v.split('___').slice(1).join(': ')).join(', ');
  } else {
    valueStr = value.toString();
  }

  return valueStr;
}

/**
 * Check if facet value matches default values
 * @param {Object} facet - Facet configuration
 * @param {Array} values - Current facet values
 * @param {Object} defaultValues - Default values object
 * @returns {boolean} True if values match defaults
 */
export function isFacetValueDefault(facet, values, defaultValues) {
  if (defaultValues[facet.key] && defaultValues[facet.key].length) {
    const differ = new DeepDiffMapper();
    const valueDiff = differ.map(defaultValues[facet.key], [...values].sort());
    return !valueDiff.changed;
  }
  return false;
}

/**
 * Determine if search inversion should be cleared for a facet
 * @param {Object} facet - Facet configuration
 * @param {Array} values - Current facet values
 * @param {Object} defaultValues - Default values object
 * @returns {boolean} True if inversion should be cleared
 */
export function shouldClearInversion(facet, values, defaultValues) {
  let facetHasDefaults = false;
  if (defaultValues[facet.key] && defaultValues[facet.key].length) {
    facetHasDefaults = true;
  }

  return !facetHasDefaults && facet.type !== 'tile' && (values || []).length === 0;
}

/**
 * Get the result label/title for a product based on view configuration
 * @param {Object} item - Product item
 * @param {string} viewKey - View key from config.es_mappings
 * @param {Object} keywordsMap - Map of keywords by ID
 * @returns {string} Result label
 */
export function getResultLabel(item, viewKey, keywordsMap = {}) {
  const config = getConfig();
  if (viewKey === 'annotation') {
    return item[config.es_mappings.annotation.title.key] || 'Untitled Annotation';
  } else if (viewKey === 'image_feature') {
    const keywordID = item[config.es_mappings.image_feature.feature_science_intent_keyword_id.key];
    return keywordsMap[keywordID] ? keywordsMap[keywordID].name : `Unknown Keyword ID ${keywordID}`;
  } else {
    return getPropFromProduct(item, config.es_mappings[viewKey]);
  }
}

/**
 * Process facets from search configuration
 * @param {Object} searchConfig - Search configuration object
 * @param {Function} createRef - Function to create React refs
 * @returns {Object} Object containing facets array and facetsMap
 */
export function processFacetsFromSearchConfig(searchConfig, createRef) {
  const facets = [];
  const facetsMap = {};

  searchConfig.facets.forEach((facet) => {
    const useKeyword = facet.hasOwnProperty('useKeyword') ? facet.useKeyword : false;
    const facetID = `${searchConfig.url_prefix}_${facet.key}`;
    const ref = createRef(facetID);
    const dataField = useKeyword ? `${facet.key}.keyword` : facet.key;
    const obj = { facetID, ref, dataField, ...facet };
    facets.push(obj);
  });

  const sortOrder = searchConfig.sort_order || getConfig().search_config.facet_search.sort_order;

  facets.forEach((facet) => {
    facetsMap[facet.facetID] = facet;
  });

  return { facets, facetsMap, sortOrder };
}

/**
 * Check if a facet has active (non-default) values
 * @param {Object} facet - Facet configuration
 * @param {*} searchValue - Current search value for facet
 * @param {Object} defaultValues - Default values object
 * @returns {boolean} True if facet has active values
 */
export function facetHasActiveValues(facet, searchValue, defaultValues) {
  if (!searchValue) return false;

  if (defaultValues[facet.key]) {
    const differ = new DeepDiffMapper();
    const valueDiff = differ.map(defaultValues[facet.key], [...searchValue].sort());
    return valueDiff.changed;
  }

  return true;
}

/**
 * Generate search options for ElasticSearch query
 * @param {Object} params - Parameters object
 * @returns {Object} Search options for ES query
 */
export function buildSearchOptions({
  baseQueries,
  queryComponents,
  sortByField,
  sortDirection,
  groupResults,
  resultSize,
  view,
  exactCountEnabled,
  searchConfig,
  page,
  viewOptions = {},
  searchBaseKeyInclusionSet,
}) {
  const resolvedSortByField = getDefined(viewOptions.sortByField, sortByField);
  const resolvedSortDirection = getDefined(viewOptions.sortDirection, sortDirection);
  const resolvedGroupResults = getDefined(viewOptions.groupResults, groupResults);
  const resolvedResultSize = getDefined(viewOptions.resultSize, resultSize);
  const resolvedView = getDefined(viewOptions.view, view);
  const resolvedExactCountEnabled = getDefined(viewOptions.exactCountEnabled, exactCountEnabled);

  const facetQueries = Object.values(queryComponents).flat();
  const searchQuery = { bool: { must: baseQueries.concat(facetQueries) } };

  const sorts = [
    resolvedSortByField
      ? { [resolvedSortByField.value]: { order: resolvedSortDirection, unmapped_type: 'long' } }
      : { [getConfig().es_mappings.time1.key]: { order: 'desc', unmapped_type: 'long' } },
    { ocs_name: { order: 'asc', unmapped_type: 'long' } },
  ];

  const size =
    !searchConfig.force_items_per_query &&
    ((resolvedView === 'image' && resolvedResultSize === 'small') ||
      (resolvedView === 'filename' && resolvedResultSize !== 'large'))
      ? 100
      : searchConfig.items_per_query;
  const from = page * size;

  return {
    query: searchQuery,
    size,
    from,
    sort: sorts,
    groupResults:
      searchConfig.query_options && searchConfig.query_options.group_results
        ? searchConfig.query_options.group_results
        : resolvedGroupResults,
    includes: searchBaseKeyInclusionSet,
    exactCount: resolvedExactCountEnabled,
    flattenAll: searchConfig.query_options ? searchConfig.query_options.flatten_all : false,
  };
}
