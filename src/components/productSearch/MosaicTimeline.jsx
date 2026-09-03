import classNames from 'classnames';
import 'lazysizes';
import debounce from 'lodash.debounce';
import React from 'react';
import { connect } from 'react-redux';
import { setActiveSearchProduct } from 'src/actions/activeSearchProduct';
import { setActiveMosaicBrowseCategory } from 'src/actions/searchActions';
import Button from 'src/components/common/Button';
import {
  ChevronRightIcon,
  CloseIcon,
  ExternalLink,
  HeliIcon,
  NavcamIcon,
  RefreshIcon,
  SHERLOCIcon,
  SupercamIcon,
  ZCAMIcon,
} from 'src/components/common/Icons';
import Tooltip from 'src/components/common/Tooltip';
import ExportResultsButtonContainer from 'src/containers/ExportResultsButtonContainer';
import EDRListStyles from 'src/styles/EdrList.module.css';
import FormsStyles from 'src/styles/Forms.module.css';
import MosaicsTimelineStyles from 'src/styles/MosaicsTimeline.module.css';
import { getURLForProductWithExistingParams, isCustomProduct, openInNewTab } from 'src/utils';
import { buildTiledImageURL } from 'src/utils/osd/osdUtils';
import { getAlias, getDescendantProp, getMosaics, getPropFromProduct } from 'src/utils/sharedUtils';
import { logError } from 'src/utils/telemetryUtils';

import config from 'config.js';
class MosaicTimeline extends React.Component {
  constructor(props) {
    super(props);

    this.ref = React.createRef();

    this.debouncedFilterChange = debounce(this.handleFilterChange.bind(this), 150, {
      trailing: true,
    });

    this.state = {
      containerWidth: 0,
      loading: true,
      retrying: false,
      initialLoadComplete: false,
      loadingSuccess: false,
      groupedMosaics: {},
      activeMosaicBrowseCategory: null,
      filter: '',
    };
  }

  componentDidMount() {
    this.connectResizeObserver();
    // Wait a frame for URL params to be dispatched from loadInitialData
    requestAnimationFrame(async () => {
      await this.fetchMosaics();
    });

    window.addEventListener('keyup', this.onKeyUp);
  }

  handleFilterChange = (event) => {
    this.setState({
      filter: event.target.value,
    });
  };

  onKeyUp = (event) => {
    const { activeSearchProduct, activeMosaicBrowseCategory, isVisible } = this.props;

    let mosaics = [];
    const instrument = activeMosaicBrowseCategory;
    if (this.state.groupedMosaics[instrument]) {
      mosaics = this.state.groupedMosaics[instrument].images;
    }

    if (!isVisible || !activeSearchProduct) return;
    if (event.target.nodeName === 'INPUT' || event.target.nodeName === 'TEXTAREA') return; // ignore events coming from inputs
    if (event.key === '[' || event.key === ']') {
      // Get item from mosaics
      const activeSearchProductId = getPropFromProduct(activeSearchProduct, config.es_mappings.id);
      const matchingResultIndex = mosaics.findIndex(
        (result) => getPropFromProduct(result, config.es_mappings.id) === activeSearchProductId
      );

      let newResultIndex = 0;

      // Find next acceptable result
      // If we can't find the activeSearchProduct in our list just select the first result
      if (matchingResultIndex > -1) {
        if (event.key === '[') {
          newResultIndex = matchingResultIndex - 1;
          if (newResultIndex < 0) return;
        } else {
          newResultIndex = matchingResultIndex + 1;
          if (newResultIndex > mosaics.length - 1) return;
        }
      }

      const nextResultElementId = this.getIdForResultIndex(newResultIndex);
      if (nextResultElementId) {
        const nextResultElement = document.getElementById(nextResultElementId);
        if (nextResultElement) {
          nextResultElement.focus();
          nextResultElement.scrollIntoViewIfNeeded
            ? nextResultElement.scrollIntoViewIfNeeded()
            : nextResultElement.scrollIntoView(); // fallback for Firefox that doesn't support this

          nextResultElement.click(); // Using click here since for some reason calling `handleSearchItemClicked` is terribly slow, needs more digging in performance profiler
        }
      }
    }
  };

