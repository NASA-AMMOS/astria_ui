import config from 'config.js';
import PropTypes from 'prop-types';
import ProductDetailsStyles from 'src/styles/ProductDetails.module.css';
import { getPropFromProduct } from 'src/utils/sharedUtils';

const GroupsLoading = ({ product = null, fetchingInitialData, fetchingGroups, children }) => {
  if (fetchingInitialData) {
    return <div className={ProductDetailsStyles.emptyStateMessage}>Loading</div>;
  }
  if (!product || !getPropFromProduct(product, config.es_mappings.filename, null)) {
    return <div className={ProductDetailsStyles.emptyStateMessage}>Select an Image</div>;
  }
  if (fetchingGroups) {
    return <div className={ProductDetailsStyles.emptyStateMessage}>Loading Overlays</div>;
  }
  return children;
};

GroupsLoading.propTypes = {
  product: PropTypes.object,
  fetchingInitialData: PropTypes.bool.isRequired,
  fetchingGroups: PropTypes.bool.isRequired,
  children: PropTypes.node,
};
export default GroupsLoading;
