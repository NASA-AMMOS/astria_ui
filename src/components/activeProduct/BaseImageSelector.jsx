import PropTypes from 'prop-types';
import React from 'react';
import ImageResult from 'src/components/common/ImageResult';
import MultiSelect from 'src/components/common/MultiSelect';
import Select from 'src/components/common/Select';
import BaseImageSelectorStyles from 'src/styles/BaseImageSelector.module.css';
import ProductDetailsStyles from 'src/styles/ProductDetails.module.css';
import { cloneObj, determineBestImageInGroup, objAlphaSort } from 'src/utils';
import { getConfig } from 'src/utils/configRegistry';
import { getLatestVersionsByType } from 'src/utils/dataQuery';
import { getAlias, getPropFromProduct, groupProductsBy } from 'src/utils/sharedUtils';
import * as telemetry from 'src/utils/telemetryUtils';

const BaseImageOption = (props) => {
  const config = getConfig();
  const { value: product, data, getValue, setValue } = props;

  let isSelected = false;
  const selectedValue = getValue();
  if (selectedValue && selectedValue[0]) {
    isSelected =
      getPropFromProduct(selectedValue[0].value, config.es_mappings.id) ===
      getPropFromProduct(product, config.es_mappings.id);
  }

  return (
    <ImageResult
      className={BaseImageSelectorStyles.image}
      product={product}
      showMetadata
      interactable
      raised={false}
      active={isSelected}
      customLabel={{
        title: getPropFromProduct(product, config.es_mappings.product_type, null) || 'Unknown',
        subtitle: getPropFromProduct(product, config.es_mappings.description, null) || 'Unknown Description',
      }}
      onClick={() => setValue(data)}
    />
  );
};

class BaseImageSelector extends React.Component {
  constructor(props) {
    super(props);

    this.handleSelect = this.handleSelect.bind(this);
    this.handleMultiSelect = this.handleMultiSelect.bind(this);
    this.handleBaseImageSelect = this.handleBaseImageSelect.bind(this);
  }

  getBaseImages() {
    const config = getConfig();
    const { groups, allowOverlays } = this.props;
    return groups.filter(
      (p) =>
        getPropFromProduct(p, config.es_mappings.object_type) !== config.object_type_mappings.annotation &&
        getPropFromProduct(p, config.es_mappings.object_type) !== config.object_type_mappings.image_feature &&
        (allowOverlays || !getPropFromProduct(p, config.es_mappings.overlayable, null))
    );
  }

  getOptionsForKey(key, type, allBaseImages) {
    const possibleOptions = [
      ...new Set(allBaseImages.map((item) => getPropFromProduct(item, this.getESMappingForKey(key)))),
    ];
    const isNumeric = type === 'lowest_value_numeric' || type === 'highest_value_numeric';

    // Return sorted options
    return objAlphaSort(
      possibleOptions.map((value) => {
        const safeValue = typeof value === 'number' || typeof value === 'string' ? value : ''; // guard against values that may not exist
        const label = getAlias(key, safeValue); // Use aliased value, if one exists
        const option = { value: safeValue, label: label.toString() }; // convert to string since sorting fn expects string keys
        return option;
      }),
      'label',
      false,
      false,
      isNumeric
    );
  }

  getESMappingForKey(key) {
    return Object.values(getConfig().es_mappings).find((mapping) => mapping.key === key) ?? null;
  }

