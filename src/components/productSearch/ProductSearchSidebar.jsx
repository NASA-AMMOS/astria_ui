import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import { MosaicIcon, RDRIcon, SearchIcon, SolIcon, TargetGroupIcon } from 'src/components/common/Icons';
import FacetSearch from 'src/components/productSearch/FacetSearch';
import SolSearch from 'src/components/productSearch/SolSearch';
import tabsStyles from 'src/styles/Tabs.module.css';
import CategorySearch from './CategorySearch';
import MosaicTimeline from './MosaicTimeline';
import RDRSearch from './RDRSearch';
import TargetSearch from './TargetSearch';

import config from 'config.js';
export const PRODUCT_SEARCH_TAB_INDICES = {
  SOL: 0,
  FACET: 1,
  MOSAIC: 2,
  CATEGORY: 3,
  TARGET: 4,
  RDR: 5,
};

const LOCALSTORAGE_TAB_INDEX_KEY = 'leftPaneTabIndex';

class ProductSearchSidebar extends React.Component {
  constructor(props) {
    super(props);

    const stateObj = {};
    for (const key in PRODUCT_SEARCH_TAB_INDICES) {
      stateObj[key] = '0';
    }

    this.state = stateObj;
  }

  onTabResultsChange = (tab, count, isExactCount = true) => {
    this.setState({ [tab]: isExactCount ? count : `${count}+` });
  };

  onTabChange = (newTabIndex) => {
    const { setSearchTab, tabIndex } = this.props;
    let finalTabIndex = newTabIndex;
    if (newTabIndex === tabIndex && tabIndex > -1) finalTabIndex = -1;
    localStorage.setItem(LOCALSTORAGE_TAB_INDEX_KEY, finalTabIndex);
    setSearchTab(finalTabIndex);
  };

  onTabPanelContentClose = () => {
    this.onTabSelect(-1);
  };

  render() {
    const { tabIndex } = this.props;

    const tabListClass = classNames({
      'react-tabs__tab-list': true,
      [tabsStyles.verticalTabListLeft]: true,
    });

    const tabsClass = classNames({
      [tabsStyles.verticalTabs]: true,
    });

    return (
      <>
        <div className={tabsStyles.tabsContainer}>
          <Tabs
            selectedIndex={tabIndex}
            onSelect={this.onTabChange}
            forceRenderTabPanel
            selectedTabPanelClassName={tabsStyles.tabPanelSelected}
            className={tabsClass}
            selectedTabClassName={tabsStyles.selectedVerticalTab}
          >
            <TabList className={tabListClass}>
              {config.feature_flags.search.enable_time_search && (
                <Tab className={tabsStyles.verticalTab}>
                  <SolIcon />
                  <div className={tabsStyles.verticalTabLabel}>Sol</div>
                </Tab>
              )}
              {config.feature_flags.search.enable_facet_search && (
                <Tab className={tabsStyles.verticalTab}>
                  <SearchIcon />
                  <div className={tabsStyles.verticalTabLabel}>Search</div>
                </Tab>
              )}
              {config.feature_flags.search.enable_mosaic_browse && (
                <Tab className={tabsStyles.verticalTab}>
                  <MosaicIcon />
                  <div className={tabsStyles.verticalTabLabel}>Mosaic</div>
                </Tab>
              )}
              {config.feature_flags.search.enable_category_search && (
                <Tab className={tabsStyles.verticalTab}>
                  <SearchIcon />
                  <div className={tabsStyles.verticalTabLabel}>Category</div>
                </Tab>
              )}
              {config.feature_flags.search.enable_target_search && (
                <Tab className={tabsStyles.verticalTab}>
                  <TargetGroupIcon />
                  <div className={tabsStyles.verticalTabLabel}>Target</div>
                </Tab>
              )}
              {config.feature_flags.search.enable_rdr_search && (
                <Tab className={tabsStyles.verticalTab}>
                  <RDRIcon />
                  <div className={tabsStyles.verticalTabLabel}>RDR</div>
                </Tab>
              )}
            </TabList>

            {config.feature_flags.search.enable_time_search && (
              <TabPanel className={tabsStyles.tabPanel}>
                {/* TODO rename to TimeSearch */}
                <SolSearch isVisible={tabIndex === PRODUCT_SEARCH_TAB_INDICES.SOL} {...this.props} />
              </TabPanel>
            )}
            {config.feature_flags.search.enable_facet_search && (
              <TabPanel className={tabsStyles.tabPanel}>
                <FacetSearch isVisible={tabIndex === PRODUCT_SEARCH_TAB_INDICES.FACET} {...this.props} />
              </TabPanel>
            )}
            {config.feature_flags.search.enable_mosaic_browse && (
              <TabPanel className={tabsStyles.tabPanel}>
                <MosaicTimeline isVisible={tabIndex === PRODUCT_SEARCH_TAB_INDICES.MOSAIC} {...this.props} />
              </TabPanel>
            )}
            {config.feature_flags.search.enable_category_search && (
              <TabPanel className={tabsStyles.tabPanel}>
                <CategorySearch isVisible={tabIndex === PRODUCT_SEARCH_TAB_INDICES.CATEGORY} {...this.props} />
              </TabPanel>
            )}
            {config.feature_flags.search.enable_target_search && (
              <TabPanel className={tabsStyles.tabPanel}>
                <TargetSearch isVisible={tabIndex === PRODUCT_SEARCH_TAB_INDICES.TARGET} {...this.props} />
              </TabPanel>
            )}
            {config.feature_flags.search.enable_rdr_search && (
              <TabPanel className={tabsStyles.tabPanel}>
                <RDRSearch isVisible={tabIndex === PRODUCT_SEARCH_TAB_INDICES.RDR} {...this.props} />
              </TabPanel>
            )}
          </Tabs>
        </div>
      </>
    );
  }
}

ProductSearchSidebar.propTypes = {
  tabIndex: PropTypes.number.isRequired,
  setSearchTab: PropTypes.func.isRequired,
};

export default ProductSearchSidebar;
