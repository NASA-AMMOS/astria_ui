import { connect } from 'react-redux';
import { openHelpArticle } from 'src/actions/helpActions';
import { setResultsExportOpen } from 'src/actions/searchActions';
import SearchBase from 'src/components/productSearch/SearchBase';
import { setActiveSearchProduct } from '../actions/activeSearchProduct';

const mapStateToProps = (state) => {
  return {
    activeSearchProduct: state.activeSearchProduct.searchProduct,
    fetchingInitialData: state.loading.fetchingInitialData,
    ocsPackages: state.search.ocsPackages,
    campaigns: state.search.campaigns,
    goals: state.search.goals,
    tasks: state.search.tasks,
    keywords: state.search.keywords,
    keywordsMap: state.search.keywordsMap,
    storeQueryID: state.search.storeQueryID,
  };
};

const matchDispatchToProps = (dispatch) => {
  return {
    handleSearchItemClicked(item) {
      dispatch(setActiveSearchProduct(item, true, true));
    },
    exportResults(results) {
      dispatch(setResultsExportOpen(true, results));
    },
    openHelpArticle(key) {
      dispatch(openHelpArticle(key));
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps, null, { forwardRef: true })(SearchBase);
