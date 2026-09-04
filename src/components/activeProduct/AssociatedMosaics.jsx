import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import Button from 'src/components/common/Button';
import EmptyState from 'src/components/common/EmptyState';
import { ExternalLink, InfoIcon } from 'src/components/common/Icons';
import ImageResult from 'src/components/common/ImageResult';
import MultiSelect from 'src/components/common/MultiSelect';
import ResultsControls from 'src/components/common/ResultsControls';
import Tip from 'src/components/common/Tip';
import Tooltip from 'src/components/common/Tooltip';
import AssociatedMosaicsStyles from 'src/styles/AssociatedMosaics.module.css';
import TypographyStyles from 'src/styles/common/typography.module.css';
import EDRListStyles from 'src/styles/EdrList.module.css';
import ProductDetailsStyles from 'src/styles/ProductDetails.module.css';
import { getURLForProductWithExistingParams, isTile, openInNewTab, pluralizeByListLength } from 'src/utils';
import { getPropFromProduct } from 'src/utils/sharedUtils';

import { getConfig } from 'src/utils/configRegistry';
export class AssociatedMosaics extends React.Component {
  constructor(props) {
    super(props);

    this.LOCALSTORAGE_ASSOCIATED_MOSAICS_VIEW_OPTION_KEY = 'AssociatedMosaics_ViewOption';

    this.state = {
      view: localStorage.getItem(this.LOCALSTORAGE_ASSOCIATED_MOSAICS_VIEW_OPTION_KEY) || 'image',
    };
  }

  openSourceProduct(product) {
    const url = getURLForProductWithExistingParams(product, {});
    openInNewTab(url, false);
  }

  renderFilenameResult(item) {
    const config = getConfig();
    const resultClass = classNames({
      [EDRListStyles.filenameResult]: true,
      [AssociatedMosaicsStyles.filenameResultError]: item._error,
    });

    const filenameTextClass = classNames({
      [EDRListStyles.filenameText]: true,
      [AssociatedMosaicsStyles.filenameText]: true,
      [AssociatedMosaicsStyles.filenameTextError]: item._error,
    });

    return (
      <div className={resultClass}>
        <ImageResult
          interactable={false}
          fadeIn
          autoConstrain
          product={item}
          className={EDRListStyles.filenameImage}
          showMetadata={false}
          showAlt={false}
        />
        <div className={filenameTextClass}>
          {getPropFromProduct(item, config.es_mappings.filename)}
          {item._error && <div className={AssociatedMosaicsStyles.productNotFoundBadge}>Product not found</div>}
        </div>
      </div>
    );
  }

  renderImageResult(item) {
    if (item._error) {
      item.instrument_id = item.ocs_name;
    }
    return (
      <div className={AssociatedMosaicsStyles.imageResultContainer}>
        {item._error && <div className={AssociatedMosaicsStyles.productNotFoundBadge}>Product not found</div>}
        <ImageResult
          interactable={!item._error}
          titleSelectable={item._error}
          fadeIn
          autoConstrain={false}
          product={item}
          className={EDRListStyles.imageResult}
          showMetadata
          showAlt
        />
      </div>
    );
  }

  onResultClicked(event, item) {
    const { setActiveSearchProduct } = this.props;

    // If we detect ctrl, command or shift, let the link handle the event since
    // this should be opening in a new tab/window
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      const newURL = getURLForProductWithExistingParams(item);
      const link = document.createElement('a');
      link.href = newURL;
      const newEvent = new MouseEvent('click', { ...event }); // clone click event
      link.dispatchEvent(newEvent); // trigger click event on our link element
    } else {
      // Otherwise we'll open the image here
      event.preventDefault();

      // Call item clicked with hasPartialMetadata since we don't have all mosaic metadata
      setActiveSearchProduct(item, true, true);
    }
  }

  render() {
    const config = getConfig();
    const { product, loading, associatedMosaics, openHelpArticle } = this.props;
    const { view } = this.state;

    const productIsTile = isTile(product);
    const associatedProductType = productIsTile ? 'reconstructed image' : 'mosaic';

    if (loading) return <div className={ProductDetailsStyles.emptyStateMessageFullHeight}>Loading</div>;

    if (associatedMosaics.length === 0) {
      return <EmptyState text={`No associated ${associatedProductType}s found for this image`} icon={<InfoIcon />} />;
    }

    const listClass = classNames({
      [EDRListStyles.filenameResults]: view === 'filename',
      [EDRListStyles.imageResults]: view === 'image',
      [AssociatedMosaicsStyles.imageResults]: view === 'image',
    });

    const buttonClass = classNames({
      [EDRListStyles.searchResult]: true,
      [AssociatedMosaicsStyles.sourceImageResult]: true,
    });

    const openInNewTabButtonClasses = classNames({
      [EDRListStyles.openInNewTabButton]: true,
      [EDRListStyles.openInNewTabButtonNoTopLabelImage]: view === 'image',
      [EDRListStyles.openInNewTabButtonImage]: view === 'image',
      [EDRListStyles.openInNewTabButtonFilename]: view === 'filename',
    });

    return (
      <div className={AssociatedMosaicsStyles.root}>
        <Tip className={AssociatedMosaicsStyles.tip}>
          All {associatedProductType}s that include this exposure.&nbsp;
          <button
            type="button"
            onClick={() => openHelpArticle('search_for_images/associated_mosaics')}
            className={TypographyStyles.learnMore}
          >
            Learn More
          </button>
        </Tip>
        <ResultsControls
          viewControls={[
            <MultiSelect
              label="Result Display"
              key="view_ASSOCIATED_MOSAICS_display"
              selectedValue={view}
              options={[
                { label: 'Filename', value: 'filename' },
                { label: 'Image', value: 'image' },
              ]}
              onChange={(value) => {
                this.setState({ view: value });
                localStorage.setItem(this.LOCALSTORAGE_ASSOCIATED_MOSAICS_VIEW_OPTION_KEY, value);
              }}
            />,
          ]}
          viewLabel="Image View Options"
          resultStatsLabel={`${associatedMosaics.length.toLocaleString()} ${pluralizeByListLength(
            'result',
            associatedMosaics
          )}`}
          loading={loading}
          results={associatedMosaics}
          compactWidth={200}
        />
        {associatedMosaics.length > 0 && (
          <div className={listClass}>
            {associatedMosaics.map((item) => {
              return (
                <div
                  key={`${getPropFromProduct(item, config.es_mappings.id)}_mosaic_image_${view}`}
                  className={EDRListStyles.searchResultContainer}
                >
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={(evt) => {
                      if (!item._error) this.onResultClicked(evt, item);
                    }}
                  >
                    {view === 'image' ? this.renderImageResult(item) : this.renderFilenameResult(item)}
                  </button>
                  {!item._error && (
                    <Tooltip placement="top" overlay="Open in New Tab">
                      <a target="_blank" rel="noreferrer" href={getURLForProductWithExistingParams(item)}>
                        <Button
                          aria-label="Open in New Tab"
                          className={openInNewTabButtonClasses}
                          variant="icon"
                          icon={<ExternalLink />}
                        />
                      </a>
                    </Tooltip>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
}

AssociatedMosaics.defaultProps = {
  loading: true,
  product: null,
  associatedMosaics: [],
};

AssociatedMosaics.propTypes = {
  loading: PropTypes.bool,
  product: PropTypes.object,
  associatedMosaics: PropTypes.array,
  openHelpArticle: PropTypes.func.isRequired,
};

export default AssociatedMosaics;
