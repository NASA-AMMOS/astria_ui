import classNames from 'classnames';
import 'lazysizes';
import debounce from 'lodash.debounce';
import React from 'react';
import { connect } from 'react-redux';
import { setActiveSearchProduct } from 'src/actions/activeSearchProduct';
import { setActiveCategorySearchCategory } from 'src/actions/searchActions';
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
import { getCategoryImages, getDescendantProp, getPropFromProduct } from 'src/utils/sharedUtils';
import { logError } from 'src/utils/telemetryUtils';

import { getConfig } from 'src/utils/configRegistry';

const ICON_MAP = {
  ZCAMIcon: <ZCAMIcon />,
  NavcamIcon: <NavcamIcon />,
  SupercamIcon: <SupercamIcon />,
  SHERLOCIcon: <SHERLOCIcon />,
  HeliIcon: <HeliIcon />,
};

class CategorySearch extends React.Component {
  constructor(props) {
    super(props);

    this.ref = React.createRef();
    this.isFetching = false;

    this.debouncedFilterChange = debounce(this.handleFilterChange.bind(this), 150, {
      trailing: true,
    });

    this.state = {
      containerWidth: 0,
      loading: false,
      retrying: false,
      initialLoadComplete: false,
      loadingSuccess: false,
      groupedImages: {},
      activeCategorySearchCategory: null,
      filter: '',
    };
  }

  componentDidMount() {
    this.connectResizeObserver();
    window.addEventListener('keyup', this.onKeyUp);

    // Always fetch on mount (like MosaicTimeline)
    requestAnimationFrame(async () => {
      await this.fetchCategoryImages();
    });
  }

  componentDidUpdate(prevProps) {
    // Fetch when tab becomes visible for the first time
    if (!prevProps.isVisible && this.props.isVisible && !this.state.initialLoadComplete) {
      requestAnimationFrame(async () => {
        await this.fetchCategoryImages();
      });
    }
  }

  componentWillUnmount() {
    window.removeEventListener('keyup', this.onKeyUp);
    this.disconnectResizeObserver();
    this.isFetching = false;
  }

  handleFilterChange = (event) => {
    this.setState({
      filter: event.target.value,
    });
  };

  onKeyUp = (event) => {
    const config = getConfig();
    const { activeSearchProduct, activeCategorySearchCategory, isVisible } = this.props;

    let images = [];
    const categoryId = activeCategorySearchCategory;
    if (this.state.groupedImages[categoryId]) {
      images = this.state.groupedImages[categoryId].images;
    }

    if (!isVisible || !activeSearchProduct) return;
    if (event.target.nodeName === 'INPUT' || event.target.nodeName === 'TEXTAREA') return;
    if (event.key === '[' || event.key === ']') {
      const activeSearchProductId = getPropFromProduct(activeSearchProduct, config.es_mappings.id);
      const matchingResultIndex = images.findIndex(
        (result) => getPropFromProduct(result, config.es_mappings.id) === activeSearchProductId
      );

      let newResultIndex = 0;

      if (matchingResultIndex > -1) {
        if (event.key === '[') {
          newResultIndex = matchingResultIndex - 1;
          if (newResultIndex < 0) return;
        } else {
          newResultIndex = matchingResultIndex + 1;
          if (newResultIndex > images.length - 1) return;
        }
      }

      const nextResultElementId = this.getIdForResultIndex(newResultIndex);
      if (nextResultElementId) {
        const nextResultElement = document.getElementById(nextResultElementId);
        if (nextResultElement) {
          nextResultElement.focus();
          nextResultElement.scrollIntoViewIfNeeded
            ? nextResultElement.scrollIntoViewIfNeeded()
            : nextResultElement.scrollIntoView();

          nextResultElement.click();
        }
      }
    }
  };

