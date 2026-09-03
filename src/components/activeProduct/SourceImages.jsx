import classNames from 'classnames';
import config from 'config.js';
import PropTypes from 'prop-types';
import React from 'react';
import { components } from 'react-select';
import Button from 'src/components/common/Button';
import EmptyState from 'src/components/common/EmptyState';
import { CrosshairsLooseIcon, ExternalLink, InfoIcon } from 'src/components/common/Icons';
import ImageResult from 'src/components/common/ImageResult';
import MultiSelect from 'src/components/common/MultiSelect';
import ResultsControls from 'src/components/common/ResultsControls';
import Select from 'src/components/common/Select';
import Tip from 'src/components/common/Tip';
import Toggle from 'src/components/common/Toggle';
import Tooltip from 'src/components/common/Tooltip';
import DataCursorControlContainer from 'src/containers/DataCursorControlContainer';
import typographyStyles from 'src/styles/common/typography.module.css';
import EDRListStyles from 'src/styles/EdrList.module.css';
import FacetSearchStyles from 'src/styles/FacetSearch.module.css';
import ProductDetailsStyles from 'src/styles/ProductDetails.module.css';
import SourceImagesStyles from 'src/styles/SourceImages.module.css';
import {
  getAdditionalCustomLabelPropsForProduct,
  getURLForProductWithExistingParams,
  isMosaic,
  openInNewTab,
  pluralizeByListLength,
} from 'src/utils';
import {
  fetchDataForProduct,
  getAssociatedMosaicsForImage,
  getLatestVersionsForOverlayId,
  getMatchingRdr,
  matchingRdrExists,
} from 'src/utils/dataQuery';
import { getAlias, getPropFromProduct } from 'src/utils/sharedUtils';
import AssociatedMosaics from './AssociatedMosaics';

export class SourceImages extends React.Component {
  constructor(props) {
    super(props);

    this.LOCALSTORAGE_SOURCE_IMAGES_VIEW_OPTION_KEY = 'SourceImages_ViewOption';
    this.LOCALSTORAGE_SOURCE_IMAGES_TITLE_LABEL_OPTION_KEY = 'SourceImages_TitleLabelOption';
    this.associatedMosaicsController1 = null;
    this.associatedMosaicsController2 = null;

    this.state = {
      view: localStorage.getItem(this.LOCALSTORAGE_SOURCE_IMAGES_VIEW_OPTION_KEY) || 'image',
      imageResultTitleKey:
        localStorage.getItem(this.LOCALSTORAGE_SOURCE_IMAGES_TITLE_LABEL_OPTION_KEY) ||
        config.search_config.time_search.default_thumbnail_title_key.value,
      filteredList: [],
      associatedMosaicsForCursor: [],
      loadingIDX: false,
      instrumentsFilter: [],
      loadingAssociatedImagesForSelection: false,
      showAssociatedMosaics: false,
      filterToStereoProducts: false,
      filterToSelection: true,
    };
  }

  componentDidMount() {
    this.handleActiveCursor();
  }

  componentDidUpdate(prevProps) {
    const { cursor, sourceImages, showFootprints, selectedFootprint } = this.props;
    const { cursor: prevCursor, selectedFootprint: prevSelectedFootprint } = prevProps;
    const { showAssociatedMosaics } = this.state;
    // If cursor has been deactivated, clear filtered list
    if (prevProps.cursor.active && !this.props.cursor.active) {
      this.setState({ filteredList: [] });
    }

    if (cursor.active && (cursor.line !== prevCursor.line || cursor.sample !== prevCursor.sample)) {
      this.handleActiveCursor();
    }

    if (showFootprints) {
      if (selectedFootprint) {
        // TODO make this not tied to OCS
        if (selectedFootprint.ocs_name !== (prevSelectedFootprint || {}).ocs_name) {
          const filteredList = sourceImages.filter(
            (product) => getPropFromProduct(product, config.es_mappings.filename) === selectedFootprint.ocs_name
          );
          this.setState({ filteredList });
          if (filteredList.length === 1 && showAssociatedMosaics) {
            this.setState({ loadingAssociatedImagesForSelection: true });
            this.fetchAssociatedMosaics(filteredList[0]);
          }

          // Scroll to element in list
          const elementId = this.getIdForResult(selectedFootprint);
          if (elementId) {
            const nextResultElement = document.getElementById(elementId);
            if (nextResultElement) {
              nextResultElement.focus();
              nextResultElement.scrollIntoViewIfNeeded
                ? nextResultElement.scrollIntoViewIfNeeded()
                : nextResultElement.scrollIntoView(); // fallback for Firefox that doesn't support this
            }
          }
        }
      } else if (prevSelectedFootprint) {
        this.setState({
          filteredList: [],
          associatedMosaicsForCursor: [],
          loadingAssociatedImagesForSelection: false,
        });
      }
    }
  }

