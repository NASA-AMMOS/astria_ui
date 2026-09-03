import { connect } from 'react-redux';
import ImageViewingHistory from '../components/ImageViewingHistory';
import { clearViewingHistory, setActiveSearchProduct } from '../actions/activeSearchProduct';

const mapStateToProps = (state) => {
  return {
    imageHistory: state.activeSearchProduct.imageHistory,
  };
};

const matchDispatchToProps = (dispatch) => {
  return {
    clearViewingHistory() {
      dispatch(clearViewingHistory());
    },
    handleSearchItemClicked(item) {
      dispatch(setActiveSearchProduct(item, true, true));
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps)(ImageViewingHistory);