  async fetchMosaics() {
    this.setState({ loading: true });

    try {
      const mosaicGatheringEnabled = (
        await (await fetch(`${config.mosaic_timeline?.url_base ?? './api'}/isMosaicGatheringEnabled`)).json()
      ).enabled;

      let cachedMosaics = [];
      let minutesLimitFromNow = 10; // 10 minutes
      if (mosaicGatheringEnabled) {
        // If mosaic gathering is enabled (the norm) fetch them from the server
        const response = await fetch(`${config.mosaic_timeline?.url_base ?? './api'}/mosaics`);
        cachedMosaics = await response.json();
      } else minutesLimitFromNow = -1;

      const { mosaics: latestMosaics } = await getMosaics(null, minutesLimitFromNow); // Fetch mosaics updated within the last X minutes

      // Merge latestMosaics on top of cachedMosaics
      const allMosaics = {};

      // Add all latest mosaics to the map
      latestMosaics.forEach((mosaic) => (allMosaics[mosaic.ocs_name] = mosaic));

      // Add all mosaics not already in latest mosaics to the map
      cachedMosaics.forEach((mosaic) => {
        if (!allMosaics.hasOwnProperty(mosaic.ocs_name)) allMosaics[mosaic.ocs_name] = mosaic;
      });

      let groupedMosaics = this.groupImages(allMosaics);

      // Cull stale Finder mosaics because we're so multimission
      groupedMosaics = this.cullFinderMosaics(groupedMosaics);

      // Sort groups
      const getTimeFromImage = (image) => {
        if (image.hasOwnProperty('time1')) return image.time1;
        if (image.hasOwnProperty('sol')) return image.sol;
        return 0;
      };
      Object.keys(groupedMosaics).forEach((group) => {
        groupedMosaics[group].images = groupedMosaics[group].images.sort((a, b) => {
          return getTimeFromImage(b) - getTimeFromImage(a);
        });
      });

      this.setState({ loading: false, groupedMosaics, initialLoadComplete: true, loadingSuccess: true });
      if (this.props.onResultsChange) this.props.onResultsChange(Object.keys(allMosaics).length);
    } catch (err) {
      this.setState({ loading: false, groupedMosaics: [], initialLoadComplete: true, loadingSuccess: false });
      logError('Failed to fetch recent mosaics:', err);
    }
  }

