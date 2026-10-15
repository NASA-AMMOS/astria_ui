import { getConfig } from 'src/utils/configRegistry';
export function assign(oldState, newState) {
  return Object.assign({}, oldState, newState);
}

export function getOCSPackagesQuery(ocsPackages) {
  // where ocsPackages has the structure:
  // { active: '<active_package>', base: Set<'package1','package2',...>}

  // janky and brittle workaround of packages
  const config = getConfig();
  if (config.feature_flags.general.enable_package_selection) {
    return {
      terms: {
        [config.es_mappings.package_name.key]: Array.from(new Set([ocsPackages.active, ...ocsPackages.base])),
      },
    };
  }
  return null;
}
