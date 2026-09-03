import { connect } from 'react-redux';
import { setResultsExportOpen } from 'src/actions/searchActions';
import ExportResultsButton from 'src/components/common/ExportResultsButton';

const mapDispatchToProps = (dispatch) => {
  return {
    exportResults(results) {
      dispatch(setResultsExportOpen(true, results));
    },
  };
};

const ExportResultsButtonContainer = connect(null, mapDispatchToProps)(ExportResultsButton);

export default ExportResultsButtonContainer;
