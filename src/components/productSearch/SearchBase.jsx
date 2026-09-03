import classNames from 'classnames';
import debounce from 'lodash.debounce';
import PropTypes from 'prop-types';
import React from 'react';
import InfiniteScroll from 'react-infinite-scroller';
import Button from 'src/components/common/Button';
import { ExternalLink, RefreshIcon } from 'src/components/common/Icons';
import MultiSelect from 'src/components/common/MultiSelect';
import Panel from 'src/components/common/Panel';
import ResultsControls from 'src/components/common/ResultsControls';
import Select from 'src/components/common/Select';
import Toggle from 'src/components/common/Toggle';
import Tooltip from 'src/components/common/Tooltip';
import Facet from 'src/components/productSearch/facets/Facet';
import PrimaryTimeInput from 'src/components/productSearch/facets/PrimaryTimeInput';
import EDRListStyles from 'src/styles/EdrList.module.css';
import FacetSearchStyles from 'src/styles/FacetSearch.module.css';
import SearchBaseStyles from 'src/styles/SearchBase.module.css';
import {
  cloneObj,
  DeepDiffMapper,
  getDefined,
  getLocalStorageOption,
  getURLForProductWithExistingParams,
  isAnnotation,
  isDefined,
  isFeature,
  isSingleFrame,
  objAlphaSort,
  openInNewTab,
} from 'src/utils';
import { getBaseSearchQuery, performESImageSearch, searchBaseKeyInclusionSet } from 'src/utils/dataQuery';
import {
  buildSearchOptions,
  determineFilenameDiffs,
  facetHasActiveValues,
  getLocalStorageSearchKey,
  isFacetValueDefault,
  processFacetsFromSearchConfig,
  shouldClearInversion as shouldClearInversionUtil,
} from 'src/utils/searchUtils';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import * as telemetry from 'src/utils/telemetryUtils';
import ActiveFacetList from './searchResults/ActiveFacetList';
import FilenameSearchResult from './searchResults/FilenameSearchResult';
import ImageSearchResult from './searchResults/ImageSearchResult';
import TextSearchResult from './searchResults/TextSearchResult';

import config from 'config.js';
class SearchBase extends React.Component {
  constructor(props) {
    super(props);

    this.controller = null; // request abort controller for main results query
    this.debouncedSearch = debounce(this.search, 250, {
      leading: true,
      trailing: true,
    }).bind(this);

    // reference parent SearchBase if its available
    const searchBaseParent =
      this.props.parentSearchBase && this.props.parentSearchBase.current ? this.props.parentSearchBase.current : false;
    if (searchBaseParent) {
      this.facets = searchBaseParent.facets;
      this.facetsMap = searchBaseParent.facetsMap;
      this.sortOrder = searchBaseParent.sortOrder;
    } else {
      const { facets, facetsMap, sortOrder } = processFacetsFromSearchConfig(props.searchConfig, React.createRef);
      this.facets = facets;
      this.facetsMap = facetsMap;
      this.sortOrder = sortOrder;
    }

    // Will be populated later
    this.goalsMap = {};
    this.tasksMap = {};

    // Set up search option localstorage keys
    const searchConfig = searchBaseParent ? searchBaseParent.props.searchConfig : props.searchConfig;
    this.LOCALSTORAGE_SEARCH_VIEW_OPTION_KEY = getLocalStorageSearchKey(searchConfig.url_prefix, 'ViewOption');
    this.LOCALSTORAGE_SEARCH_RESULT_SIZE_OPTION_KEY = getLocalStorageSearchKey(
      searchConfig.url_prefix,
      'ResultSizeOption'
    );
    this.LOCALSTORAGE_SEARCH_TIME_LABEL_OPTION_KEY = getLocalStorageSearchKey(
      searchConfig.url_prefix,
      'TimeLabelOption'
    );
    this.LOCALSTORAGE_SEARCH_EDR_GROUPING_OPTION_KEY = getLocalStorageSearchKey(
      searchConfig.url_prefix,
      'EDRGroupingOption'
    );
    this.LOCALSTORAGE_SEARCH_TITLE_LABEL_OPTION_KEY = getLocalStorageSearchKey(
      searchConfig.url_prefix,
      'TitleLabelOption'
    );
    this.LOCALSTORAGE_SEARCH_FILENAME_DIFF_OPTION_KEY = getLocalStorageSearchKey(
      searchConfig.url_prefix,
      'FilenameDiffOption'
    );
    this.LOCALSTORAGE_SEARCH_EDR_GROUP_TOOLTIP_OPTION_KEY = getLocalStorageSearchKey(
      searchConfig.url_prefix,
      'EDRGroupTooltipOption'
    );
    this.LOCALSTORAGE_SEARCH_EXACT_COUNT_OPTION_KEY = getLocalStorageSearchKey(
      searchConfig.url_prefix,
      'ExactCountOption'
    );
    this.LOCALSTORAGE_SEARCH_SORT_BY_OPTION_KEY = getLocalStorageSearchKey(searchConfig.url_prefix, 'SortByOption');
    this.LOCALSTORAGE_SEARCH_SORT_DIRECTION_OPTION_KEY = getLocalStorageSearchKey(
      searchConfig.url_prefix,
      'SortDirectionOption'
    );

    this.searchControlRefView = React.createRef(searchConfig.url_prefix + 'view_controls_overlay');
    this.searchControlRefSort = React.createRef(searchConfig.url_prefix + 'sort_controls_overlay');

    this.state = {
      ...this.getViewStateFromProps(props),
      numberOfResults: 0,
      numberOfResultsIsExact: true,
      page: 0,
      lastSearchReturnedResults: true,
      results: [],
      queryComponents: {},
      queryID: 0,
      loadingQuery: true,
      loadingQueryFailed: false,
      loadingMore: false,
      loadingMoreFailed: false,
      facetsRegistered: false,
      baseQueries: [],
      searchBaseReady: false,
    };
  }

  componentDidMount() {
    if (!this.props.noKeyListener) {
      window.addEventListener('keyup', this.onKeyUp);
    }

    // if we've mounted and inital fetch is already done
    if (!this.props.fetchingInitialData) {
      this.handleInit();
    }
  }

  shouldComponentUpdate(nextProps) {
    const { fetchingInitialData } = this.props;
    if (!nextProps.fetchingInitialData && fetchingInitialData) {
      this.processGoalsAndTasks(this.props); // TODO - should we be using nextProps?
    }
    return true;
  }