  async fetchCategoryImages() {
    const config = getConfig();
    if (this.isFetching) {
      return;
    }

    this.isFetching = true;
    this.setState({ loading: true });

    try {
      const categoryGatheringEnabled = (
        await (await fetch(`${config.category_search?.url_base ?? './api'}/isCategorySearchGatheringEnabled`)).json()
      ).enabled;

      let cachedImages = [];
      let minutesLimitFromNow = 10;
      if (categoryGatheringEnabled) {
        const response = await fetch(`${config.category_search?.url_base ?? './api'}/categorySearch`);
        cachedImages = await response.json();
      } else {
        minutesLimitFromNow = -1;
      }

      const { images: latestImages } = await getCategoryImages(null, config.category_search, minutesLimitFromNow, true);

      // Merge latestImages on top of cachedImages
      const allImages = {};

      // Add all latest images to the map
      latestImages.forEach((image) => (allImages[image.ocs_name] = image));

      // Add all cached images not already in latest images to the map
      cachedImages.forEach((image) => {
        if (!allImages.hasOwnProperty(image.ocs_name)) allImages[image.ocs_name] = image;
      });

      let groupedImages = this.groupImagesByCategory(Object.values(allImages));

      // Apply category-specific culling based on configuration
      groupedImages = this.cullCategoryImages(groupedImages);

      Object.keys(groupedImages).forEach((categoryId) => {
        groupedImages[categoryId].images = groupedImages[categoryId].images.sort((a, b) => {
          const getTimeFromImage = (image) => {
            if (image.hasOwnProperty('time1')) return image.time1;
            if (image.hasOwnProperty('sol')) return image.sol;
            return 0;
          };
          return getTimeFromImage(b) - getTimeFromImage(a);
        });
      });

      this.setState({ loading: false, groupedImages, initialLoadComplete: true, loadingSuccess: true });
      if (this.props.onResultsChange) this.props.onResultsChange(Object.keys(allImages).length);
    } catch (err) {
      this.setState({ loading: false, groupedImages: {}, initialLoadComplete: true, loadingSuccess: false });
      console.error('CategorySearch: Fetch failed:', err);
      logError('Failed to fetch category search images:', err);
    } finally {
      this.isFetching = false;
    }
  }

  cullCategoryImages(categoryGroups) {
    const config = getConfig();
    // Apply culling based on category configuration
    if (!config.category_search || !config.category_search.categories) {
      return categoryGroups;
    }

    config.category_search.categories.forEach((category) => {
      if (!category.culling_params) return;

      const categoryGroup = categoryGroups[category.id];
      if (!categoryGroup) return;

      const { group_by, select_by, select_method } = category.culling_params;

      // Group images by the specified fields
      const imageMap = {};
      categoryGroup.images.forEach((image) => {
        const key = group_by.map((field) => image[field]).join('_');
        if (!imageMap[key]) imageMap[key] = [];
        imageMap[key].push(image);
      });

      // Select the best image from each group based on select_by and select_method
      const newImages = [];
      Object.keys(imageMap).forEach((key) => {
        const images = imageMap[key];
        let bestImage;
        images.forEach((image) => {
          if (!bestImage) {
            bestImage = image;
          } else {
            const compareValue = image[select_by];
            const bestValue = bestImage[select_by];
            if (select_method === 'max' && compareValue > bestValue) {
              bestImage = image;
            } else if (select_method === 'min' && compareValue < bestValue) {
              bestImage = image;
            }
          }
        });
        newImages.push(bestImage);
      });
      categoryGroup.images = newImages;
    });

    return categoryGroups;
  }

