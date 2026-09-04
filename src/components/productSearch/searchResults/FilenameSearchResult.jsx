import classNames from 'classnames';
import ImageResult from 'src/components/common/ImageResult';
import Tooltip from 'src/components/common/Tooltip';
import EDRListStyles from 'src/styles/EdrList.module.css';
import { getDefined } from 'src/utils';
import { getConfig } from 'src/utils/configRegistry';
import { formatFilenameLabel } from 'src/utils/searchUtils';
import { getPropFromProduct } from 'src/utils/sharedUtils';

const FilenameSearchResult = ({
  item,
  viewOptions,
  resultSize: stateResultSize,
  filenameDiffingEnabled: stateFilenameDiffingEnabled,
  EDRGroupTooltipEnabled: stateEDRGroupTooltipEnabled,
  groupResults: stateGroupResults,
}) => {
  const config = getConfig();
  const resultSize = getDefined(viewOptions.resultSize, stateResultSize);
  const filenameDiffingEnabled = getDefined(viewOptions.filenameDiffingEnabled, stateFilenameDiffingEnabled);
  const EDRGroupTooltipEnabled = getDefined(viewOptions.EDRGroupTooltipEnabled, stateEDRGroupTooltipEnabled);
  const groupResults = getDefined(viewOptions.groupResults, stateGroupResults);

  const resultLabel = getPropFromProduct(item, config.es_mappings.filename);

  const showDiffFunctionality = filenameDiffingEnabled && groupResults;
  const showImage = resultSize !== 'small';

  const formatFilename = (string, indexDiffMap) => {
    const formatted = formatFilenameLabel(string, indexDiffMap, EDRListStyles.highlightedFilenameComponent);
    return formatted.map((formattedItem, _index) => {
      if (typeof formattedItem === 'string') {
        return formattedItem;
      }
      return (
        <span key={formattedItem.key} className={formattedItem.className}>
          {formattedItem.text}
        </span>
      );
    });
  };

  const formattedLabel = showDiffFunctionality ? formatFilename(resultLabel, item._filenameDiff) : resultLabel;

  const renderTooltip = (product) => (
    <div key={getPropFromProduct(product, config.es_mappings.id)} className={EDRListStyles.searchResult}>
      <div className={EDRListStyles.filenameResult}>
        <div className={EDRListStyles.filenameText}>{getPropFromProduct(product, config.es_mappings.filename)}</div>
      </div>
    </div>
  );

  const innerContent = (
    <div
      key={`${getPropFromProduct(item, config.es_mappings.id)}_filenameResult_inner`}
      className={classNames({
        [EDRListStyles.filenameResult]: true,
        [EDRListStyles.filenameHighlightingEnabled]: filenameDiffingEnabled,
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
      <div className={EDRListStyles.filenameText}>{formattedLabel}</div>
    </div>
  );

  let tooltipWrapper = innerContent;
  if (showDiffFunctionality && EDRGroupTooltipEnabled) {
    const tooltipOverlayClassnames = classNames({
      [EDRListStyles.filenameResults]: true,
      [EDRListStyles.reactiveListContainer]: true,
      [EDRListStyles.filenameTooltipItems]: true,
      [EDRListStyles.resultsSmall]: true,
    });
    const tooltipOverlay = (
      <div>
        <div className={EDRListStyles.filenameTooltipLabel}>EDR Group Members</div>
        <div className={tooltipOverlayClassnames}>
          {item._group &&
            item._group
              .sort((a, b) => {
                const x = getPropFromProduct(a, config.es_mappings.product_type);
                const y = getPropFromProduct(b, config.es_mappings.product_type);
                return x < y ? -1 : x > y ? 1 : 0;
              })
              .map((member) => renderTooltip(member))}
        </div>
      </div>
    );
    tooltipWrapper = (
      <Tooltip
        key={`${getPropFromProduct(item, config.es_mappings.id)}_filenameResult`}
        className={EDRListStyles.filenameTooltip}
        overlay={tooltipOverlay}
        autoPlacement
        mouseEnterDelay={2}
        mouseLeaveDelay={0.25}
      >
        {innerContent}
      </Tooltip>
    );
  }
  return tooltipWrapper;
};

export default FilenameSearchResult;
