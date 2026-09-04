import classNames from 'classnames';
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { connect } from 'react-redux';
import {
  clearTargetSearchValues,
  setTargetSearchInverted,
  setTargetSearchValue,
  setTargetSearchViewOption,
} from 'src/actions/searchActions';
import Button from 'src/components/common/Button';
import { CloseIcon } from 'src/components/common/Icons';
import Panel from 'src/components/common/Panel';
import Tooltip from 'src/components/common/Tooltip';
import SearchBaseContainer from 'src/containers/SearchBaseContainer';
import EDRListStyles from 'src/styles/EdrList.module.css';
import SearchBaseStyles from 'src/styles/SearchBase.module.css';
import TargetSearchStyles from 'src/styles/TargetSearch.module.css';
import { cloneObj, performElasticSearchQuery } from 'src/utils';
import { getPropFromProduct } from 'src/utils/sharedUtils';

import { getConfig } from 'src/utils/configRegistry';

class TargetSearch extends Component {
  constructor(props) {
    super(props);

    this.searchBaseRef = React.createRef();
    this.relatedNamesController = undefined;

    const config = getConfig();
    this.targetSearchConfig1 = cloneObj(config.search_config.target_search_1 || {});
    this.targetSearchConfig2 = cloneObj(config.search_config.target_search_2 || {});

    this.state = {
      selectedTargetName: undefined,
      relatedNames: { loading: false, error: false, results: [] },
    };
  }

  handleSearchItemClicked = (item) => {
    this.setSelectedTargetFromProduct(item);
  };

  setSelectedTargetFromProduct = (prod) => {
    const { setViewOption } = this.props;
    this.abortRelatedSearch(false);
    if (prod) {
      // we have selected a target
      const targetName = getPropFromProduct(prod, getConfig().es_mappings.target_name_rtt);
      this.setState({ selectedTargetName: targetName }, () => this.searchForRelatedTargets(targetName));
      setViewOption('imageResultTitleKey', {
        label: 'Instrument Category (default)',
        value: 'instrument_category',
      });
    } else {
      // we have cleared the selected target
      this.setState({ selectedTargetName: undefined });
      setViewOption('imageResultTitleKey', {
        label: 'Target name (default)',
        value: 'target_name_rtt',
      });
    }
  };

  getRelatedTargetNameStr(targetName) {
    let searchStr = targetName;
    if (targetName.match(/^LD_/i)) {
      // starts with LD_
      searchStr = searchStr.replace(/^LD_/i, '*');
    } else {
      searchStr = `*${searchStr}`;
    }
    if (targetName.match(/_\d+$/i)) {
      // ends with _[NUM]
      searchStr = searchStr.replace(/_\d+$/i, '*');
    } else {
      searchStr = `${searchStr}*`;
    }
    return searchStr;
  }

  getRelatedTargetSearchConfig(targetName) {
    const searchConfig = cloneObj(getConfig().search_config.target_search_2 || {});
    searchConfig.query_options.base_queries[0].bool.must.query_string.query = targetName;

    // catch current facet queries from "parent" search base
    if (this.searchBaseRef.current) {
      const currFilters = this.searchBaseRef.current.getQueryComponents();
      if (currFilters.length > 0) {
        searchConfig.query_options.base_queries = searchConfig.query_options.base_queries.concat(currFilters);
      }
    }
    return searchConfig;
  }

  getTargetSearchConfig(targetName) {
    if (targetName) {
      // don't duplicate so we don't force re-renders
      this.targetSearchConfig2.query_options.base_queries[0].bool.must.query_string.query = targetName;
      return this.targetSearchConfig2;
    }
    return this.targetSearchConfig1;
  }

  abortRelatedSearch(makeNew = true) {
    if (this.relatedNamesController) this.relatedNamesController.abort();
    if (makeNew) {
      this.relatedNamesController = new AbortController();
      return this.relatedNamesController.signal;
    }
    this.relatedNamesController = undefined;
  }

  async searchForRelatedTargets(targetName) {
    this.setState({
      relatedNames: { loading: true, error: false, results: [] },
    });

    // should we be using redux state instead? yes.
    // do with that information what you wish.
    if (this.searchBaseRef.current) {
      const _queryComponents = this.searchBaseRef.current.getQueryComponents();
      const baseQueries = this.searchBaseRef.current.getBaseQueries();
      const relatedNames = await this.fetchRelatedTargetNames({
        targetName,
        // queryComponents, // TODO - do we want to restrict related target name search with these components? Causes issues with Mosaics
        baseQueries,
      });
      if (relatedNames.error) {
        this.setState({
          relatedNames: { loading: false, error: true, results: [] },
        });
      } else {
        this.setState({ relatedNames: { loading: false, error: false, results: relatedNames.results } });
      }
    } else {
      // no search base found for query components etc.
      this.setState({
        relatedNames: { loading: false, error: true, results: [] },
      });
    }
  }