  groupImagesByCategory(images) {
    const config = getConfig();
    if (!config.category_search || !config.category_search.categories) {
      return {};
    }

    const categoryMap = {};
    config.category_search.categories.forEach((category) => {
      categoryMap[category.id] = {
        images: [],
        label: category.label,
        icon: ICON_MAP[category.icon] || <NavcamIcon />,
        order: category.order,
      };
    });

    const uncategorizedImages = [];
    images.forEach((image) => {
      const categoryId = image._category_id;
      if (categoryId && categoryMap[categoryId]) {
        categoryMap[categoryId].images.push(image);
      } else {
        uncategorizedImages.push(image);
      }
    });

    if (uncategorizedImages.length > 0) {
      console.log(
        '[CategorySearch] Uncategorized images:',
        uncategorizedImages.length,
        'first example:',
        uncategorizedImages[0]
      );
    }

    return categoryMap;
  }

  setActiveCategorySearchCategory(categoryId) {
    this.setState({ filter: '' });
    this.props.setActiveCategorySearchCategory(categoryId);
  }

  renderCategoryMenu() {
    const categories = Object.keys(this.state.groupedImages);
    const sortedCategories = categories.sort((a, b) => {
      const aOrder = this.state.groupedImages[a].order;
      const bOrder = this.state.groupedImages[b].order;
      return aOrder - bOrder;
    });
    return (
      <>
        <div className={MosaicsTimelineStyles.headerContainer}>
          <div className={MosaicsTimelineStyles.header}>Category Browse</div>
          <div className={MosaicsTimelineStyles.subheader}>Browse through categorized images</div>
        </div>

        <div className={MosaicsTimelineStyles.categoryList}>
          {sortedCategories.map((categoryId) => {
            const { images, label, icon } = this.state.groupedImages[categoryId];
            return (
              <button
                key={categoryId}
                onClick={() => this.setActiveCategorySearchCategory(categoryId)}
                className={MosaicsTimelineStyles.instrument}
              >
                <div className={MosaicsTimelineStyles.instrumentIcon}>{icon}</div>
                <div className={MosaicsTimelineStyles.instrumentNameContainer}>
                  <div className={MosaicsTimelineStyles.instrumentName}>{label}</div>
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
        const width = entries[0].contentRect.width - 73;
        this.setState({ containerWidth: width });
      });
    });

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

    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      const newURL = getURLForProductWithExistingParams(item);
      const link = document.createElement('a');
      link.href = newURL;
      const newEvent = new MouseEvent('click', { ...event });
      link.dispatchEvent(newEvent);
    } else {
      event.preventDefault();
      handleSearchItemClicked(item, true, true);
    }
  }

