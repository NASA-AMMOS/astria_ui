export const setProductSearchSidebarOpen = (open) => {
  return {
    type: 'SET_PRODUCT_SEARCH_SIDEBAR_OPEN',
    open,
  };
};

export const setProductDetailsSidebarOpen = (open) => {
  return {
    type: 'SET_PRODUCT_DETAILS_SIDEBAR_OPEN',
    open,
  };
};

export const storeEdrList = (activeRows) => {
  return {
    type: 'STORE_EDR_LIST',
    activeRows,
  };
};

export const setSearchTab = (tabIndex) => {
  return {
    type: 'SET_SEARCH_TAB',
    tabIndex,
  };
};

export const setImageTab = (tabIndex) => {
  return {
    type: 'SET_IMAGE_TAB',
    tabIndex,
  };
};
