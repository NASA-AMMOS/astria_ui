import classNames from 'classnames';
import config from 'config.js';
import PropTypes from 'prop-types';
import React from 'react';
import { DragDropContext, Draggable } from 'react-beautiful-dnd';
import { ImageOverlay } from 'src/components/activeProduct/ImageOverlay';
import Button from 'src/components/common/Button';
import ControlsOverlay from 'src/components/common/ControlsOverlay';
import {
  CloseIcon,
  CrosshairsLooseIcon,
  EditIcon,
  FastForwardIcon,
  InfoIcon,
  NoOpacityIcon,
  OpacityIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RemoveAllIcon,
  RewindIcon,
  SettingsIcon,
  SpinnerIcon,
  StopIcon,
  ThreeDotIcon,
  TrashIcon,
} from 'src/components/common/Icons';
import Select from 'src/components/common/Select';
import Tooltip from 'src/components/common/Tooltip';
import { StrictModeDroppable } from 'src/components/StrictModeDroppable';
import annotationFallbackImage from 'src/images/annotation_fallback_image.jpg';
import targetsIcon from 'src/images/targets_icon.svg';
import TypographyStyles from 'src/styles/common/typography.module.css';
import OverlaysPanelStyles from 'src/styles/OverlaysPanel.module.css';
import ProductDetailsStyles from 'src/styles/ProductDetails.module.css';
import {
  formatDate,
  getConfidenceLevelLabel,
  getDescriptionsForProduct,
  getIDForLayer,
  isAnnotatableProduct,
  isCustomProduct,
  isMosaic,
  isSingleFrame,
  isTarget,
} from 'src/utils';
import { datadriveGetOCSObjectDownloadPathForS3URL } from 'src/utils/endpoints';
import { getPropFromProduct } from 'src/utils/sharedUtils';

const animationSpeeds = [
  { label: 'Fastest (30 FPS)', value: 33 },
  { label: 'Faster (24 FPS)', value: 41 },
  { label: 'Fast (12 FPS)', value: 83 },
  { label: 'Medium (6 FPS)', value: 166 },
  { label: 'Slow (3 FPS)', value: 333 },
  { label: 'Slower (1 FPS)', value: 1000 },
  { label: 'Slowest (0.5 FPS)', value: 2000 },
];

class ActiveOverlay extends React.Component {
  render() {
    const {
      dragging,
      overlay,
      overlaysVisible,
      onChangeOpacity,
      onRemove,
      dragHandleProps,
      handleDisplayProductMetadata,
      setOperatorControlsProduct,
      operatorControlsMap,
      productDescriptions,
    } = this.props;
    const opControlsActive =
      typeof operatorControlsMap[getPropFromProduct(overlay, config.es_mappings.product_type)] !== 'undefined';

    const metadataBtn = (
      <Tooltip overlay="Metadata" placement="top">
        <Button
          aria-label="Metadata"
          disabled={overlay.loading}
          variant="icon"
          onClick={() => {
            handleDisplayProductMetadata(overlay, false);
          }}
          icon={<InfoIcon />}
        />
      </Tooltip>
    );

    const overlayActions = (
      <>
        {metadataBtn}
        <Tooltip overlay="Render Controls" placement="top">
          <Button
            aria-label="Render Controls"
            variant="icon"
            disabled={overlay.loading}
            active={opControlsActive}
            onClick={() => {
              setOperatorControlsProduct(overlay);
            }}
            icon={<SettingsIcon />}
          />
        </Tooltip>
        <Tooltip overlay="Remove" placement="top">
          <Button
            aria-label="Remove"
            className={overlay.loading ? OverlaysPanelStyles.overlaySpinnerIcon : null}
            disabled={overlay.loading}
            variant="icon"
            onClick={() => onRemove(overlay)}
            icon={overlay.loading ? <SpinnerIcon /> : <CloseIcon />}
          />
        </Tooltip>
      </>
    );

    return (
      <ImageOverlay
        key={getIDForLayer(overlay)}
        dragging={dragging}
        product={overlay}
        productFamilyMetadata={getDescriptionsForProduct(overlay, productDescriptions)}
        overlayActions={overlayActions}
        selectable
        opacityAdjustable
        opacity={overlay.opacity}
        visible={overlay.opacityOverridesVisibility || overlaysVisible}
        disableControls={overlay.loading}
        onChangeOpacity={(opacity) => onChangeOpacity(overlay, opacity)}
        dragHandleProps={dragHandleProps}
      />
    );
  }
}

