export const debugMode = () => {
  return (dispatch, getState) => {
    const state = getState();
    const osdRefs = state.imageViewer.osdRefs;
    const { osdWrapper } = osdRefs;

    osdWrapper.setDebugMode(!state.debugMode.debugState);

    dispatch({
      type: 'TOGGLE_DEBUG',
    });
  };
};