  getImageGroup(image) {
    // Separate out Quicklooks
    if (image.ocs_type_name === 'm20-quicklook') {
      if (image.instrument_id === 'SCAM-RMI-Mosaics') {
        return { label: 'SuperCam RMI Quicklook', icon: <SupercamIcon />, order: 6 };
      } else {
        return { label: 'Mastcam-Z Quicklook (ASU)', icon: <ZCAMIcon />, order: 0 };
      }
    } else {
      // Mosaics
      // Determine if this is an "other" arm mosaic with instrument_id and instrument2_id = I[PXZNFB] or C[PXZNFB] or P[ICXZNFB]
      const armMosaicInstrumentIDCombos = {
        I: { P: true, X: true, Z: true, N: true, F: true, B: true },
        C: { P: true, X: true, Z: true, N: true, F: true, B: true },
        P: { I: true, C: true, X: true, Z: true, N: true, F: true, B: true },
      };
      let isArmMosaic = false;
      if (armMosaicInstrumentIDCombos.hasOwnProperty(image.instrument_id)) {
        if (armMosaicInstrumentIDCombos[image.instrument2_id]) isArmMosaic = true;
      }
      if (isArmMosaic) {
        return { label: 'Other Arm Camera', icon: <NavcamIcon />, order: 15 };
      } else if (image.instrument_id === 'Z' || image.instrument_id === 'ZCAM') {
        // ASU produced ZCAM mosaics, could be either producer string because humans are inconsistent
        // and could either be instrument id of 'Z' or 'ZCAM' because
        if (image.producer === 'ASU' || image.producer === 'Arizona State University') {
          return { label: 'Mastcam-Z Strategic Mosaics (ASU)', icon: <ZCAMIcon />, order: 1 };
        } else return { label: 'Cylindrical Mastcam-Z (JPL)', icon: <ZCAMIcon />, order: 2 };
      } else if (image.instrument_id === 'N') {
        // Determine if this is a Navcam finder mosaic
        if (image.ocs_name.indexOf('FINDER') > 0) {
          return { label: 'Navcam Finder', icon: <NavcamIcon />, order: 3 };
        } else if (image.eye_type === 'Colorglyph') {
          return { label: 'Navcam Colorglyph', icon: <NavcamIcon />, order: 5 };
        } else {
          return { label: 'Cylindrical Navcam', icon: <NavcamIcon />, order: 4 };
        }
      } else if (image.instrument_id === 'L' && (image.instrument2_id === 'Z' || image.instrument2_id === 'N')) {
        // SCAM on ZCAM or NCAM
        return { label: 'Supercam RMI on Background', icon: <SupercamIcon />, order: 7 };
      } else if (
        (image.instrument_id === 'I' || image.instrument_id === 'S') &&
        (image.instrument2_id === '_' || !image.instrument2_id)
      ) {
        // Both I and S can be WATSON. Also want to exclude WATSON mosaics with secondary instruments
        if (image.producer === 'MSSS') {
          return { label: 'WATSON Closerlooks (MSSS)', icon: <SHERLOCIcon />, order: 8 };
        }
        return { label: 'WATSON (JPL)', icon: <SHERLOCIcon />, order: 10 };
      } else if (
        (image.instrument_id === 'C' && image.instrument2_id === 'I') ||
        (image.instrument_id === 'I' && image.instrument2_id === 'C')
      ) {
        return { label: 'ACI on WATSON', icon: <SHERLOCIcon />, order: 11 };
      } else if (image.instrument_id === 'C') {
        if (image.producer === 'MSSS') {
          return { label: 'ACI Closerlooks (MSSS)', icon: <SHERLOCIcon />, order: 9 };
        }
        return { label: 'ACI', icon: <SHERLOCIcon />, order: 12 };
      } else if (image.instrument_id === 'V') {
        return { label: 'Helicopter Navcam', icon: <HeliIcon />, order: 13 };
      } else if (image.instrument_id === 'H') {
        return { label: 'Helicopter RTE', icon: <HeliIcon />, order: 14 };
      } else {
        return { label: 'Other', icon: <NavcamIcon />, order: 16 };
      }
    }
  }

  groupImages(images) {
    return Object.keys(images).reduce((imageMap, key) => {
      const image = images[key];
      const { label, icon, order } = this.getImageGroup(image);
      if (!imageMap[label]) imageMap[label] = { images: [], icon, order };
      imageMap[label].images.push(image);
      return imageMap;
    }, {});
  }

  cullFinderMosaics(imageGroups) {
    // Collapse Finder mosaics by site/drive and choose the latest one
    const finderGroup = imageGroups['Navcam Finder'];
    if (finderGroup) {
      // Group finders by site+drive
      const finderMap = {};
      finderGroup.images.forEach((image) => {
        const key = `${image.site}_${image.drive}`;
        if (!finderMap[key]) finderMap[key] = [];
        finderMap[key].push(image);
      });

      // Select only the highest sol among each site+drive
      const newImages = [];
      Object.keys(finderMap).forEach((key) => {
        const finders = finderMap[key];
        let latestFinder;
        finders.forEach((finder) => {
          if (!latestFinder) latestFinder = finder;
          else {
            if (latestFinder.time1 < finder.time1) {
              latestFinder = finder;
            }
          }
        });
        newImages.push(latestFinder);
      });
      finderGroup.images = newImages;
    }

    return imageGroups;
  }

  setActiveMosaicBrowseCategory(instrument) {
    // Reset filter
    this.setState({ filter: '' });

    // Update instrument (can be null) in state
    this.props.setActiveMosaicBrowseCategory(instrument);
  }

