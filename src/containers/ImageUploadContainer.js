import { connect } from 'react-redux';
import ImageUpload from '../components/ImageUpload';
import { setActiveSearchProduct } from '../actions/activeSearchProduct';

const matchDispatchToProps = (dispatch) => {
  return {
    setActiveSearchProduct(item) {
      dispatch(setActiveSearchProduct(item));
    },
  };
};

export default connect(null, matchDispatchToProps)(ImageUpload);