  renderCategoryPage() {
    const categoryId = this.props.activeCategorySearchCategory;
    let images = [];
    let minSol = Number.POSITIVE_INFINITY;
    let maxSol = 0;
    let categoryLabel = '';

    if (this.state.groupedImages[categoryId]) {
      images = this.state.groupedImages[categoryId].images;
      categoryLabel = this.state.groupedImages[categoryId].label;
      images.forEach((image) => {
        if (image.time1 < minSol) minSol = image.time1;
        if (image.time1 > maxSol) maxSol = image.time1;
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
                <div className={MosaicsTimelineStyles.header}>{categoryLabel}</div>
                <div className={MosaicsTimelineStyles.subheader}>
                  {this.state.loading || this.state.retrying
                    ? 'Loading'
                    : `${images.length} images from sols ${minSol} – ${maxSol}`}
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
                    onClick={() => this.fetchCategoryImages()}
                  />
                </Tooltip>
                <ExportResultsButtonContainer results={images} className={MosaicsTimelineStyles.fixedContentButton} />
                <Tooltip overlay="Back to All Categories" placement="top">
                  <Button
                    aria-label="Back to All Categories"
                    className={MosaicsTimelineStyles.fixedContentButton}
                    variant="icon"
                    disabled={this.state.loading}
                    icon={<CloseIcon />}
                    onClick={() => this.setActiveCategorySearchCategory()}
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
          {this.renderImageList(images)}
        </div>
      </>
    );
  }

  getIdForResultIndex(i) {
    return `category_search_item_${i}`;
  }

  getStringOrArrayFieldValue(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      return value.join(', ');
    }
  }

  renderImageList(images) {
    const config = getConfig();
    return (
      <div className={MosaicsTimelineStyles.mosaicsListContainer}>
        <div className={MosaicsTimelineStyles.mosaicsListPadding}>
          {images.map((image, index) => {
            const isImageCustomProduct = isCustomProduct(image);
            let src = buildTiledImageURL(image, true);

            const imageWidth = parseInt(getDescendantProp(image, config.es_mappings.width.key));
            const imageHeight = parseInt(getDescendantProp(image, config.es_mappings.height.key));

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
                getPropFromProduct(image, config.es_mappings.id) ===
                getPropFromProduct(this.props.activeSearchProduct, config.es_mappings.id),
            });

            let productTitleItems = [];

            if (typeof image.time1 === 'number') {
              productTitleItems.push(`Sol: ${image.time1}`);
            } else if (Array.isArray(image.time1)) {
              productTitleItems.push(`Sols: ${this.getStringOrArrayFieldValue(image.time1)}`);
            }
            if (typeof image.site === 'number' || typeof image.site === 'string') {
              productTitleItems.push(`Site: ${image.site}`);
            }
            if (typeof image.drive === 'number' || typeof image.drive === 'string') {
              productTitleItems.push(`Drive: ${image.drive}`);
            }
            if (typeof image.flight === 'number' || typeof image.flight === 'string') {
              productTitleItems.push(`Flight: ${image.flight}`);
            }

            const activityNames = this.getStringOrArrayFieldValue(image.activity_name_rtt);
            const seqIDs = this.getStringOrArrayFieldValue(image.seq_id_rtt);
            const targetNames = this.getStringOrArrayFieldValue(image.target_name_rtt);

            let description = image.description;
            if (image.description_field && image.description_field !== 'AUTOGEN') {
              description = image.description_field;
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
              <div key={image.ocs_name} className={EDRListStyles.searchResultContainer}>
                <button
                  id={this.getIdForResultIndex(index)}
                  onClick={(event) => this.onSearchResultClicked(event, image)}
                  className={productClasses}
                >
                  <div style={{ width, height }} className={imageContainerClasses}>
                    <img alt={image.ocs_name} data-sizes="auto" data-src={src} className={imageClasses} />
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
                      const newURL = getURLForProductWithExistingParams(image);
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
        {this.state.loading && (!this.state.initialLoadComplete || !this.props.activeCategorySearchCategory) && (
          <div className={EDRListStyles.initialLoadMoreMessage}>Loading</div>
        )}
        {!this.state.loading && this.state.initialLoadComplete && !this.state.loadingSuccess && (
          <div className={MosaicsTimelineStyles.retryContainer}>
            <div className={EDRListStyles.errorStateMessage}>
              Unable to load category search images
              <div>
                <Button
                  text="Retry"
                  variant="secondary"
                  onClick={async () => {
                    this.setState({ retrying: true });
                    await this.fetchCategoryImages();
                    this.setState({ retrying: false });
                  }}
                />
              </div>
            </div>
          </div>
        )}
        {!this.state.loading &&
          this.state.loadingSuccess &&
          !this.props.activeCategorySearchCategory &&
          this.renderCategoryMenu()}
        {(this.state.loadingSuccess || this.state.retrying) &&
          this.state.initialLoadComplete &&
          this.props.activeCategorySearchCategory &&
          this.renderCategoryPage()}
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    activeSearchProduct: state.activeSearchProduct.searchProduct,
    activeCategorySearchCategory: state.search.activeCategorySearchCategory,
  };
};

const matchDispatchToProps = (dispatch) => {
  return {
    handleSearchItemClicked(item, showImage, hasPartialMetadata) {
      dispatch(setActiveSearchProduct(item, showImage, hasPartialMetadata));
    },
    setActiveCategorySearchCategory(categoryId) {
      dispatch(setActiveCategorySearchCategory(categoryId));
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps)(CategorySearch);
