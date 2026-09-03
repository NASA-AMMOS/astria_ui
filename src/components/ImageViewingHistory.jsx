import classNames from 'classnames';
import React from 'react';
import Button from 'src/components/common/Button';
import ControlsOverlay from 'src/components/common/ControlsOverlay';
import Tooltip from 'src/components/common/Tooltip';
import EDRListStyles from 'src/styles/EdrList.module.css';
import headerStyles from 'src/styles/Header.module.css';
import ImageViewingHistoryStyles from 'src/styles/ImageViewingHistory.module.css';
import { getURLForProductWithExistingParams, openInNewTab } from 'src/utils';
import { getMetadataForProducts, searchBaseKeyInclusionSet } from 'src/utils/dataQuery';
import { logError } from 'src/utils/telemetryUtils';
import { ChevronDownIcon, ExternalLink, HistoryOutlinedIcon } from './common/Icons';
import ImageResult from './common/ImageResult';
import MultiSelect from './common/MultiSelect';

import config from 'config.js';
import { getPropFromProduct } from 'src/utils/sharedUtils';
class ImageViewingHistory extends React.Component {
  constructor(props) {
    super(props);

    this.LOCALSTORAGE_IMAGE_VIEWING_HISTORY_VIEW_OPTION_KEY = 'ImageViewingHistory_ViewOption';

    this.controlsOverlayRef = React.createRef();

    this.state = {
      view: localStorage.getItem(this.LOCALSTORAGE_IMAGE_VIEWING_HISTORY_VIEW_OPTION_KEY) || 'image',
      fetchingImageHistoryMetadata: true,
      fetchingImageHistoryMetadataSuccess: false,
      imageHistoryMetadataCache: {},
    };
  }

