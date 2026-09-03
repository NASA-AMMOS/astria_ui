import config from 'config.js';
import { USING_CSSO } from 'src/constants/api';
import { defaultStarredMetadataFieldsValue } from 'src/reducers/constants';

export const fetchUser = () => {
  if (!USING_CSSO) return { type: 'SET_USER', user: {} };

  return async (dispatch) => {
    fetch('/csso_username')
      .then((res) => res.json())
      .then((userInfo) => dispatch({ type: 'SET_USER', user: userInfo }))
      .catch(() => dispatch({ type: 'SET_USER', user: {} }));
  };
};

export const setProductDescriptions = (productDescriptions) => {
  return { type: 'SET_PRODUCT_DESCRIPTIONS', productDescriptions };
};

export const addStarredMetadataField = (field, isVicar = false) => {
  return (dispatch, getState) => {
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

export const clearStarredMetadataFields = () => {
  return { type: 'SET_STARRED_METADATA_FIELDS', fields: defaultStarredMetadataFieldsValue };
};
