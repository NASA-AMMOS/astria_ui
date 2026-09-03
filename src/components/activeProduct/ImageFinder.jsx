import classNames from 'classnames';
import { Field, Form, Formik } from 'formik';
import PropTypes from 'prop-types';
import React from 'react';
import Button from 'src/components/common/Button';
import EmptyState from 'src/components/common/EmptyState';
import { ExternalLink, ExternalLinkOutlined, InfoIcon } from 'src/components/common/Icons';
import ImageResult from 'src/components/common/ImageResult';
import MultiSelect from 'src/components/common/MultiSelect';
import ResultsControls from 'src/components/common/ResultsControls';
import Select from 'src/components/common/Select';
import Tip from 'src/components/common/Tip';
import Toggle from 'src/components/common/Toggle';
import Tooltip from 'src/components/common/Tooltip';
import DataCursorControlContainer from 'src/containers/DataCursorControlContainer';
import TypographyStyles from 'src/styles/common/typography.module.css';
import EDRListStyles from 'src/styles/EdrList.module.css';
import FormsStyles from 'src/styles/Forms.module.css';
import ImageFinderStyles from 'src/styles/ImageFinder.module.css';
import ProductDetailsStyles from 'src/styles/ProductDetails.module.css';
import {
  getAdditionalCustomLabelPropsForProduct,
  getURLForProductWithExistingParams,
  objAlphaSort,
  openInNewTab,
  pluralizeByListLength,
  round,
} from 'src/utils';
import { getFootprintImagesForLineSample, getMatchingRdr, matchingRdrExistsPriority } from 'src/utils/dataQuery';
import { CAMPGetLinkForLatLon } from 'src/utils/endpoints';
import { getPropFromProduct } from 'src/utils/sharedUtils';

import config from 'config.js';
const ALL_INST_OP = { label: 'All', value: '__ALL__' };

const RESULTS_PER_PAGE = 15;

export class ImageFinder extends React.Component {
  constructor(props) {
    super(props);

    this.LOCALSTORAGE_VIEW_OPTIONS_KEY = 'ImageFinder_ViewOption';
    this.LOCALSTORAGE_TITLE_LABEL_OPTION_KEY = 'ImageFinder_TitleLabelOption';

    this.searchRadiusNodeRef = React.createRef();
    this.rangeFilterNodeRef = React.createRef();

    this.state = {
      view: localStorage.getItem(this.LOCALSTORAGE_VIEW_OPTIONS_KEY) || 'image',
      imageResultTitleKey:
        localStorage.getItem(this.LOCALSTORAGE_TITLE_LABEL_OPTION_KEY) ||
        config.search_config.time_search.default_thumbnail_title_key.value,
      relatedImages: [],
      resolvedLatLon: {},
      resolvedXYZ: {},
      loading: false,
      noxyz: false,
      rangeFilter: '',
      searchRadius: '',
      instrumentFilter: ALL_INST_OP,
      resultPage: 1,
    };
  }

  componentDidMount() {
    const { cursor } = this.props;

    if (cursor.active) {
      this.searchForRelatedImages();
    }
  }

  componentDidUpdate(prevProps, prevState) {
    const { cursor: propCursor, onResultsChange, fetchingGroups: propFetchingGroups } = this.props;
    const { cursor: prevCursor, fetchingGroups: prevFetchingGroups } = prevProps;

    const prevCursorDiff = propCursor.line !== prevCursor.line || propCursor.sample !== prevCursor.sample;
    const fetchingGroupsDiff = !propFetchingGroups && propFetchingGroups !== prevFetchingGroups;
    if (propCursor.active && (prevCursorDiff || fetchingGroupsDiff)) {
      this.searchForRelatedImages();
    } else if (!propCursor.active && prevCursor.active) {
      // cursor has been turned off so clear the image list
      this.setState({ relatedImages: [], loading: false, noxyz: false, page: 1 });
      onResultsChange(0);
    }
  }

