import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import Button from 'src/components/common/Button';
import EmptyState from 'src/components/common/EmptyState';
import {
  ASTTROLogoGrayscale,
  AzElTargetIcon,
  CheckIcon,
  CloseIcon,
  CrosshairsLooseIcon,
  InfoIcon,
  PlusIcon,
  PointTargetIcon,
  ProximityTargetIcon,
  TargetGroupIcon,
} from 'src/components/common/Icons';
import Tip from 'src/components/common/Tip';
import Toggle from 'src/components/common/Toggle';
import Tooltip from 'src/components/common/Tooltip';
import TypographyStyles from 'src/styles/common/typography.module.css';
import FormsStyles from 'src/styles/Forms.module.css';
import OverlaysPanelStyles from 'src/styles/OverlaysPanel.module.css';
import ProductDetailsStyles from 'src/styles/ProductDetails.module.css';
import TargetOverlaysStyles from 'src/styles/TargetOverlays.module.css';
import { isTarget, objAlphaSort, openInNewTab } from 'src/utils';
import { AZEL, Marker, Point, ThreeDimensional, TwoDimensional } from 'src/utils/asttroLib/targetType';
import { ASTTROGetLinkForTarget } from 'src/utils/endpoints';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import * as telemetry from 'src/utils/telemetryUtils';

