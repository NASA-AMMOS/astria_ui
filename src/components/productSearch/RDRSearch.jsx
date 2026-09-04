import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { setActiveSearchProduct } from 'src/actions/activeSearchProduct';
import { addLayer } from 'src/actions/imageLayers';
import {
  clearRDRSearchValues,
  setRDRSearchInverted,
  setRDRSearchValue,
  setRDRSearchViewOption,
} from 'src/actions/searchActions';
import Button from 'src/components/common/Button';
import Toggle from 'src/components/common/Toggle';
import SearchBaseContainer from 'src/containers/SearchBaseContainer';
import { getOCSPackagesQuery } from 'src/reducers/utils';
import EDRListStyles from 'src/styles/EdrList.module.css';
import RDRSearchStyles from 'src/styles/RDRSearch.module.css';
import SearchBaseStyles from 'src/styles/SearchBase.module.css';
import TargetSearchStyles from 'src/styles/TargetSearch.module.css';
import { getLocalStorageOption, getURLForProductWithExistingParams, isDefined } from 'src/utils';
import { getSearchBaseKeyInclusionSet, performESImageSearch } from 'src/utils/dataQuery';
import { buildTiledImageURL } from 'src/utils/osd/osdUtils';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import * as telemetry from 'src/utils/telemetryUtils';

import { getConfig } from 'src/utils/configRegistry';
class RDRSearch extends Component {
  constructor(props) {
    super(props);

    this.searchBaseRef = React.createRef();

    this.LOCALSTORAGE_SEARCH_RESULT_THUMB_BG_RENDER_KEY = 'RS_ThumbBGRenderOption';

    this.lastItemClicked = null;

    this.state = {
      [this.LOCALSTORAGE_SEARCH_RESULT_THUMB_BG_RENDER_KEY]: getLocalStorageOption(
        this.LOCALSTORAGE_SEARCH_RESULT_THUMB_BG_RENDER_KEY,
        true
      ),
    };
  }

  setStateAndLocal = (key, value, callback) => {
    localStorage.setItem(key, value);
    this.setState({ [key]: value }, callback);
  };

  triggerRefresh = () => {
    if (this.searchBaseRef.current) {
      this.searchBaseRef.current.handleRefresh();
    }
  };

  productIsActive = (item, activeSearchProduct) => {
    const config = getConfig();
    const { layers } = this.props;
    const activeProdId = getPropFromProduct(activeSearchProduct, config.es_mappings.id);
    const itemId = getPropFromProduct(item, config.es_mappings.id);
    const baseId = isDefined(item._baseProduct) ? getPropFromProduct(item._baseProduct, config.es_mappings.id) : null;
    return (
      itemId === activeProdId ||
      (baseId === activeProdId &&
        isDefined(layers.find((l) => getPropFromProduct(l, config.es_mappings.id) === itemId)))
    );
  };

  handleSearchItemClicked = async (item) => {
    const { handleSearchItemClicked, handleOverlayAdd } = this.props;

    this.lastItemClicked = item;
    const baseProduct = item._baseProduct;
    if (baseProduct) {
      await handleSearchItemClicked(baseProduct);
      if (this.lastItemClicked === item) {
        handleOverlayAdd(item);
      }
    }
  };

  processResultsBatch = (searchOutput) => {
    const config = getConfig();
    const { [this.LOCALSTORAGE_SEARCH_RESULT_THUMB_BG_RENDER_KEY]: renderThumbBG } = this.state;
    const { ocsPackages } = this.props;
    const { results: searchResults } = searchOutput;
    return new Promise(async (resolve, _reject) => {
      const overlayIds = Array.from(
        new Set(searchResults.map((prod) => getPropFromProduct(prod, config.es_mappings.overlay_id)))
      );

      const searchQuery = [];

      // add basic packages and filter keys
      if (ocsPackages) {
        const ocsPackagesQuery = getOCSPackagesQuery(ocsPackages);
        if (ocsPackagesQuery) searchQuery.push(ocsPackagesQuery);
      }
      searchQuery.push({
        bool: {
          should: [{ match: { [config.es_base_filter.key]: config.es_base_filter.value } }],
          must_not: [{ match: { [config.es_mappings.ext.key]: 'VIC' } }],
        },
      });

      // query all the matching images the footprints were derived from
      searchQuery.push({
        terms: {
          [config.es_mappings.overlay_id.key]: overlayIds,
        },
      });

      // fetch all the base images
      const baseProductSearchOutput = await performESImageSearch({
        query: {
          bool: {
            must: searchQuery,
          },
        },
        size: overlayIds.length,
        groupResults: true,
        groupByKey: config.es_mappings.overlay_id.key,
        includes: getSearchBaseKeyInclusionSet(),
      });

      // match with the base image and add the thumbnail url for later reference
      for (const result of searchResults) {
        const baseProduct = baseProductSearchOutput.results.find(
          (prod) =>
            getPropFromProduct(prod, config.es_mappings.overlay_id) ===
            getPropFromProduct(result, config.es_mappings.overlay_id)
        );
        if (baseProduct) {
          const thumbnail = buildTiledImageURL(baseProduct, true);
          if (renderThumbBG) result._thumbnailBackgroundSrc = thumbnail;
          result._baseProduct = baseProduct;
        } else {
          result._invalidProduct = true;
          result._invalidReason = 'missing underlay';
        }
      }

      resolve(searchOutput);
    });
  };

