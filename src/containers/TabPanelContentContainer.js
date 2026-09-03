import { connect } from 'react-redux';
import { openHelpArticle } from 'src/actions/helpActions';
import TabPanelContent from 'src/components/TabPanelContent';

const mapDispatchToProps = (dispatch) => {
  return {
    openHelpArticle(key) {
      dispatch(openHelpArticle(key));
    },
  };
};

export default connect(null, mapDispatchToProps)(TabPanelContent);