class ActiveAnnotation extends React.Component {
  render() {
    const {
      annotation,
      user,
      onEdit,
      onRemove,
      onChangeOpacity,
      onZoomToAnnotation,
      onAnnotationDelete,
      overlaysVisible,
      productDescriptions,
    } = this.props;

    const annotationOwner = getPropFromProduct(annotation, config.es_mappings.created_by);
    let description = '';
    if (annotation.isLocal) {
      description = (
        <span>
          {annotationOwner} • <span className={OverlaysPanelStyles.overlayChip}>Unpublished</span>
        </span>
      );
    } else if (annotation.isUnsaved) {
      description = (
        <span>
          {annotationOwner} • <span className={OverlaysPanelStyles.overlayChip}>Unsaved</span>
        </span>
      );
    } else {
      const annotationLastUpdatedLocal = formatDate(getPropFromProduct(annotation, config.es_mappings.updated_at));
      const annotationLastUpdatedUTC = formatDate(getPropFromProduct(annotation, config.es_mappings.updated_at), true);
      const annotationLastUpdatedEl = (
        <Tooltip overlay={annotationLastUpdatedUTC} placement="top">
          <span className={OverlaysPanelStyles.annotationDate}>{annotationLastUpdatedLocal}</span>
        </Tooltip>
      );
      description = (
        <span>
          {annotationOwner} • {annotationLastUpdatedEl}
        </span>
      );
    }
    const annotationActions = (
      <>
        {user.username === annotationOwner && (
          <Tooltip overlay="Edit Drawing" placement="top">
            <Button
              aria-label="Edit Drawing"
              variant="icon"
              onClick={() => {
                onEdit(annotation);
              }}
              icon={<EditIcon />}
            />
          </Tooltip>
        )}
        {user.username === annotationOwner && (
          <Tooltip overlay="Delete Drawing" placement="top">
            <Button
              aria-label="Delete Drawing"
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();
                onAnnotationDelete(annotation);
              }}
              icon={<TrashIcon />}
            />
          </Tooltip>
        )}
        <Tooltip overlay="Zoom to Drawing" placement="top">
          <Button
            aria-label="Zoom to Drawing"
            variant="icon"
            onClick={(evt) => {
              evt.stopPropagation();
              onZoomToAnnotation(annotation);
            }}
            icon={<CrosshairsLooseIcon />}
          />
        </Tooltip>
        <Tooltip overlay="Remove" placement="top">
          <Button aria-label="Remove" variant="icon" onClick={() => onRemove(annotation)} icon={<CloseIcon />} />
        </Tooltip>
      </>
    );
    const thumbnail = annotation.thumbnail
      ? datadriveGetOCSObjectDownloadPathForS3URL(annotation.thumbnail)
      : annotationFallbackImage;
    return (
      <ImageOverlay
        key={annotation.annotation_id}
        productFamilyMetadata={productDescriptions}
        title={annotation.title}
        product={annotation}
        description={description}
        tooltip={annotation.description || 'No Description'}
        fallback={thumbnail}
        overlayActions={annotationActions}
        visible={annotation.opacityOverridesVisibility || overlaysVisible}
        selectable={false}
        opacityAdjustable
        opacity={annotation.opacity !== null ? annotation.opacity : 1}
        onChangeOpacity={(opacity) => onChangeOpacity(annotation, opacity)}
      />
    );
  }
}