  renderCategoryMenu() {
    const categories = Object.keys(this.state.groupedMosaics);
    const sortedCategories = categories.sort((a, b) => {
      const aOrder = this.state.groupedMosaics[a].order;
      const bOrder = this.state.groupedMosaics[b].order;
      return aOrder - bOrder;
    });
    return (
      <>
        <div className={MosaicsTimelineStyles.headerContainer}>
          <div className={MosaicsTimelineStyles.header}>Mosaic Browse</div>
          <div className={MosaicsTimelineStyles.subheader}>Browse through the top mosaics across the mission</div>
        </div>

        <div className={MosaicsTimelineStyles.categoryList}>
          {sortedCategories.map((instrument) => {
            const { images, icon } = this.state.groupedMosaics[instrument];
            return (
              <button
                key={instrument}
                onClick={() => this.setActiveMosaicBrowseCategory(instrument)}
                className={MosaicsTimelineStyles.instrument}
              >
                <div className={MosaicsTimelineStyles.instrumentIcon}>{icon}</div>
                <div className={MosaicsTimelineStyles.instrumentNameContainer}>
                  <div className={MosaicsTimelineStyles.instrumentName}>{instrument}</div>
                  <div className={MosaicsTimelineStyles.instrumentImageCount}>({images.length})</div>
                </div>
                <ChevronRightIcon className={MosaicsTimelineStyles.chevron} />
              </button>
            );
          })}
        </div>
      </>
    );
  }

  connectResizeObserver() {
    this.resizeObserver = new ResizeObserver((entries) => {
      requestAnimationFrame(() => {
        // Note: we manually subtract 64px to account for padding inside the scroll container and the card.
        // We also subtract 2px due to the image border on each side. Finally we subtract 7px which is the width of the scrollbar.
        // The resize observer could of course be placed directly on the image container however this is an element
        // that is dynamically rendered so managing the connection/disconnection of this observer is
        // quite a hassle and difficult to do cleanly so this manual padding subtraction is a simpler option.
        // This also avoid the initial image size flash where we don't yet have a container width but are still
        // rendering the images.
        // TODO this could be improved – it doesn't work as well in Firefox (which we don't support but people use) and
        // also is not completely correct when the content isn't scrolling (shouldn't happen in M20 realistically speaking)
        // Could eventually do some sort of hidden rendering of this mosaics list so a ref can be attached to it without having to disconnect and reconnect?
        const width = entries[0].contentRect.width - 73; // padding, border, scrollbar

        this.setState({ containerWidth: width });
      });
    });

    // Observe our wrapper element for changes in size
    if (this.ref.current) this.resizeObserver.observe(this.ref.current);
  }

