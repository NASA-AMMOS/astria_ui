import { connect } from 'react-redux';
import GroupsLoading from 'src/components/activeProduct/GroupsLoading';

const mapStateToProps = (state) => {
  return {
    fetchingInitialData: state.loading.fetchingInitialData,
    fetchingGroups: state.loading.fetchingGroups,
    product: state.imageLayers.layers[0],
  };
};

export default connect(mapStateToProps, null)(GroupsLoading);
