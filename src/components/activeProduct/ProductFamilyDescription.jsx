import PropTypes from 'prop-types';
import React from 'react';
import ProductDetailsStyles from 'src/styles/ProductDetails.module.css';
import ProductFamilyDescriptionStyles from 'src/styles/ProductFamilyDescription.module.css';
import typographyStyles from 'src/styles/common/typography.module.css';
import { getPropFromProduct } from 'src/utils/sharedUtils';

import config from 'config.js';
export class ProductFamilyDescription extends React.Component {
  render() {
    const { product, productDescriptions, loading } = this.props;

    if (!product || !getPropFromProduct(product, config.es_mappings.filename, null)) {
      return <div className={ProductDetailsStyles.emptyStateMessage}>Select an Image</div>;
    }

    if (loading) {
      return <div className={ProductDetailsStyles.emptyStateMessage}>Loading Image Group</div>;
    }

    if (!productDescriptions || Object.keys(productDescriptions).length < 1) {
      return <div className={ProductDetailsStyles.emptyStateMessage}>No Description Found</div>;
    }

    return (
      <div className={ProductFamilyDescriptionStyles.root}>
        {Object.keys(productDescriptions).map((key) => (
          <div key={`product_description_${key}`} className={ProductFamilyDescriptionStyles.description}>
            <div className={ProductFamilyDescriptionStyles.label}>{key.replace('_', ' ')}</div>
            <div className={typographyStyles.body}>{productDescriptions[key]}</div>
          </div>
        ))}
      </div>
    );
  }
}

ProductFamilyDescription.defaultProps = {
  product: null,
  productDescriptions: {},
};

ProductFamilyDescription.propTypes = {
  product: PropTypes.object,
  productDescriptions: PropTypes.object,
};

export default ProductFamilyDescription;