  async componentDidUpdate(prevProps) {
    const { fetchingInitialData, ocsPackages } = this.props;
    if (prevProps.fetchingInitialData && !fetchingInitialData) {
      this.handleInit();
    }

    if (!fetchingInitialData && JSON.stringify(prevProps.ocsPackages) !== JSON.stringify(ocsPackages)) {
      this.onPackageChange();
    }

    // TODO - this is shared with all instances, should that be changed?
    // If storeQueryID changes, update our queryID to trigger a new search
    if (prevProps.storeQueryID !== this.props.storeQueryID) {
      await this.onQueryIDChange();
    }

    // if the search config changes, then run new search
    else if (
      !this.props.ignoreSearchConfigChanges &&
      this.state.searchBaseReady &&
      prevProps.searchConfig !== this.props.searchConfig
    ) {
      await this.onSearchConfigChange();
    }

    // if the view options are different, we may need a new search (view options being handled by a "parent" search base)
    else if (this.state.searchBaseReady && prevProps.viewOptions !== this.props.viewOptions) {
      const {
        resultSize: prevResultSize,
        groupResults: prevGroupResults,
        exactCountEnabled: prevExactCountEnabled,
        sortDirection: prevSortDirection,
        sortByField: prevSortByField,
      } = prevProps.viewOptions;
      const {
        resultSize,
        groupResults,
        exactCountEnabled,
        sortDirection,
        sortByField,
        view,
        imageResultTitleKey,
        imageResultTimeKey,
        filenameDiffingEnabled,
        EDRGroupTooltipEnabled,
      } = this.props.viewOptions;

      // keep view options in sync
      const {
        resultSize: stateResultSize,
        groupResults: stateGroupResults,
        exactCountEnabled: stateExactCountEnabled,
        sortDirection: stateSortDirection,
        sortByField: stateSortByField,
        view: stateView,
        imageResultTitleKey: stateImageResultTitleKey,
        imageResultTimeKey: stateImageResultTimeKey,
        filenameDiffingEnabled: stateFilenameDiffingEnabled,
        EDRGroupTooltipEnabled: stateEDRGroupTooltipEnabled,
      } = this.state;
      this.setState(
        {
          resultSize: getDefined(resultSize, stateResultSize),
          groupResults: getDefined(groupResults, stateGroupResults),
          exactCountEnabled: getDefined(exactCountEnabled, stateExactCountEnabled),
          sortDirection: getDefined(sortDirection, stateSortDirection),
          sortByField: getDefined(sortByField, stateSortByField),
          view: getDefined(view, stateView),
          imageResultTitleKey: getDefined(imageResultTitleKey, stateImageResultTitleKey),
          imageResultTimeKey: getDefined(imageResultTimeKey, stateImageResultTimeKey),
          filenameDiffingEnabled: getDefined(filenameDiffingEnabled, stateFilenameDiffingEnabled),
          EDRGroupTooltipEnabled: getDefined(EDRGroupTooltipEnabled, stateEDRGroupTooltipEnabled),
        },
        () => {
          if (resultSize !== prevResultSize) {
            this.freshSearch();
          } else if (groupResults !== prevGroupResults) {
            this.handleRefresh();
          } else if (exactCountEnabled !== prevExactCountEnabled) {
            this.handleRefresh();
          } else if (sortDirection !== prevSortDirection) {
            this.freshSearch();
          } else if (sortByField !== prevSortByField) {
            this.freshSearch();
          }
        }
      );
    }
  }

  async handleInit() {
    await this.setBaseQueries();
    // Set search ready, let a render happen so the facets are mounted, and then aggregate initial query components
    this.setState({ searchBaseReady: true }, () => {
      requestAnimationFrame(() => {
        this.aggregateInitialQueryComponents();
      });
    });
  }

  processGoalsAndTasks(options) {
    const { goals, tasks } = options;
    // Create Maps of goals and tasks by ID for fast access
    this.goalsMap = goals.reduce((goalsMap, goal) => {
      goalsMap[goal.id] = goal;
      return goalsMap;
    }, {});

    this.tasksMap = tasks.reduce((tasksMap, task) => {
      tasksMap[task.id] = task;
      return tasksMap;
    }, {});
  }

  getViewStateFromProps(props) {
    const { searchConfig } = props;

    // priority order: view option from props -> local storage value -> default from config
    return {
      view: getLocalStorageOption(this.LOCALSTORAGE_SEARCH_VIEW_OPTION_KEY, searchConfig.default_view),
      groupResults: getLocalStorageOption(
        this.LOCALSTORAGE_SEARCH_EDR_GROUPING_OPTION_KEY,
        searchConfig.default_group_results
      ),
      resultSize: getLocalStorageOption(
        this.LOCALSTORAGE_SEARCH_RESULT_SIZE_OPTION_KEY,
        searchConfig.default_thumbnail_size
      ),
      imageResultTitleKey: getLocalStorageOption(
        this.LOCALSTORAGE_SEARCH_TITLE_LABEL_OPTION_KEY,
        searchConfig.default_thumbnail_title_key,
        searchConfig.thumbnail_title_label_options
      ),
      imageResultTimeKey: getLocalStorageOption(
        this.LOCALSTORAGE_SEARCH_TIME_LABEL_OPTION_KEY,
        searchConfig.default_thumbnail_time_key,
        searchConfig.thumbnail_time_label_options
      ), // object w/value and label
      filenameDiffingEnabled: getLocalStorageOption(
        this.LOCALSTORAGE_SEARCH_FILENAME_DIFF_OPTION_KEY,
        searchConfig.default_filename_diffing
      ),
      EDRGroupTooltipEnabled: getLocalStorageOption(
        this.LOCALSTORAGE_SEARCH_EDR_GROUP_TOOLTIP_OPTION_KEY,
        searchConfig.default_EDR_group_tooltip
      ),
      exactCountEnabled: getLocalStorageOption(
        this.LOCALSTORAGE_SEARCH_EXACT_COUNT_OPTION_KEY,
        searchConfig.default_exact_count
      ),
      sortByField: getLocalStorageOption(
        this.LOCALSTORAGE_SEARCH_SORT_BY_OPTION_KEY,
        searchConfig.sort ? searchConfig.sort.default_sort_by : '',
        searchConfig.sort ? searchConfig.sort.sort_options : []
      ),
      sortDirection: getLocalStorageOption(
        this.LOCALSTORAGE_SEARCH_SORT_DIRECTION_OPTION_KEY,
        searchConfig.sort ? searchConfig.sort.default_sort_direction : 'desc'
      ),
    };
  }