  async fetchRelatedTargetNames(options) {
    const { targetName, queryComponents, baseQueries } = options;
    const dataField = getConfig().es_mappings.target_name_rtt.key;

    const signal = this.abortRelatedSearch();

    const searchStr = this.getRelatedTargetNameStr(targetName);

    // Construct aggregation query
    const size = 50;
    const query = {
      query_string: {
        query: searchStr,
        fields: [dataField],
      },
    };
    const aggs = {
      [dataField]: {
        terms: {
          field: dataField,
          size,
          order: { _count: 'desc' },
        },
        aggs: {
          group_count: {
            cardinality: {
              field: 'group_id',
            },
          },
        },
      },
    };

    let must = baseQueries.concat([query]);
    if (queryComponents && queryComponents.length > 0) {
      must = must.concat(queryComponents);
    }

    const searchQuery = {
      bool: {
        must,
        must_not: {
          match: {
            [dataField]: targetName, // exclude matching current taget
          },
        },
      },
    };
    const queryBody = {
      query: searchQuery,
    };
    queryBody.aggs = aggs;
    const body = {
      ...queryBody,
      size: 0,
    };

    try {
      const json = await performElasticSearchQuery(body, signal);
      if (!json.aggregations) {
        return { results: [] };
      } else {
        const results = json.aggregations[dataField].buckets.map((o) => {
          return {
            name: o.key,
            value: o.key,
            count: o.group_count.value,
          };
        });
        return { results };
      }
    } catch (error) {
      if (error.name === 'AbortError') return { results: [], stale: true };
      return { results: [], error };
    }
  }

  renderHeader = () => {
    const { selectedTargetName } = this.state;
    if (!selectedTargetName) {
      return (
        <div className={SearchBaseStyles.headerWrapper}>
          <div className={SearchBaseStyles.targetHeaderWrapper}>
            <div className={SearchBaseStyles.header}>Target Browse</div>
            <div className={SearchBaseStyles.subheader}>Browse targets by sol and find related targets</div>
          </div>
        </div>
      );
    } else {
      return (
        <div className={SearchBaseStyles.headerWrapper}>
          <div className={SearchBaseStyles.targetHeaderWrapper}>
            <div className={SearchBaseStyles.header}>
              <span className={SearchBaseStyles.headerSubtext}>Target:</span>
              {selectedTargetName}
            </div>
            <div className={SearchBaseStyles.subheader}>Images related to this target</div>
          </div>
          <div className={SearchBaseStyles.buttonContainer}>
            <Tooltip overlay="Back to All Targets" placement="top">
              <Button
                aria-label="Back to All Targets"
                className={SearchBaseStyles.fixedContentButton}
                variant="icon"
                disabled={this.state.loading}
                icon={<CloseIcon />}
                onClick={() => this.setSelectedTargetFromProduct()}
              />
            </Tooltip>
          </div>
        </div>
      );
    }
  };

  renderMainTargetContent = (params) => {
    const {
      resultsComponent,
      facetsComponents,
      viewControls,
      sortControls,
      renderSearchControlsRow,
      facetsMap,
      clearAllFacets,
    } = params;
    const { selectedTargetName } = this.state;
    const numActiveFilters = Object.keys(this.props.searchValues).filter(
      (x) => facetsMap[x] && !facetsMap[x].isPrimarySearch
    ).length;
    const facetListClass = classNames({
      [EDRListStyles.facetList]: true,
      [TargetSearchStyles.facetList]: true,
    });
    const filterControls =
      facetsComponents.length > 0
        ? [
            <div key="facet_controls" className={facetListClass}>
              {facetsComponents.map(({ component }) => component)}
            </div>,
            <Button
              key="clear_button"
              className={EDRListStyles.clearFilterButton}
              text="Clear Filters"
              variant="secondary"
              onClick={clearAllFacets}
            />,
          ]
        : [];

    if (selectedTargetName) {
      const resultsCounterTarget = `resultCounterTarget_${selectedTargetName}`;
      const headerTarget = document.getElementById('targetSearchContentHeader');
      return (
        <>
          {headerTarget
            ? ReactDOM.createPortal(
                renderSearchControlsRow(viewControls, sortControls, filterControls, numActiveFilters, undefined, {
                  resultsCounter: resultsCounterTarget,
                }),
                headerTarget
              )
            : renderSearchControlsRow(viewControls, sortControls, filterControls, numActiveFilters, undefined, {
                resultsCounter: resultsCounterTarget,
              })}
          <Panel defaultExpanded noPadding sticky={false} title={selectedTargetName}>
            <div id={resultsCounterTarget} className={SearchBaseStyles.panelContentHeader}></div>
            {resultsComponent}
          </Panel>
        </>
      );
    } else {
      return (
        <>
          {renderSearchControlsRow(viewControls, sortControls, filterControls, numActiveFilters)}
          {resultsComponent}
        </>
      );
    }
  };