class ActiveImageFeature extends React.Component {
  render() {
    const {
      feature,
      user,
      onFeatureEdit,
      onFeatureRemove,
      onFeatureChangeOpacity,
      setFeatureMetadataOpen,
      onZoomToFeature,
      keywordsMap,
      overlaysVisible,
      showFeatureOutline,
      hideFeatureOutline,
    } = this.props;

    const featureOwner = getPropFromProduct(feature, config.es_mappings.created_by);
    const chipClasses = classNames({
      [OverlaysPanelStyles.overlayChip]: true,
      [OverlaysPanelStyles.featureConfidenceLow]:
        !feature.isUnsaved && feature.feature_confidence_level === config.image_feature_confidence_levels.low,
      [OverlaysPanelStyles.featureConfidenceMedium]:
        !feature.isUnsaved && feature.feature_confidence_level === config.image_feature_confidence_levels.medium,
      [OverlaysPanelStyles.featureConfidenceHigh]:
        !feature.isUnsaved && feature.feature_confidence_level === config.image_feature_confidence_levels.high,
    });
    const chipContent = feature.isUnsaved
      ? 'Unpublished'
      : getConfidenceLevelLabel(getPropFromProduct(feature, config.es_mappings.image_feature.feature_confidence_level));
    let description = (
      <span>
        {featureOwner} • <span className={chipClasses}>{chipContent}</span>
      </span>
    );

    const featureActions = (
      <>
        {user.username === featureOwner && (
          <Tooltip overlay="Edit Feature" placement="top">
            <Button
              aria-label="Edit Feature"
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();
                onFeatureEdit(feature);
              }}
              icon={<EditIcon />}
            />
          </Tooltip>
        )}
        <Tooltip overlay="Feature Info" placement="top">
          <Button
            aria-label="Feature Info"
            variant="icon"
            onClick={(evt) => {
              evt.stopPropagation();
              setFeatureMetadataOpen(feature);
            }}
            icon={<InfoIcon />}
          />
        </Tooltip>
        {/* Only allow zoom to if the feature is saved since unsaved features can contain multiple shapes */}
        {!feature.isUnsaved && (
          <Tooltip overlay="Zoom to Feature" placement="top">
            <Button
              aria-label="Zoom to Feature"
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();
                onZoomToFeature(feature);
              }}
              icon={<CrosshairsLooseIcon />}
            />
          </Tooltip>
        )}
        <Tooltip overlay="Remove" placement="top">
          <Button aria-label="Remove" variant="icon" onClick={() => onFeatureRemove(feature)} icon={<CloseIcon />} />
        </Tooltip>
      </>
    );

    const thumbnail = getPropFromProduct(feature, config.es_mappings.filename)
      ? datadriveGetOCSObjectDownloadPathForS3URL(getPropFromProduct(feature, config.es_mappings.filename))
      : annotationFallbackImage;
    const keywordName = keywordsMap[feature.feature_science_intent_keyword_id]
      ? keywordsMap[feature.feature_science_intent_keyword_id].name
      : `No Keyword Selected`;
    return (
      <ImageOverlay
        key={feature.feature_id || feature.annotation_id}
        title={keywordName}
        description={description}
        tooltip={feature.feature_notes || 'No Notes'}
        fallback={thumbnail}
        overlayActions={featureActions}
        visible={feature.opacityOverridesVisibility || overlaysVisible}
        product={feature}
        selectable={false}
        opacity={feature.opacity !== null ? feature.opacity : 1}
        onChangeOpacity={(opacity) => onFeatureChangeOpacity(feature, opacity)}
        opacityAdjustable
        onMouseEnter={() => showFeatureOutline(feature)}
        onMouseLeave={() => hideFeatureOutline(feature)}
      />
    );
  }
}

class ActiveTargets extends React.Component {
  render() {
    const { targets, onRemove, onChangeOpacity, overlaysVisible } = this.props;
    const targetsActions = (
      <>
        <Tooltip overlay="Remove" placement="top">
          <Button aria-label="Remove" variant="icon" onClick={() => onRemove(targets)} icon={<CloseIcon />} />
        </Tooltip>
      </>
    );

    const representativeTarget = targets.length > 0 ? targets[0] : null;
    let visible = false;
    let opacity = 1;
    if (representativeTarget) {
      visible = representativeTarget.opacityOverridesVisibility;
      opacity = representativeTarget.opacity;
    }

    return (
      <ImageOverlay
        key="activeTargetsOverlay"
        title="Targets"
        description={`${targets.length} targets displaying`}
        product={representativeTarget}
        fallback={targetsIcon}
        overlayActions={targetsActions}
        visible={visible || overlaysVisible}
        selectable={false}
        opacityAdjustable
        opacity={opacity !== null ? opacity : 1}
        onChangeOpacity={(opacity) => onChangeOpacity(targets, opacity)}
      />
    );
  }
}