  getNewTabUrlForProduct = (item) => {
    const config = getConfig();
    const opts = {
      [config.url_keys.overlays]: [
        getPropFromProduct(item._baseProduct, config.es_mappings.filename),
        getPropFromProduct(item, config.es_mappings.filename),
      ].join(','),
    };
    return getURLForProductWithExistingParams(item._baseProduct, opts);
  };

  renderHeader = () => {
    return (
      <div className={SearchBaseStyles.headerWrapper}>
        <div className={SearchBaseStyles.targetHeaderWrapper}>
          <div className={SearchBaseStyles.header}>RDR Browse</div>
          <div className={SearchBaseStyles.subheader}>Browse RDR products by sol</div>
        </div>
      </div>
    );
  };

  renderMainTargetContent = (params) => {
    const { [this.LOCALSTORAGE_SEARCH_RESULT_THUMB_BG_RENDER_KEY]: renderThumbBG } = this.state;
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

    // add a control for toggling thumbnail background
    viewControls.push(
      <Toggle
        key="view_result_thumb_bg_render"
        on={renderThumbBG}
        label="Render EDR Underlay Thumbnail"
        onChange={(value) => {
          this.setStateAndLocal(
            this.LOCALSTORAGE_SEARCH_RESULT_THUMB_BG_RENDER_KEY,
            value,
            () => this.triggerRefresh() // refresh search to re-render results
          );
        }}
      />
    );

    return (
      <>
        {renderSearchControlsRow(viewControls, sortControls, filterControls, numActiveFilters)}
        {resultsComponent}
      </>
    );
  };

  renderMainSearchBase = () => {
    return (
      <SearchBaseContainer
        {...this.props}
        ref={this.searchBaseRef}
        packageOnlyBaseQueries
        searchConfig={getConfig().search_config.rdr_search}
        renderContent={this.renderMainTargetContent}
        setViewOption={this.props.setViewOption}
        processSearchResults={this.processResultsBatch}
        handleSearchItemClickedOverride={this.handleSearchItemClicked}
        productIsActive={this.productIsActive}
        getNewTabUrlForProduct={this.getNewTabUrlForProduct}
      />
    );
  };

  render() {
    const rootClasses = classNames({
      [SearchBaseStyles.baseWrapper]: true,
      [RDRSearchStyles.root]: true,
    });
    const contentClasses = classNames({
      [SearchBaseStyles.contentWrapper]: true,
      [SearchBaseStyles.scrollParent]: true,
    });

    return (
      <div className={rootClasses}>
        {this.renderHeader()}
        <div className={contentClasses}>{this.renderMainSearchBase()}</div>
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    searchValues: state.search.rdrSearchValues,
    defaultValues: state.search.defaultRDRSearchValues,
    searchInversions: state.search.rdrSearchInversions,
    viewOptions: state.search.rdrSearchViewOptions,
    ocsPackages: state.search.ocsPackages,
    layers: state.imageLayers.layers,
  };
};

const matchDispatchToProps = (dispatch) => {
  return {
    setSearchValue(values, componentId) {
      dispatch(setRDRSearchValue(values, componentId));
    },
    clearSearchValues(componentIds) {
      dispatch(clearRDRSearchValues(componentIds));
    },
    setComponentInverted(inverted, componentId) {
      dispatch(setRDRSearchInverted(inverted, componentId));
    },
    setViewOption(key, value) {
      dispatch(setRDRSearchViewOption(key, value));
    },
    handleSearchItemClicked(item) {
      return dispatch(setActiveSearchProduct(item, true, true, true, true));
    },
    handleOverlayAdd(item) {
      const config = getConfig();
      dispatch(addLayer(item));
      const filename = getPropFromProduct(item, config.es_mappings.filename);
      const instrument = getPropFromProduct(item, config.es_mappings.instrument_id);
      const productType = getPropFromProduct(item, config.es_mappings.product_type);
      telemetry.rdrOverlayAdded(filename, instrument, productType);
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps)(RDRSearch);