  disconnectResizeObserver() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  onSearchResultClicked(event, item) {
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

      // Call item clicked with hasPartialMetadata since we don't have all mosaic metadata
      handleSearchItemClicked(item, true, true);
    }
  }

  renderMosaicPage() {
    const instrument = this.props.activeMosaicBrowseCategory;
    let mosaics = [];
    let minSol = Number.POSITIVE_INFINITY;
    let maxSol = 0;
    if (this.state.groupedMosaics[instrument]) {
      mosaics = this.state.groupedMosaics[instrument].images;
      mosaics.forEach((mosaic) => {
        if (mosaic.time1 < minSol) minSol = mosaic.time1;
        if (mosaic.time1 > maxSol) maxSol = mosaic.time1;
      });
    }

    const inputContainerClasses = classNames({
      [FormsStyles.autosuggestInputContainer]: true,
      [FormsStyles.inputNormal]: true,
      [FormsStyles.iconRight]: true,
    });
    const inputClasses = classNames({
      [FormsStyles.autosuggestInput]: true,
    });

    return (
      <>
        <div className={MosaicsTimelineStyles.instrumentHeader}>
          <div className={MosaicsTimelineStyles.headerContainer}>
            <div className={MosaicsTimelineStyles.instrumentHeaderContainerTop}>
              <div>
                <div className={MosaicsTimelineStyles.header}>{getAlias('instrument_id', instrument)}</div>
                <div className={MosaicsTimelineStyles.subheader}>
                  {this.state.loading || this.state.retrying
                    ? 'Loading'
                    : `${mosaics.length} mosaics from sols ${minSol} – ${maxSol}`}
                </div>
              </div>
              <div className={MosaicsTimelineStyles.buttonContainer}>
                <Tooltip overlay="Refresh" placement="top">
                  <Button
                    aria-label="Refresh"
                    className={MosaicsTimelineStyles.fixedContentButton}
                    variant="icon"
                    disabled={this.state.loading}
                    icon={<RefreshIcon />}
                    onClick={() => this.fetchMosaics()}
                  />
                </Tooltip>
                <ExportResultsButtonContainer results={mosaics} className={MosaicsTimelineStyles.fixedContentButton} />
                <Tooltip overlay="Back to All Mosaics" placement="top">
                  <Button
                    aria-label="Back to All Mosaics"
                    className={MosaicsTimelineStyles.fixedContentButton}
                    variant="icon"
                    disabled={this.state.loading}
                    icon={<CloseIcon />}
                    onClick={() => this.setActiveMosaicBrowseCategory()}
                  />
                </Tooltip>
              </div>
            </div>
            <div className={inputContainerClasses}>
              <input
                value={this.state.filter}
                className={inputClasses}
                type="text"
                placeholder="Filter by text"
                aria-label="Filter by text"
                onChange={this.handleFilterChange}
              />
              {this.state.filter && (
                <Button
                  aria-label="Clear"
                  variant="icon"
                  onClick={() => this.setState({ filter: '' })}
                  icon={<CloseIcon />}
                  className={FormsStyles.autosuggestClearIcon}
                />
              )}
            </div>
          </div>
        </div>
        <div className={MosaicsTimelineStyles.bottomContent}>
          {this.state.loading && (
            <div className={MosaicsTimelineStyles.categoryRefreshContent}>
              <div className={EDRListStyles.initialLoadMoreMessage}>Loading</div>
            </div>
          )}
          {this.renderMosaicList(mosaics)}
        </div>
      </>
    );
  }

  getIdForResultIndex(i) {
    return `mosaic_timeline_item_${i}`;
  }

  getStringOrArrayFieldValue(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      return value.join(', ');
    }
  }

  renderMosaicList(mosaics) {
    return (
      <div className={MosaicsTimelineStyles.mosaicsListContainer}>
        <div className={MosaicsTimelineStyles.mosaicsListPadding}>
          {mosaics.map((mosaic, index) => {
            const isImageCustomProduct = isCustomProduct(mosaic);
            let src = buildTiledImageURL(mosaic, true);

            const imageWidth = parseInt(getDescendantProp(mosaic, config.es_mappings.width.key));
            const imageHeight = parseInt(getDescendantProp(mosaic, config.es_mappings.height.key));

            const width = !isImageCustomProduct ? `${this.state.containerWidth}px` : '';
            const height = !isImageCustomProduct
              ? `${(this.state.containerWidth * imageHeight) / imageWidth || 300}px`
              : '';

            const imageClasses = classNames({
              [MosaicsTimelineStyles.img]: true,
              lazyload: true,
              [MosaicsTimelineStyles.input]: true,
            });

            const imageContainerClasses = classNames({
              [MosaicsTimelineStyles.imageContainer]: true,
              [MosaicsTimelineStyles.imageContainerUnknownSize]: isImageCustomProduct,
            });

            const productClasses = classNames({
              [MosaicsTimelineStyles.product]: true,
              [MosaicsTimelineStyles.activeImage]:
                getPropFromProduct(mosaic, config.es_mappings.id) ===
                getPropFromProduct(this.props.activeSearchProduct, config.es_mappings.id),
            });

            let productTitleItems = [];

            if (typeof mosaic.time1 === 'number') {
              productTitleItems.push(`Sol: ${mosaic.time1}`);
            } else if (Array.isArray(mosaic.time1)) {
              productTitleItems.push(`Sols: ${this.getStringOrArrayFieldValue(mosaic.time1)}`);
            }
            if (typeof mosaic.site === 'number' || typeof mosaic.site === 'string') {
              productTitleItems.push(`Site: ${mosaic.site}`);
            }
            if (typeof mosaic.drive === 'number' || typeof mosaic.drive === 'string') {
              productTitleItems.push(`Drive: ${mosaic.drive}`);
            }
            if (typeof mosaic.flight === 'number' || typeof mosaic.flight === 'string') {
              productTitleItems.push(`Flight: ${mosaic.flight}`);
            }

            // Check for any RTT info to display
            const activityNames = this.getStringOrArrayFieldValue(mosaic.activity_name_rtt);
            const seqIDs = this.getStringOrArrayFieldValue(mosaic.seq_id_rtt);
            const targetNames = this.getStringOrArrayFieldValue(mosaic.target_name_rtt);

            // Use description_field over description if description_field exists and is not AUTOGEN
            let description = mosaic.description;
            if (mosaic.description_field && mosaic.description_field !== 'AUTOGEN') {
              description = mosaic.description_field;
            }

            const openInNewTabButtonClasses = classNames({
              [EDRListStyles.openInNewTabButton]: true,
              [EDRListStyles.openInNewTabButtonImage]: true,
              [MosaicsTimelineStyles.openInNewTabButton]: true,
            });

            const textContentArray = [productTitleItems.join(', ')];
            if (activityNames) textContentArray.push(`activities: ${activityNames}`);
            if (seqIDs) textContentArray.push(`sequences: ${seqIDs}`);
            if (targetNames) textContentArray.push(`targets: ${targetNames}`);
            if (description) textContentArray.push(description);
            const textContent = textContentArray.join(' ').toLowerCase();

            if (textContent.indexOf(this.state.filter.toLowerCase()) < 0) {
              return null;
            }

            return (
              <div key={mosaic.ocs_name} className={EDRListStyles.searchResultContainer}>
                <button
                  id={this.getIdForResultIndex(index)}
                  onClick={(event) => this.onSearchResultClicked(event, mosaic)}
                  className={productClasses}
                >
                  <div style={{ width, height }} className={imageContainerClasses}>
                    <img
                      alt={mosaic.ocs_name}
                      data-sizes="auto"
                      data-src={src} // use normal <img> attributes as props
                      className={imageClasses}
                    />
                  </div>
                  <div className={MosaicsTimelineStyles.productMetadata}>
                    <div className={MosaicsTimelineStyles.productTitle}>{productTitleItems.join(', ')}</div>
                    {activityNames && (
                      <div className={MosaicsTimelineStyles.productRTT}>
                        <span className={MosaicsTimelineStyles.productRTTLabel}>Activities: </span>
                        {activityNames}
                      </div>
                    )}
                    {seqIDs && (
                      <div className={MosaicsTimelineStyles.productRTT}>
                        <span className={MosaicsTimelineStyles.productRTTLabel}>Sequences: </span>
                        {seqIDs}
                      </div>
                    )}
                    {targetNames && (
                      <div className={MosaicsTimelineStyles.productRTT}>
                        <span className={MosaicsTimelineStyles.productRTTLabel}>Targets: </span>
                        {targetNames}
                      </div>
                    )}
                    <div className={MosaicsTimelineStyles.productDescription}>{description}</div>
                  </div>
                </button>
                <Tooltip placement="top" overlay="Open in New Tab">
                  <Button
                    aria-label="Open in New Tab"
                    className={openInNewTabButtonClasses}
                    variant="icon"
                    icon={<ExternalLink />}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const newURL = getURLForProductWithExistingParams(mosaic);
                      openInNewTab(newURL, false);
                    }}
                  />
                </Tooltip>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  render() {
    return (
      <div className={MosaicsTimelineStyles.root} ref={this.ref}>
        {this.state.loading && (!this.state.initialLoadComplete || !this.props.activeMosaicBrowseCategory) && (
          <div className={EDRListStyles.initialLoadMoreMessage}>Loading</div>
        )}
        {!this.state.loading && !this.state.loadingSuccess && (
          <div className={MosaicsTimelineStyles.retryContainer}>
            <div className={EDRListStyles.errorStateMessage}>
              Unable to load mosaics
              <div>
                <Button
                  text="Retry"
                  variant="secondary"
                  onClick={async () => {
                    this.setState({ retrying: true });
                    await this.fetchMosaics();
                    this.setState({ retrying: false });
                  }}
                />
              </div>
            </div>
          </div>
        )}
        {!this.state.loading &&
          this.state.loadingSuccess &&
          !this.props.activeMosaicBrowseCategory &&
          this.renderCategoryMenu()}
        {(this.state.loadingSuccess || this.state.retrying) &&
          this.state.initialLoadComplete &&
          this.props.activeMosaicBrowseCategory &&
          this.renderMosaicPage()}
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    activeSearchProduct: state.activeSearchProduct.searchProduct,
    activeMosaicBrowseCategory: state.search.activeMosaicBrowseCategory,
  };
};

const matchDispatchToProps = (dispatch) => {
  return {
    handleSearchItemClicked(item, showImage, hasPartialMetadata) {
      dispatch(setActiveSearchProduct(item, showImage, hasPartialMetadata));
    },
    setActiveMosaicBrowseCategory(item) {
      dispatch(setActiveMosaicBrowseCategory(item));
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps)(MosaicTimeline);