import config from 'config.js';
class TargetOverlays extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      titleFilter: '',
    };
  }

  getIconForTarget(target) {
    try {
      const targetType = target.content.type;
      if (targetType === AZEL) return <AzElTargetIcon />;
      if (targetType === Point || targetType === TwoDimensional || targetType === ThreeDimensional) {
        return <PointTargetIcon />;
      }
      if (targetType === Marker) return <ProximityTargetIcon />;
      throw new Error('Unsupported target type');
    } catch (err) {
      console.warn(err, target);
      return <PointTargetIcon />;
    }
  }

  openTargetInASTTRO(target) {
    openInNewTab(ASTTROGetLinkForTarget(target));
  }

  getActiveImagesMap() {
    return this.props.layers.reduce((overlayMap, overlay) => {
      overlayMap[getPropFromProduct(overlay, config.es_mappings.id)] = overlay;
      return overlayMap;
    }, {});
  }

  getRepresentativeTargetOpacity() {
    // Get representative opacity from active targets
    let opacity = 1;
    const representativeTarget = Object.values(this.getActiveImagesMap()).find((x) => isTarget(x));
    if (representativeTarget) {
      opacity = typeof representativeTarget.opacity === 'number' ? representativeTarget.opacity : 1;
    }
    return opacity;
  }

  addTarget(target) {
    const { handleAddTarget } = this.props;

    const opacity = this.getRepresentativeTargetOpacity();

    // Add the target
    handleAddTarget(target, opacity);

    // Send event
    this.sendTelemetryEvent();
  }

  sendTelemetryEvent() {
    const { activeProduct } = this.props;

    // Send telemetry that a target has been added and include the object type of the product it was added on top of
    const objectType = getPropFromProduct(activeProduct, config.es_mappings.object_type);
    telemetry.targetAdded(objectType);
  }

  renderTargetRow(layer, activeImagesMap) {
    const { handleRemoveTarget, zoomToTarget, setTargetMetadataOpen, highlightTarget, unhighlightTarget } = this.props;

    const targetId = layer.target.content.id;
    const overlayActive = activeImagesMap[getPropFromProduct(layer, config.es_mappings.id)];

    const onClick = () => {
      // Add all targets if hidden
      if (!overlayActive) this.addTarget(layer);

      // Open target metadata after a frame once the layer has been added
      requestAnimationFrame(() => setTargetMetadataOpen(layer.target));
    };

    const onKeyPress = (evt) => {
      // Check enter key
      if (evt.key === 'Enter') onClick(evt);
    };

    const onMouseEnter = () => highlightTarget(targetId);
    const onMouseLeave = () => unhighlightTarget(targetId);

    return (
      <div
        key={targetId}
        className={TargetOverlaysStyles.target}
        tabIndex={0}
        role="button"
        onClick={onClick}
        onKeyPress={onKeyPress}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className={TargetOverlaysStyles.targetIcon}>{this.getIconForTarget(layer.target)}</div>
        <div className={TargetOverlaysStyles.targetTitle}>{layer.title}</div>
        <div className={TargetOverlaysStyles.targetActions}>
          <Tooltip overlay="View Metadata" placement="top">
            <Button
              aria-label="View Metadata"
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();
                onClick();
              }}
              icon={<InfoIcon />}
            />
          </Tooltip>
          <Tooltip overlay="Find Target" placement="top">
            <Button
              aria-label="Find Target"
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();

                // Add all targets if hidden
                if (!overlayActive) this.addTarget(layer);

                // Zoom to target after a frame once the layer has been added
                requestAnimationFrame(() => zoomToTarget(targetId));
              }}
              icon={<CrosshairsLooseIcon />}
            />
          </Tooltip>
          <Tooltip overlay="Open in ASTTRO" placement="topRight">
            <Button
              aria-label="Open in ASTTRO"
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();
                this.openTargetInASTTRO(layer.target);
              }}
              icon={<ASTTROLogoGrayscale />}
            />
          </Tooltip>
        </div>
        {!overlayActive && (
          <Tooltip overlay="Add Target" placement="top">
            <Button
              aria-label="Add Target"
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();
                this.addTarget(layer);
              }}
              icon={<PlusIcon />}
            />
          </Tooltip>
        )}
        {overlayActive && (
          <Tooltip overlay="Remove Target" placement="top">
            <Button
              aria-label="Remove Target"
              className={OverlaysPanelStyles.overlayAddedIcon}
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();
                handleRemoveTarget(layer);
              }}
              icon={<CheckIcon />}
            />
          </Tooltip>
        )}
      </div>
    );
  }

  render() {
    const {
      activeProduct,
      groups,
      handleAddTarget,
      handleRemoveTarget,
      openHelpArticle,
      preserveTargets,
      fetchingTargets,
    } = this.props;
    const { titleFilter } = this.state;

    if (fetchingTargets) {
      return <div className={ProductDetailsStyles.emptyStateMessage}>Loading</div>;
    }

    const activeImagesMap = this.getActiveImagesMap();

    const productsWithSameOverlayId = groups.filter(
      (item) =>
        getPropFromProduct(item, config.es_mappings.overlay_id) ===
        getPropFromProduct(activeProduct, config.es_mappings.overlay_id)
    );

    if (!productsWithSameOverlayId.length) {
      telemetry.logWarning(
        `Error: Unable to find matching overlays for product ${getPropFromProduct(
          activeProduct,
          config.es_mappings.id
        )} with overlayId ${getPropFromProduct(activeProduct, config.es_mappings.overlay_id)}.`
      );
      return <div className={ProductDetailsStyles.emptyStateMessage}>Error Loading Overlays</div>;
    }

    const targets = productsWithSameOverlayId.filter(
      (p) => getPropFromProduct(p, config.es_mappings.object_type) === 'm20-target'
    );
    if (!targets.length)
      return (
        <div className={OverlaysPanelStyles.contentRoot}>
          <EmptyState text="No targets found for this site and drive" icon={<TargetGroupIcon />} />
        </div>
      );

    // Apply filters
    const filteredTargets = targets.filter(
      (target) => (target.title || '').toLowerCase().indexOf(titleFilter.toLowerCase()) > -1
    );

    const sortedLayers = objAlphaSort(filteredTargets, 'title');

    const filterContainerClasses = classNames({
      [FormsStyles.autosuggestInputContainer]: true,
      [FormsStyles.inputNormal]: true,
      [FormsStyles.iconRight]: true,
      [TargetOverlaysStyles.filterContainer]: true,
    });

    return (
      <div className={TargetOverlaysStyles.root}>
        <div className={classNames(OverlaysPanelStyles.toggleContainer, TargetOverlaysStyles.toggleContainer)}>
          <div className={TypographyStyles.label}>Preserve Added Targets on Image Switch</div>
          <Toggle on={preserveTargets} onChange={() => this.props.handleTogglePreserveTargets()} />
        </div>
        <div className={TargetOverlaysStyles.topContent}>
          <Button
            full
            variant="secondary"
            text="Show All"
            onClick={() => {
              const opacity = this.getRepresentativeTargetOpacity();
              filteredTargets.forEach((target) => handleAddTarget(target, opacity));
              this.sendTelemetryEvent();
            }}
          />
          <Button
            full
            variant="secondary"
            text="Hide All"
            onClick={() => filteredTargets.forEach((target) => handleRemoveTarget(target))}
          />
        </div>

        <div className={TargetOverlaysStyles.filter}>
          <div className={filterContainerClasses}>
            <input
              aria-label="Filter targets by title"
              className={FormsStyles.autosuggestInput}
              type="text"
              value={titleFilter}
              placeholder="Filter targets by title"
              onChange={(evt) => this.setState({ titleFilter: evt.target.value })}
            />
            {titleFilter && (
              <Button
                variant="icon"
                onClick={() => this.setState({ titleFilter: '' })}
                icon={<CloseIcon />}
                className={FormsStyles.autosuggestClearIcon}
              />
            )}
          </div>
        </div>

        <div className={TargetOverlaysStyles.targets}>
          {sortedLayers.length < 1 && (
            <div className={TargetOverlaysStyles.noTargetsMatchingFilterMessage}>
              No targets found matching your filter
            </div>
          )}
          {sortedLayers.map((layer) => this.renderTargetRow(layer, activeImagesMap))}
          <div className={TargetOverlaysStyles.footer}>
            <Tip>
              Note: Only certain target types can be viewed in {config.app_title}.&nbsp;
              <button
                type="button"
                onClick={() => openHelpArticle('add_image_and_data_overlays/overlay_targets')}
                className={TypographyStyles.learnMore}
              >
                Learn More
              </button>
            </Tip>
          </div>
        </div>
      </div>
    );
  }
}

TargetOverlays.defaultProps = {};

TargetOverlays.propTypes = {
  activeProduct: PropTypes.object.isRequired,
  layers: PropTypes.array.isRequired,
  setTargetMetadataOpen: PropTypes.func.isRequired,
  zoomToTarget: PropTypes.func.isRequired,
  highlightTarget: PropTypes.func.isRequired,
  unhighlightTarget: PropTypes.func.isRequired,
  openHelpArticle: PropTypes.func.isRequired,
};
export default TargetOverlays;