  async onSearchConfigChange() {
    await this.setBaseQueries();
    const { facets, facetsMap, sortOrder } = processFacetsFromSearchConfig(this.props.searchConfig, React.createRef);
    this.facets = facets;
    this.facetsMap = facetsMap;
    this.sortOrder = sortOrder;
    this.setState({ ...this.getViewStateFromProps(this.props) }, () => this.handleRefresh());
  }

  async onPackageChange() {
    await this.setBaseQueries();
    this.handleRefresh();
  }

  isFacetValueDefault(facetID, values) {
    const { defaultValues } = this.props;
    const facet = this.facetsMap[facetID];
    return isFacetValueDefault(facet, values, defaultValues);
  }

  shouldClearInversion(facetID, values) {
    const { defaultValues } = this.props;
    const facet = this.facetsMap[facetID];
    return shouldClearInversionUtil(facet, values, defaultValues);
  }

  onFacetChange = (facetID, query, values) => {
    const { setSearchValue } = this.props;
    const { queryComponents } = this.state;
    const newQueryComponents = { ...queryComponents };

    if (query) newQueryComponents[facetID] = query;
    else delete newQueryComponents[facetID];

    this.setState(
      {
        queryComponents: newQueryComponents,
      },
      () => {
        const clearInversion = this.shouldClearInversion(facetID, values);

        // Set redux state which will update URL
        setSearchValue(values, facetID, clearInversion);

        this.freshSearch();
      }
    );
  };

  // If search is triggered by a queryid change (i.e. from saved searches updating search values in redux state)
  // we have to create the elastic search queries for each facet and trigger a fresh search
  onQueryIDChange = async () => {
    const { searchValues } = this.props;

    const queries = await Promise.all(
      Object.keys(searchValues).map(async (key) => {
        const query = await this.facetsMap[key].ref.current.getQuery(searchValues[key]);
        return { [key]: query };
      })
    );

    this.setState(
      {
        queryComponents: Object.assign({}, ...queries),
      },
      () => {
        this.freshSearch();
      }
    );
  };

  handleClearFacetChip = async (key) => {
    const { setSearchValue, defaultValues, searchInversions } = this.props;
    const { queryComponents } = this.state;

    // duplicate the query components for a new query
    const newQueryComponents = { ...queryComponents };

    // reset to defaults if necessary
    let values = [];
    const facet = this.facets.find((f) => f.facetID === key);
    if (facet.defaultOnClear) {
      const ref = facet.ref;
      const current = ref.current;
      if (!current || !current.getQuery) {
        telemetry.logWarning(`Facet ${facet.facetID} does not support getQuery, cannot use in search.`);
        console.warn(facet);
        delete newQueryComponents[key];
      } else {
        const query = await ref.current.getQuery(facet.defaults);
        newQueryComponents[key] = query;
        values = facet.defaults;
      }
    } else {
      delete newQueryComponents[key];
    }

    // Determine whether search inversion should be cleared and handle
    // the case where an inverted default is being cleared
    let clearInversion = false;
    if (defaultValues[facet.key].length) {
      clearInversion = this.isFacetValueDefault(facet.facetID, values) && searchInversions[facet.facetID];
    } else {
      clearInversion = this.shouldClearInversion(facet.facetID, values);
    }

    // refresh search
    this.setState(
      {
        queryComponents: newQueryComponents,
      },
      () => {
        // update the store
        setSearchValue(values, key, clearInversion);

        // If we have an existing inversion for this facet and we're clearing
        // the inversion we can skip searching as the inversion store update
        // will cause a fresh search.
        if (searchInversions[facet.facetID] && clearInversion) return;
        this.freshSearch();
      }
    );
  };

  clearAllFacets = () => {
    const { searchValues, clearSearchValues } = this.props;
    const { queryComponents } = this.state;

    // Remove all active search values from query components but leave those not tracked
    // by search values since these are default values
    const newQueryComponents = { ...queryComponents };
    const componentsToClear = [];
    Object.keys(searchValues).forEach((key) => {
      // Don't clear primary search, that's a special one.
      if (this.facetsMap[key] && !this.facetsMap[key].isPrimarySearch) {
        // Delete the facet from our local query components
        delete newQueryComponents[key];

        // Add this component to the list of those to clear in state
        componentsToClear.push(key);
      }
    });

    this.setState(
      {
        queryComponents: newQueryComponents,
      },
      () => {
        clearSearchValues(componentsToClear);
        requestAnimationFrame(() => {
          this.aggregateInitialQueryComponents(); // reset our components to default and trigger a new search
        });
      }
    );
  };

  onKeyUp = (event) => {
    const { activeSearchProduct, isVisible } = this.props;
    const { results, numberOfResults } = this.state;

    if (!isVisible || !activeSearchProduct) return;
    if (event.target.nodeName === 'INPUT' || event.target.nodeName === 'TEXTAREA') return; // ignore events coming from inputs
    if (event.key === '[' || event.key === ']') {
      // Get item from results
      const activeSearchProductId = getPropFromProduct(activeSearchProduct, config.es_mappings.id);
      const matchingResultIndex = results.findIndex(
        (result) => getPropFromProduct(result, config.es_mappings.id) === activeSearchProductId
      );

      let newResultIndex = 0;

      // Find next acceptable result
      // If we can't find the activeSearchProduct in our list just select the first result
      if (matchingResultIndex > -1) {
        if (event.key === '[') {
          newResultIndex = matchingResultIndex - 1;
          if (newResultIndex < 0) return;
        } else {
          newResultIndex = matchingResultIndex + 1;
          if (newResultIndex > numberOfResults || newResultIndex > results.length - 1) return;
        }
      }

      // Get element by id. TODO could use refs but why add the complexity since we only need the dom nodes?
      const nextResultElementId = this.getIdForResultIndex(newResultIndex);
      if (nextResultElementId) {
        const nextResultElement = document.getElementById(nextResultElementId);
        if (nextResultElement) {
          nextResultElement.focus();
          nextResultElement.scrollIntoViewIfNeeded
            ? nextResultElement.scrollIntoViewIfNeeded()
            : nextResultElement.scrollIntoView(); // fallback for Firefox that doesn't support this

          nextResultElement.click(); // Using click here since for some reason calling `handleSearchItemClicked` is terribly slow, needs more digging in performance profiler
        }
      }
    }
  };