  renderRelatedTargetContent = (params) => {
    const { renderSearchControlsRow, resultsComponent, relatedTargetName } = params;
    const resultsCounterTarget = `resultCounterTarget_${relatedTargetName}`;
    return (
      <>
        <div id={resultsCounterTarget} className={SearchBaseStyles.panelContentHeader}></div>
        {renderSearchControlsRow([], [], [], undefined, undefined, {
          resultsCounter: resultsCounterTarget,
        })}
        {resultsComponent}
      </>
    );
  };

  renderMainSearchBase = () => {
    const { selectedTargetName } = this.state;
    const { viewOptions } = this.props;
    const searchConfig = this.getTargetSearchConfig(selectedTargetName);
    return (
      <SearchBaseContainer
        {...this.props}
        ref={this.searchBaseRef}
        parentScroll={!!selectedTargetName}
        manualLoadMore={!!selectedTargetName}
        noExport={!selectedTargetName}
        imageResultTitleOnly={!selectedTargetName}
        searchConfig={searchConfig}
        renderContent={this.renderMainTargetContent}
        viewOptions={{ imageResultTitleKey: viewOptions.imageResultTitleKey }}
        setViewOption={this.props.setViewOption}
        handleSearchItemClickedOverride={!selectedTargetName ? this.handleSearchItemClicked : undefined}
      />
    );
  };

  render() {
    const { viewOptions } = this.props;
    const { selectedTargetName, relatedNames } = this.state;

    const contentHeaderClasses = classNames({
      [SearchBaseStyles.contentHeader]: true,
      [SearchBaseStyles.hidden]: !selectedTargetName,
    });

    const contentClasses = classNames({
      [SearchBaseStyles.contentWrapper]: true,
      [SearchBaseStyles.scrollParent]: true,
      [SearchBaseStyles.dark]: !!selectedTargetName,
    });

    return (
      <div className={SearchBaseStyles.baseWrapper}>
        {this.renderHeader()}
        <div className={contentClasses}>
          <div id="targetSearchContentHeader" className={contentHeaderClasses}></div>
          {this.renderMainSearchBase()}
          {!(relatedNames.loading || relatedNames.error) && !!selectedTargetName
            ? relatedNames.results.map((targetNameObj) => {
                const searchConfig = this.getRelatedTargetSearchConfig(targetNameObj.value);
                return (
                  <Panel
                    defaultExpanded={false}
                    noPadding
                    sticky={false}
                    title={`${targetNameObj.name}`}
                    key={`related_target_group_${targetNameObj.value}`}
                  >
                    <SearchBaseContainer
                      {...this.props}
                      manualLoadMore
                      parentScroll
                      noKeyListener
                      searchConfig={searchConfig}
                      renderContent={(params) =>
                        this.renderRelatedTargetContent({ ...params, relatedTargetName: targetNameObj.value })
                      }
                      viewOptions={viewOptions}
                      parentSearchBase={this.searchBaseRef}
                    />
                  </Panel>
                );
              })
            : null}
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    searchValues: state.search.targetSearchValues,
    defaultValues: state.search.defaultTargetSearchValues,
    searchInversions: state.search.targetSearchInversions,
    viewOptions: state.search.targetSearchViewOptions,
  };
};

const matchDispatchToProps = (dispatch) => {
  return {
    setSearchValue(values, componentId) {
      dispatch(setTargetSearchValue(values, componentId));
    },
    clearSearchValues(componentIds) {
      dispatch(clearTargetSearchValues(componentIds));
    },
    setComponentInverted(inverted, componentId) {
      dispatch(setTargetSearchInverted(inverted, componentId));
    },
    setViewOption(key, value) {
      dispatch(setTargetSearchViewOption(key, value));
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps)(TargetSearch);
