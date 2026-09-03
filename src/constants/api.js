import config from '../../configs/config.js';

export const IMAGE_TILER_SERVICE = config.tile_service_url;
export const USING_CSSO = config.using_csso;
export const PERMISSIONS = {
  users: config.users_list,
  admins: config.admins_list,
  port: config.port,
};
export const PROD_MODE = config.prod_mode;
export const ES_URL = config.es_url;
export const ES_TYPE = config.es_type;
export const ES_BASE_QUERY_STRING = ES_TYPE ? `${ES_URL}/${ES_TYPE}/_search?` : `${ES_URL}/_search?`;