  onSearchResultClicked = (event, item) => {
    const { handleSearchItemClicked, handleSearchItemClickedOverride } = this.props;

    // If we detect ctrl, command or shift, let the link handle the event since
    // this should be opening in a new tab/window
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      const newURL = this.getNewTabUrlForProduct(item);
      const link = document.createElement('a');
      link.href = newURL;
      const newEvent = new MouseEvent('click', { ...event }); // clone click event
      link.dispatchEvent(newEvent); // trigger click event on our link element
    } else {
      // Otherwise we'll open the image here
      event.preventDefault();
      if (handleSearchItemClickedOverride) {
        handleSearchItemClickedOverride(item); // I know no one likes this but the container stomps on this param
      } else {
        handleSearchItemClicked(item);
      }
    }
  };

  getNewTabUrlForProduct = (item) => {
    const { getNewTabUrlForProduct } = this.props;

    if (getNewTabUrlForProduct) {
      return getNewTabUrlForProduct(item);
    }
    return getURLForProductWithExistingParams(item);
  };

  getQueryComponents() {
    return Object.values(cloneObj(this.state.queryComponents)).flat();
  }

  getBaseQueries(baseQuery = []) {
    const { ocsPackages, packageOnlyBaseQueries } = this.props;
    const baseQueries = getBaseSearchQuery(ocsPackages, packageOnlyBaseQueries);
    const merged = baseQueries.concat(baseQuery);
    return merged;
  }

  async setBaseQueries() {
    return new Promise((resolve) => {
      const { searchConfig } = this.props;
      const baseQueries = this.getBaseQueries(
        searchConfig.query_options && searchConfig.query_options.base_queries
          ? searchConfig.query_options.base_queries
          : []
      );
      this.setState({ baseQueries }, () => resolve());
    });
  }

  aggregateInitialQueryComponents() {
    const { searchValues } = this.props;
    const initialQueryComponents = {};

    if (this.facets.length > 0) {
      const promises = this.facets.map(async (facet) => {
        let facetValues = searchValues[facet.facetID];
        const ref = facet.ref;
        const current = ref.current;
        if (!current || !current.getQuery) {
          telemetry.logWarning(`Facet ${facet.facetID} does not support getQuery, cannot use in search.`);
          console.warn(facet);
        } else {
          const query = await ref.current.getQuery(facetValues);
          if (query) initialQueryComponents[facet.facetID] = query;
        }
      });
      Promise.all(promises).then(() => {
        this.setState({ queryComponents: initialQueryComponents, facetsRegistered: true }, () =>
          this.debouncedSearch()
        );
      });
    } else {
      this.setState({ queryComponents: initialQueryComponents, facetsRegistered: true }, () => this.debouncedSearch());
    }
  }

  freshSearch() {
    this.setState({ results: [], page: 0, lastSearchReturnedResults: true }, () => this.debouncedSearch());
  }

  handleRefresh() {
    // re-run the query
    this.setState({ queryID: this.state.queryID + 1, results: [], page: 0, lastSearchReturnedResults: true }, () =>
      this.debouncedSearch()
    );
  }

  getSearchOptions(options = {}) {
    const {
      baseQueries: stateBaseQueries,
      queryComponents: stateQueryComponents,
      sortByField: stateSortByField,
      sortDirection: stateSortDirection,
      groupResults: stateGroupResults,
      page,
      resultSize: stateResultSize,
      view: stateView,
      exactCountEnabled: stateExactCountEnabled,
    } = this.state;
    const { searchConfig, parentSearchBase, viewOptions } = this.props;
    const { baseQueries: optionalBaseQueries, queryComponents: optionalQueryComponents } = options;

    const queryComponents =
      parentSearchBase && parentSearchBase.current
        ? parentSearchBase.current.state.queryComponents
        : stateQueryComponents;

    return buildSearchOptions({
      baseQueries: getDefined(optionalBaseQueries, stateBaseQueries),
      queryComponents: getDefined(optionalQueryComponents, queryComponents),
      sortByField: stateSortByField,
      sortDirection: stateSortDirection,
      groupResults: stateGroupResults,
      resultSize: stateResultSize,
      view: stateView,
      exactCountEnabled: stateExactCountEnabled,
      searchConfig,
      page,
      viewOptions,
      searchBaseKeyInclusionSet,
    });
  }

  async search() {
    const { groupResults: stateGroupResults, page, results } = this.state;
    const { onResultsChange, viewOptions, processSearchResults } = this.props;

    const groupResults = getDefined(viewOptions.groupResults, stateGroupResults);

    const startTime = Date.now();
    const isLoadingMore = page > 0;
    if (isLoadingMore) {
      this.setState({
        loadingQuery: false,
        loadingQueryFailed: false,
        loadingMore: true,
        loadingMoreFailed: false,
      });
    } else {
      this.setState({
        loadingQuery: true,
        loadingQueryFailed: false,
        loadingMore: false,
        loadingMoreFailed: false,
        results: [],
      });
    }

    // Cancel any previous requests by checking for an existing abort controller
    if (this.controller) this.controller.abort();

    // Assign new abort controller
    this.controller = new AbortController();
    const signal = this.controller.signal;

    const searchOptions = this.getSearchOptions();
    let searchOutput = await performESImageSearch({
      ...searchOptions,
      signal,
    });

    if (searchOutput.error) {
      const err = searchOutput.error;
      // If this was an aborted request we can bail
      if (err.name === 'AbortError') return true;
      telemetry.logError('Error loading search results', err);
      this.setState({
        results: isLoadingMore ? results : [],
        numberOfResults: 0,
        lastSearchReturnedResults: false,
        numberOfResultsIsExact: true,
        loadingQuery: false,
        loadingQueryFailed: !isLoadingMore,
        loadingMore: false,
        loadingMoreFailed: isLoadingMore,
      });
      if (onResultsChange) onResultsChange(0);
    } else {
      // external processing to add metadata
      if (processSearchResults) {
        searchOutput = await processSearchResults(searchOutput);
      }

      const { results: searchResults, numberOfResults, numberOfResultsLabel, isExactCount } = searchOutput;

      const finalResults = isLoadingMore ? results.concat(searchResults) : searchResults;

      if (groupResults) {
        // Compute within-group diffing for each group in each result
        finalResults.forEach((result) => {
          const filenameDiff = determineFilenameDiffs(
            result._group.map((item) => getPropFromProduct(item, config.es_mappings.filename))
          );
          result._filenameDiff = filenameDiff;
        });
      }

      this.setState({
        results: finalResults,
        numberOfResults: getDefined(numberOfResultsLabel, numberOfResults, true),
        numberOfResultsIsExact: isExactCount,
        lastSearchReturnedResults: searchResults.length > 0,
        loadingQuery: false,
        loadingQueryFailed: false,
        loadingMore: false,
        loadingMoreFailed: false,
      });
      if (onResultsChange) onResultsChange(numberOfResults, isExactCount);
      this.logSuccessfulSearch(startTime);
    }
    return true;
  }

  logSuccessfulSearch(startTime) {
    const { searchConfig, searchValues, defaultValues } = this.props;
    try {
      const searchFacets = [];
      Object.keys(searchValues).forEach((key) => {
        const value = searchValues[key];
        const defaultValueKey = key.replace(`${searchConfig.url_prefix}_`, '');
        if (defaultValues[defaultValueKey]) {
          const differ = new DeepDiffMapper();
          const valueDiff = differ.map(defaultValues[defaultValueKey], [...value].sort());
          if (!valueDiff.changed) return;
        }

        let stringValue = '';
        // Assume objects are arrays here
        if (value && typeof value === 'object') {
          if (value.length) stringValue = value.join(',');
        } else if (typeof value === 'string') {
          if (value) stringValue = value;
        } else if (typeof value === 'number') {
          if (!isNaN(value)) stringValue = value.toString();
        }
        searchFacets.push(`${key}=${stringValue}`);
      });
      let queryString = searchFacets.join('&');
      telemetry.searchPerformed(searchConfig.url_prefix, Date.now() - startTime, queryString);
    } catch (err) {
      console.warn('Unable to log search query', err);
    }
  }

  renderFacet(facet, isPrimary = false) {
    const {
      searchValues,
      campaigns,
      keywordsMap,
      searchInversions,
      setComponentInverted,
      viewOptions,
      openHelpArticle,
    } = this.props;
    const { baseQueries, groupResults: stateGroupResults, facetsRegistered, queryComponents, queryID } = this.state;

    const groupResults = getDefined(viewOptions.groupResults, stateGroupResults);

    const facetValues = searchValues[facet.facetID] || [];
    return (
      <Facet
        key={facet.key}
        facet={facet}
        baseQueries={baseQueries}
        facetValues={facetValues}
        groupResults={groupResults}
        queryComponents={isPrimary ? {} : queryComponents} // primary facets don't respond to other facets
        facetsRegistered={isPrimary ? true : facetsRegistered}
        queryID={isPrimary ? 0 : queryID}
        campaigns={isPrimary ? [] : campaigns}
        keywordsMap={isPrimary ? {} : keywordsMap}
        onFacetChange={this.onFacetChange}
        inverted={!!searchInversions[facet.facetID]}
        setComponentInverted={setComponentInverted}
        openHelpArticle={openHelpArticle}
      />
    );
  }

  getIdForResultIndex(i) {
    return `${this.props.searchConfig.url_prefix}_${i}`;
  }

  productIsActive = (item) => {
    const { activeSearchProduct, productIsActive } = this.props;

    // if we are given a custom active checker
    if (productIsActive) {
      return productIsActive(item, activeSearchProduct);
    }

    // oetherise, do basic check
    return (
      getPropFromProduct(item, config.es_mappings.id) === getPropFromProduct(activeSearchProduct, config.es_mappings.id)
    );
  };

  renderSearchResult(item, index) {
    const { viewOptions, imageResultTitleOnly } = this.props;
    const { view: stateView, resultSize: stateResultSize } = this.state;

    const view = getDefined(viewOptions.view, stateView);
    const resultSize = getDefined(viewOptions.resultSize, stateResultSize);

    const linkClass = classNames({
      [EDRListStyles.searchResult]: true,
      [EDRListStyles.activeResult]: this.productIsActive(item),
    });

    const openInNewTabButtonClasses = classNames({
      [EDRListStyles.openInNewTabButton]: true,
      [EDRListStyles.openInNewTabButtonImage]: view === 'image',
      [EDRListStyles.openInNewTabButtonFilename]: view !== 'image',
      [EDRListStyles.openInNewTabButtonCompactImage]: view === 'image' && resultSize === 'small',
      [EDRListStyles.openInNewTabButtonCompactFilename]: view !== 'image' && resultSize === 'small',
      [EDRListStyles.openInNewTabButtonNoTopLabelImage]:
        view === 'image' && ((!isSingleFrame(item) && !isFeature(item) && !isAnnotation(item)) || imageResultTitleOnly),
    });

    const isValid = !isDefined(item._invalidProduct) || !item._invalidProduct;

    if (isValid) {
      return (
        <div
          key={`${getPropFromProduct(item, config.es_mappings.id)}_result`}
          className={EDRListStyles.searchResultContainer}
        >
          <button
            id={this.getIdForResultIndex(index)}
            className={linkClass}
            onClick={(event) => this.onSearchResultClicked(event, item)}
          >
            {view === 'image'
              ? this.renderImageResult(item)
              : view === 'filename'
              ? this.renderFilenameResult(item)
              : this.renderTextResult(item)}
          </button>
          <Tooltip placement="top" overlay="Open in New Tab">
            <Button
              aria-label="Open in New Tab"
              className={openInNewTabButtonClasses}
              variant="icon"
              icon={<ExternalLink />}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const newURL = this.getNewTabUrlForProduct(item);
                openInNewTab(newURL, false);
              }}
            />
          </Tooltip>
        </div>
      );
    } else {
      return (
        <div
          key={`${getPropFromProduct(item, config.es_mappings.id)}_result`}
          className={EDRListStyles.searchResultContainer}
        >
          <div className={linkClass}>
            {view === 'image'
              ? this.renderImageResult(item)
              : view === 'filename'
              ? this.renderFilenameResult(item)
              : this.renderTextResult(item)}
          </div>
        </div>
      );
    }
  }

  renderFilenameResult(item) {
    const { resultSize, filenameDiffingEnabled, EDRGroupTooltipEnabled, groupResults } = this.state;
    const { viewOptions } = this.props;

    return (
      <FilenameSearchResult
        item={item}
        viewOptions={viewOptions}
        resultSize={resultSize}
        filenameDiffingEnabled={filenameDiffingEnabled}
        EDRGroupTooltipEnabled={EDRGroupTooltipEnabled}
        groupResults={groupResults}
      />
    );
  }

  renderTextResult(item) {
    const { resultSize, view } = this.state;
    const { viewOptions } = this.props;

    return <TextSearchResult item={item} viewOptions={viewOptions} resultSize={resultSize} view={view} />;
  }

  renderImageResult(item) {
    const { keywordsMap, viewOptions, imageResultTitleOnly } = this.props;
    const { resultSize, imageResultTimeKey, imageResultTitleKey } = this.state;

    return (
      <ImageSearchResult
        item={item}
        viewOptions={viewOptions}
        keywordsMap={keywordsMap}
        imageResultTitleOnly={imageResultTitleOnly}
        resultSize={resultSize}
        imageResultTimeKey={imageResultTimeKey}
        imageResultTitleKey={imageResultTitleKey}
        productIsActive={this.productIsActive}
      />
    );
  }

  renderActiveFacetList = () => {
    const { searchValues, defaultValues, searchInversions } = this.props;
    const { searchBaseReady } = this.state;

    return (
      <ActiveFacetList
        searchValues={searchValues}
        defaultValues={defaultValues}
        searchInversions={searchInversions}
        facetsMap={this.facetsMap}
        goalsMap={this.goalsMap}
        tasksMap={this.tasksMap}
        searchBaseReady={searchBaseReady}
        onClearFacet={this.handleClearFacetChip}
      />
    );
  };

  renderSearchControlComponents = () => {
    const {
      sortByField: stateSortByField,
      sortDirection: stateSortDirection,
      view: stateView,
      imageResultTitleKey: stateImageResultTitleKey,
      groupResults: stateGroupResults,
      filenameDiffingEnabled: stateFilenameDiffingEnabled,
      EDRGroupTooltipEnabled: stateEDRGroupTooltipEnabled,
      exactCountEnabled: stateExactCountEnabled,
      resultSize: stateResultSize,
      imageResultTimeKey: stateImageResultTimeKey,
    } = this.state;
    const { searchConfig, viewOptions: propViewOptions, setViewOption } = this.props;

    const sortByField = getDefined(propViewOptions.sortByField, stateSortByField);
    const sortDirection = getDefined(propViewOptions.sortDirection, stateSortDirection);
    const view = getDefined(propViewOptions.view, stateView);
    const imageResultTitleKey = getDefined(propViewOptions.imageResultTitleKey, stateImageResultTitleKey);
    const groupResults = getDefined(propViewOptions.groupResults, stateGroupResults);
    const filenameDiffingEnabled = getDefined(propViewOptions.filenameDiffingEnabled, stateFilenameDiffingEnabled);
    const EDRGroupTooltipEnabled = getDefined(propViewOptions.EDRGroupTooltipEnabled, stateEDRGroupTooltipEnabled);
    const exactCountEnabled = getDefined(propViewOptions.exactCountEnabled, stateExactCountEnabled);
    const resultSize = getDefined(propViewOptions.resultSize, stateResultSize);
    const imageResultTimeKey = getDefined(propViewOptions.imageResultTimeKey, stateImageResultTimeKey);

    let viewOptions = [
      { label: 'Filename', value: 'filename' },
      { label: 'Image', value: 'image' },
    ];
    if (searchConfig.add_text_view_options) {
      viewOptions = viewOptions.concat(
        searchConfig.add_text_view_options.map((ocsKey) => {
          return { label: config.es_mappings[ocsKey].label, value: ocsKey };
        })
      );
    }

    const viewControls = [
      <MultiSelect
        key="view_result_display"
        label="Result Display"
        selectedValue={view}
        options={viewOptions}
        onChange={(value) => {
          this.setState({ view: value });
          localStorage.setItem(this.LOCALSTORAGE_SEARCH_VIEW_OPTION_KEY, value);
          setViewOption('view', value);
        }}
      />,
      <MultiSelect
        key="view_result_size"
        label="Result Size"
        selectedValue={resultSize}
        options={[
          { label: 'Compact', value: 'small' },
          { label: 'Normal', value: 'medium' },
          { label: 'Large', value: 'large' },
        ]}
        onChange={(value) => {
          this.setState({ resultSize: value });
          // TODO is this excessive? Not sure
          this.freshSearch(); // reset search if going to small since we'll need more results, TODO maybe have infinitescroll component check result height and auto load more if needed..?
          localStorage.setItem(this.LOCALSTORAGE_SEARCH_RESULT_SIZE_OPTION_KEY, value);
          setViewOption('resultSize', value);
        }}
      />,
      searchConfig.thumbnail_time_label_options ? (
        <MultiSelect
          key="view_result_time_label"
          label="Image Result Time Label"
          selectedValue={imageResultTimeKey.value}
          options={searchConfig.thumbnail_time_label_options}
          onChange={(value) => {
            const matchingOption = searchConfig.thumbnail_time_label_options.find((x) => x.value === value);
            this.setState({ imageResultTimeKey: matchingOption });
            localStorage.setItem(this.LOCALSTORAGE_SEARCH_TIME_LABEL_OPTION_KEY, value);
            setViewOption('imageResultTimeKey', matchingOption);
          }}
        />
      ) : (
        false
      ),
      searchConfig.thumbnail_title_label_options ? (
        <Select
          key="view_result_title_label"
          label="Image Result Title Label"
          labelPosition="top"
          labelWidth={160}
          defaultValue={imageResultTitleKey}
          searchable={false}
          options={searchConfig.thumbnail_title_label_options}
          onChange={(selectedOption) => {
            this.setState({ imageResultTitleKey: selectedOption });
            localStorage.setItem(this.LOCALSTORAGE_SEARCH_TITLE_LABEL_OPTION_KEY, selectedOption.value);
            setViewOption('imageResultTitleKey', selectedOption);
          }}
        />
      ) : (
        false
      ),
      !searchConfig.disable_group_toggle ? (
        <Toggle
          key="view_result_edr_grouping"
          on={groupResults}
          label="Enable EDR Grouping"
          onChange={(value) => {
            this.setState({ groupResults: value }, () => this.handleRefresh()); // handle refresh so that facets also update
            localStorage.setItem(this.LOCALSTORAGE_SEARCH_EDR_GROUPING_OPTION_KEY, value);
            setViewOption('groupResults', value);
          }}
        />
      ) : (
        false
      ),
      !searchConfig.disable_filename_diffing_toggle ? (
        <Toggle
          key="view_result_filename_diffing"
          on={filenameDiffingEnabled}
          label="Enable Filename Diffing"
          onChange={(value) => {
            this.setState({ filenameDiffingEnabled: value });
            localStorage.setItem(this.LOCALSTORAGE_SEARCH_FILENAME_DIFF_OPTION_KEY, value);
            setViewOption('filenameDiffingEnabled', value);
          }}
        />
      ) : (
        false
      ),
      !searchConfig.disable_EDR_group_tooltip_toggle ? (
        <Toggle
          key="view_result_edr_grouping_tooltip"
          on={EDRGroupTooltipEnabled}
          label="Enable EDR Group Tooltip"
          onChange={(value) => {
            this.setState({ EDRGroupTooltipEnabled: value });
            localStorage.setItem(this.LOCALSTORAGE_SEARCH_EDR_GROUP_TOOLTIP_OPTION_KEY, value);
            setViewOption('EDRGroupTooltipEnabled', value);
          }}
        />
      ) : (
        false
      ),
      <Toggle
        key="view_result_exact_count"
        on={exactCountEnabled}
        label="Enable Exact Result Counts for Large Queries (slower)"
        onChange={(value) => {
          this.setState({ exactCountEnabled: value }, () => this.handleRefresh());
          localStorage.setItem(this.LOCALSTORAGE_SEARCH_EXACT_COUNT_OPTION_KEY, value);
          setViewOption('exactCountEnabled', value);
        }}
      />,
    ].filter((x) => !!x);
    const sortControls = searchConfig.sort
      ? [
          <MultiSelect
            key="sort_direction"
            label="Sort Direction"
            selectedValue={sortDirection}
            options={[
              { label: 'Ascending', value: 'asc' },
              { label: 'Descending', value: 'desc' },
            ]}
            onChange={(value) => {
              this.setState({ sortDirection: value });
              this.freshSearch();
              localStorage.setItem(this.LOCALSTORAGE_SEARCH_SORT_DIRECTION_OPTION_KEY, value);
              setViewOption('sortDirection', value);
            }}
          />,
          <Select
            key="sort_by"
            label="Sort By"
            labelPosition="top"
            defaultValue={sortByField}
            searchable={false}
            options={searchConfig.sort.sort_options}
            onChange={(selectedOption) => {
              this.setState({ sortByField: selectedOption });
              this.freshSearch();
              localStorage.setItem(this.LOCALSTORAGE_SEARCH_SORT_BY_OPTION_KEY, selectedOption.value);
              setViewOption('sortByField', selectedOption);
            }}
          />,
        ]
      : [];
    return { viewControls, sortControls };
  };

  renderSearchControlsRow = (
    viewControls = [],
    sortControls = [],
    filterControls = [],
    filterCount = 0,
    compactWidth = 380,
    renderTargets = {}
  ) => {
    const { noExport } = this.props;
    const { numberOfResults, numberOfResultsIsExact, loadingQuery, results } = this.state;
    const resultString = `${
      numberOfResultsIsExact ? numberOfResults.toLocaleString() : `${numberOfResults.toLocaleString()}+`
    } result${numberOfResults === 1 ? '' : 's'}`;
    return (
      <ResultsControls
        className={EDRListStyles.resultsControls}
        noExport={noExport}
        viewControls={viewControls}
        sortControls={sortControls}
        filterControls={filterControls}
        viewLabel="View Options"
        sortLabel="Sort Options"
        filterLabel="Search Filters"
        resultStatsLabel={!loadingQuery ? resultString : ''}
        filterCount={filterCount}
        loading={loadingQuery}
        results={results}
        renderTargets={renderTargets}
        compactWidth={compactWidth}
      />
    );
  };

  renderPrimarySearch(primarySearchFacet) {
    const { searchValues } = this.props;
    const { baseQueries } = this.state;
    return (
      <div className={SearchBaseStyles.primaryFacets}>
        {primarySearchFacet.map((pfacet) => {
          if (pfacet.type === 'primary_time_input') {
            return (
              <PrimaryTimeInput
                ref={pfacet.ref}
                facet={pfacet}
                key={`psearch_facet_${pfacet.facetID}`}
                values={searchValues[pfacet.facetID]}
                onChange={(query, value) => {
                  this.onFacetChange(pfacet.facetID, query, value);
                }}
                baseQueries={baseQueries}
              />
            );
          } else {
            return this.renderFacet(pfacet, true);
          }
        })}
      </div>
    );
  }

  renderTopRow() {
    const primarySearchFacet = this.facets.filter((x) => x.isPrimarySearch);
    if (primarySearchFacet.length > 0) {
      return (
        <div className={FacetSearchStyles.searchBoxRow}>
          {this.renderPrimarySearch(primarySearchFacet)}
          <Tooltip overlay="Refresh" placement="top">
            <Button
              aria-label="Refresh"
              className={EDRListStyles.refreshButton}
              type="button"
              icon={<RefreshIcon />}
              variant="icon"
              onClick={() => this.handleRefresh()}
            />
          </Tooltip>
        </div>
      );
    }
    return null;
  }

  renderSearchResults() {
    const { processResults, searchConfig, manualLoadMore, viewOptions, parentScroll } = this.props;
    const {
      results,
      numberOfResults,
      numberOfResultsIsExact,
      loadingQuery,
      loadingQueryFailed,
      loadingMore,
      loadingMoreFailed,
      view: stateView,
      resultSize: stateResultSize,
      page,
      lastSearchReturnedResults,
    } = this.state;

    const view = getDefined(viewOptions.view, stateView);
    const resultSize = getDefined(viewOptions.resultSize, stateResultSize);

    if (loadingQueryFailed)
      return (
        <div className={EDRListStyles.errorStateMessage}>
          Unable to load products
          <div>
            <Button text="Retry" variant="secondary" onClick={this.debouncedSearch} />
          </div>
        </div>
      );

    const loadingComponent = (
      <div key="resultsLoader" className={EDRListStyles.loadMoreMessage}>
        Loading
      </div>
    );
    if (loadingQuery) return loadingComponent;
    if (!results.length) return <div className={EDRListStyles.noResults}>No results found matching your filters</div>;

    const processedResults = processResults ? processResults(results) : results;

    const reactiveListContainerClass = classNames({
      [EDRListStyles.reactiveListContainer]: true,
      [EDRListStyles.filenameResults]: view !== 'image',
      [EDRListStyles.imageResults]: view === 'image',
      [EDRListStyles.resultsSmall]: resultSize === 'small',
      [EDRListStyles.resultsMedium]: resultSize === 'medium',
      [EDRListStyles.resultsLarge]: resultSize === 'large',
    });
    let moreResults = results.length < numberOfResults;
    if (!numberOfResultsIsExact && lastSearchReturnedResults) {
      moreResults = true;
    }

    let renderedResults;
    if (searchConfig.group_results_by) {
      const groupedResults = processedResults.reduce(
        (acc, res) => {
          const val = getPropFromProduct(res, config.es_mappings[searchConfig.group_results_by]);
          if (acc.groups[val]) {
            acc.groups[val].push(res);
          } else {
            acc.keys.push(val);
            acc.groups[val] = [res];
          }
          return acc;
        },
        { groups: {}, keys: [] } // accumulated keys as we go should maintain search sort order
      );

      const keys = groupedResults.keys;
      const groupedItems = groupedResults.groups;
      const prefix = config.es_mappings[searchConfig.group_results_by].label;

      renderedResults = keys.map((group_key, i) => {
        return (
          <Panel
            defaultExpanded
            noPadding
            title={`${prefix} ${group_key}`}
            key={`search_res_group_${prefix}_${group_key}`}
          >
            <div className={reactiveListContainerClass}>
              {groupedItems[group_key].map((res, j) => this.renderSearchResult(res, `${i}_${j}`))}
            </div>
          </Panel>
        );
      });
    } else {
      renderedResults = (
        <div className={reactiveListContainerClass}>
          {processedResults.map((result, i) => this.renderSearchResult(result, i))}
        </div>
      );
    }

    const handleLoadMore = () => {
      if (loadingQuery || loadingMore) return;
      if (moreResults) {
        this.setState({ page: page + 1 }, () => {
          this.debouncedSearch();
        });
      }
    };

    const wrapperClasses = classNames({
      [EDRListStyles.parentScroll]: parentScroll,
      [EDRListStyles.infiniteScrollContainer]: !parentScroll,
    });

    // use a "Load More" button or infinite scroll container
    if (manualLoadMore) {
      const shouldRenderLoader = loadingQuery || loadingMore;
      const shouldRenderLoadMore = moreResults && !shouldRenderLoader && !loadingMoreFailed;
      return (
        <div className={wrapperClasses}>
          {renderedResults}
          {shouldRenderLoadMore ? (
            <div className={SearchBaseStyles.loadMoreButtonContainer}>
              <Tooltip overlay="Load more results" placement="bottom">
                <Button
                  full
                  text="Load More"
                  variant="secondary"
                  onClick={handleLoadMore}
                  className={SearchBaseStyles.loadMoreButton}
                />
              </Tooltip>
            </div>
          ) : null}
          <div>{shouldRenderLoader ? loadingComponent : null}</div>
          {loadingMoreFailed ? (
            <div className={EDRListStyles.loadMoreFailedMessage}>
              Unable to load more results
              <div>
                <Button text="Retry" variant="secondary" onClick={this.debouncedSearch} />
              </div>
            </div>
          ) : null}
        </div>
      );
    } else {
      return (
        <div className={wrapperClasses} ref={(ref) => (this.scrollParentRef = ref)}>
          <InfiniteScroll
            initialLoad={false} // we'll provide initial result set
            loadMore={handleLoadMore}
            hasMore={moreResults}
            loader={loadingComponent}
            useWindow={false}
            getScrollParent={() => this.scrollParentRef}
          >
            {renderedResults}
            {loadingMoreFailed && (
              <div key="resultsLoader" className={EDRListStyles.loadMoreFailedMessage}>
                Unable to load more results
                <div>
                  <Button text="Retry" variant="secondary" onClick={this.debouncedSearch} />
                </div>
              </div>
            )}
          </InfiniteScroll>
        </div>
      );
    }
  }

  render() {
    const { renderContent, parentScroll } = this.props;
    const { searchBaseReady } = this.state;

    if (!searchBaseReady) return <div className={EDRListStyles.initialLoadMoreMessage}>Loading</div>;

    const resultsComponent = this.renderSearchResults();

    const searchFacetOrder = this.sortOrder.slice().reverse();
    let orderedFacets = objAlphaSort(this.facets, 'label');
    for (let i = 0; i < searchFacetOrder.length; i++) {
      const itemIndex = orderedFacets.findIndex((item) => item.label === searchFacetOrder[i]);
      orderedFacets.splice(0, 0, orderedFacets.splice(itemIndex, 1)[0]);
    }

    const facetsComponents = orderedFacets
      .filter((x) => !x.isPrimarySearch)
      .map((facet) => {
        const searchValue = this.props.searchValues[facet.facetID];
        facet.hasActiveValues = facetHasActiveValues(facet, searchValue, this.props.defaultValues);
        const component = this.renderFacet(facet);
        return { facet, component };
      });
    const { viewControls, sortControls } = this.renderSearchControlComponents();
    const renderedComponents = renderContent({
      resultsComponent,
      facetsComponents,
      viewControls,
      sortControls,
      renderSearchControlsRow: this.renderSearchControlsRow,
      renderActiveFacetList: this.renderActiveFacetList,
      facetsMap: this.facetsMap,
      clearAllFacets: this.clearAllFacets,
    });

    const wrapperClasses = classNames({
      [FacetSearchStyles.reactiveBaseWrapper]: true,
      [SearchBaseStyles.autoHeight]: parentScroll,
    });

    return (
      /* TODO collapse EDRList and FacetSearch styling */
      /* TODO rename all RS things */
      <div className={wrapperClasses}>
        {this.renderTopRow()}
        {renderedComponents}
      </div>
    );
  }
}

