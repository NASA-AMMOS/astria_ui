import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import Button from 'src/components/common/Button';
import { StarIcon, StarOutlineIcon } from 'src/components/common/Icons';
import InlineLabeledValue from 'src/components/common/InlineLabeledValue';
import Select from 'src/components/common/Select';
import Tooltip from 'src/components/common/Tooltip';
import ProductDetailsStyles from 'src/styles/ProductDetails.module.css';
import ProductSummaryStyles from 'src/styles/ProductSummary.module.css';
import { flattenObjectKeys, objAlphaSort } from 'src/utils';
import { getEsMappingsByKey, getPropFromProduct } from 'src/utils/sharedUtils';

import { getConfig } from 'src/utils/configRegistry';
export class ProductSummary extends React.Component {
  constructor(props) {
    super(props);

    this.LOCALSTORAGE_METADATA_FILTER = 'productMetadataFilter';
    const metadataFilter = localStorage.getItem(this.LOCALSTORAGE_METADATA_FILTER) || 'Default';

    this.state = {
      showMore: false,
      metadataFilter,
    };

    this.toggleShowMore = this.toggleShowMore.bind(this);
  }

  toggleShowMore() {
    const { showMore } = this.state;
    this.setState({ showMore: !showMore });
  }

  formatItemLabel(label) {
    // Format OCS property by changing snake case to spaces
    // Replace ocs with OCS
    // Sentence case each item
    // e.g. ocs_name_1 -> "OCS Name 1"
    try {
      return label
        .replaceAll('_', ' ')
        .replaceAll('.', ' • ')
        .replaceAll('ocs', 'OCS')
        .split(' ')
        .map((x) => {
          let capitalizedString = x;
          if (typeof x[0] === 'string') capitalizedString = x[0].toUpperCase() + x.substring(1);
          return capitalizedString;
        })
        .join(' ');
    } catch (err) {
      console.warn('Unable to format product summary label', err);
      return label;
    }
  }