  computeBaseImageSelectionFilters(activeProduct) {
    const config = getConfig();
    const { allowAllSelectors } = this.props;
    // TODO could also do some "show more options" thing and only normally show Eye?

    // Gather base image selection filters that do not have custom selectors (those must be hardcoded elsewhere in this component, e.g. Product Type)
    // and do not have search_only flag set to true
    const baseImageSelectionFilters = allowAllSelectors
      ? [...config.image_ranking_criteria]
      : config.image_ranking_criteria.filter((x) => !x.is_custom_selector && !x.search_only);

    let filteredBaseImages = this.getBaseImages();
    const validFilters = [];
    baseImageSelectionFilters.forEach((criteria) => {
      const esMapping = this.getESMappingForKey(criteria.key);
      if (esMapping) {
        criteria.value = getPropFromProduct(activeProduct, esMapping);
        criteria.valueLabel = getAlias(criteria.key, criteria.value);
        criteria.options = this.getOptionsForKey(criteria.key, criteria.type, filteredBaseImages);

        // Filter base images to those with active product criteria value
        const newFilteredBaseImages = filteredBaseImages.filter(
          (x) => getPropFromProduct(x, esMapping) === getPropFromProduct(activeProduct, esMapping)
        );

        // Only narrow our filtered base image set if we have > 0 resulting options since
        // some criteria will not apply to certain products
        if (newFilteredBaseImages.length) filteredBaseImages = newFilteredBaseImages;

        validFilters.push(criteria);
      } else {
        console.warn(`BaseImageSelector: No ES mapping found for criteria key '${criteria.key}'`);
      }
    });

    return validFilters;
  }

  handleSelect(options, key) {
    const { value } = options;
    this.handleFilterChange(value, key);
  }

  handleMultiSelect(value, key) {
    this.handleFilterChange(value, key);
  }

  handleFilterChange(value, key) {
    const config = getConfig();
    const { setBaseLayer, activeProduct } = this.props;
    const baseImageSelectionFilters = this.computeBaseImageSelectionFilters(this.props.activeProduct);

    const allBaseImages = this.getBaseImages();
    const matchingBaseImages = allBaseImages.filter(
      (image) => getPropFromProduct(image, this.getESMappingForKey(key)).toString() === value.toString()
    );

    // Make a deep copy as to not modify the original object since we don't want this to persist outside of this function
    const allRankCriteria = cloneObj(config.image_ranking_criteria);

    // Filter out keys that we don't want to preserve on base image changes
    const skipFilters = allRankCriteria.filter((x) => config.image_ranking_no_preserve_keys.indexOf(x.key) !== -1);
    let rankCriteria = allRankCriteria.filter((x) => config.image_ranking_no_preserve_keys.indexOf(x.key) === -1);

    // Prefer current filters (eye, geom, etc) by adding corresponding active prop to the criteria list
    baseImageSelectionFilters
      .filter((f) => f.key !== key) // exclude current key
      .forEach((f) => {
        const match = rankCriteria.find((x) => x.key === f.key);
        if (match && match.best_options) match.best_options.unshift(f.value);
      });

    // Manually add in product type preference since it's not an automatically created base image filter
    const activeProductType = getPropFromProduct(activeProduct, config.es_mappings.product_type);
    rankCriteria.find((x) => x.key === config.es_mappings.product_type.key).best_options.unshift(activeProductType);

    // Manually add skipped keys in at the end
    rankCriteria = rankCriteria.concat(skipFilters);

    // Get the best image using our modified ranking criteria
    const bestImage = determineBestImageInGroup(matchingBaseImages, rankCriteria);

    if (bestImage) setBaseLayer(bestImage);
    else {
      const baseImageFilenames = allBaseImages
        .map((x) => getPropFromProduct(x, config.es_mappings.filename))
        .join(', ');
      // TODO is this TMI?
      telemetry.logWarning(
        `No matching image found for base images: ${baseImageFilenames} using criteria ${JSON.stringify(rankCriteria)}`
      );
      console.warn('allBaseImages', allBaseImages, 'rankCriteria', rankCriteria);
    }
  }

  handleBaseImageSelect(options) {
    const { setBaseLayer } = this.props;
    const { value: selectedImage } = options;
    setBaseLayer(selectedImage);
  }