SearchBase.defaultProps = {
  viewOptions: {},
  manualLoadMore: false,
  parentScroll: false,
  ignoreSearchConfigChanges: false,
  imageResultTitleOnly: false,
  noKeyListener: false,
  packageOnlyBaseQueries: false,
  setViewOption: () => {},
  processSearchResults: undefined,
  getNewTabUrlForProduct: undefined,
};

SearchBase.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  activeSearchProduct: PropTypes.object.isRequired,
  ocsPackages: PropTypes.object.isRequired,
  renderContent: PropTypes.func.isRequired,
  campaigns: PropTypes.arrayOf(PropTypes.object).isRequired,
  goals: PropTypes.arrayOf(PropTypes.object).isRequired,
  tasks: PropTypes.arrayOf(PropTypes.object).isRequired,
  keywords: PropTypes.arrayOf(PropTypes.object).isRequired,
  fetchingInitialData: PropTypes.bool.isRequired,
  handleSearchItemClicked: PropTypes.func.isRequired,
  handleSearchItemClickedOverride: PropTypes.func,
  exportResults: PropTypes.func.isRequired,
  onResultsChange: PropTypes.func,
  searchValues: PropTypes.object.isRequired,
  defaultValues: PropTypes.object.isRequired,
  setSearchValue: PropTypes.func.isRequired,
  storeQueryID: PropTypes.number.isRequired,
  searchInversions: PropTypes.object.isRequired,
  setComponentInverted: PropTypes.func.isRequired,
  manualLoadMore: PropTypes.bool,
  viewOptions: PropTypes.object,
  setViewOption: PropTypes.func,
  parentScroll: PropTypes.bool,
  ignoreSearchConfigChanges: PropTypes.bool,
  imageResultTitleOnly: PropTypes.bool,
  openHelpArticle: PropTypes.func.isRequired,
  noKeyListener: PropTypes.bool,
  packageOnlyBaseQueries: PropTypes.bool,
  processSearchResults: PropTypes.func,
  productIsActive: PropTypes.func,
  getNewTabUrlForProduct: PropTypes.func,
};

export default SearchBase;
