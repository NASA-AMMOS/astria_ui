import classNames from 'classnames';
import config from 'config.js';
import ImageResult from 'src/components/common/ImageResult';
import EDRListStyles from 'src/styles/EdrList.module.css';
import { getDefined } from 'src/utils';
import { getPropFromProduct } from 'src/utils/sharedUtils';

const TextSearchResult = ({ item, viewOptions, resultSize: stateResultSize, view: stateView }) => {
  const resultSize = getDefined(viewOptions.resultSize, stateResultSize);
  const view = getDefined(viewOptions.view, stateView);

  const resultLabel = getPropFromProduct(item, config.es_mappings[view]);

  const showImage = resultSize !== 'small';
  return (
    <div
      key={`${getPropFromProduct(item, config.es_mappings.id)}_textResult`}
      className={classNames({
        [EDRListStyles.filenameResult]: true,
      })}
    >
      {showImage && (
        <ImageResult
          interactable={false}
          fadeIn
          autoConstrain
          product={item}
          className={EDRListStyles.filenameImage}
          showMetadata={false}
          showAlt={false}
        />
      )}
      <div className={EDRListStyles.filenameText}>{resultLabel}</div>
    </div>
  );
};

export default TextSearchResult;