  render() {
    const config = getConfig();
    const { activeProduct, isCustomProduct, fetchingGroups } = this.props;

    // Check loading and active product states
    if (isCustomProduct) return <div />;
    if (fetchingGroups) return <div className={ProductDetailsStyles.emptyStateMessage}>Loading Image Group</div>;

    // Get valid base images
    const allBaseImages = this.getBaseImages();

    // Create filter option components
    const baseImageSelectionFilters = this.computeBaseImageSelectionFilters(activeProduct);
    const filterOptions = baseImageSelectionFilters
      .filter((f) => f.options.length > 1)
      .map((f) => {
        const options = f.options;
        if (f.input_type === 'select') {
          return (
            <Select
              key={`base_${f.key}_select`}
              label={f.label}
              labelPosition="inner"
              value={{ value: f.value, label: f.valueLabel }}
              searchable={false}
              options={options}
              onChange={(newOptions) => this.handleSelect(newOptions, f.key)}
            />
          );
        }
        if (f.input_type === 'multiselect') {
          return (
            <MultiSelect
              key={`base_${f.key}_select`}
              selectedValue={f.value}
              options={options}
              onChange={(value) => this.handleFilterChange(value, f.key)}
            />
          );
        }
        console.warn('Unsupported base image selection option:', f);
        return <div key={`base_${f.key}_filter_unsupported`}>Unsupported filter</div>;
      });

    // Collect matching base images based on our parameters
    const matchingBaseImages = allBaseImages.filter(
      (image) =>
        baseImageSelectionFilters.every((f) => f.value === getPropFromProduct(image, this.getESMappingForKey(f.key))) // ensure every filter value matches every corresponding prop in the image
    );

    // Select the highest version of each product type for each group of overlay ids
    // This may result in duplicate base images in rare cases where our filters somehow
    // miss some parameters. But better to have a few duplicates than to hide data.
    const overlayIDs = new Set(matchingBaseImages.map((x) => getPropFromProduct(x, config.es_mappings.overlay_id)));
    if (overlayIDs.size > 1) {
      const baseImageFilenames = matchingBaseImages
        .map((x) => getPropFromProduct(x, config.es_mappings.filename))
        .join(', ');
      const overlayIDsString = Array.from(overlayIDs).join(',');
      telemetry.logWarning(
        `Could not select highest versions by product type for base images since multiple overlayIDs were found in the set. Base images: ${baseImageFilenames}, overlayIDs :${overlayIDsString}`
      );
      console.warn('overlayIDs', overlayIDs, 'matchingBaseImages', matchingBaseImages);
    }

    // Group products by type
    const baseImagesGroupedByOverlayId = groupProductsBy(matchingBaseImages, config.es_mappings.overlay_id);
    const finalBaseImages = Object.values(baseImagesGroupedByOverlayId)
      .map((s) => getLatestVersionsByType(s))
      .flat();
    const baseImageOptions = objAlphaSort(
      finalBaseImages.map((image) => {
        return {
          value: image,
          label: getPropFromProduct(image, config.es_mappings.product_type),
        };
      }),
      'label'
    );
    const currentBaseImage = {
      value: activeProduct,
      label: getPropFromProduct(activeProduct, config.es_mappings.product_type),
    };

    return (
      <div className={BaseImageSelectorStyles.root}>
        {filterOptions}
        {baseImageOptions.length > 1 && (
          <Select
            className={BaseImageSelectorStyles.productTypeSelect}
            key="base_image_select"
            label="Base Image"
            labelPosition="inner"
            value={currentBaseImage}
            searchable={false}
            options={baseImageOptions}
            closeMenuOnSelect={false}
            onChange={this.handleBaseImageSelect}
            components={{ Option: BaseImageOption }}
          />
        )}
      </div>
    );
  }
}

BaseImageSelector.defaultProps = {
  activeProduct: null,
  allowOverlays: false,
  allowAllSelectors: false,
};

BaseImageSelector.propTypes = {
  activeProduct: PropTypes.object,
  allowOverlays: PropTypes.bool,
  allowAllSelectors: PropTypes.bool,
  groups: PropTypes.arrayOf(PropTypes.object).isRequired,
  fetchingGroups: PropTypes.bool.isRequired,
  isCustomProduct: PropTypes.bool.isRequired,
  setBaseLayer: PropTypes.func.isRequired,
};
export default BaseImageSelector;