  async handleActiveCursor() {
    const { cursor, groups, product, sourceImages, preferredImageForType } = this.props;
    const { showAssociatedMosaics } = this.state;

    if (!cursor.active) return;

    const latestMatchingProducts = getLatestVersionsForOverlayId(
      groups,
      getPropFromProduct(product, config.es_mappings.overlay_id),
      preferredImageForType
    );
    // for single frame non-mosaics we need to have a range product available
    const idxProduct = latestMatchingProducts.find((product) =>
      getPropFromProduct(product, config.es_mappings.product_type)
    );

    if (typeof idxProduct !== 'undefined') {
      this.setState({ loadingIDX: true, loadingAssociatedImagesForSelection: true, associatedMosaicsForCursor: [] });
      fetchDataForProduct(idxProduct, cursor.line, cursor.sample)
        .then(async (data) => {
          const dnValue = parseInt(data['_dn']);
          const source = sourceImages[dnValue - 1];
          if (dnValue && source) {
            this.setState({ filteredList: [source], loadingIDX: false });
            if (showAssociatedMosaics) {
              this.fetchAssociatedMosaics(source);
            } else {
              this.setState({ loadingAssociatedImagesForSelection: false });
            }
          } else if (dnValue) {
            this.setState({
              filteredList: 'failed to fetch source image',
              loadingIDX: false,
              loadingAssociatedImagesForSelection: false,
            });
          } else {
            this.setState({
              filteredList: 'no source image present',
              loadingIDX: false,
              loadingAssociatedImagesForSelection: false,
            });
          }
        })
        .catch((err) => {
          console.log(err);
          this.setState({
            filteredList: 'failed to fetch IDX layer',
            loadingIDX: false,
            loadingAssociatedImagesForSelection: false,
          });
        });
    }
  }

  async fetchAssociatedMosaics(product) {
    // Fetch mosaics associated with image at cursor if we're looking at a mosaic
    if (isMosaic(this.props.product)) {
      try {
        // Manage the two abort controllers needed for the two step search.
        if (this.associatedMosaicsController1) this.associatedMosaicsController1.abort();
        if (this.associatedMosaicsController2) this.associatedMosaicsController2.abort();
        this.associatedMosaicsController1 = new AbortController();
        this.associatedMosaicsController2 = new AbortController();
        const associatedMosaicsForCursor = await getAssociatedMosaicsForImage(
          product,
          this.props.ocsPackages,
          this.associatedMosaicsController1.signal,
          this.associatedMosaicsController2.signal
        );
        let results = [];
        if (associatedMosaicsForCursor.error && associatedMosaicsForCursor.error.name === 'AbortError') {
          return;
        }

        // Detect if user has toggled off associated mosaic display
        if (!this.state.showAssociatedMosaics) return;

        // Detect if the request is stale
        if (this.state.filteredList.length === 1) {
          if (
            getPropFromProduct(this.state.filteredList[0], config.es_mappings.filename) !==
            getPropFromProduct(product, config.es_mappings.filename)
          ) {
            return;
          }
        } else return;

        results = associatedMosaicsForCursor.results;
        this.setState({
          associatedMosaicsForCursor: results,
          loadingAssociatedImagesForSelection: false,
        });
      } catch (err) {
        this.setState({ associatedMosaicsForCursor: [], loadingAssociatedImagesForSelection: false });
      }
    }
  }

  openSourceProduct(product) {
    const url = getURLForProductWithExistingParams(product, {});
    openInNewTab(url, false);
  }

  highlightFootprint(item) {
    this.props.highlightFootprint(item);
  }

  unhighlightFootprint(item) {
    this.props.unhighlightFootprint(item);
  }

  zoomToFootprint(item) {
    this.props.zoomToFootprint(item);
  }

