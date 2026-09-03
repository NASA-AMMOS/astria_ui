import { connect } from 'react-redux';
import AuthAlerter from '../components/common/AuthAlerter';
import { showAlert as showAlertAction } from '../actions/alertActions';

const matchDispatchToProps = (dispatch) => {
  return {
    showAlert(alert) {
      dispatch(showAlertAction(alert));
    },
  };
};

export default connect(null, matchDispatchToProps)(AuthAlerter);
