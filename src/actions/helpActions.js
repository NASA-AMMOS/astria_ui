export const setHelpOpen = (open) => {
  return {
    type: 'SET_HELP_OPEN',
    open,
  };
};
export const setHelpArticle = (key) => {
  return {
    type: 'SET_HELP_ARTICLE',
    key,
  };
};

export const openHelpArticle = (key) => (dispatch) => {
  dispatch(setHelpArticle(key));
  dispatch(setHelpOpen(true));
};