class ActiveOverlays extends React.Component {
  constructor(props) {
    super(props);

    this.toggleVisibility = this.toggleVisibility.bind(this); // Preferred React way of binding context for event handlers
    this.removeAllActiveOverlays = this.removeAllActiveOverlays.bind(this); // Preferred React way of binding context for event handlers
  }

  handleOverlayRemove = (overlay) => {
    const {
      handleOverlayRemove: handleOverlayRemoveProp,
      overlays,
      annotations,
      handleToggleOverlaysVisible,
    } = this.props;
    handleOverlayRemoveProp(overlay);
    // if overlays + annotations is 2 then we're about to clear our last overlay so we'll toggle overlay visibility back on
    if (overlays.length + annotations.length === 2) handleToggleOverlaysVisible(true);
  };

  toggleVisibility() {
    const { handleToggleOverlaysVisible } = this.props;
    handleToggleOverlaysVisible();
  }

  addCustomLayer = () => {
    this.props.handleAddCustomLayer();
  };

  removeAllActiveOverlays() {
    const { handleRemoveAllOverlays, handleToggleOverlaysVisible, handleRemoveAllAnnotations } = this.props;

    handleRemoveAllAnnotations();
    handleRemoveAllOverlays();
    handleToggleOverlaysVisible(true);
  }

  handleReorder = (results) => {
    if (results.source && results.destination) {
      const { handleOverlayMove, overlays: activeOverlays } = this.props;

      // filter out targets
      const imageOverlays = activeOverlays.filter((overlay) => !isTarget(overlay));
      const numActiveOverlays = imageOverlays.length - 1; // ignore base image
      const currIndex = numActiveOverlays - results.source.index; // reversed and does not account for base image
      const newIndex = numActiveOverlays - results.destination.index; // reversed and does not account for base image

      const overlayId = results.draggableId;
      const overlay = activeOverlays.find((l) => getIDForLayer(l) === overlayId);

      handleOverlayMove(overlay, currIndex, newIndex);
    }
  };

