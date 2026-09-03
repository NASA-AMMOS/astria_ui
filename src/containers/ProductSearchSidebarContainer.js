import { connect } from 'react-redux';
import { setSearchTab } from 'src/actions/sidebarState';
import ProductSearchSidebar from 'src/components/productSearch/ProductSearchSidebar';

const mapStateToProps = (state) => {
  return {
    tabIndex: state.sidebarState.searchTabIndex,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setSearchTab(tabIndex) {
      dispatch(setSearchTab(tabIndex));
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ProductSearchSidebar);
