import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import {
  ContrastIcon,
  CrosshairsLooseIcon,
  EditIcon,
  InfoIcon,
  LayersIcon,
  MapIcon,
  PinIcon,
  RDRIcon,
  TargetGroupIcon,
  VennDiagramIcon,
} from 'src/components/common/Icons';
import ActiveOverlaysContainer from 'src/containers/ActiveOverlaysContainer';
import AnnotationOverlaysContainer from 'src/containers/AnnotationOverlaysContainer';
import FeatureOverlaysContainer from 'src/containers/FeatureOverlaysContainer';
import GroupsLoadingContainer from 'src/containers/GroupsLoadingContainer';
import ImageDataExplorerContainer from 'src/containers/ImageDataExplorerContainer';
import ImageOverlaysContainer from 'src/containers/ImageOverlaysContainer';
import MapViewContainer from 'src/containers/MapViewContainer';
import RelatedImagesContainer from 'src/containers/RelatedImagesContainer';
import TabPanelContentContainer from 'src/containers/TabPanelContentContainer';
import TargetOverlaysContainer from 'src/containers/TargetOverlaysContainer';
import ProductDetailsStyles from 'src/styles/ProductDetails.module.css';
import { isAnnotation, isFeature, isTarget } from 'src/utils';
import { getConfig } from 'src/utils/configRegistry';
import { getLatestVersionsByType } from 'src/utils/dataQuery';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import ImageStretchContainer from '../../containers/ImageStretchContainer';
import ProductDetailsContainer from '../../containers/ProductDetailsContainer';
import tabsStyles from '../../styles/Tabs.module.css';

export const ACTIVE_PRODUCT_TAB_INDICES = {
  IMAGE: 0,
  VALUES: 1,
  ADJUST: 2,
  MAP: 3,
  RELATED: 4,
  LAYERS: 5,
  TARGETS: 6,
  RDRS: 7,
  DRAW: 8,
  FEATURES: 9,
};

const LOCALSTORAGE_TAB_INDEX_KEY = 'rightPaneTabIndex';

