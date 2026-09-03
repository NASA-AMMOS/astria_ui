import { connect } from 'react-redux';
import DataCursorControl from 'src/components/activeProduct/DataCursorControl';
import { setDataCursorExternally, clearDataCursor } from 'src/actions/dataCursor';

const mapDispatchToProps = (dispatch) => {
  return {
    addDataCursor(product, sample, line) {
      dispatch(setDataCursorExternally({ active: true, product, line, sample, cursorOrigin: 'IMAGE' }));
    },
    removeDataCursor() {
      dispatch(clearDataCursor());
    },
  };
};

const DataCursorControlContainer = connect(null, mapDispatchToProps)(DataCursorControl);

export default DataCursorControlContainer;