  renderStarButton(key) {
    const config = getConfig();
    const starredVICAR = this.props.starredMetadataFields[config.label_key].indexOf(key) > -1;
    const starredOCS = this.props.starredMetadataFields.ocs.indexOf(key) > -1;
    const starred = starredOCS || starredVICAR;
    const classes = classNames({
      [ProductSummaryStyles.starButtonBase]: true,
      [ProductSummaryStyles.starButton]: starred,
      [ProductSummaryStyles.unStarButton]: !starred,
    });
    const overlay = `${starred ? 'Remove from' : 'Add to'} starred fields`;
    return (
      <Tooltip overlay={overlay} placement="top">
        <Button
          aria-label={overlay}
          className={classes}
          variant="icon"
          icon={starred ? <StarIcon /> : <StarOutlineIcon />}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (starred) this.props.removeStarredMetadataField(key, starredVICAR);
            else this.props.addStarredMetadataField(key);
          }}
        />
      </Tooltip>
    );
  }

  render() {
    const config = getConfig();
    const { showMore, metadataFilter } = this.state;
    const { product, loading, starredMetadataFields } = this.props;

    if (!product || !getPropFromProduct(product, config.es_mappings.filename, null)) {
      return <div className={ProductDetailsStyles.emptyStateMessage}>Select an Image</div>;
    }

    if (loading) {
      return <div className={ProductDetailsStyles.emptyStateMessage}>Loading Image Group</div>;
    }

    let metadataItems = [];

    // Prepare items based off our metadata mode (default, all, starrd)
    // Default: Defined in the config
    // All: Displays all metadata values besides the vicar label plus the vicar label items specifically
    // mentioned in the Default config. This mode and requires some auto formatting
    // to make auto discovered keys more human readable.
    // Starred: Displays all starred OCS and vicar_label fields

    // Get OCS object type for product
    const objectType = getPropFromProduct(product, config.es_mappings.object_type, 'default', false, false);

    // Get corresponding config-defined list of metadata keys to present
    const metadataForObject = config.product_details.hasOwnProperty(objectType)
      ? config.product_details[objectType]
      : config.product_details.default;

    metadataItems = metadataForObject.overview_items;

    if (metadataFilter === 'All' || metadataFilter === 'Starred') {
      // Collect all keys from the product that we do not already have in our default metadata config
      // Also exclude vicar_label since we render that separately
      const defaultMetadataKeys = metadataItems
        .map((x) => x.key)
        .reduce((accum, x) => {
          accum[x] = true;
          return accum;
        }, {});
      const labelKeyPrefix = config.label_key + '.';
      const metadataKeys = flattenObjectKeys(product).filter(
        (x) => !defaultMetadataKeys.hasOwnProperty(x) && !x.startsWith(labelKeyPrefix) && x !== config.label_key
      );

      const esMappingsByKey = getEsMappingsByKey();

      // For each key, look for a corresponding mapping in our config for labeling purposes,
      // otherwise just use the existing key with some best guess formatting.
      // Skip any item whose resolved key is already present in the defaults.
      const additionalMetadataItems = metadataKeys.reduce((accum, x) => {
        const item = esMappingsByKey[x] || { label: this.formatItemLabel(x), key: x };
        if (!defaultMetadataKeys.hasOwnProperty(item.key)) {
          defaultMetadataKeys[item.key] = true;
          accum.push(item);
        }
        return accum;
      }, []);

      metadataItems = metadataItems.concat(additionalMetadataItems);

      if (metadataFilter === 'Starred') {
        // Filter by starredMetadataFields.ocs
        metadataItems = metadataItems.filter((x) => starredMetadataFields.ocs.indexOf(x.key) > -1);

        // Add vicar label items
        starredMetadataFields[config.label_key].forEach((l) => {
          try {
            const label = l.split('.')[2];
            metadataItems.push({ label, key: l });
          } catch (err) {
            console.log(err);
          }
        });
      }

      // Sort based off label
      metadataItems = objAlphaSort(metadataItems, 'label');
    }

    const inlinedLabeledValueClass = classNames({
      [ProductDetailsStyles.inlineLabeledValue]: true,
      [ProductSummaryStyles.inlineLabeledValue]: true,
    });
    const renderOverviewItem = (label, value, key) => (
      <InlineLabeledValue
        leftButton={this.renderStarButton(key)}
        labelWidth={metadataFilter === 'Starred' ? 160 : 96}
        key={key + label + metadataFilter}
        value={value}
        label={label}
        tooltip={key}
        valueMissing={value === config.missing_property_value}
        className={inlinedLabeledValueClass}
      />
    );

    const starredLabel = `Starred (${
      starredMetadataFields.ocs.length + starredMetadataFields[config.label_key].length
    })`;
    const currentValueLabel = metadataFilter === 'Starred' ? starredLabel : metadataFilter;

    return (
      <div>
        <Select
          aria-label="Metadata group"
          className={ProductDetailsStyles.metadataFilterSelect}
          value={{ label: currentValueLabel, value: metadataFilter }}
          searchable={false}
          options={[
            { value: 'Default', label: 'Default' },
            { value: 'All', label: 'All' },
            {
              value: 'Starred',
              label: starredLabel,
            },
          ]}
          onChange={(selectedOption) => {
            this.setState({ metadataFilter: selectedOption.value });
            localStorage.setItem(this.LOCALSTORAGE_METADATA_FILTER, selectedOption.value);
          }}
        />
        <div className={ProductSummaryStyles.metadataItems}>
          {metadataItems
            .filter((item) => {
              const property = getPropFromProduct(product, item);
              const isArray = Array.isArray(property);
              const isComputedProperty = item.key[0] === '_'; // Private ASTRIA properties
              return (
                property !== undefined &&
                property !== null &&
                !(typeof property === 'object' && !isArray) &&
                !isComputedProperty
              );
            })
            .slice(0, !showMore ? 12 : metadataItems.length) // limit number of items if showMore not active
            .map((item) => {
              const property = getPropFromProduct(product, item);
              const isArray = Array.isArray(property);
              const stringProperty = isArray ? property.join(', ') : property.toString();
              return renderOverviewItem(item.label, stringProperty, item.key);
            })}
          {metadataItems.length > 12 && (
            <Button
              className={ProductSummaryStyles.showMoreButton}
              variant="text"
              onClick={this.toggleShowMore}
              text={showMore ? 'Show less' : 'Show more'}
            />
          )}
          {starredMetadataFields.ocs.length + starredMetadataFields[config.label_key].length === 0 &&
            metadataFilter === 'Starred' && (
              <div className={ProductDetailsStyles.emptyStateMessage}>
                Starred fields from Image Metadata and VICAR Label Explorer will appear here
              </div>
            )}
          {starredMetadataFields.ocs.length + starredMetadataFields[config.label_key].length > 0 &&
            metadataFilter === 'Starred' && (
              <Button
                className={ProductSummaryStyles.showMoreButton}
                variant="text"
                onClick={this.props.clearStarredMetadataFields}
                text="Unstar All"
              />
            )}
        </div>
      </div>
    );
  }
}

ProductSummary.defaultProps = {
  product: null,
  loading: false,
  starredMetadataFields: null,
};

ProductSummary.propTypes = {
  product: PropTypes.object,
  loading: PropTypes.bool,
  starredMetadataFields: PropTypes.object,
  addStarredMetadataField: PropTypes.func,
  removeStarredMetadataField: PropTypes.func,
  clearStarredMetadataFields: PropTypes.func,
};

export default ProductSummary;