  renderFilenameResult(item) {
    const bboxAvailable = this.props.sourceImageFootprints.length > 0;
    const resultClass = classNames({
      [EDRListStyles.filenameResult]: true,
      [SourceImagesStyles.filenameResultError]: item._error,
    });

    const filenameTextClass = classNames({
      [EDRListStyles.filenameText]: true,
      [SourceImagesStyles.filenameText]: true,
      [SourceImagesStyles.filenameTextError]: item._error,
      [SourceImagesStyles.filenameTextNoZoomTo]: !bboxAvailable,
    });

    return (
      <div
        className={resultClass}
        onMouseEnter={() => this.highlightFootprint(item)}
        onMouseLeave={() => this.unhighlightFootprint(item)}
      >
        <ImageResult
          interactable={false}
          fadeIn
          autoConstrain
          product={item}
          className={EDRListStyles.filenameImage}
          showMetadata={false}
          showAlt={false}
          indexLabel={`#${item._activeImageIndex + 1}`}
        />
        <div className={filenameTextClass}>
          {getPropFromProduct(item, config.es_mappings.filename)}
          {item._error && <div className={SourceImagesStyles.productNotFoundBadge}>Product not found</div>}
        </div>
      </div>
    );
  }

  renderImageResult(item) {
    if (item._error) {
      item.instrument_id = item.ocs_name;
    }

    const additionalProps = getAdditionalCustomLabelPropsForProduct(item, this.state.imageResultTitleKey);

    return (
      <div
        className={SourceImagesStyles.imageResultContainer}
        onMouseEnter={() => this.highlightFootprint(item)}
        onMouseLeave={() => this.unhighlightFootprint(item)}
      >
        {item._error && <div className={SourceImagesStyles.productNotFoundBadge}>Product not found</div>}
        <ImageResult
          interactable={!item._error}
          titleSelectable={item._error}
          fadeIn
          autoConstrain={false}
          product={item}
          className={EDRListStyles.imageResult}
          showMetadata
          showAlt
          active={
            this.props.selectedFootprint
              ? getPropFromProduct(this.props.selectedFootprint, config.es_mappings.filename) ===
                getPropFromProduct(item, config.es_mappings.filename)
              : false
          }
          indexLabel={`#${item._activeImageIndex + 1}`}
          {...additionalProps}
        />
      </div>
    );
  }

  isIDXActive() {
    const { overlays: activeOverlays } = this.props;
    return (
      typeof activeOverlays.find(
        (overlay) => getPropFromProduct(overlay, config.es_mappings.product_type) === 'IDX'
      ) !== 'undefined'
    );
  }

  toggleIDXOverlay = () => {
    const { product, groups, addOverlay, removeOverlay, preferredImageForType } = this.props;
    const idxActive = this.isIDXActive();

    const idxLayer = getMatchingRdr(product, groups, 'IDX', preferredImageForType);

    if (!idxActive) {
      addOverlay(idxLayer, 0.5);
    } else {
      removeOverlay(idxLayer);
    }
  };

  toggleShowAssociatedMosaics = () => {
    const show = !this.state.showAssociatedMosaics;
    this.setState({ showAssociatedMosaics: show });
    if (!show) {
      this.setState({ associatedMosaicsForCursor: [], loadingAssociatedImagesForSelection: false });
    } else {
      if (this.state.filteredList.length === 1) {
        this.setState({ loadingAssociatedImagesForSelection: true });
        this.fetchAssociatedMosaics(this.state.filteredList[0]);
      }
    }
  };

  setSourceImageFilterFn = () => {
    const { instrumentsFilter, filterToStereoProducts } = this.state;
    const filterFn = (footprint) => {
      let matchesInstrumentsFilter = false;
      if (instrumentsFilter.length === 0) matchesInstrumentsFilter = true;
      else if (instrumentsFilter.find((x) => x.value === footprint.instrument_id)) {
        matchesInstrumentsFilter = true;
      }

      let matchesStereoFilter = filterToStereoProducts
        ? getPropFromProduct(footprint, config.es_mappings.frame_type) === 'STEREO'
        : true;
      return matchesInstrumentsFilter && matchesStereoFilter;
    };
    this.props.setSourceImageFootprintsFilter(filterFn);
  };

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

  CustomMultiValueLabel = (props) => {
    const { data } = props;
    return <div className={FacetSearchStyles.selectValueLabel}>{this.getMultiSelectResultLabel(data.value)}</div>;
  };

  CustomOption = (props) => {
    const { data, children, ...rest } = props;
    return (
      <components.Option {...rest}>
        {this.getMultiSelectResultLabel(data.value)}
        <span className={FacetSearchStyles.selectOptionCount}>{data.label}</span>
      </components.Option>
    );
  };

  getMultiSelectResultLabel(value) {
    return getAlias('instrument_id', value);
  }

