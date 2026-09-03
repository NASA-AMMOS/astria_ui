import { clearSelectedFootprint } from './imageLayers';

export const updateLineSample = (currentLine, currentSample) => {
  return {
    type: 'UPDATE_LINE_SAMPLE',
    line: currentLine,
    sample: currentSample,
  };
};

export const setDataCursor = (options) => async (dispatch, getState) => {
  dispatch(clearSelectedFootprint());
  dispatch({ type: 'SET_DATA_CURSOR', options });
};

export const setDataCursorExternally = (options) => async (dispatch, getState) => {
  // Add data cursor directly to OSD
  const state = getState();
  const osdRefs = state.imageViewer.osdRefs;
  const { osdWrapper } = osdRefs;
  if (options.line !== -1 && options.sample !== -1) {
    osdWrapper.addDataCursor({
      lsPoint: { line: options.line, sample: options.sample },
      cursorOrigin: options.cursorOrigin,
    });
  } else {
    osdWrapper.removeDataCursor();
  }

  // Set data cursor in state
  dispatch(setDataCursor(options));
};

export const clearDataCursor = () => {
  return { type: 'CLEAR_DATA_CURSOR' };
};
