import PropTypes from 'prop-types';
import React from 'react';
import { JSONLabelDetails } from 'src/components/activeProduct/JSONLabelDetails';
import ProductScienceIntent from 'src/components/activeProduct/ProductScienceIntent';
import ProductSummary from 'src/components/activeProduct/ProductSummary';
import XMLLabelDetails from 'src/components/activeProduct/XMLLabelDetails';
import Button from 'src/components/common/Button';
import ControlsOverlay from 'src/components/common/ControlsOverlay';
import {
  AstriaLogoLowEffort,
  ASTTROLogo,
  CAMPLogo,
  DataDriveLogo,
  Download,
  ExternalLink,
  // MarsviewerLogo,
  NASALogo,
} from 'src/components/common/Icons';
import ImageResult from 'src/components/common/ImageResult';
import Panel from 'src/components/common/Panel';
import BaseImageSelectorContainer from 'src/containers/BaseImageSelectorContainer';
import ImageDataExplorerContainer from 'src/containers/ImageDataExplorerContainer';
import ProductDetailsStyles from 'src/styles/ProductDetails.module.css';
import {
  getDescriptionsForProduct,
  getURLForProductWithExistingParams,
  isMosaic,
  isSingleFrame,
  openInNewTab,
} from 'src/utils';
import { getConfig } from 'src/utils/configRegistry';
import { getLatestVersionsForOverlayId } from 'src/utils/dataQuery';
import {
  ASTTROGetLink,
  CAMPGetLinkForSiteDrive,
  datadriveGetLink,
  getBrowseImagePathForProduct,
  getDownloadPath,
  pdsGetLink,
} from 'src/utils/endpoints';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import ProductFamilyDescription from './ProductFamilyDescription';

export class ProductDetails extends React.Component {
  openInASTTRO(product) {
    openInNewTab(ASTTROGetLink(product));
  }

  openInPDS() {
    openInNewTab(pdsGetLink(this.props.product));
  }

  viewInDataDrive() {
    openInNewTab(datadriveGetLink(this.props.product));
  }

  viewInASTRIA() {
    const { product } = this.props;
    const url = getURLForProductWithExistingParams(product, {});
    openInNewTab(url, false);
  }

  viewSiteDriveInCAMP() {
    openInNewTab(CAMPGetLinkForSiteDrive(this.props.product));
  }

  downloadImage(path) {
    openInNewTab(getDownloadPath(path, this.props.product));
  }

  getASTTROImg() {
    const config = getConfig();
    const { product, fetchingGroups, groups, isCustomProduct } = this.props;
    if (!isCustomProduct && !fetchingGroups) {
      const latestMatchingProducts = getLatestVersionsForOverlayId(
        groups,
        getPropFromProduct(product, config.es_mappings.overlay_id)
      );
      const matchingProduct = latestMatchingProducts.find((p) => {
        const productType = getPropFromProduct(p, config.es_mappings.product_type);
        return isMosaic(p)
          ? productType === 'RAS' || productType === 'RZS' || productType === 'RAD'
          : isSingleFrame(p)
          ? productType === 'RAS'
          : false;
      });
      if (matchingProduct) return matchingProduct;
    }
    return false;
  }

  loadFresherProduct() {
    this.props.setActiveSearchProduct(this.props.fresherProduct);
  }