  searchForRelatedImages = async () => {
    const { cursor, groups, product, ocsPackages, onResultsChange, preferredImageForType } = this.props;
    const { searchRadius } = this.state;

    // convert radius from m to cm and limit to 500
    const restrictedRadius = Math.min(parseFloat(searchRadius || 0) / 100, 500);
    try {
      this.setState({ loading: true, noxyz: false, page: 1 });
      const relatedImagesData = await getFootprintImagesForLineSample(
        product,
        groups,
        cursor,
        restrictedRadius,
        ocsPackages,
        preferredImageForType
      );
      const relatedImages = relatedImagesData.images
        .filter((x) => x.backprojectPixelLoc) // filter out the images that failed backprojection
        .sort((a, b) => a.backprojectPixelLoc.range - b.backprojectPixelLoc.range)
        .concat(relatedImagesData.images.filter((x) => !x.backprojectPixelLoc)); // append the ones without a distance to the end
      const latLon = relatedImagesData.latLon.latLon;
      const xyz = relatedImagesData.xyz;
      this.setState({ relatedImages, resolvedLatLon: latLon, resolvedXYZ: xyz, loading: false });
      onResultsChange(relatedImages.length);
    } catch (err) {
      this.setState({
        relatedImages: [],
        resolvedLatLon: {},
        resolvedXYZ: {},
        loading: false,
        noxyz: err.message === 'No XYZ data found',
      });
      onResultsChange(0);
    }
  };

  openCAMPLink = () => {
    const { product } = this.props;
    const { resolvedLatLon } = this.state;
    openInNewTab(
      CAMPGetLinkForLatLon({
        latLon: resolvedLatLon,
        text: `point in ${getPropFromProduct(product, config.es_mappings.filename, null)}`,
      })
    );
  };

  toggleXYZOverlay = () => {
    const { product, groups, addOverlay, removeOverlay, preferredImageForType } = this.props;
    const preferredType = this.getPreferredXYZType();
    const xyzActive = this.isXYZActive(preferredType);

    const xyzLayer = getMatchingRdr(product, groups, preferredType, preferredImageForType);

    if (!xyzActive) {
      addOverlay(xyzLayer, 0.5);
    } else {
      removeOverlay(xyzLayer);
    }
  };