class ActiveProductSidebar extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      numOverlappingImages: 0,
    };
  }

  onTabSelect = (newTabIndex) => {
    const { setImageTab, tabIndex } = this.props;
    let finalTabIndex = newTabIndex;
    if (newTabIndex === tabIndex && tabIndex > -1) finalTabIndex = -1;
    localStorage.setItem(LOCALSTORAGE_TAB_INDEX_KEY, finalTabIndex);
    setImageTab(finalTabIndex);
  };

  onTabPanelContentClose = () => {
    this.onTabSelect(-1);
  };

  onOverlappingImagesResultCountChange = (count) => {
    this.setState({ numOverlappingImages: count });
  };

  render() {
    const config = getConfig();
    const {
      tabIndex,
      fetchingGroups,
      product,
      groups,
      overlays,
      annotations,
      numSourceImages,
      numAssociatedMosaics,
      preferredImageForType,
    } = this.props;
    const { numOverlappingImages } = this.state;

    const tabListClass = classNames({
      'react-tabs__tab-list': true,
      [tabsStyles.verticalTabList]: true,
    });

    const tabsClass = classNames({
      [tabsStyles.verticalTabsRight]: true,
    });

    // Group images and overlays, add active overlays to map
    const availableTargets = [];
    let availableOverlayImages = [];
    const availableAnnotations = [];
    const availableFeatures = [];
    let numActiveOverlays = 0;
    if (product) {
      const productsWithSameOverlayId = groups.filter(
        (item) =>
          getPropFromProduct(item, config.es_mappings.overlay_id) ===
          getPropFromProduct(product, config.es_mappings.overlay_id)
      );
      productsWithSameOverlayId.forEach((p) => {
        // Determine if this is an overlay or base image
        if (isAnnotation(p)) availableAnnotations.push(p);
        else if (isFeature(p)) availableFeatures.push(p);
        else if (isTarget(p)) availableTargets.push(p);
        else if (getPropFromProduct(p, config.es_mappings.overlayable)) {
          availableOverlayImages.push(p);
        }
      });
      availableOverlayImages = getLatestVersionsByType(
        availableOverlayImages,
        preferredImageForType,
        getPropFromProduct(product, config.es_mappings.spec_flag, null)
      );

      // Compute active overlays, separate out targets and all other layers
      const activeTargetOverlays = [];
      const activeOtherOverlays = [];
      overlays.forEach((overlay) => {
        if (isTarget(overlay)) {
          activeTargetOverlays.push(overlay);
        } else {
          activeOtherOverlays.push(overlay);
        }
      });

      numActiveOverlays =
        activeOtherOverlays.length + annotations.length + (activeTargetOverlays.length > 0 ? 1 : 0) - 1; // add 1 for active targets if needed and subtract 1 for base image
    }

    const numRelatedImages = numOverlappingImages + numAssociatedMosaics + numSourceImages;

    return (
      <>
        <div className={tabsStyles.tabsContainer}>
          <Tabs
            selectedIndex={tabIndex}
            onSelect={this.onTabSelect}
            forceRenderTabPanel
            selectedTabPanelClassName={tabsStyles.tabPanelSelected}
            className={tabsClass}
            selectedTabClassName={tabsStyles.selectedVerticalTab}
          >
            <TabList className={tabListClass}>
              <Tab className={tabsStyles.verticalTab}>
                <InfoIcon />
                <div className={tabsStyles.verticalTabLabel}>Image</div>
              </Tab>
              <Tab className={tabsStyles.verticalTab}>
                <CrosshairsLooseIcon />
                <div className={tabsStyles.verticalTabLabel}>Values</div>
              </Tab>
              <Tab className={tabsStyles.verticalTab}>
                <ContrastIcon />
                <div className={tabsStyles.verticalTabLabel}>Adjust</div>
              </Tab>
              {config.feature_flags.active_product.enable_map && (
                <Tab className={tabsStyles.verticalTab}>
                  <MapIcon />
                  <div className={tabsStyles.verticalTabLabel}>Map</div>
                </Tab>
              )}
              {config.feature_flags.active_product.enable_related_images && (
                <Tab className={tabsStyles.verticalTab}>
                  {!!numRelatedImages && <div className={tabsStyles.verticalTabBadge}>{numRelatedImages}</div>}
                  <VennDiagramIcon />
                  <div className={tabsStyles.verticalTabLabel}>Related</div>
                </Tab>
              )}
              <Tab className={tabsStyles.verticalTab}>
                {!!numActiveOverlays && <div className={tabsStyles.verticalTabBadge}>{numActiveOverlays}</div>}
                <LayersIcon />
                <div className={tabsStyles.verticalTabLabel}>Layers</div>
              </Tab>
              {config.feature_flags.active_product.enable_targets && (
                <Tab className={tabsStyles.verticalTab}>
                  {!!availableTargets.length && (
                    <div className={tabsStyles.verticalTabBadge}>{availableTargets.length}</div>
                  )}
                  <TargetGroupIcon />
                  <div className={tabsStyles.verticalTabLabel}>Targets</div>
                </Tab>
              )}
              {config.feature_flags.active_product.enable_rdrs && (
                <Tab className={tabsStyles.verticalTab}>
                  {!!availableOverlayImages.length && (
                    <div className={tabsStyles.verticalTabBadge}>{availableOverlayImages.length}</div>
                  )}
                  <RDRIcon />
                  <div className={tabsStyles.verticalTabLabel}>RDRs</div>
                </Tab>
              )}
              {config.feature_flags.active_product.enable_annotations && (
                <Tab className={tabsStyles.verticalTab}>
                  {!!availableAnnotations.length && (
                    <div className={tabsStyles.verticalTabBadge}>{availableAnnotations.length}</div>
                  )}
                  <EditIcon />
                  <div className={tabsStyles.verticalTabLabel}>Draw</div>
                </Tab>
              )}
              {config.feature_flags.active_product.enable_image_features && (
                <Tab className={tabsStyles.verticalTab}>
                  {!!availableFeatures.length && (
                    <div className={tabsStyles.verticalTabBadge}>{availableFeatures.length}</div>
                  )}
                  <PinIcon />
                  <div className={tabsStyles.verticalTabLabel}>Features</div>
                </Tab>
              )}
            </TabList>

            <TabPanel className={tabsStyles.tabPanel}>
              <TabPanelContentContainer
                helpArticle="view_image_data_and_metadata/view_image_metadata"
                title="Image Metadata"
                subtitle="Select image version and browse metadata"
                onClose={this.onTabPanelContentClose}
              >
                <ProductDetailsContainer
                  selectBaseImage
                  enableScienceIntentenableScienceIntent={
                    config.feature_flags.active_product.enable_science_intent_metadata
                  }
                />
              </TabPanelContentContainer>
            </TabPanel>

            <TabPanel className={tabsStyles.tabPanel}>
              <TabPanelContentContainer
                helpArticle="view_image_data_and_metadata/access_data_values"
                title="Image Data Explorer"
                subtitle="Control-click on the image to retrieve data values for a line and sample"
                onClose={this.onTabPanelContentClose}
              >
                {product ? (
                  <ImageDataExplorerContainer product={product} groups={groups} fetchingGroups={fetchingGroups} />
                ) : (
                  <div className={ProductDetailsStyles.emptyStateMessage}>Select an Image</div>
                )}
              </TabPanelContentContainer>
            </TabPanel>
            <TabPanel className={tabsStyles.tabPanel}>
              <TabPanelContentContainer
                helpArticle="view_image_data_and_metadata/adjust_image_stretch"
                title="Image Adjustments"
                subtitle="Stretch the brightness of the image"
                onClose={this.onTabPanelContentClose}
              >
                <ImageStretchContainer />
              </TabPanelContentContainer>
            </TabPanel>
            {config.feature_flags.active_product.enable_map && (
              <TabPanel className={tabsStyles.tabPanel}>
                <TabPanelContentContainer
                  allowPopout={false}
                  helpArticle="view_image_data_and_metadata/view_orbital_context"
                  title="Map View"
                  subtitle="View rover and data cursor position. Visualize the image footprint if one is available. Control click to estimate the location of a point within an image."
                  onClose={this.onTabPanelContentClose}
                >
                  <MapViewContainer instanceName="productMinimap" />
                </TabPanelContentContainer>
              </TabPanel>
            )}
            {config.feature_flags.active_product.enable_related_images && (
              <TabPanel className={tabsStyles.tabPanel}>
                <TabPanelContentContainer
                  title="Related Images"
                  subtitle="Images related to the base image"
                  onClose={this.onTabPanelContentClose}
                >
                  <RelatedImagesContainer
                    product={product}
                    onOverlappingResultsChange={this.onOverlappingImagesResultCountChange}
                  />
                </TabPanelContentContainer>
              </TabPanel>
            )}
            <TabPanel className={tabsStyles.tabPanel}>
              <TabPanelContentContainer
                helpArticle="add_image_and_data_overlays/adjust_overlay_order_and_opacity"
                title="Active Layers"
                subtitle="All layers on the canvas"
                onClose={this.onTabPanelContentClose}
              >
                <GroupsLoadingContainer>
                  <ActiveOverlaysContainer />
                </GroupsLoadingContainer>
              </TabPanelContentContainer>
            </TabPanel>
            {config.feature_flags.active_product.enable_targets && (
              <TabPanel className={tabsStyles.tabPanel}>
                <TabPanelContentContainer
                  helpArticle="add_image_and_data_overlays/overlay_targets"
                  title="Tactical Targets"
                  subtitle="Visualize tactical targets"
                  onClose={this.onTabPanelContentClose}
                >
                  <GroupsLoadingContainer>
                    <TargetOverlaysContainer />
                  </GroupsLoadingContainer>
                </TabPanelContentContainer>
              </TabPanel>
            )}
            {config.feature_flags.active_product.enable_rdrs && (
              <TabPanel className={tabsStyles.tabPanel}>
                <TabPanelContentContainer
                  helpArticle="add_image_and_data_overlays/overlay_rdr_data"
                  title="RDR Overlays"
                  subtitle="Overlay RDR products on the base image"
                  onClose={this.onTabPanelContentClose}
                >
                  <GroupsLoadingContainer>
                    <ImageOverlaysContainer />
                  </GroupsLoadingContainer>
                </TabPanelContentContainer>
              </TabPanel>
            )}
            {config.feature_flags.active_product.enable_annotations && (
              <TabPanel className={tabsStyles.tabPanel}>
                <TabPanelContentContainer
                  helpArticle="annotate_images/annotate_an_image"
                  title="Drawings"
                  subtitle="Mark up images with shapes and text"
                  onClose={this.onTabPanelContentClose}
                >
                  <GroupsLoadingContainer>
                    <AnnotationOverlaysContainer activeProduct={product} />
                  </GroupsLoadingContainer>
                </TabPanelContentContainer>
              </TabPanel>
            )}
            {config.feature_flags.active_product.enable_image_features && (
              <TabPanel className={tabsStyles.tabPanel}>
                <TabPanelContentContainer
                  helpArticle="mark_features/mark_feature_in_an_image"
                  title="Features"
                  subtitle="Areas of interest tagged in this image"
                  onClose={this.onTabPanelContentClose}
                >
                  <GroupsLoadingContainer>
                    <FeatureOverlaysContainer activeProduct={product} />
                  </GroupsLoadingContainer>
                </TabPanelContentContainer>
              </TabPanel>
            )}
          </Tabs>
        </div>
      </>
    );
  }
}

ActiveProductSidebar.propTypes = {
  tabIndex: PropTypes.number.isRequired,
  setImageTab: PropTypes.func.isRequired,
  preferredImageForType: PropTypes.object.isRequired,
};

export default ActiveProductSidebar;