  renderProductActions() {
    const config = getConfig();
    const { product } = this.props;
    const ASTTROImg = this.getASTTROImg();
    const imageHasSiteDrive = typeof product.site === 'number' && typeof product.drive === 'number';

    // Compute image download options
    const path = getPropFromProduct(product, config.es_mappings.img_url);
    const splits = path.split('.');
    const originalExtension = splits[splits.length - 1];
    let downloadFormats = [[originalExtension, path]];

    // If product is a single frame or mosaic look for browse images
    if (isSingleFrame(product) || isMosaic(product)) {
      const browseImagePath = getBrowseImagePathForProduct(product);
      if (browseImagePath) downloadFormats.push(['PNG', browseImagePath]);
    }

    return (
      <div className={ProductDetailsStyles.productActionBtns}>
        <ControlsOverlay
          overlayPlacement="top"
          full={false}
          noPadding
          className={ProductDetailsStyles.actionButton}
          icon={<ExternalLink />}
          tooltipProps={{
            placement: 'bottom',
            overlay: 'Open In',
            trigger: ['click', 'hover'],
          }}
        >
          <div>
            {config.feature_flags.active_product.deeplinks.datadrive && (
              <Button
                full
                text="View in DataDrive"
                variant="menuItem"
                icon={<DataDriveLogo />}
                onClick={() => this.viewInDataDrive()}
              />
            )}
            {config.feature_flags.active_product.deeplinks.astria && (
              <Button
                full
                text={`View in ${config.app_title}`}
                variant="menuItem"
                icon={<AstriaLogoLowEffort />}
                onClick={() => this.viewInASTRIA()}
              />
            )}
            {config.feature_flags.active_product.deeplinks.camp && (
              <Button
                full
                disabled={!imageHasSiteDrive}
                text="View Site & Drive in CAMP"
                variant="menuItem"
                icon={<CAMPLogo />}
                onClick={() => this.viewSiteDriveInCAMP()}
              />
            )}
            {config.feature_flags.active_product.deeplinks.asttro && (
              <Button
                full
                text="View in ASTTRO"
                variant="menuItem"
                disabled={!ASTTROImg}
                icon={<ASTTROLogo />}
                onClick={() => this.openInASTTRO(ASTTROImg)}
              />
            )}
            {config.feature_flags.active_product.deeplinks.pds && (
              <Button
                full
                text="View in PDS Atlas"
                variant="menuItem"
                icon={<NASALogo />}
                onClick={() => this.openInPDS()}
              />
            )}
          </div>
        </ControlsOverlay>
        <ControlsOverlay
          overlayPlacement="top"
          full={false}
          noPadding
          className={ProductDetailsStyles.actionButton}
          icon={<Download />}
          tooltipProps={{
            placement: 'bottom',
            overlay: 'Download',
            trigger: ['click', 'hover'],
          }}
        >
          <div>
            {downloadFormats.map((format) => (
              <Button
                key={format[0]}
                className={ProductDetailsStyles.downloadFormatButton}
                full
                text={format[0]}
                variant="menuItem"
                onClick={() => this.downloadImage(format[1])}
              />
            ))}
          </div>
        </ControlsOverlay>
      </div>
    );
  }

  renderProductFreshness() {
    const { fresherProduct } = this.props;
    if (!fresherProduct) return;
    return (
      <div className={ProductDetailsStyles.fresherProduct}>
        <Button full variant="primary" text="View Newer Product" onClick={() => this.loadFresherProduct()} />
      </div>
    );
  }

  renderProductTitle() {
    const config = getConfig();
    const { product } = this.props;

    const objectType = getPropFromProduct(product, config.es_mappings.object_type, 'default', false, false);
    const metadataForObject = Object.prototype.hasOwnProperty.call(config.product_details, objectType)
      ? config.product_details[objectType]
      : config.product_details.default;

    const title = getPropFromProduct(product, metadataForObject.title);
    const subtitleValue = getPropFromProduct(product, metadataForObject.subtitle);
    const subtitle = metadataForObject.subtitle.template_string
      ? metadataForObject.subtitle.template_string.replace(`{${metadataForObject.subtitle.key}}`, subtitleValue)
      : subtitleValue;

    const productId = getPropFromProduct(product, config.es_mappings.filename, null);

    const actions = this.renderProductActions();

    return (
      <div className={ProductDetailsStyles.header}>
        <ImageResult
          className={ProductDetailsStyles.productImage}
          key={productId}
          product={product}
          interactable={false}
        />
        <div className={ProductDetailsStyles.titleContainer}>
          <div className={ProductDetailsStyles.title}>{title}</div>
          {actions}
          <div className={ProductDetailsStyles.subtitle}>{subtitle}</div>
        </div>
      </div>
    );
  }

