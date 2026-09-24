import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import AssociatedMosaicsContainer from 'src/containers/AssociatedMosaicsContainer';
import ImageFinderContainer from 'src/containers/ImageFinderContainer';
import SourceImagesContainer from 'src/containers/SourceImagesContainer';
import OverlaysPanelStyles from 'src/styles/OverlaysPanel.module.css';
import ProductDetailsStyles from 'src/styles/ProductDetails.module.css';
import tabsStyles from 'src/styles/Tabs.module.css';
import { getPropFromProduct } from 'src/utils/sharedUtils';

import { getConfig } from 'src/utils/configRegistry';
const LOCALSTORAGE_TAB_INDEX_KEY = 'relatedImagesTabIndex';

export class RelatedImages extends React.Component {
  constructor(props) {
    super(props);

    // Retrieve any locally stored tab indices
    const tabIndex = parseInt(localStorage.getItem(LOCALSTORAGE_TAB_INDEX_KEY)) || 0;

    this.state = { tabIndex, overlappingResultsCount: 0 };
  }

  onOverlappingResultsChange = (count) => {
    const { onOverlappingResultsChange } = this.props;

    this.setState({ overlappingResultsCount: count });
    onOverlappingResultsChange(count);
  };

  render() {
    const config = getConfig();
    const {
      product,
      fetchingInitialData,
      fetchingGroups,
      cursor,
      fetchingSourceImages,
      fetchingSourceImageFootprints,
      fetchingAssociatedMosaics,
      sourceImages,
      associatedMosaics,
      groups,
      overlays,
    } = this.props;

    const { tabIndex, overlappingResultsCount } = this.state;

    if (fetchingInitialData) {
      return <div className={ProductDetailsStyles.emptyStateMessage}>Loading</div>;
    }
    if (!product || !getPropFromProduct(product, config.es_mappings.filename, null)) {
      return <div className={ProductDetailsStyles.emptyStateMessage}>Select an Image</div>;
    }

    const tabClass = classNames({
      'react-tabs__tab': true,
      [tabsStyles.secondaryTab]: true,
    });

    const tabsClass = classNames({
      'react-tabs__tab': true,
      [tabsStyles.secondaryTabs]: true,
    });

    const tabListClass = classNames({
      'react-tabs__tab-list': true,
      [tabsStyles.tabListSecondary]: true,
    });

    const tabPanelClass = classNames({
      [tabsStyles.tabPanel]: true,
      [OverlaysPanelStyles.tabPanel]: true,
    });

    return (
      <div className={ProductDetailsStyles.root}>
        <Tabs
          forceRenderTabPanel
          selectedTabPanelClassName={tabsStyles.tabPanelSelected}
          className={tabsClass}
          selectedTabClassName={tabsStyles.secondarySelectedTab}
          selectedIndex={tabIndex}
          onSelect={(newIndex) => {
            localStorage.setItem(LOCALSTORAGE_TAB_INDEX_KEY, newIndex);
            this.setState({ tabIndex: newIndex });
          }}
        >
          <TabList className={tabListClass}>
            <Tab className={tabClass}>Source ({sourceImages.length})</Tab>
            <Tab className={tabClass}>Used In ({associatedMosaics.length})</Tab>
            {config.feature_flags.active_product.enable_overlapping_images && (
              <Tab className={tabClass}>Overlapping ({overlappingResultsCount})</Tab>
            )}
          </TabList>

          <div className={OverlaysPanelStyles.tabsContent}>
            <TabPanel className={tabPanelClass}>
              <SourceImagesContainer
                loading={fetchingGroups || fetchingSourceImages || fetchingSourceImageFootprints}
                product={product}
                sourceImages={sourceImages}
                groups={groups}
                cursor={cursor}
                overlays={overlays}
              />
            </TabPanel>
            <TabPanel className={tabPanelClass}>
              <AssociatedMosaicsContainer
                loading={fetchingGroups || fetchingAssociatedMosaics}
                product={product}
                associatedMosaics={associatedMosaics}
              />
            </TabPanel>
            {config.feature_flags.active_product.enable_overlapping_images && (
              <TabPanel className={tabPanelClass}>
                <ImageFinderContainer
                  product={product}
                  groups={groups}
                  cursor={cursor}
                  loading={fetchingGroups}
                  onResultsChange={this.onOverlappingResultsChange}
                />
              </TabPanel>
            )}
          </div>
        </Tabs>
      </div>
    );
  }
}

RelatedImages.defaultProps = {
  product: {},
};

RelatedImages.propTypes = {
  product: PropTypes.object,
  cursor: PropTypes.object,
  groups: PropTypes.arrayOf(PropTypes.object).isRequired,
  fetchingGroups: PropTypes.bool.isRequired,
  isCustomProduct: PropTypes.bool.isRequired,
  fetchingInitialData: PropTypes.bool.isRequired,
  onOverlappingResultsChange: PropTypes.func.isRequired,
};

export default RelatedImages;
