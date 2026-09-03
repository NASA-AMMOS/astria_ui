import { setResultsExportOpen } from 'src/actions/searchActions';
import { connect } from 'react-redux';
import ResultsExportModal from '../components/ResultsExportModal';

const mapStateToProps = (state) => {
  return {
    open: state.search.resultsExportOpen,
    results: state.search.resultsExportItems,
  };
};

const matchDispatchToProps = (dispatch) => {
  return {
    close() {
      dispatch(setResultsExportOpen(false));
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps)(ResultsExportModal);
