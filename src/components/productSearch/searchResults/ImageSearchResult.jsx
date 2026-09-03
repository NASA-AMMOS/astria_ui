import config from 'config.js';
import ImageResult from 'src/components/common/ImageResult';
import EDRListStyles from 'src/styles/EdrList.module.css';
import {
  getAdditionalCustomLabelPropsForProduct,
  getConfidenceLevelLabel,
  getDefined,
  isAnnotation,
  isFeature,
} from 'src/utils';
import { getPropFromProduct } from 'src/utils/sharedUtils';

const ImageSearchResult = ({
  item,
  viewOptions,
  keywordsMap,
  imageResultTitleOnly,
  resultSize: stateResultSize,
  imageResultTimeKey: stateImageResultTimeKey,
  imageResultTitleKey: stateImageResultTitleKey,
  productIsActive,
}) => {
  const resultSize = getDefined(viewOptions.resultSize, stateResultSize);
  const imageResultTimeKey = getDefined(viewOptions.imageResultTimeKey, stateImageResultTimeKey);
  const imageResultTitleKey = getDefined(viewOptions.imageResultTitleKey, stateImageResultTitleKey);

  const showMetadata = resultSize !== 'small';

  if (isAnnotation(item)) {
    const createTime = getPropFromProduct(item, config.es_mappings.created_at);
    const secondaryTimeStr = typeof createTime === 'string' ? createTime.split('T')[0] : 'Unknown Time';
    return (
      <ImageResult
        fadeIn
        showOwner
        autoConstrain={false}
        product={item}
        className={EDRListStyles.imageResult}
        key={`${getPropFromProduct(item, config.es_mappings.id)}_imageResult`}
        active={productIsActive(item)}
        showMetadata={showMetadata}
        showAlt={!showMetadata}
        customLabel={{ title: getPropFromProduct(item, config.es_mappings.annotation.title) }}
        secondaryTimeLabel={`Created ${secondaryTimeStr}`}
      />
    );
  } else if (isFeature(item)) {
    const keywordID = getPropFromProduct(item, config.es_mappings.image_feature.feature_science_intent_keyword_id);
    const keywordName = keywordsMap[keywordID] ? keywordsMap[keywordID].name : `Unknown Keyword ID ${keywordID}`;
    return (
      <ImageResult
        fadeIn
        showOwner
        autoConstrain={false}
        product={item}
        className={EDRListStyles.imageResult}
        key={`${getPropFromProduct(item, config.es_mappings.id)}_imageResult`}
        active={productIsActive(item)}
        showMetadata={showMetadata}
        showAlt={!showMetadata}
        customLabel={{ title: keywordName }}
        secondaryTimeLabel={getConfidenceLevelLabel(
          getPropFromProduct(item, config.es_mappings.image_feature.feature_confidence_level)
        )}
      />
    );
  } else {
    const secondaryTimeValue = getPropFromProduct(item, { key: imageResultTimeKey.value }) || '';
    let secondaryTimeStr = secondaryTimeValue.toString() || 'Unknown Time';
    const secondaryTimeLabel = imageResultTimeKey.label || 'Unk';

    if (imageResultTimeKey.value === config.es_mappings.LMST.key) {
      try {
        const timeRegex = /\d{2}:\d{2}:\d{2}/;
        secondaryTimeStr = secondaryTimeValue.match(timeRegex)[0] || 'Invalid Format';
      } catch (err) {
        // do nothing
      }
    } else if (imageResultTimeKey.value === config.es_mappings.ERT.key) {
      try {
        let pieces = secondaryTimeValue.split('T');
        const date = pieces[0];
        let time = pieces[1];
        pieces = time.split(':');
        time = pieces.slice(0, 2).join(':');
        secondaryTimeStr = `${date} ${time} UTC`;
      } catch (err) {
        secondaryTimeStr = 'Invalid Format';
      }
    }

    const additionalProps = getAdditionalCustomLabelPropsForProduct(item, imageResultTitleKey.value);
    if (imageResultTitleOnly) {
      additionalProps.customLabel = additionalProps.customLabel || {};
      additionalProps.customLabel.subtitle = ' ';
    }

    return (
      <ImageResult
        fadeIn
        autoConstrain={false}
        product={item}
        className={EDRListStyles.imageResult}
        key={`${getPropFromProduct(item, config.es_mappings.id)}_imageResult`}
        active={productIsActive(item)}
        showMetadata={showMetadata}
        showAlt={!showMetadata}
        secondaryTimeLabel={imageResultTitleOnly ? '' : `${secondaryTimeLabel} ${secondaryTimeStr}`}
        {...additionalProps}
      />
    );
  }
};

export default ImageSearchResult;