  componentDidMount() {
    this.getImageHistoryMetadata();
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.imageHistory !== prevProps.imageHistory &&
      !this.state.fetchingImageHistoryMetadata &&
      Object.keys(this.props.imageHistory).length > 0
    ) {
      // If we have a new imageHistory list object, we're not already fetching history,
      // and we have history to fetch, get metadata. Note that this call will only
      // populate the cache for non-cached entries.
      this.getImageHistoryMetadata();
    }
  }

  getImageHistoryMetadata = async () => {
    try {
      this.setState({
        fetchingImageHistoryMetadata: true,
      });
      const productsToLookup = this.props.imageHistory
        .filter((x) => {
          // Only do a lookup for entries without metadata included or in cache
          return !Object.values(x)[0] && !this.state.imageHistoryMetadataCache[Object.keys(x)[0]];
        })
        .map((x) => ({ [config.es_mappings.img_url.key]: Object.keys(x)[0] })); // shape them into fake products for our lookup

      let metadata = {};
      if (productsToLookup.length > 0) {
        metadata = await getMetadataForProducts(
          productsToLookup,
          null,
          config.es_mappings.img_url.key, // lookup by full path
          false,
          searchBaseKeyInclusionSet
        );
      }

      this.setState({
        fetchingImageHistoryMetadata: false,
        fetchingImageHistoryMetadataSuccess: true,
        imageHistoryMetadataCache: { ...this.state.imageHistoryMetadataCache, ...metadata }, // merge with existing metadata cache
      });
    } catch (err) {
      logError('Unable to fetch metadata for image viewing history products', err);
      this.setState({
        fetchingImageHistoryMetadata: false,
        fetchingImageHistoryMetadataSuccess: false,
      });
    }
  };

  onImageHistoryItemClick = async (event, item) => {
    const { handleSearchItemClicked } = this.props;

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
      handleSearchItemClicked(item);
      if (this.controlsOverlayRef.current) {
        this.controlsOverlayRef.current.toggleOpen();
      }
    }
  };

  renderImageResult(product) {
    return (
      <ImageResult
        fadeIn
        autoConstrain={false}
        product={product}
        className={EDRListStyles.imageResult}
        showMetadata
        showAlt
      />
    );
  }

  renderFilenameResult(product) {
    return (
      <div
        className={classNames({
          [EDRListStyles.filenameResult]: true,
        })}
      >
        <ImageResult
          interactable={false}
          fadeIn
          autoConstrain
          product={product}
          className={EDRListStyles.filenameImage}
          showMetadata={false}
          showAlt={false}
        />
        <div className={classNames(EDRListStyles.filenameText, ImageViewingHistoryStyles.filenameText)}>
          {getPropFromProduct(product, config.es_mappings.filename)}
        </div>
      </div>
    );
  }

  render() {
    const { showTextLabel, imageHistory, clearViewingHistory } = this.props;
    const { view, imageHistoryMetadataCache, fetchingImageHistoryMetadata, fetchingImageHistoryMetadataSuccess } =
      this.state;

    const listClass = classNames({
      [ImageViewingHistoryStyles.filenameResults]: view === 'filename',
      [ImageViewingHistoryStyles.imageResults]: view === 'image',
      [EDRListStyles.filenameResults]: view === 'filename',
      [EDRListStyles.imageResults]: view === 'image',
      [EDRListStyles.resultsMedium]: true,
      [headerStyles.imageViewingHistoryList]: true,
    });

    const imageHistoryProducts = [];
    if (!fetchingImageHistoryMetadata && fetchingImageHistoryMetadataSuccess) {
      imageHistory.forEach((x) => {
        const s3Path = Object.keys(x)[0];
        const possibleProduct = Object.values(x)[0];
        // ensure we have product metadata for this object or that metadata is found in the cache
        const product = possibleProduct || imageHistoryMetadataCache[s3Path];
        if (product) imageHistoryProducts.push(product);
      });
    }

    return (
      <ControlsOverlay
        ref={this.controlsOverlayRef}
        overlayPlacement="bottom-start"
        full={false}
        noPadding={true}
        button={
          <Button
            className={headerStyles.headerButton}
            id="prevent-controls-overlay-close"
            text={showTextLabel ? 'History' : ''}
            variant="lineButton"
            rightIcon={
              <span className={headerStyles.chevron}>
                <ChevronDownIcon />
              </span>
            }
            icon={<HistoryOutlinedIcon />}
          />
        }
      >
        <div className={ImageViewingHistoryStyles.menu}>
          <div className={headerStyles.genericMenuTitle}>
            Recently Viewed Images
            <Button variant="text" onClick={clearViewingHistory} text="Clear History" />
          </div>
          {fetchingImageHistoryMetadata && (
            <div className={headerStyles.emptyMenuItem}>
              <div className={headerStyles.menuItemTitle}>Loading Image History</div>
            </div>
          )}
          {!fetchingImageHistoryMetadata && !fetchingImageHistoryMetadataSuccess && (
            <div className={headerStyles.emptyMenuItem}>
              <div className={headerStyles.menuItemTitle}>Unable to Fetch Image History</div>
            </div>
          )}
          {!fetchingImageHistoryMetadata && fetchingImageHistoryMetadataSuccess && (
            <div className={headerStyles.menuItems}>
              {!imageHistory.length && (
                <div className={ImageViewingHistoryStyles.emptyStateMessage}>No recently viewed images</div>
              )}
              {imageHistory.length > 0 && (
                <div>
                  <MultiSelect
                    key="view_history_display"
                    className={ImageViewingHistoryStyles.multiselect}
                    selectedValue={view}
                    options={[
                      { label: 'Filename', value: 'filename' },
                      { label: 'Image', value: 'image' },
                    ]}
                    onChange={(value) => {
                      this.setState({ view: value });
                      localStorage.setItem(this.LOCALSTORAGE_IMAGE_VIEWING_HISTORY_VIEW_OPTION_KEY, value);
                    }}
                  />
                  <div className={listClass}>
                    {imageHistoryProducts.map((product) => {
                      return (
                        <div
                          key={`${getPropFromProduct(product, config.es_mappings.id)}_history`}
                          className={ImageViewingHistoryStyles.productButtonContainer}
                        >
                          <button
                            type="button"
                            className={classNames(EDRListStyles.searchResult, ImageViewingHistoryStyles.productButton)}
                            onClick={(event) => this.onImageHistoryItemClick(event, product)}
                          >
                            {view === 'image' ? this.renderImageResult(product) : this.renderFilenameResult(product)}
                          </button>
                          <Tooltip placement="top" overlay="Open in New Tab">
                            <Button
                              className={classNames(ImageViewingHistoryStyles.openInNewTabButton, {
                                [ImageViewingHistoryStyles.openInNewTabButtonBackground]: view === 'image',
                              })}
                              aria-label="Open in New Tab"
                              variant="icon"
                              icon={<ExternalLink />}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                const newURL = getURLForProductWithExistingParams(product);
                                openInNewTab(newURL, false);
                              }}
                            />
                          </Tooltip>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ControlsOverlay>
    );
  }
}

export default ImageViewingHistory;
