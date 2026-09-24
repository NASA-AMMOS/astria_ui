import { createDefaultStarredMetadataFieldsValue } from '../reducers/constants';

export const fetchUser = () => (dispatch, getState) => {
  const { config } = getState();
  if (!config.using_csso) {
    dispatch({ type: 'SET_USER', user: {} });
    return;
  }

  fetch('/csso_username')
    .then((res) => res.json())
    .then((userInfo) => dispatch({ type: 'SET_USER', user: userInfo }))
    .catch(() => dispatch({ type: 'SET_USER', user: {} }));
};

export const setProductDescriptions = (productDescriptions) => {
  return { type: 'SET_PRODUCT_DESCRIPTIONS', productDescriptions };
};

export const addStarredMetadataField = (field, isVicar = false) => {
  return (dispatch, getState) => {
    const { config } = getState();
    const fields = getState().app.starredMetadataFields;
    if (!isVicar && fields.ocs.indexOf(field) === -1) {
      fields.ocs = [...fields.ocs, field];
    }
    if (isVicar && fields[config.label_key].indexOf(field) === -1) {
      fields[config.label_key] = [...fields[config.label_key], field];
    }
    const newFields = { ...fields };
    dispatch({ type: 'SET_STARRED_METADATA_FIELDS', fields: newFields });
  };
};

export const removeStarredMetadataField = (field, isVicar = false) => {
  return (dispatch, getState) => {
    const { config } = getState();
    const fields = getState().app.starredMetadataFields;
    if (!isVicar && fields.ocs.indexOf(field) > -1) {
      fields.ocs = fields.ocs.filter((f) => f !== field);
    }
    if (isVicar && fields[config.label_key].indexOf(field) > -1) {
      fields[config.label_key] = fields[config.label_key].filter((f) => f !== field);
    }
    const newFields = { ...fields };
    dispatch({ type: 'SET_STARRED_METADATA_FIELDS', fields: newFields });
  };
};

export const clearStarredMetadataFields = () => (dispatch, getState) => {
  const { config } = getState();
  dispatch({ type: 'SET_STARRED_METADATA_FIELDS', fields: createDefaultStarredMetadataFieldsValue(config) });
};
