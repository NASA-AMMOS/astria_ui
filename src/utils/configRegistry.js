let _config = null;

export const setConfig = (cfg) => {
  _config = cfg;
};

export const getConfig = () => {
  if (!_config) throw new Error('Runtime config has not been loaded yet');
  return _config;
};

export const getConfigOrNull = () => _config;
