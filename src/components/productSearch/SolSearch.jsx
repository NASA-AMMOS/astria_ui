import React from 'react';
import { connect } from 'react-redux';
import { clearBrowseValues, setBrowseInverted, setBrowseValue } from 'src/actions/searchActions';
import Button from 'src/components/common/Button';
import SearchBaseContainer from 'src/containers/SearchBaseContainer';
import EDRListStyles from 'src/styles/EdrList.module.css';

import config from 'config.js';
class SolSearch extends React.Component {
  renderContent = (params) => {
    const {
      resultsComponent,
      facetsComponents,
      viewControls,
      sortControls,
      renderSearchControlsRow,
      facetsMap,
      clearAllFacets,
    } = params;
    const numActiveFilters = Object.keys(this.props.searchValues).filter(
      (x) => facetsMap[x] && !facetsMap[x].isPrimarySearch
    ).length;
    const filterControls = [
      <div key="facet_controls" className={EDRListStyles.facetList}>
        {facetsComponents.map(({ component }) => component)}
      </div>,
      <Button
        key="clear_button"
        className={EDRListStyles.clearFilterButton}
        text="Clear Filters"
        variant="secondary"
        onClick={clearAllFacets}
      />,
    ];
    return (
      <>
        {renderSearchControlsRow(viewControls, sortControls, filterControls, numActiveFilters)}
        {resultsComponent}
      </>
    );
  };

  render() {
    return (
      <SearchBaseContainer
        searchConfig={config.search_config.time_search}
        renderContent={this.renderContent}
        {...this.props}
      />
    );
  }
}

const mapStateToProps = (state) => {
  return {
    searchValues: state.search.browseValues,
    defaultValues: state.search.defaultBrowseValues,
    searchInversions: state.search.browseInversions,
  };
};

const matchDispatchToProps = (dispatch) => {
  return {
    setSearchValue(values, componentId) {
      dispatch(setBrowseValue(values, componentId));
    },
    clearSearchValues(componentIds) {
      dispatch(clearBrowseValues(componentIds));
    },
    setComponentInverted(inverted, componentId) {
      dispatch(setBrowseInverted(inverted, componentId));
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps)(SolSearch);
