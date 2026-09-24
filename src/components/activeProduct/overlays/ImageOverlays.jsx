import PropTypes from 'prop-types';
import React from 'react';
import { ImageOverlay } from 'src/components/activeProduct/ImageOverlay';
import Button from 'src/components/common/Button';
import EmptyState from 'src/components/common/EmptyState';
import { CheckIcon, InfoIcon, PlusIcon, RDRIcon, SettingsIcon } from 'src/components/common/Icons';
import Toggle from 'src/components/common/Toggle';
import Tooltip from 'src/components/common/Tooltip';
import TypographyStyles from 'src/styles/common/typography.module.css';
import ImageOverlayStyles from 'src/styles/ImageOverlay.module.css';
import OverlaysPanelStyles from 'src/styles/OverlaysPanel.module.css';
import { getDescriptionsForProduct, getIDForLayer, isMosaic, isSingleFrame, objAlphaSort } from 'src/utils';
import { getConfig } from 'src/utils/configRegistry';
import { getLatestVersionsByType } from 'src/utils/dataQuery';
import { getPropFromProduct } from 'src/utils/sharedUtils';

class ImageOverlays extends React.Component {
  renderAvailableOverlayResult = (overlayImage, overlayActive) => {
    const config = getConfig();
    const {
      handleOverlayAdd,
      handleOverlayRemove,
      handleDisplayProductMetadata,
      setOperatorControlsProduct,
      operatorControlsMap,
      handleOverlayChangeOpacity,
      productDescriptions,
    } = this.props;

    const opControlsActive =
      typeof operatorControlsMap[getPropFromProduct(overlayImage, config.es_mappings.product_type)] !== 'undefined';

    const overlayActions = (
      <>
        <Tooltip overlay="View Metadata" placement="top">
          <Button
            aria-label="View Metadata"
            variant="icon"
            onClick={(evt) => {
              evt.stopPropagation();
              handleDisplayProductMetadata(overlayImage);
            }}
            icon={<InfoIcon />}
          />
        </Tooltip>
        <Tooltip overlay="Render Controls" placement="top">
          <Button
            aria-label="Render Controls"
            variant="icon"
            active={opControlsActive}
            onClick={(evt) => {
              evt.stopPropagation();
              if (!overlayActive) {
                handleOverlayAdd(overlayImage);
              }
              setOperatorControlsProduct(overlayImage);
            }}
            icon={<SettingsIcon />}
          />
        </Tooltip>
        {!overlayActive && (
          <Tooltip overlay="Add Overlay" placement="top">
            <Button
              aria-label="Add Overlay"
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();
                handleOverlayAdd(overlayImage);
              }}
              icon={<PlusIcon />}
            />
          </Tooltip>
        )}
        {overlayActive && (
          <Tooltip overlay="Remove Overlay" placement="top">
            <Button
              aria-label="Remove Overlay"
              className={OverlaysPanelStyles.overlayAddedIcon}
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();
                handleOverlayRemove(overlayImage);
              }}
              icon={<CheckIcon />}
            />
          </Tooltip>
        )}
      </>
    );
    return (
      <ImageOverlay
        productFamilyMetadata={getDescriptionsForProduct(overlayImage, productDescriptions)}
        key={getIDForLayer(overlayImage)}
        overlayActions={overlayActions}
        product={overlayImage}
        selectable={true}
        onClick={(evt) => {
          evt.stopPropagation();
          const skip = !!evt.target.closest(`.${ImageOverlayStyles.bottomContent}`);
          if (!skip) {
            if (!overlayActive) {
              handleOverlayAdd(overlayImage);
            } else {
              handleOverlayRemove(overlayImage);
            }
          }
        }}
        opacityAdjustable={overlayActive}
        opacity={overlayImage.opacity}
        onChangeOpacity={(opacity) => handleOverlayChangeOpacity(overlayImage, opacity)}
      />
    );
  };

  render() {
    const config = getConfig();
    const {
      layers: activeImages,
      preserveRDRs,
      handleTogglePreserveRDRs,
      groups,
      activeProductOverlayID,
      activeProductSpecFlag,
      preferredImageForType,
    } = this.props;

    const activeImagesMap = activeImages.reduce((overlayMap, overlay) => {
      overlayMap[getIDForLayer(overlay)] = overlay;
      return overlayMap;
    }, {});

    const productsWithSameOverlayId = groups.filter(
      (item) => getPropFromProduct(item, config.es_mappings.overlay_id) === activeProductOverlayID
    );
    const rdrs = productsWithSameOverlayId.filter(
      (p) => getPropFromProduct(p, config.es_mappings.overlayable) && (isSingleFrame(p) || isMosaic(p))
    );
    const layers = getLatestVersionsByType(rdrs, preferredImageForType, activeProductSpecFlag);

    // sort the items
    const sortedLayers = objAlphaSort(layers, config.es_mappings.product_type.key);

    if (!sortedLayers.length) {
      return (
        <div className={OverlaysPanelStyles.contentRoot}>
          <EmptyState text="No RDRs found for this image group" icon={<RDRIcon />} />
        </div>
      );
    }

    return (
      <div className={OverlaysPanelStyles.contentRoot}>
        <div className={OverlaysPanelStyles.overlaysContainer}>
          {!!sortedLayers.length && (
            <div className={OverlaysPanelStyles.toggleContainer}>
              <div className={TypographyStyles.label}>Preserve Added RDRs on Image Switch</div>
              <Toggle on={preserveRDRs} onChange={() => handleTogglePreserveRDRs()} />
            </div>
          )}
          {sortedLayers.map((overlay) => {
            const overlayActive = !!activeImagesMap[getPropFromProduct(overlay, config.es_mappings.id)];
            return this.renderAvailableOverlayResult(overlay, overlayActive);
          })}
        </div>
      </div>
    );
  }
}

ImageOverlays.propTypes = {
  groups: PropTypes.arrayOf(PropTypes.object).isRequired,
  layers: PropTypes.arrayOf(PropTypes.object).isRequired,
  activeImagesMap: PropTypes.object,
  imagesLoadedMap: PropTypes.object,
  activeProductOverlayID: PropTypes.string,
  activeProductSpecFlag: PropTypes.string,
  preserveRDRs: PropTypes.bool,
  handleTogglePreserveRDRs: PropTypes.func,
  handleOverlayAdd: PropTypes.func.isRequired,
  handleOverlayRemove: PropTypes.func.isRequired,
  handleDisplayProductMetadata: PropTypes.func.isRequired,
  setOperatorControlsProduct: PropTypes.func.isRequired,
  preferredImageForType: PropTypes.object.isRequired,
  operatorControlsMap: PropTypes.object.isRequired,
  handleOverlayChangeOpacity: PropTypes.func.isRequired,
  productDescriptions: PropTypes.object,
};
export default ImageOverlays;
