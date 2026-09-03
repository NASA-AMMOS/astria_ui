import { connect } from 'react-redux';
import Help from 'src/components/Help';
import { setHelpOpen, setHelpArticle } from 'src/actions/helpActions';

const mapStateToProps = (state) => {
  return {
    open: state.help.open,
    activeArticleKey: state.help.activeArticleKey,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setHelpOpen(open) {
      dispatch(setHelpOpen(open));
    },
    setHelpArticle(open) {
      dispatch(setHelpArticle(open));
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Help);
