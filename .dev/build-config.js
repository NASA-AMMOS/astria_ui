import FileSystem, { readFileSync } from 'fs';
import merge from 'lodash.merge';
import Path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = Path.dirname(__filename);

// get config paths from env vars
const output_config_path = Path.resolve(
  process.env.ASTRIA_CONFIG_BUILD_OUTPUT_PATH || Path.resolve(__dirname, '../src/constants/config.json')
);
let src_config_paths = process.env.ASTRIA_CONFIG_BUILD_SRC_PATHS || '';
src_config_paths = src_config_paths
  .split(',')
  .filter((p) => p)
  .map((p) => Path.resolve(p));
src_config_paths.unshift(Path.resolve('./configs/config.common.json')); // make the default config the base

const loadJSON = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));

// check that we have configs to merge
if (src_config_paths.length > 0) {
  // merge all listed configs together
  let config = {};
  for (const ext_p of src_config_paths) {
    if (!FileSystem.existsSync(ext_p)) {
      throw new Error(`Config file does not exist: ${ext_p}`);
    } else {
      const f = loadJSON(ext_p);
      config = merge(config, f);
    }
  }

  // overwrite specific fields from ENV
  const env_overrides = {
    app_version: process.env.ASTRIA_APP_VERSION || process.env.npm_package_version,
  };
  config = merge(config, env_overrides);

  // write out config
  FileSystem.writeFile(output_config_path, JSON.stringify(config, null, 2), (err) => {
    if (err) throw err;
  });
} else {
  throw new Error('No configs found');
}