  render() {
    const config = getConfig();
    const {
      product,
      fetchingInitialData,
      campaigns,
      selectBaseImage,
      fetchingGroups,
      hasPartialMetadata,
      groups,
      productDescriptions,
      enableScienceIntent,
      enableDataExplorer,
      starredMetadataFields,
      addStarredMetadataField,
      removeStarredMetadataField,
      clearStarredMetadataFields,
      poppedout,
    } = this.props;

    if (fetchingInitialData) {
      return <div className={ProductDetailsStyles.emptyStateMessage}>Loading</div>;
    }
    if (!product || !getPropFromProduct(product, config.es_mappings.filename, null)) {
      return <div className={ProductDetailsStyles.emptyStateMessage}>Select an Image</div>;
    }

    const productId = getPropFromProduct(product, config.es_mappings.filename, null);

    const title = this.renderProductTitle();

    const labelType = config.label_key === 'vicar_label' ? 'VICAR' : 'PDS';

    return (
      <div className={ProductDetailsStyles.root}>
        <div className={ProductDetailsStyles.section}>{title}</div>
        {selectBaseImage && <BaseImageSelectorContainer />}
        {this.renderProductFreshness()}
        <Panel
          sticky
          allowPopout={!poppedout}
          defaultExpanded
          title="Image Metadata"
          popoutTitle={`Image Metadata – ${productId}`}
          preserveToggledStateLocally
          id="IMAGE_METADATA"
        >
          <ProductSummary
            loading={hasPartialMetadata && fetchingGroups}
            product={product}
            starredMetadataFields={starredMetadataFields}
            addStarredMetadataField={addStarredMetadataField}
            removeStarredMetadataField={removeStarredMetadataField}
            clearStarredMetadataFields={clearStarredMetadataFields}
          />
        </Panel>
        <Panel
          sticky
          allowPopout={!poppedout}
          defaultExpanded={false}
          title="Image Family Description"
          popoutTitle={`Image Family Description – ${productId}`}
          noPadding
          preserveToggledStateLocally
          id="IMAGE_FAMILY_DESCRIPTION"
        >
          <ProductFamilyDescription
            loading={hasPartialMetadata && fetchingGroups}
            product={product}
            productDescriptions={getDescriptionsForProduct(product, productDescriptions)}
          />
        </Panel>
        {enableScienceIntent && (
          <Panel
            sticky
            allowPopout={!poppedout}
            defaultExpanded={false}
            title="Science Intent Metadata"
            popoutTitle={`Science Intent Metadata – ${productId}`}
            preserveToggledStateLocally
            id="SCIENCE_INTENT_METADATA"
          >
            <ProductScienceIntent product={product} campaigns={campaigns} />
          </Panel>
        )}
        {enableDataExplorer && (
          <Panel
            sticky
            allowPopout={!poppedout}
            defaultExpanded={false}
            title="Image Data Explorer"
            popoutTitle={`Image Data Explorer – ${productId}`}
            noPadding
            preserveToggledStateLocally
            id="IMAGE_DATA_EXPLORER"
          >
            <ImageDataExplorerContainer product={product} groups={groups} fetchingGroups={fetchingGroups} />
          </Panel>
        )}
        <Panel
          sticky
          allowPopout={!poppedout}
          defaultExpanded={false}
          title={`${labelType} Label Explorer`}
          popoutTitle={`${labelType} Label Explorer – ${productId}`}
          preserveToggledStateLocally
          id={labelType}
        >
          {!config.label_xml_url_key && (
            <JSONLabelDetails
              loading={fetchingGroups}
              product={product}
              addStarredMetadataField={addStarredMetadataField}
              removeStarredMetadataField={removeStarredMetadataField}
              starredMetadataFields={starredMetadataFields}
            />
          )}
          {config.label_xml_url_key && <XMLLabelDetails product={product} />}
        </Panel>
      </div>
    );
  }
}

ProductDetails.defaultProps = {
  product: {},
  groups: [],
  campaigns: [],
  poppedout: false,
  fetchingInitialData: false,
  isCustomProduct: false,
  hasPartialMetadata: false,
  fetchingGroups: false,
  selectBaseImage: false,
  productDescriptions: {},
  enableDataExplorer: false,
  enableScienceIntent: false,
  starredMetadataFields: null,
  addStarredMetadataField: () => {},
  removeStarredMetadataField: () => {},
  clearStarredMetadataFields: () => {},
  setActiveSearchProduct: () => {},
  fresherProduct: null,
};

ProductDetails.propTypes = {
  poppedout: PropTypes.bool,
  product: PropTypes.object,
  cursor: PropTypes.object,
  campaigns: PropTypes.arrayOf(PropTypes.object),
  groups: PropTypes.arrayOf(PropTypes.object),
  hasPartialMetadata: PropTypes.bool,
  fetchingGroups: PropTypes.bool,
  isCustomProduct: PropTypes.bool,
  fetchingInitialData: PropTypes.bool,
  selectBaseImage: PropTypes.bool,
  productDescriptions: PropTypes.object,
  enableDataExplorer: PropTypes.bool,
  enableScienceIntent: PropTypes.bool,
  starredMetadataFields: PropTypes.object,
  addStarredMetadataField: PropTypes.func,
  removeStarredMetadataField: PropTypes.func,
  clearStarredMetadataFields: PropTypes.func,
  fresherProduct: PropTypes.object,
  setActiveSearchProduct: PropTypes.func,
};

export default ProductDetails;