  renderFilenameResult(item) {
    const resultClass = classNames({
      [EDRListStyles.filenameResult]: true,
      [ImageFinderStyles.filenameResultError]: item._error,
    });

    const filenameTextClass = classNames({
      [EDRListStyles.filenameText]: true,
      [ImageFinderStyles.filenameText]: true,
      [ImageFinderStyles.filenameTextError]: item._error,
    });

    const dist = item.backprojectPixelLoc ? `~${round(item.backprojectPixelLoc.range, 0)}m` : 'UNK';

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
          indexLabel={dist}
        />
        <div className={filenameTextClass}>
          {getPropFromProduct(item, config.es_mappings.filename)}
          {item._error && <div className={ImageFinderStyles.productNotFoundBadge}>Product not found</div>}
        </div>
      </div>
    );
  }

  renderImageResult(item) {
    if (item._error) {
      item.instrument_id = item.ocs_name;
    }

    const otherProps = getAdditionalCustomLabelPropsForProduct(item, this.state.imageResultTitleKey);
    const pixelLoc = item.backprojectPixelLoc;
    let dist = 'UKN dist';
    if (pixelLoc) {
      if (!pixelLoc.approximate) {
        otherProps.cursor = {
          sample: pixelLoc.pixel.x,
          line: pixelLoc.pixel.y,
        };
      }
      dist = `~${round(pixelLoc.range, 0)}m away`;
    }
    return (
      <div className={ImageFinderStyles.imageResultContainer}>
        {item._error && <div className={ImageFinderStyles.productNotFoundBadge}>Product not found</div>}
        <ImageResult
          interactable={!item._error}
          titleSelectable={item._error}
          fadeIn
          autoConstrain={false}
          product={item}
          className={EDRListStyles.imageResult}
          showMetadata
          showAlt
          indexLabel={dist}
          {...otherProps}
        />
      </div>
    );
  }

  getPreferredXYZType() {
    const { product, groups } = this.props;
    return matchingRdrExistsPriority(product, groups, ['XYR', 'XYZ', 'XOZ']);
  }

  isXYZActive(preferredType) {
    const { overlays: activeOverlays } = this.props;
    preferredType = preferredType || this.getPreferredXYZType();
    return (
      typeof activeOverlays.find(
        (overlay) => getPropFromProduct(overlay, config.es_mappings.product_type) === preferredType
      ) !== 'undefined'
    );
  }

  showMore = () => {
    const { page } = this.state;
    this.setState({ page: page + 1 });
  };

  getBackprojectedPixelLocationForImage(image) {
    const pixelLoc = image.backprojectPixelLoc;
    if (pixelLoc && !pixelLoc.approximate) {
      const projectedSample = pixelLoc.pixel.x;
      const projectedLine = pixelLoc.pixel.y;
      if (
        projectedLine >= 0 &&
        projectedLine <= getPropFromProduct(image, config.es_mappings.height) &&
        projectedSample >= 0 &&
        projectedSample <= getPropFromProduct(image, config.es_mappings.width)
      ) {
        return { projectedLine, projectedSample };
      }
    } else {
      console.warn('Failed to backproject into image');
      return;
    }
  }

  onResultClicked(event, item) {
    const { setActiveSearchProduct, addDataCursor, osdWrapper } = this.props;

    const optParams = {};
    let dataCursor = null;
    const location = this.getBackprojectedPixelLocationForImage(item);
    if (location) {
      optParams[config.url_keys.dataCursor] = `${location.projectedLine}_${location.projectedSample}`;
      dataCursor = { active: true, product: item, line: location.projectedLine, sample: location.projectedSample };
    }

    const pixelLoc = item.backprojectPixelLoc;
    if (pixelLoc && !pixelLoc.approximate) {
      const projectedSample = pixelLoc.pixel.x;
      const projectedLine = pixelLoc.pixel.y;
      if (
        projectedLine >= 0 &&
        projectedLine <= getPropFromProduct(item, config.es_mappings.height) &&
        projectedSample >= 0 &&
        projectedSample <= getPropFromProduct(item, config.es_mappings.width)
      ) {
        optParams[config.url_keys.dataCursor] = `${projectedLine}_${projectedSample}`;
        dataCursor = { active: true, product: item, line: projectedLine, sample: projectedSample };
      }
    } else {
      console.warn('Failed to backproject into image');
    }

    // If we detect ctrl, command or shift, let the link handle the event since
    // this should be opening in a new tab/window
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      const newURL = getURLForProductWithExistingParams(item, optParams);
      const link = document.createElement('a');
      link.href = newURL;
      const newEvent = new MouseEvent('click', { ...event }); // clone click event
      link.dispatchEvent(newEvent); // trigger click event on our link element
    } else {
      // Otherwise we'll open the image here
      event.preventDefault();

      // Set DN cursor if we have one
      if (dataCursor) {
        const callback = () => {
          osdWrapper.off('layeradded', callback);
          addDataCursor(item, dataCursor.sample, dataCursor.line);
          // setDataCursor(dataCursor);
        };
        osdWrapper.on('layeradded', callback);
      }

      // Call item clicked with hasPartialMetadata since we don't have all mosaic metadata
      setActiveSearchProduct(item, true, true);
    }
  }

  render() {
    const { cursor: propCursor, openHelpArticle, loading: propLoading } = this.props;
    const {
      view,
      imageResultTitleKey,
      loading,
      relatedImages,
      resolvedLatLon,
      noxyz,
      rangeFilter,
      searchRadius,
      instrumentFilter,
      page,
    } = this.state;

    if (propLoading) {
      return <div className={ProductDetailsStyles.emptyStateMessageFullHeight}>Loading overlays</div>;
    }

    const preferredType = this.getPreferredXYZType();
    if (!preferredType) {
      return <EmptyState text="No XYZ type overlay available" icon={<InfoIcon />} />;
    }

    const listClass = classNames({
      [EDRListStyles.filenameResults]: view === 'filename',
      [EDRListStyles.imageResults]: view === 'image',
      [ImageFinderStyles.imageResults]: view === 'image',
    });

    const buttonClass = classNames({
      [EDRListStyles.searchResult]: true,
      [ImageFinderStyles.sourceImageResult]: true,
    });

    const openInNewTabButtonClasses = classNames({
      [EDRListStyles.openInNewTabButton]: true,
      [EDRListStyles.openInNewTabButtonImage]: view === 'image',
      [EDRListStyles.openInNewTabButtonFilename]: view === 'filename',
    });

    const showResults = !loading && propCursor.active && relatedImages.length > 0;
    const showLatLon =
      propCursor.active &&
      !loading &&
      typeof resolvedLatLon.longitude === 'number' &&
      typeof resolvedLatLon.latitude === 'number';

    const xyzActive = this.isXYZActive(preferredType);

    const instrumentIds = relatedImages.reduce((acc, el) => {
      return acc.add(getPropFromProduct(el, config.es_mappings.instrument_id));
    }, new Set());
    const instrumentOptions = objAlphaSort(
      Array.from(instrumentIds).map((id) => {
        return {
          label: config.es_value_aliases.instrument_id[id],
          value: id,
        };
      }),
      'label'
    );
    instrumentOptions.unshift(ALL_INST_OP);

    // apply filters
    const filteredImages = relatedImages.filter((img) => {
      const instMatch =
        instrumentFilter.value === '__ALL__' ||
        getPropFromProduct(img, config.es_mappings.instrument_id) === instrumentFilter.value;
      const rangeMatch =
        rangeFilter === '' ||
        parseInt(rangeFilter) === 0 ||
        (img.backprojectPixelLoc && parseInt(img.backprojectPixelLoc.range) <= parseInt(rangeFilter));

      return instMatch && rangeMatch;
    });

    const pagedImages = filteredImages.slice(0, page * RESULTS_PER_PAGE);
    const moreImages = filteredImages.length > pagedImages.length;

    let filterCount = 0;
    if (rangeFilter !== '' && parseInt(rangeFilter) > 0) {
      filterCount += 1;
    }
    if (instrumentFilter.value !== '__ALL__') {
      filterCount += 1;
    }

    let message = null;
    if (loading) {
      message = <div className={ProductDetailsStyles.emptyStateMessageFullHeight}>Loading</div>;
    } else if (!propCursor.active) {
      message = <div className={ProductDetailsStyles.emptyStateMessageFullHeight}>No data cursor placed</div>;
    } else if (noxyz) {
      message = (
        <div className={ProductDetailsStyles.emptyStateMessageFullHeight}>No {preferredType} data at this location</div>
      );
    } else if (relatedImages.length === 0) {
      message = <div className={ProductDetailsStyles.emptyStateMessageFullHeight}>No images found</div>;
    } else if (filteredImages.length === 0) {
      message = <div className={ProductDetailsStyles.emptyStateMessageFullHeight}>No images match filters</div>;
    }

    const imageTitleOptions = config.search_config.time_search.thumbnail_title_label_options;
    const defaultImageTitleValue = imageTitleOptions.find((o) => o.value === imageResultTitleKey);

    return (
      <div className={ImageFinderStyles.root}>
        <Tip className={ImageFinderStyles.tip}>
          Place an Image Data Explorer cursor using control-click to search for related images at a pixel. XYZ type
          overlay required.&nbsp;
          <button
            type="button"
            onClick={() => openHelpArticle('search_for_images/scilo_image_finder')}
            className={TypographyStyles.learnMore}
          >
            Learn More
          </button>
        </Tip>
        <div className={ImageFinderStyles.controls}>
          <div className={ImageFinderStyles.toggle}>
            <div className={TypographyStyles.label}>Show {preferredType} Overlay</div>
            <Toggle on={xyzActive} onChange={this.toggleXYZOverlay} />
          </div>
          <div className={ImageFinderStyles.controlRow}>
            <Formik
              enableReinitialize
              initialValues={{ searchRadius }}
              onSubmit={(values, { setSubmitting }) => {
                this.searchForRelatedImages();
                setSubmitting(false);
              }}
            >
              {() => (
                <Form noValidate autoComplete="off" className={ImageFinderStyles.radiusWrapper}>
                  <Field name="searchRadius">
                    {({ field }) => {
                      const { value, onChange, ...otherFieldProps } = field;
                      return (
                        <>
                          <label htmlFor="radius" className={FormsStyles.label}>
                            Radius (cm)
                          </label>
                          <input
                            id="radius"
                            ref={this.searchRadiusNodeRef}
                            className={FormsStyles.textInput}
                            placeholder="0-500cm"
                            type="number"
                            min={0}
                            max={500}
                            value={value}
                            onChange={(evt) => {
                              this.setState({ searchRadius: evt.target.value });
                              onChange(evt);
                            }}
                            {...otherFieldProps}
                          />
                        </>
                      );
                    }}
                  </Field>
                </Form>
              )}
            </Formik>
            <div className={ImageFinderStyles.inputWrapper}>
              <DataCursorControlContainer cursor={propCursor} noChangeSearch={this.searchForRelatedImages} />
            </div>
          </div>
          <div className={ImageFinderStyles.latLonWrapper}>
            <span className={ImageFinderStyles.latLonLabel}>
              Lon,Lat: {showLatLon ? round(resolvedLatLon.longitude, 7) : '--'},
              {showLatLon ? round(resolvedLatLon.latitude, 7) : '--'}
            </span>
            {showLatLon ? (
              <Button
                variant="text"
                onClick={this.openCAMPLink}
                text="CAMP"
                className={ImageFinderStyles.externalLink}
                rightIcon={<ExternalLinkOutlined />}
              />
            ) : (
              ''
            )}
          </div>
        </div>
        {showResults && (
          <ResultsControls
            viewControls={[
              <MultiSelect
                key="view_sources_display"
                className={ImageFinderStyles.multiselect}
                selectedValue={view}
                options={[
                  { label: 'Filename', value: 'filename' },
                  { label: 'Image', value: 'image' },
                ]}
                onChange={(value) => {
                  this.setState({ view: value });
                  localStorage.setItem(this.LOCALSTORAGE_VIEW_OPTIONS_KEY, value);
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
                  localStorage.setItem(this.LOCALSTORAGE_TITLE_LABEL_OPTION_KEY, selectedOption.value);
                }}
              />,
            ]}
            filterControls={[
              <Select
                key="filter_instrument"
                value={instrumentFilter}
                options={instrumentOptions}
                searchable={false}
                label="Instrument"
                onChange={(selectedOption) => {
                  this.setState({ instrumentFilter: selectedOption, page: 1 });
                }}
              />,
              <div className={ImageFinderStyles.inputWrapper} key="filter_range">
                <label htmlFor="max-range" className={FormsStyles.label}>
                  Maximum Range (m)
                </label>
                <input
                  id="max-range"
                  ref={this.rangeFilterNodeRef}
                  className={FormsStyles.textInput}
                  placeholder="e.g. 42"
                  type="number"
                  min={0}
                  value={rangeFilter}
                  onChange={(evt) => this.setState({ rangeFilter: evt.target.value, page: 1 })}
                />
              </div>,
            ]}
            viewLabel="Image View Options"
            filterLabel="Image Filters"
            resultStatsLabel={
              filterCount > 0
                ? `${filteredImages.length} of ${relatedImages.length.toLocaleString()} ${pluralizeByListLength(
                    'result',
                    relatedImages
                  )}`
                : `${relatedImages.length.toLocaleString()} ${pluralizeByListLength('result', relatedImages)}`
            }
            filterCount={filterCount}
            loading={loading}
            results={pagedImages}
          />
        )}
        {message}
        {showResults ? (
          <>
            <div className={listClass}>
              {pagedImages.map((item) => {
                let imageURL = '';
                if (!item._error) {
                  const location = this.getBackprojectedPixelLocationForImage(item);
                  const optParams = {};
                  if (location) {
                    optParams[config.url_keys.dataCursor] = `${location.projectedLine}_${location.projectedSample}`;
                  }
                  imageURL = getURLForProductWithExistingParams(item, optParams);
                }

                return (
                  <div
                    key={`${getPropFromProduct(item, config.es_mappings.id)}_related_image`}
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
                      <a target="_blank" rel="noreferrer" href={imageURL}>
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
                  </div>
                );
              })}
            </div>
            {moreImages ? (
              <div className={ImageFinderStyles.showMoreWrapper}>
                <Button
                  full
                  className={ImageFinderStyles.showMoreButton}
                  variant="secondary"
                  onClick={this.showMore}
                  text="Show more"
                />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    );
  }
}

ImageFinder.defaultProps = {
  product: null,
  loading: true,
  cursor: {},
  onResultsChange: () => {},
};

ImageFinder.propTypes = {
  product: PropTypes.object,
  loading: PropTypes.bool,
  overlays: PropTypes.arrayOf(PropTypes.object).isRequired,
  groups: PropTypes.arrayOf(PropTypes.object),
  cursor: PropTypes.object,
  addOverlay: PropTypes.func.isRequired,
  removeOverlay: PropTypes.func.isRequired,
  openHelpArticle: PropTypes.func.isRequired,
  onResultsChange: PropTypes.func,
  preferredImageForType: PropTypes.object.isRequired,
};

export default ImageFinder;
