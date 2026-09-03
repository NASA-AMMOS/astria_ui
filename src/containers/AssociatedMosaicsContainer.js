import { connect } from 'react-redux';
import AssociatedMosaics from 'src/components/activeProduct/AssociatedMosaics';
import { openHelpArticle } from 'src/actions/helpActions';
import { setActiveSearchProduct } from 'src/actions/activeSearchProduct';

const mapStateToProps = (state) => {
  return {
    overlays: state.imageLayers.layers,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    openHelpArticle(key) {
      dispatch(openHelpArticle(key));
    },
    setActiveSearchProduct(item) {
      dispatch(setActiveSearchProduct(item, true, true));
    },
  };
};

const AssociatedMosaicsContainer = connect(mapStateToProps, mapDispatchToProps)(AssociatedMosaics);

export default AssociatedMosaicsContainer;
