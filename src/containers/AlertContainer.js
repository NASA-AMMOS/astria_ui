import { connect } from 'react-redux';
import Alert from '../components/common/Alert';
import { doPrimaryAction, doSecondaryAction, hideAlert } from '../actions/alertActions';

const mapStateToProps = (state) => {
  return state.alert;
};

const matchDispatchToProps = (dispatch) => {
  return {
    doPrimaryAction() {
      dispatch(doPrimaryAction());
    },
    doSecondaryAction() {
      dispatch(doSecondaryAction());
    },
    close() {
      dispatch(hideAlert());
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps)(Alert);