  getIdForResult(item) {
    return `${getPropFromProduct(item, config.es_mappings.filename)}_source_image`;
  }

  renderBboxToggle() {
    const productHasFootprints = this.props.sourceImageFootprints.length > 0;

    const toggle = (
      <Toggle
        on={this.props.showFootprints && productHasFootprints}
        disabled={!productHasFootprints}
        onChange={() => {
          if (this.props.showFootprints) this.props.hideSourceImageFootprints();
          else this.props.showSourceImageFootprints();
        }}
      />
    );

    if (productHasFootprints) return toggle;
    else {
      return (
        <Tooltip placement="top" overlay="Missing bounding boxes">
          <span>{toggle}</span>
        </Tooltip>
      );
    }
  }

  renderIDXToggle() {
    const idxProductExists = matchingRdrExists(this.props.product, this.props.groups, 'IDX');
    const idxActive = this.isIDXActive();
    const toggle = <Toggle on={idxActive} onChange={this.toggleIDXOverlay} disabled={!idxProductExists} />;

    if (idxProductExists) return toggle;
    else {
      return (
        <Tooltip placement="top" overlay="Missing IDX Overlay">
          <span>{toggle}</span>
        </Tooltip>
      );
    }
  }

  render() {
    const {
      product,
      loading,
      sourceImages,
      cursor,
      openHelpArticle,
      showFootprints,
      setActiveSearchProduct,
      sourceImageFootprintsFilter,
      selectedFootprint,
    } = this.props;
    const {
      view,
      filteredList,
      loadingIDX,
      filterToStereoProducts,
      instrumentsFilter,
      loadingAssociatedImagesForSelection,
      associatedMosaicsForCursor,
      showAssociatedMosaics,
      filterToSelection,
      imageResultTitleKey,
    } = this.state;

    if (loading) return <div className={ProductDetailsStyles.emptyStateMessageFullHeight}>Loading</div>;

    const hasLabel = !!product[config.label_key];

    if (!hasLabel || sourceImages.length === 0) {
      return <EmptyState text="No source images found for this image" icon={<InfoIcon />} />;
    }

    let finalList = sourceImages;
    if (!Array.isArray(filteredList)) {
      finalList = filteredList;
    } else {
      if (filterToSelection && filteredList.length === 1) {
        finalList = filteredList;
      }
      finalList = finalList.filter(sourceImageFootprintsFilter);
    }

    const bboxAvailable = this.props.sourceImageFootprints.length > 0;

    const listClass = classNames({
      [EDRListStyles.filenameResults]: view === 'filename',
      [EDRListStyles.imageResults]: view === 'image',
      [SourceImagesStyles.imageResults]: view === 'image',
    });

    const openInNewTabButtonClasses = classNames({
      [EDRListStyles.openInNewTabButton]: true,
      [EDRListStyles.openInNewTabButtonImage]: view === 'image',
      [EDRListStyles.openInNewTabButtonFilename]: view === 'filename',
    });

    const zoomToImageButtonClasses = classNames({
      [EDRListStyles.openInNewTabButton]: true,
      [EDRListStyles.openInNewTabButtonImage]: view === 'image',
      [EDRListStyles.openInNewTabButtonFilename]: view === 'filename',
      [SourceImagesStyles.zoomToImageButtonFilename]: view === 'filename',
      [SourceImagesStyles.zoomToImageButtonImage]: view === 'image',
    });

    let filterCount = 0;
    const idxProductExists = matchingRdrExists(this.props.product, this.props.groups, 'IDX');
    if (instrumentsFilter.length !== 0) filterCount += 1;
    if (filterToStereoProducts) filterCount += 1;
    if (cursor.active && idxProductExists) filterCount += 1;

    const sourceImageInstrumentsCount = {};
    sourceImages.forEach((product) => {
      const instrument = getPropFromProduct(product, config.es_mappings.instrument_id);
      if (!sourceImageInstrumentsCount[instrument]) {
        sourceImageInstrumentsCount[instrument] = 0;
      }
      sourceImageInstrumentsCount[instrument]++;
    });

    const sourceImageInstrumentSelectionFilterOptions = Object.keys(sourceImageInstrumentsCount).map((key) => {
      return { value: key, label: sourceImageInstrumentsCount[key] };
    });
    const noDataCursorPlaced = !loadingIDX && typeof finalList !== 'string' && finalList.length < 1;

    const imageTitleOptions = config.search_config.time_search.thumbnail_title_label_options;
    const defaultImageTitleValue = imageTitleOptions.find((o) => o.value === imageResultTitleKey);

    let resultStatsLabel = '';
    if (!loadingIDX) {
      // If we have a selection or active cursor see if we have any results
      if (selectedFootprint || cursor.active) {
        if (Array.isArray(finalList) && finalList.length === 1) {
          resultStatsLabel = '1 result';
        } else {
          resultStatsLabel = '0 results';
        }
      } else if (filterCount > 0) {
        // If any filters are active show appropriate label
        resultStatsLabel = `${finalList.length} of ${sourceImages.length} ${pluralizeByListLength(
          'result',
          sourceImages
        )}`;
      } else if (Array.isArray(finalList)) {
        resultStatsLabel = `${finalList.length} ${pluralizeByListLength('result', finalList)}`;
      }
    }

    return (
      <div className={SourceImagesStyles.root}>
        <Tip className={SourceImagesStyles.tip}>
          All images used to construct the current image. Select a source image using bounding boxes or the data cursor.
          <button
            type="button"
            onClick={() => openHelpArticle('search_for_images/source_images')}
            className={typographyStyles.learnMore}
          >
            &nbsp;Learn More
          </button>
        </Tip>
        <div className={SourceImagesStyles.inlineButtonWrapper}>
          <div className={SourceImagesStyles.toggleContainer}>
            <div className={typographyStyles.label}>Show Bounding Boxes</div>
            {this.renderBboxToggle()}
          </div>
        </div>
        <ResultsControls
          viewControls={[
            <MultiSelect
              label="Result Display"
              key="view_sources_display"
              selectedValue={view}
              options={[
                { label: 'Filename', value: 'filename' },
                { label: 'Image', value: 'image' },
              ]}
              onChange={(value) => {
                this.setState({ view: value });
                localStorage.setItem(this.LOCALSTORAGE_SOURCE_IMAGES_VIEW_OPTION_KEY, value);
              }}
            />,
            <Select
              key="view_result_title_label"
              label="Image Result Title Label"
              labelPosition="top"
              labelWidth={160}
              defaultValue={defaultImageTitleValue}
              searchable={false}
              options={imageTitleOptions}
              onChange={(selectedOption) => {
                this.setState({ imageResultTitleKey: selectedOption.value });
                localStorage.setItem(this.LOCALSTORAGE_SOURCE_IMAGES_TITLE_LABEL_OPTION_KEY, selectedOption.value);
              }}
            />,
            <div className={SourceImagesStyles.toggleContainer} key="view_show_idx">
              <div className={typographyStyles.label}>Show IDX Overlay</div>
              {this.renderIDXToggle()}
            </div>,
            <div className={SourceImagesStyles.toggleContainer} key="view_show_associated_mosaics">
              <div className={typographyStyles.label}>Show Mosaics Associated with Selection</div>
              <Toggle on={showAssociatedMosaics} onChange={this.toggleShowAssociatedMosaics} />
            </div>,
          ]}
          filterControls={[
            <div className={SourceImagesStyles.toggleContainer} key="filter_to_selection">
              <div className={typographyStyles.label}>Filter to Selection</div>
              <Toggle
                on={filterToSelection}
                onChange={() => {
                  this.setState({ filterToSelection: !this.state.filterToSelection });
                }}
              />
            </div>,
            <div className={SourceImagesStyles.toggleContainer} key="filter_to_stereo_products">
              <div className={typographyStyles.label}>Filter to Stereo Products</div>
              <Toggle
                on={filterToStereoProducts}
                onChange={() => {
                  this.setState({ filterToStereoProducts: !this.state.filterToStereoProducts }, () => {
                    this.setSourceImageFilterFn();
                  });
                }}
              />
            </div>,
            <Select
              key="filter_by_instrument"
              value={instrumentsFilter}
              options={sourceImageInstrumentSelectionFilterOptions}
              placeholder="Select..."
              label="Instruments"
              multi
              components={{ MultiValueLabel: this.CustomMultiValueLabel, Option: this.CustomOption }}
              onChange={(selectedOptions) => {
                this.setState({ instrumentsFilter: selectedOptions || [] }, () => {
                  this.setSourceImageFilterFn();
                });
              }}
            />,
            <DataCursorControlContainer cursor={cursor} key="filter_by_data_cursor" />,
          ]}
          viewLabel="Image View Options"
          filterLabel="Image Filters"
          resultStatsLabel={resultStatsLabel}
          filterCount={filterCount}
          loading={loading}
          results={Array.isArray(finalList) ? finalList : []}
        />
        {loadingIDX && <div className={ProductDetailsStyles.emptyStateMessage}>Loading</div>}
        {!loadingIDX && typeof finalList === 'string' && (
          <div className={ProductDetailsStyles.emptyStateMessage}>{finalList}</div>
        )}
        {noDataCursorPlaced && showFootprints && (
          <div className={ProductDetailsStyles.emptyStateMessage}>Select a source image bounding box</div>
        )}
        {noDataCursorPlaced && !showFootprints && (
          <div className={ProductDetailsStyles.emptyStateMessage}>No data cursor placed</div>
        )}
        {!loadingIDX && typeof finalList !== 'string' && finalList.length > 0 && (
          <div className={listClass}>
            {finalList.map((item) => {
              const buttonClass = classNames({
                [EDRListStyles.searchResult]: true,
                [SourceImagesStyles.sourceImageResult]: true,
                [SourceImagesStyles.activeImage]: selectedFootprint
                  ? getPropFromProduct(selectedFootprint, config.es_mappings.filename) ===
                    getPropFromProduct(item, config.es_mappings.filename)
                  : false,
              });

              return (
                <div
                  key={`${getPropFromProduct(item, config.es_mappings.id)}_source_image_${view}`}
                  className={EDRListStyles.searchResultContainer}
                >
                  <button
                    type="button"
                    id={this.getIdForResult(item)}
                    className={buttonClass}
                    onClick={(evt) => {
                      if (!item._error) this.onResultClicked(evt, item);
                    }}
                  >
                    {view === 'image' ? this.renderImageResult(item) : this.renderFilenameResult(item)}
                  </button>
                  {!item._error && (
                    <a target="_blank" rel="noreferrer" href={getURLForProductWithExistingParams(item)}>
                      <Tooltip placement="top" overlay="Open in New Tab">
                        <Button
                          aria-label="Open in New Tab"
                          className={openInNewTabButtonClasses}
                          variant="icon"
                          icon={<ExternalLink />}
                        />
                      </Tooltip>
                    </a>
                  )}
                  {bboxAvailable && (
                    <Tooltip overlay="Zoom to Image" placement="top">
                      <Button
                        aria-label="Zoom to Image"
                        className={zoomToImageButtonClasses}
                        variant="icon"
                        onClick={(evt) => {
                          evt.stopPropagation();
                          this.zoomToFootprint(item);
                        }}
                        icon={<CrosshairsLooseIcon />}
                      />
                    </Tooltip>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {Array.isArray(filteredList) && finalList.length === 1 && (selectedFootprint || cursor.active) && (
          <Button
            className={SourceImagesStyles.clearSelectionButton}
            variant="text"
            onClick={() => {
              this.props.clearSelectedFootprint();
              this.props.removeDataCursor();
            }}
            text="Clear Selection"
          />
        )}
        {showAssociatedMosaics &&
          Array.isArray(filteredList) &&
          filteredList.length === 1 &&
          ((!loadingIDX && !noDataCursorPlaced) || showFootprints) &&
          isMosaic(product) && (
            <div className={SourceImagesStyles.associatedMosaicsForCursorContainer}>
              <div className={SourceImagesStyles.associatedMosaicsForCursorLabel}>
                Mosaics Including Image at Cursor Position
              </div>
              <AssociatedMosaics
                associatedMosaics={associatedMosaicsForCursor}
                setActiveSearchProduct={setActiveSearchProduct}
                openHelpArticle={openHelpArticle}
                loading={loadingAssociatedImagesForSelection}
                product={product}
              />
            </div>
          )}
      </div>
    );
  }
}

SourceImages.defaultProps = {
  loading: true,
  product: null,
  sourceImages: [],
  sourceImageFootprints: [],
  selectedFootprint: null,
};

SourceImages.propTypes = {
  loading: PropTypes.bool,
  product: PropTypes.object,
  sourceImages: PropTypes.array,
  sourceImageFootprintsFilter: PropTypes.func,
  preferredImageForType: PropTypes.object.isRequired,
  selectedFootprint: PropTypes.object,
  showSourceImageFootprints: PropTypes.func.isRequired,
  highlightFootprint: PropTypes.func.isRequired,
  unhighlightFootprint: PropTypes.func.isRequired,
  clearSelectedFootprint: PropTypes.func.isRequired,
  removeDataCursor: PropTypes.func.isRequired,
};

export default SourceImages;