  render() {
    const {
      user,
      annotations,
      handleAnnotationEdit,
      handleAnnotationDelete,
      handleAnnotationRemove,
      handleAnnotationChangeOpacity,
      handleRemoveAllTargets,
      handleZoomToAnnotation,
      handleZoomToFeature,
      handleSetFeatureMetadataOpen,
      handleFeatureEdit,
      handleTargetsChangeOpacity,
      activeProduct,
      handleOverlayChangeOpacity,
      overlaysVisible,
      handleDisplayProductMetadata,
      setOperatorControlsProduct,
      operatorControlsMap,
      productDescriptions,
      overlays: allActiveOverlays,
      fetchingInitialData,
      fetchingGroups,
      groups,
      keywordsMap,
      showFeatureOutline,
      hideFeatureOutline,
      animationPlayerState,
      playLayerAnimation,
      pauseLayerAnimation,
      stopLayerAnimation,
      nextLayerAnimationFrame,
      previousLayerAnimationFrame,
      animationFrameGapMS,
      setAnimationSpeed,
    } = this.props;

    // Check loading and active product states
    if (isCustomProduct && !isAnnotatableProduct) {
      return <div className={ProductDetailsStyles.emptyStateMessage}>No Overlays</div>;
    }
    if (fetchingInitialData) return <div className={ProductDetailsStyles.emptyStateMessage}>Loading</div>;
    if (!activeProduct || !getPropFromProduct(activeProduct, config.es_mappings.filename, null))
      return <div className={ProductDetailsStyles.emptyStateMessage}>Select an Image</div>;
    if (fetchingGroups) return <div className={ProductDetailsStyles.emptyStateMessage}>Loading Overlays</div>;

    const productsWithSameOverlayId = groups.filter(
      (item) =>
        getPropFromProduct(item, config.es_mappings.overlay_id) ===
        getPropFromProduct(activeProduct, config.es_mappings.overlay_id)
    );

    if (!productsWithSameOverlayId.length) {
      // telemetry.logWarning(
      //   `Error: Unable to find matching overlays for product ${
      //     getPropFromProduct(activeProduct, config.es_mappings.id)
      //   } with overlayId ${getPropFromProduct(activeProduct, config.es_mappings.overlay_id)}.`
      // );
      return <div className={ProductDetailsStyles.emptyStateMessage}>Error Loading Overlays</div>;
    }

    const addedAnnotationsMap = annotations.reduce((annotationsMap, annotation) => {
      annotationsMap[annotation.annotation_id] = annotation;
      return annotationsMap;
    }, {});

    const matchingActiveAnnotations = Object.values(addedAnnotationsMap);

    // Separate out targets and all other layers
    const targets = [];
    const activeOverlays = [];
    allActiveOverlays.forEach((overlay) => {
      if (isTarget(overlay)) {
        targets.push(overlay);
      } else {
        activeOverlays.push(overlay);
      }
    });

    // slice to remove base image from list
    const currActiveOverlays = activeOverlays.slice(1).reverse(); // reverse order for display order
    const numActiveOverlays = currActiveOverlays.length + (targets.length > 0 ? 1 : 0); // add 1 for active targets if needed

    const baseImageOptionalProps = {};
    if (isCustomProduct(activeProduct) && isAnnotatableProduct(activeProduct)) {
      baseImageOptionalProps.title = getPropFromProduct(activeProduct, config.es_mappings.filename, null);
      baseImageOptionalProps.description = `Uploaded by ${getPropFromProduct(
        activeProduct,
        config.es_mappings.created_by
      )}`;
    }

    if (isSingleFrame(activeProduct) || isMosaic(activeProduct)) {
      baseImageOptionalProps.productFamilyMetadata = getDescriptionsForProduct(activeProduct, productDescriptions);
    }

    const anythingActive = numActiveOverlays > 0 || matchingActiveAnnotations.length > 0 || targets.length > 0;
    const imagesAndNonImagesActive =
      currActiveOverlays.length > 0 && (matchingActiveAnnotations.length > 0 || targets.length > 0);

    const selectedAnimationSpeedOption = animationSpeeds.find((o) => o.value === animationFrameGapMS);
    return (
      <div className={OverlaysPanelStyles.contentRoot}>
        <div className={OverlaysPanelStyles.panelSectionHeaderRow}>
          <span className={OverlaysPanelStyles.panelSectionHeader}>Base Image</span>
        </div>
        <div className={OverlaysPanelStyles.overlaysContainer}>
          <ImageOverlay
            key={getPropFromProduct(activeProduct, config.es_mappings.id)}
            product={activeProduct}
            orderAdjustable={false}
            selectable={false}
            active={false}
            {...baseImageOptionalProps}
          />
        </div>
        <div className={OverlaysPanelStyles.panelSectionHeaderRow}>
          <span className={OverlaysPanelStyles.panelSectionHeader}>Active Overlays</span>
          <div>
            <Tooltip overlay={overlaysVisible ? 'Hide overlays' : 'Show overlays'} placement="topLeft">
              <Button
                aria-label={overlaysVisible ? 'Hide overlays' : 'Show overlays'}
                disabled={!anythingActive}
                variant="icon"
                onClick={this.toggleVisibility}
                icon={overlaysVisible ? <OpacityIcon /> : <NoOpacityIcon />}
              />
            </Tooltip>
            <Tooltip overlay="Remove All" placement="topLeft">
              <Button
                aria-label="Remove All"
                disabled={!anythingActive}
                variant="icon"
                onClick={this.removeAllActiveOverlays}
                icon={<RemoveAllIcon />}
              />
            </Tooltip>
            <ControlsOverlay
              overlayPlacement="top"
              full={false}
              closeOnClick
              noPadding
              icon={<ThreeDotIcon />}
              tooltipProps={{
                placement: 'topLeft',
                overlay: 'Layer Actions',
                trigger: ['click', 'hover'],
              }}
            >
              <span>
                <Button
                  full
                  text="Add Layers from URL or Path"
                  variant="menuItem"
                  icon={<PlusIcon />}
                  onClick={this.addCustomLayer}
                />
                <Button
                  disabled={numActiveOverlays < 1}
                  full
                  text="Animate Layers"
                  variant="menuItem"
                  icon={<PlayIcon />}
                  onClick={playLayerAnimation}
                />
              </span>
            </ControlsOverlay>
          </div>
        </div>
        {!anythingActive && (
          <div className={TypographyStyles.medium}>
            Add overlays from other tabs to view them on top of your current base image. Alternatively add overlays from
            URLs or paths using the plus button.
          </div>
        )}
        {animationPlayerState !== 'stopped' && (
          <div className={OverlaysPanelStyles.animationControls}>
            <Tooltip overlay="Step Backwards" placement="top">
              <Button
                aria-label="Step Backwards"
                variant="icon"
                icon={<RewindIcon />}
                onClick={previousLayerAnimationFrame}
              />
            </Tooltip>
            {animationPlayerState === 'playing' && (
              <Tooltip overlay="Pause Layer Animation" placement="top">
                <Button
                  aria-label="Pause Layer Animation"
                  variant="icon"
                  icon={<PauseIcon />}
                  onClick={pauseLayerAnimation}
                />
              </Tooltip>
            )}
            {animationPlayerState === 'paused' && (
              <Tooltip overlay="Play Layer Animation" placement="top">
                <Button
                  aria-label="Play Layer Animation"
                  variant="icon"
                  icon={<PlayIcon />}
                  onClick={playLayerAnimation}
                />
              </Tooltip>
            )}
            <Tooltip overlay="Stop Layer Animation" placement="top">
              <Button
                aria-label="Stop Layer Animation"
                variant="icon"
                icon={<StopIcon />}
                onClick={stopLayerAnimation}
              />
            </Tooltip>
            <Tooltip overlay="Step Forwards" placement="top">
              <Button
                aria-label="Step Forwards"
                variant="icon"
                icon={<FastForwardIcon />}
                onClick={nextLayerAnimationFrame}
              />
            </Tooltip>
            <Select
              className={OverlaysPanelStyles.animationControlsSelect}
              labelPosition="inner"
              options={animationSpeeds}
              defaultValue={selectedAnimationSpeedOption}
              searchable={false}
              label="Speed"
              onChange={(selectedOption) => setAnimationSpeed(selectedOption.value)}
            />
          </div>
        )}
        <div className={OverlaysPanelStyles.overlaysContainer}>
          {targets.length > 0 && (
            <ActiveTargets
              key="activeTargets"
              targets={targets}
              overlaysVisible={overlaysVisible}
              onRemove={handleRemoveAllTargets}
              onChangeOpacity={handleTargetsChangeOpacity}
            />
          )}
          {matchingActiveAnnotations.map((annotation) => {
            if (getPropFromProduct(annotation, config.es_mappings.object_type) === 'm20-image-feature') {
              return (
                <ActiveImageFeature
                  key={annotation.annotation_id}
                  feature={annotation}
                  keywordsMap={keywordsMap}
                  user={user}
                  overlaysVisible={overlaysVisible}
                  onFeatureEdit={handleFeatureEdit}
                  onFeatureRemove={handleAnnotationRemove}
                  onFeatureChangeOpacity={handleAnnotationChangeOpacity}
                  onZoomToFeature={handleZoomToFeature}
                  setFeatureMetadataOpen={handleSetFeatureMetadataOpen}
                  showFeatureOutline={showFeatureOutline}
                  hideFeatureOutline={hideFeatureOutline}
                />
              );
            }
            return (
              <ActiveAnnotation
                key={annotation.annotation_id}
                annotation={annotation}
                user={user}
                overlaysVisible={overlaysVisible}
                onEdit={handleAnnotationEdit}
                onRemove={handleAnnotationRemove}
                onChangeOpacity={handleAnnotationChangeOpacity}
                onZoomToAnnotation={handleZoomToAnnotation}
                onAnnotationDelete={handleAnnotationDelete}
              />
            );
          })}
          {imagesAndNonImagesActive && <div className={OverlaysPanelStyles.overlaySectionDivider} />}
          <DragDropContext onDragEnd={this.handleReorder}>
            <StrictModeDroppable droppableId="overlay-droppable">
              {(droppableProvided, droppableSnapshot) => (
                <div {...droppableProvided.droppableProps} ref={droppableProvided.innerRef}>
                  {currActiveOverlays.map((overlay, i) => {
                    const id = getIDForLayer(overlay);
                    return (
                      <Draggable
                        key={id}
                        draggableId={id}
                        disableInteractiveElementBlocking={false}
                        index={i}
                        style={{ zIndex: 9999999 }}
                      >
                        {(draggableProvided, draggableSnapshot) => (
                          <div
                            ref={draggableProvided.innerRef}
                            className={OverlaysPanelStyles.draggableWrapper}
                            {...draggableProvided.draggableProps}
                          >
                            <ActiveOverlay
                              productDescriptions={productDescriptions}
                              dragging={draggableSnapshot.isDragging}
                              overlay={overlay}
                              overlaysVisible={overlaysVisible}
                              onChangeOpacity={handleOverlayChangeOpacity}
                              onRemove={this.handleOverlayRemove}
                              handleDisplayProductMetadata={handleDisplayProductMetadata}
                              dragHandleProps={{ ...draggableProvided.dragHandleProps }}
                              setOperatorControlsProduct={setOperatorControlsProduct}
                              operatorControlsMap={operatorControlsMap}
                            />
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {droppableProvided.placeholder}
                </div>
              )}
            </StrictModeDroppable>
          </DragDropContext>
          {currActiveOverlays.length > 1 ? (
            <div className={OverlaysPanelStyles.dragHint}>Drag to re-order overlays</div>
          ) : null}
        </div>
      </div>
    );
  }
}

ActiveOverlays.defaultProps = {
  activeProduct: null,
};

ActiveOverlays.propTypes = {
  activeProduct: PropTypes.object,
  animationPlayerState: PropTypes.string.isRequired,
  user: PropTypes.object.isRequired,
  annotations: PropTypes.array.isRequired,
  productDescriptions: PropTypes.object,
  handleRemoveAllAnnotations: PropTypes.func.isRequired,
  handleAnnotationAdd: PropTypes.func.isRequired,
  handleAnnotationEdit: PropTypes.func.isRequired,
  handleAnnotationRemove: PropTypes.func.isRequired,
  handleAnnotationChangeOpacity: PropTypes.func.isRequired,
  handleZoomToAnnotation: PropTypes.func.isRequired,
  overlays: PropTypes.arrayOf(PropTypes.object).isRequired,
  overlaysVisible: PropTypes.bool.isRequired,
  handleAddCustomLayer: PropTypes.func.isRequired,
  playLayerAnimation: PropTypes.func.isRequired,
  pauseLayerAnimation: PropTypes.func.isRequired,
  stopLayerAnimation: PropTypes.func.isRequired,
  nextLayerAnimationFrame: PropTypes.func.isRequired,
  previousLayerAnimationFrame: PropTypes.func.isRequired,
  animationFrameGapMS: PropTypes.number.isRequired,
  setAnimationSpeed: PropTypes.func.isRequired,
  handleOverlayRemove: PropTypes.func.isRequired,
  handleOverlayChangeOpacity: PropTypes.func.isRequired,
  handleToggleOverlaysVisible: PropTypes.func.isRequired,
  handleOverlayMove: PropTypes.func.isRequired,
  handleRemoveAllOverlays: PropTypes.func.isRequired,
  handleDisplayProductMetadata: PropTypes.func.isRequired,
  showFeatureOutline: PropTypes.func.isRequired,
  hideFeatureOutline: PropTypes.func.isRequired,
};
export default ActiveOverlays;
