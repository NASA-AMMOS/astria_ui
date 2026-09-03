import PropTypes from 'prop-types';
import React from 'react';
import ProductDetails from 'src/components/activeProduct/ProductDetails';
import SidebarOverlay from 'src/components/activeProduct/SidebarOverlay';

class ProductMetadata extends React.Component {
  handleClose = () => {
    this.props.handleDisplayProductMetadata(null);
  };

  render() {
    const {
      product,
      groups,
      hasPartialMetadata,
      cursor,
      productDescriptions,
      addStarredMetadataField,
      removeStarredMetadataField,
      clearStarredMetadataFields,
      starredMetadataFields,
      poppedout,
    } = this.props;
    return (
      <SidebarOverlay isOpen={product} handleClose={this.handleClose}>
        <ProductDetails
          enableDataExplorer
          product={product}
          hasPartialMetadata={hasPartialMetadata}
          fetchingGroups={hasPartialMetadata}
          groups={groups}
          cursor={cursor}
          productDescriptions={productDescriptions}
          poppedout={poppedout}
          starredMetadataFields={starredMetadataFields}
          addStarredMetadataField={addStarredMetadataField}
          removeStarredMetadataField={removeStarredMetadataField}
          clearStarredMetadataFields={clearStarredMetadataFields}
        />
      </SidebarOverlay>
    );
  }
}

ProductMetadata.defaultProps = {
  product: null,
};

ProductMetadata.propTypes = {
  product: PropTypes.object,
  handleDisplayProductMetadata: PropTypes.func,
  starredMetadataFields: PropTypes.object,
  addStarredMetadataField: PropTypes.func,
  removeStarredMetadataField: PropTypes.func,
  clearStarredMetadataFields: PropTypes.func,
};

export default ProductMetadata;
