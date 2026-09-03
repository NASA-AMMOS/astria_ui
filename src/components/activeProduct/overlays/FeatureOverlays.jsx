import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { ImageOverlay } from 'src/components/activeProduct/ImageOverlay';
import Button from 'src/components/common/Button';
import { CheckIcon, CrosshairsLooseIcon, EditIcon, InfoIcon, PlusIcon, SpinnerIcon } from 'src/components/common/Icons';
import Select from 'src/components/common/Select';
import Tip from 'src/components/common/Tip';
import Toggle from 'src/components/common/Toggle';
import Tooltip from 'src/components/common/Tooltip';
import annotationFallbackImage from 'src/images/annotation_fallback_image.jpg';
import TypographyStyles from 'src/styles/common/typography.module.css';
import ImageOverlayStyles from 'src/styles/ImageOverlay.module.css';
import OverlaysPanelStyles from 'src/styles/OverlaysPanel.module.css';
import { getConfidenceLevelLabel, objAlphaSort } from 'src/utils';
import { datadriveGetOCSObjectDownloadPathForS3URL } from 'src/utils/endpoints';
import { getPropFromProduct } from 'src/utils/sharedUtils';

import config from 'config.js';
class FeatureOverlays extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      selectedKeyword: { value: '__ALL__', label: 'All' },
    };
  }

  renderAvailableFeatureResult = (feature, featureActive, loading) => {
    const {
      user,
      handleFeatureAdd,
      handleFeatureEdit,
      handleFeatureRemove,
      handleFeatureChangeOpacity,
      setFeatureMetadataOpen,
      handleZoomToFeature,
      keywordsMap,
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
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();
                handleFeatureEdit(feature);
              }}
              icon={<EditIcon />}
            />
          </Tooltip>
        )}
        <Tooltip overlay="Feature Info" placement="top">
          <Button
            variant="icon"
            onClick={(evt) => {
              evt.stopPropagation();
              setFeatureMetadataOpen(feature);
            }}
            icon={<InfoIcon />}
          />
        </Tooltip>
        {/* Only allow zoom to if the feature is saved since unsaved features can contain multiple shapes */}
        {featureActive && !feature.isUnsaved && (
          <Tooltip overlay="Zoom to Feature" placement="top">
            <Button
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();
                handleZoomToFeature(feature);
              }}
              icon={<CrosshairsLooseIcon />}
            />
          </Tooltip>
        )}
        {!featureActive && (
          <Tooltip overlay="Add Feature" placement="top">
            <Button
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();
                handleFeatureAdd(feature);
              }}
              icon={<PlusIcon />}
            />
          </Tooltip>
        )}
        {featureActive && (
          <Tooltip overlay="Remove Feature" placement="top">
            <Button
              className={loading ? OverlaysPanelStyles.overlaySpinnerIcon : OverlaysPanelStyles.overlayAddedIcon}
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();
                handleFeatureRemove(feature);
              }}
              icon={loading ? <SpinnerIcon /> : <CheckIcon />}
            />
          </Tooltip>
        )}
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
        tooltip={feature.feature_notes || 'No Notes'} // TODO show here?
        fallback={thumbnail}
        overlayActions={featureActions}
        product={feature}
        selectable={true}
        onClick={(evt) => {
          evt.stopPropagation();
          const skip = !!evt.target.closest(`.${ImageOverlayStyles.bottomContent}`);
          if (!skip) {
            if (!featureActive) {
              handleFeatureAdd(feature);
            } else {
              handleFeatureRemove(feature);
            }
          }
        }}
        opacityAdjustable={featureActive}
        opacity={feature.opacity !== null ? feature.opacity : 1}
        onChangeOpacity={(opacity) => handleFeatureChangeOpacity(feature, opacity)}
        onMouseEnter={() => showFeatureOutline(feature)}
        onMouseLeave={() => hideFeatureOutline(feature)}
      />
    );
  };

  render() {
    const {
      groups,
      activeProduct,
      allActiveAnnotations,
      keywordsMap,
      handleFeatureAdd,
      handleFeatureRemove,
      handleAutoShowImageFeatures,
      autoShowImageFeatures,
    } = this.props;
    const { selectedKeyword } = this.state;

    const activeFeatures = allActiveAnnotations.filter(
      (x) => getPropFromProduct(x, config.es_mappings.object_type) === 'm20-image-feature'
    );

    const productsWithSameOverlayId = groups.filter(
      (item) =>
        getPropFromProduct(item, config.es_mappings.overlay_id) ===
        getPropFromProduct(activeProduct, config.es_mappings.overlay_id)
    );

    const allFeatures = productsWithSameOverlayId.filter(
      (p) => getPropFromProduct(p, config.es_mappings.object_type) === 'm20-image-feature'
    );

    // build list of available keywords
    const keywordOptionsMap = allFeatures.reduce((acc, feature) => {
      const keyId = feature.feature_science_intent_keyword_id;
      if (keyId && typeof acc[keyId] === 'undefined') {
        const keyword = keywordsMap[keyId];
        if (keyword) {
          acc[keyId] = { value: keyword.id, label: keyword.name };
        }
      }
      return acc;
    }, {});
    const keywordOptions = objAlphaSort(
      Object.keys(keywordOptionsMap).map((keyId) => {
        return { ...keywordOptionsMap[keyId] };
      }),
      'label',
      false,
      false
    );
    keywordOptions.unshift({ value: '__ALL__', label: 'All' });

    const activeFeaturesMap = activeFeatures.reduce((featuresMap, feature) => {
      featuresMap[feature.annotation_id || feature.feature_id] = feature;
      return featuresMap;
    }, {});

    // Filter features and sort by last updated date
    const features = allFeatures.filter(
      (feature) =>
        selectedKeyword.value === '__ALL__' || selectedKeyword.value === feature.feature_science_intent_keyword_id
    );
    features.sort(
      (a, b) =>
        new Date(getPropFromProduct(b, config.es_mappings.updated_at)) -
        new Date(getPropFromProduct(a, config.es_mappings.updated_at))
    );

    return (
      <div className={OverlaysPanelStyles.contentRoot}>
        <div className={OverlaysPanelStyles.overlaysList}>
          <Tip>Tag areas in the image with Science Intent keywords and visualize features created by other users.</Tip>
          <div className={OverlaysPanelStyles.toggleContainer}>
            <div className={TypographyStyles.label}>Automatically show all features</div>
            <Toggle on={autoShowImageFeatures} disabled={false} onChange={() => handleAutoShowImageFeatures()} />
          </div>
          <div className={OverlaysPanelStyles.featureButtonRow}>
            <Button
              full
              variant="secondary"
              onClick={() => {
                features.forEach((feature) => {
                  // Add the feature if it is not already active or loading
                  if (!feature.loading && !activeFeaturesMap[feature.annotation_id || feature.feature_id]) {
                    handleFeatureAdd(feature);
                  }
                });
              }}
              text="Show All"
            />
            <Button
              full
              variant="secondary"
              onClick={() => {
                allFeatures.forEach((feature) => {
                  // Hide the feature if it is active or unsaved
                  if (!feature.isUnsaved && !!activeFeaturesMap[feature.annotation_id || feature.feature_id]) {
                    handleFeatureRemove(feature);
                  }
                });
              }}
              text="Hide All"
            />
          </div>
          <Button full variant="secondary" onClick={() => this.props.newFeature()} text="Add Feature" />
          {allFeatures.length > 0 ? (
            <>
              <Select
                labelWidth="100%"
                labelPosition="inner"
                label="Keyword Filter"
                searchable
                value={selectedKeyword}
                options={keywordOptions}
                onChange={(selectedOption) => this.setState({ selectedKeyword: selectedOption })}
              />
              {features.length > 0 ? (
                features.map((feature) => {
                  const activeFeature = activeFeaturesMap[feature.annotation_id || feature.feature_id];
                  const loading = activeFeature ? activeFeature.loading : false;
                  return this.renderAvailableFeatureResult(
                    !!activeFeature ? activeFeature : feature,
                    !!activeFeature,
                    loading
                  );
                })
              ) : (
                <div className={TypographyStyles.medium}>
                  No matching features, try selecting a different Science Intent Keyword
                </div>
              )}
            </>
          ) : (
            <div className={TypographyStyles.medium}>No features found for this image group</div>
          )}
        </div>
      </div>
    );
  }
}

FeatureOverlays.propTypes = {
  groups: PropTypes.arrayOf(PropTypes.object).isRequired,
  user: PropTypes.object.isRequired,
  keywordsMap: PropTypes.object.isRequired,
  activeProduct: PropTypes.object.isRequired,
  handleFeatureAdd: PropTypes.func.isRequired,
  handleFeatureEdit: PropTypes.func.isRequired,
  handleFeatureRemove: PropTypes.func.isRequired,
  setImageFeatureEditorOpen: PropTypes.func.isRequired,
  handleZoomToFeature: PropTypes.func.isRequired,
  newFeature: PropTypes.func.isRequired,
  showFeatureOutline: PropTypes.func.isRequired,
  hideFeatureOutline: PropTypes.func.isRequired,
};
export default FeatureOverlays;
