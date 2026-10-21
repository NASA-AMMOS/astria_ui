import centroid from '@turf/centroid';
import circle from '@turf/circle';
import cleanCoords from '@turf/clean-coords';
import distance from '@turf/distance';
import { polygon } from '@turf/helpers';
import transformRotate from '@turf/transform-rotate';
import Papa from 'papaparse';
import { getOCSPackagesQuery } from 'src/reducers/utils';
import {
  convertToMeters,
  deg2rad,
  determineBestImageInGroup,
  getESBaseQueryString,
  isAnnotation,
  isCustomProduct,
  isFeature,
  isMosaic,
  isSingleFrame,
  isTile,
  latLonToOrbitalCoords,
  metersToDegrees,
  orbitalCoordsToLatLon,
  parseWKTString,
  performElasticSearchQuery,
  rad2deg,
  round,
} from 'src/utils';
import { getModelForProduct } from 'src/utils/asttroLib/cameraModels';
import * as coordinateConversionHelpers from 'src/utils/asttroLib/coordinateConversionHelpers';
import * as frameDefinition from 'src/utils/asttroLib/frameDefinition';
import * as frameConversion from 'src/utils/asttroLib/frames';
import { Target } from 'src/utils/asttroLib/target';
import * as TargetType from 'src/utils/asttroLib/targetType';
import { Vector3 as ASTTROVector3 } from 'src/utils/asttroLib/vector3';
import { parseVicarLabel } from 'src/utils/asttroLib/vicar';
import { getConfig } from 'src/utils/configRegistry';
import { datadriveGetOCSObjectDownloadPathForOCSURL, pdsGetS3PathForImage } from 'src/utils/endpoints';
import { getNormalizeImageLabel } from 'src/utils/labels';
import { getDescendantProp, getPropFromProduct, groupProductsBy } from 'src/utils/sharedUtils';
import * as telemetry from 'src/utils/telemetryUtils';
import { Vector2, Vector3 } from 'three';

const targetsControllers = [];
const cachedPlacesOffsets = {};

export function getImageRankingCriteriaKeys() {
  return getConfig().image_ranking_criteria.map((x) => x.key);
}
export function getSearchBaseKeyInclusionSet() {
  return Array.from(new Set(getImageRankingCriteriaKeys().concat(getConfig().search_config.search_base_includes)));
}

export function abortRequestControllers() {
  // abort all the controllers
  targetsControllers.forEach((controller) => controller.abort());

  // empty out the arrays
  targetsControllers.splice(0, targetsControllers.length);
}

export async function performESImageSearch(options) {
  const config = getConfig();
  const {
    query,
    size = 1000,
    groupResults = false,
    groupByKey = config.es_mappings.group_id.key,
    from,
    excludes,
    includes,
    sort,
    signal,
    exactCount = false,
    flattenAll = false,
  } = options;

  const body = { query, size };
  if (typeof from === 'number' && from > 0) {
    body.from = from;
  }
  if (Array.isArray(sort)) {
    body.sort = sort;
  }

  if (config.es_version >= 7) {
    // Configure limit at which ES will return "> limit" or use exact count if requested
    if (exactCount) body.track_total_hits = true;
    else body.track_total_hits = config.search_config.exact_results_max;
  }

  if (groupResults) {
    if (typeof groupResults === 'boolean') {
      body.aggs = {
        group_count: {
          cardinality: {
            field: groupByKey,
          },
        },
      };
      const collapseSource = {};
      if (excludes) collapseSource.excludes = excludes;
      if (includes) collapseSource.includes = includes;
      body.collapse = {
        field: groupByKey,
        inner_hits: {
          size: 500,
          name: 'group_members',
          _source: collapseSource,
        },
      };
      body._source = { includes: [], excludes: ['*'] };
    } else {
      if (groupResults.aggs) {
        body.aggs = groupResults.aggs;
      }
      if (groupResults.collapse) {
        body.collapse = groupResults.collapse;
      }
    }
  } else {
    body._source = {};
    if (excludes) body._source.excludes = excludes;
    if (includes) body._source.includes = includes;
  }

  try {
    const json = await performElasticSearchQuery(body, signal);
    if (!json.hits || !json.hits.hits) {
      throw new Error('Bad ES response');
    }

    const esResponse = json;
    let numberOfResults = 0;
    let numberOfResultsLabel = undefined; // only want to assign a value if there is a configured field
    let finalResults = [];
    let isExactCount = true;
    if (groupResults && esResponse.aggregations) {
      let bestImages = [];
      if (flattenAll) {
        // find all _source products reported
        const groupMembers = esResponse.hits.hits.map((group) =>
          group.inner_hits.group_members.hits.hits.map((x) => x._source)
        );
        groupMembers.forEach((group) => {
          group.forEach((item) => {
            item._group = [item];
            bestImages.push(item);
          });
        });

        // remove duplicates
        bestImages = bestImages.reduce(
          (acc, item) => {
            const id = getPropFromProduct(item, config.es_mappings.id);
            if (acc.map[id]) {
              return acc;
            }
            acc.map[id] = true;
            acc.list.push(item);
            return acc;
          },
          { map: {}, list: [] }
        ).list;
      } else {
        const groupMembers = esResponse.hits.hits.map((group) =>
          group.inner_hits.group_members.hits.hits.map((x) => x._source)
        );
        groupMembers.forEach((group) => {
          const images = [];
          const annotations = [];
          const imageFeatures = [];
          group.forEach((item) => {
            if (isAnnotation(item)) {
              item._group = [item];
              bestImages.push(item);
              annotations.push(item);
            } else if (isFeature(item)) {
              item._group = [item];
              bestImages.push(item);
              imageFeatures.push(item);
            } else images.push(item);
          });

          if (images.length > 0) {
            // Compute best image within the group
            const bestImage = determineBestImageInGroup(images, config.image_ranking_criteria);

            bestImage._group = images; // Note, this may not be the full group since it's filtered by the base query, so TODO about the hover filename product group list..?
            bestImages.push(bestImage);
          }
        });
      }

      numberOfResults = esResponse.aggregations.group_count.value;
      if (esResponse.aggregations.label_count) numberOfResultsLabel = esResponse.aggregations.label_count.value;
      finalResults = bestImages;
    } else {
      const images = esResponse.hits.hits.map((x) => x._source);
      if (config.es_version < 7) {
        numberOfResults = esResponse.hits.total;
      } else {
        numberOfResults = esResponse.hits.total.value;
        isExactCount = esResponse.hits.total.relation === 'eq';
      }
      finalResults = images;
    }

    return { results: finalResults, numberOfResults, isExactCount, numberOfResultsLabel };
  } catch (err) {
    return { error: err };
  }
}

export const getBaseSearchQuery = (ocsPackages, packagesOnly = false) => {
  const config = getConfig();
  const ocsPackagesQuery = getOCSPackagesQuery(ocsPackages);
  const baseQueries = ocsPackagesQuery ? [getOCSPackagesQuery(ocsPackages)] : [];

  if (!packagesOnly) {
    const extensionExcludes = config.search_config.extension_excludes || null;
    const obj = {
      bool: {
        should: [
          { match: { [config.es_base_filter.key]: config.es_base_filter.value } },
          // { match: { [config.es_mappings.object_type.key]: config.object_type_mappings.annotation } },
          // { match: { [config.es_mappings.object_type.key]: config.object_type_mappings.image_feature } },
        ],
      },
    };
    if (extensionExcludes) {
      obj.bool.must_not = [{ match: { [config.es_mappings.ext.key]: config.search_config.extension_excludes } }];
    }
    baseQueries.push(obj);
  }

  return baseQueries;
};

export const fetchSavedSearches = (username) => {
  return new Promise((resolve, reject) => {
    const config = getConfig();
    const ES_QUERY_STRING = `${config.es_url}/${config.saved_search_upload.es_type}/_search?`;

    const body = {
      query: {
        bool: {
          must: [
            {
              match: {
                [config.es_mappings.package_name.key]: config.annotation_upload.pkg_name,
              },
            },
            {
              match: {
                [config.es_mappings.created_by.key]: username,
              },
            },
            {
              query_string: {
                query: `${username}-saved-searches.json`,
                fields: ['ocs_name'],
              },
            },
          ],
        },
      },
      size: 1,
    };

    fetch(ES_QUERY_STRING, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      ...(config.using_csso ? { credentials: 'include' } : null),
      body: JSON.stringify(body),
    })
      .then((response) => {
        if (!response.ok) {
          reject(new Error(response.statusText));
          return null;
        }
        return response.json();
      })
      .then((json) => {
        if (!json.hits || !json.hits.hits || !json.hits.hits.length) {
          resolve();
        } else {
          const esResult = json.hits.hits[0]._source;
          resolve(esResult);
        }
      })
      .catch((err) => reject(err));
  });
};

export const fetchProductGroupItems = (product, signal, ocsPackages) => {
  return new Promise((resolve, reject) => {
    const config = getConfig();
    const groupId = getDescendantProp(product, config.es_mappings.group_id.key);

    const fetchQuery = (body) => {
      return new Promise((res, rej) => {
        fetch(getESBaseQueryString(), {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(body),
          signal,
          ...(config.using_csso ? { credentials: 'include' } : null),
        })
          .then((response) => {
            if (!response.ok) {
              rej(new Error(response.statusText));
              return null;
            }
            return response.json();
          })
          .then((json) => {
            if (!json.hits) {
              rej(new Error('empty json response'));
            } else {
              let data = json.hits.hits;
              if (data.length) data = data.map((x) => x._source);
              res(data);
            }
          })
          .catch((err) => {
            if (err.name !== 'AbortError') {
              rej(err);
            }
          });
      });
    };

    // fetch all overlays
    const overlayProm = new Promise((res, rej) => {
      const ocsPackagesQuery = getOCSPackagesQuery(ocsPackages);
      const must = [];
      if (ocsPackagesQuery) {
        must.push(ocsPackagesQuery);
      }
      const body = {
        size: 1000,
        query: {
          bool: {
            must: must.concat([
              {
                bool: {
                  ...(config.search_config.extension_excludes
                    ? {
                        must_not: {
                          match: { [config.es_mappings.ext.key]: config.search_config.extension_excludes },
                        },
                      }
                    : {}),
                  must: [
                    {
                      match: {
                        [config.es_mappings.group_id.key]: groupId,
                      },
                    },
                  ],
                },
              },
            ]),
          },
        },
      };

      fetchQuery(body)
        .then((groups) => res(groups))
        .catch((err) => {
          if (err.name !== 'AbortError') {
            rej(err);
          }
        });
    });

    const promises = [overlayProm];
    if (config.feature_flags.active_product.enable_annotations) {
      // fetch all annotations and image features
      const annoProm = new Promise((res, rej) => {
        const body = {
          query: {
            bool: {
              must: [
                {
                  match: {
                    [config.es_mappings.annotation.base_group_id.key]: groupId,
                  },
                },
              ],
              should: [
                { match: { [config.es_mappings.object_type.key]: 'm20-mv-annotation' } },
                { match: { [config.es_mappings.object_type.key]: 'm20-image-feature' } },
              ],
            },
          },
          size: 1000, // quick patch to avoid paging in 99.99% of cases
        };

        fetchQuery(body)
          .then((annotations) => {
            res(
              annotations.map((anno) => {
                if (anno.feature_id && !anno.annotation_id) {
                  anno.annotation_id = anno.feature_id;
                }
                return anno;
              })
            );
          })
          .catch((err) => {
            if (err.name !== 'AbortError') {
              rej(err);
            }
          });
      });
      promises.push(annoProm);
    }

    Promise.all(promises)
      .then((data) => {
        resolve(data.flat());
      })
      .catch((err) => {
        reject(err);
      });
  });
};

export const fetchESDataForProduct = (productId, signal, keyOverride = '', size = 1, includeType = true) => {
  return new Promise((resolve, reject) => {
    const config = getConfig();
    const ES_QUERY_STRING = `${config.es_url}${includeType && config.es_type ? `/${config.es_type}` : ''}/_search?`;

    const key = keyOverride || [config.es_mappings.id.key];
    const body = {
      query: {
        match: {
          [key]: productId,
        },
      },
      size,
    };

    fetch(ES_QUERY_STRING, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      ...(config.using_csso ? { credentials: 'include' } : null),
      body: JSON.stringify(body),
    })
      .then((response) => {
        if (!response.ok) {
          reject(new Error(response.statusText));
          return null;
        }
        return response.json();
      })
      .then((json) => {
        if (!json.hits || !json.hits.hits || !json.hits.hits.length) {
          resolve();
        } else {
          const esResult = json.hits.hits[0]._source;
          resolve(esResult);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          reject(err);
        }
      });
  });
};

export const fetchDataForProduct = (product, line, sample, signal) => {
  return new Promise(async (resolve, reject) => {
    const config = getConfig();
    let fileUrl = getPropFromProduct(product, config.es_mappings.img_url);
    if (config.data_provider_type === 'pds') {
      // fileUrl = await pdsFetchDownloadPath(product, signal);
      fileUrl = pdsGetS3PathForImage(product);
    }
    const url = `${config.data_query_service_url}?line=${line}&sample=${sample}&url=${fileUrl}&label=true`;

    fetch(url, { credentials: 'include', signal })
      .then((response) => {
        if (!response.ok) {
          throw Error(response.statusText);
        } else {
          return response.json();
        }
      })
      .then((result) => {
        resolve(result);
      })
      .catch((err) => {
        reject(err);
      });
  });
};

/**
 * 0: mosaic
 * 1: single frame non-mosaic
 * -1: unknown
 */
export const EDRType = (product) => {
  const config = getConfig();
  if (config.label_key === 'vicar_label') {
    const vicar = product.vicar_label;
    // need a vicar label and no thumbnails
    if (vicar && getPropFromProduct(product, config.es_mappings.size_type) === 'Full') {
      // check for mosaic
      if (
        vicar.SURFACE_MODEL_PARMS &&
        vicar.SURFACE_MODEL_PARMS.SURFACE_MODEL_TYPE === 'PLANE' &&
        vicar.SURFACE_PROJECTION_PARMS.MAP_PROJECTION_TYPE === 'CYLINDRICAL'
      ) {
        return 0;
      }

      // check for simple non-mosaic
      if (vicar.GEOMETRIC_CAMERA_MODEL) {
        return 1;
      }
    }
    return -1;
  } else if (config.label_key === 'pds4_label') {
    const pds4 = product.pds4_label;
    // need a pds4 label and no thumbnails
    if (
      pds4 &&
      (getPropFromProduct(product, config.es_mappings.size_type).toLowerCase() === 'regular' ||
        getPropFromProduct(product, config.es_mappings.size_type).toLowerCase() === 'miscellaneous')
    ) {
      // check for mosaic
      // TODO double check how to detect single and mosaic for pds4?
      // TODO how to get map resolution from pds4?
      if (
        (getPropFromProduct(product, config.es_mappings.surface_model).toLowerCase() === 'planar' &&
          getPropFromProduct(product, config.es_mappings.projection).toLowerCase().indexOf('cylindrical') > -1) ||
        (product.vicar_label &&
          product.vicar_label.SURFACE_MODEL_PARMS &&
          product.vicar_label.SURFACE_MODEL_PARMS.SURFACE_MODEL_TYPE === 'PLANE' &&
          product.vicar_label.SURFACE_PROJECTION_PARMS.MAP_PROJECTION_TYPE.indexOf('CYLINDRICAL') > -1)
      ) {
        return 0;
      }

      // check for simple non-mosaic
      if (
        pds4['geom:Camera_Model_Parameters/geom:model_type'] ||
        (product.vicar_label && product.vicar_label.GEOMETRIC_CAMERA_MODEL)
      ) {
        return 1;
      }
    }
    return -1;
  }
  return -1;
};

export const matchingRdrExists = (baseImage, groups, rdrArr) => {
  const config = getConfig();
  const latestMatchingProducts = getLatestVersionsForOverlayId(
    groups,
    getPropFromProduct(baseImage, config.es_mappings.overlay_id)
  );

  if (!Array.isArray(rdrArr)) {
    rdrArr = [rdrArr];
  }

  // return true if any of the specified RDR types exist
  const rdrProduct = latestMatchingProducts.find(
    (product) => rdrArr.indexOf(getPropFromProduct(product, config.es_mappings.product_type)) > -1
  );
  return typeof rdrProduct !== 'undefined';
};

// like matchingRdrExists but it assumes the the rdrArr is prioritized and
// will return type that was found (if any was)
export const matchingRdrExistsPriority = (baseImage, groups, rdrArr) => {
  const config = getConfig();
  const latestMatchingProducts = getLatestVersionsForOverlayId(
    groups,
    getPropFromProduct(baseImage, config.es_mappings.overlay_id)
  );

  if (!Array.isArray(rdrArr)) {
    rdrArr = [rdrArr];
  }

  // return true if any of the specified RDR types exist
  for (let i = 0; i < rdrArr.length; ++i) {
    const rdrType = rdrArr[i];
    const rdrProduct = latestMatchingProducts.find(
      (product) => getPropFromProduct(product, config.es_mappings.product_type) === rdrType
    );
    if (typeof rdrProduct !== 'undefined') {
      return rdrType;
    }
  }
  return false;
};

export const getMatchingRdr = (baseImage, groups, rdr, preferredImageForType) => {
  const config = getConfig();
  const latestMatchingProducts = getLatestVersionsForOverlayId(
    groups,
    getPropFromProduct(baseImage, config.es_mappings.overlay_id),
    preferredImageForType,
    getPropFromProduct(baseImage, config.es_mappings.spec_flag)
  );

  const rdrProduct = latestMatchingProducts.find(
    (product) => getPropFromProduct(product, config.es_mappings.product_type) === rdr
  );
  return rdrProduct;
};

// like getMatchingRdr but assumes the input is an array of rdr types
// that include fallback types sorted in priority order
export const getMatchingRdrPriority = (baseImage, groups, rdrArr, preferredImageForType) => {
  const config = getConfig();
  const latestMatchingProducts = getLatestVersionsForOverlayId(
    groups,
    getPropFromProduct(baseImage, config.es_mappings.overlay_id),
    preferredImageForType,
    getPropFromProduct(baseImage, config.es_mappings.spec_flag)
  );

  if (!Array.isArray(rdrArr)) {
    rdrArr = [rdrArr];
  }

  // return true if any of the specified RDR types exist
  for (let i = 0; i < rdrArr.length; ++i) {
    const rdrType = rdrArr[i];
    const rdrProduct = latestMatchingProducts.find(
      (product) => getPropFromProduct(product, config.es_mappings.product_type) === rdrType
    );
    if (typeof rdrProduct !== 'undefined') {
      return rdrProduct;
    }
  }
  return false;
};

export const measureSupported = (baseImage, groups) => {
  return matchingRdrExistsPriority(baseImage, groups, ['XYZ', 'XYM', 'XYR']);
};

export const scaleDataSupported = (baseImage, groups) => {
  const config = getConfig();
  // TODO support scale data for PDS4 labels
  if (config.data_provider_type === 'pds' && !baseImage.vicar_label) {
    return false;
  }

  const type = EDRType(baseImage);
  if (type >= 0) {
    if (type === 1) {
      // standard single frames
      if (matchingRdrExists(baseImage, groups, ['RNG', 'XYZ', 'XYM'])) {
        return true;
      } else {
        // special cases for specific instruments
        const inst = getPropFromProduct(baseImage, config.es_mappings.instrument_id);
        return (
          (inst === 'SC' && scaleDataSupportedACI(baseImage)) ||
          (inst === 'SI' && scaleDataSupportedWATSON(baseImage)) ||
          (inst === 'LR' && scaleDataSupportedRMI(baseImage))
        );
      }
    }
    return true;
  }
  return false;
};

export const getScaleData = (baseImage, groups, line, sample, preferredImageForType, signal) => {
  const config = getConfig();
  // TODO support scale data for PDS4 labels
  if (config.data_provider_type === 'pds' && !baseImage.vicar_label) {
    return new Promise((resolve, reject) => {
      reject(new Error('Cannot get scale for this image'));
    });
  }

  // for all image types, the magic formula is:
  // pixelSize = range * Math.tan(iFOV);
  const type = EDRType(baseImage);
  if (type >= 0) {
    if (type === 0) {
      return getScaleDataMosaic(baseImage, groups, line, sample, preferredImageForType, signal);
    }
    if (type === 1) {
      if (matchingRdrExists(baseImage, groups, ['RNG', 'XYZ', 'XYM'])) {
        return getScaleDataSimpleNonMosaic(baseImage, groups, line, sample, preferredImageForType, signal);
      } else {
        // instrument specific scale calculations
        const inst = getPropFromProduct(baseImage, config.es_mappings.instrument_id);
        if (inst === 'SI') {
          return getScaleForWATSON({ baseImage });
        } else if (inst === 'SC') {
          return getScaleForACI({ baseImage });
        } else if (inst === 'LR') {
          return getScaleForRMI({ baseImage });
        }
      }
    }
  }
  return new Promise((resolve, reject) => {
    reject(new Error('Cannot get scale for this image'));
  });
};

function getScaleDataMosaic(baseImage, groups, line, sample, preferredImageForType, signal) {
  const config = getConfig();
  const vicar = baseImage.vicar_label;
  return new Promise(async (resolve, reject) => {
    // calculate the iFOV from the map resolution
    let iFOV;
    // TODO map resolution is broken up into two fields in pds4..
    // cart:Cylindrical/cart:pixel_scale_x and cart:Cylindrical/cart:pixel_scale_y
    // so will need a utility to get this from a product.
    const mapResolution = vicar.SURFACE_PROJECTION_PARMS.MAP_RESOLUTION.map((x) => parseFloat(x));
    const mapResolutionUnit = vicar.SURFACE_PROJECTION_PARMS.MAP_RESOLUTION__UNIT;
    if (mapResolutionUnit) {
      if (mapResolutionUnit[0].toLowerCase().indexOf('deg') > -1) {
        iFOV = mapResolution.reduce((acc, res) => deg2rad(1 / res) + acc, 0) / 2;
      } else if (mapResolutionUnit[0].toLowerCase().indexOf('rad') > -1) {
        iFOV = mapResolution.reduce((acc, res) => 1 / res + acc, 0) / 2;
      } else {
        reject(new Error('Could not determine iFOV'));
      }
    } else {
      reject(new Error('Could not determine iFOV'));
    }

    // pull necessary fields from vicar label
    const startAzimuth = parseFloat(vicar.SURFACE_PROJECTION_PARMS.START_AZIMUTH);
    const zeroElevationLine = parseFloat(vicar.SURFACE_PROJECTION_PARMS.ZERO_ELEVATION_LINE);
    const projectionOriginVector = new Vector3(
      ...vicar.SURFACE_PROJECTION_PARMS.PROJECTION_ORIGIN_VECTOR.map((x) => parseFloat(x))
    );
    const surfaceGroundLocation = new Vector3(
      ...vicar.SURFACE_MODEL_PARMS.SURFACE_GROUND_LOCATION.map((x) => parseFloat(x))
    );
    const surfaceNormalVector = new Vector3(
      ...vicar.SURFACE_MODEL_PARMS.SURFACE_NORMAL_VECTOR.map((x) => parseFloat(x))
    );

    // construct unit vector in look direction
    // MSL camera SIS section 5.2.1.13.4
    const azimuth = deg2rad(sample / mapResolution[0] + startAzimuth);
    const elevation = deg2rad((zeroElevationLine - line) / mapResolution[1]);

    // convert az/el to unit vector
    const rc = Math.cos(elevation);
    const lookDirX = rc * Math.cos(azimuth);
    const lookDirY = rc * Math.sin(azimuth);
    const lookDirZ = Math.sin(elevation);
    const lookDirection = new Vector3(lookDirX, lookDirY, lookDirZ);

    // ((ground - origin) dot normal) is the perp. distance to the plane.
    // (look_direction dot normal) is the projection of the look direction onto
    // that perpendicular.  Then by similar triangles, the ratio is multiplied
    // by the look direction to get the vector to the intercept point.
    const lookDirProj = lookDirection.dot(surfaceNormalVector);
    const ratio = surfaceGroundLocation.clone().sub(projectionOriginVector).dot(surfaceNormalVector) / lookDirProj;
    const intersectionPoint = projectionOriginVector.clone().add(lookDirection.clone().multiplyScalar(ratio));

    // range is now the distance from the origin to the calculated intersection
    const range = intersectionPoint.clone().sub(projectionOriginVector).length();

    // calculate the iFOV from the map resolution and calculate pixel size
    const pixelSize = range * Math.tan(iFOV);
    const surfaceModelResult = { pixelSize, approximate: true };

    // check if we have an xyz product for this mosaic
    const xyzProduct = getMatchingRdr(baseImage, groups, 'XYZ', preferredImageForType);

    // if we have an xyz product, attempt to resolve the scale from that
    // we calculate it ourselves as a fallback if there is not xyz data at this point
    if (typeof xyzProduct !== 'undefined') {
      try {
        let xyzVicarLabel = xyzProduct.vicar_label;
        if (!xyzVicarLabel) {
          xyzVicarLabel = await getNormalizeImageLabel(xyzProduct);
          if (xyzVicarLabel) {
            // TODO - update the base layer with the new vicar label (dispatch doesn't work from here)
            // newBaseLayer = { ...newBaseLayer, vicar_label: xyzVicarLabel };
            // dispatch({ type: 'UPDATE_LAYER', layer: newBaseLayer });
          } else {
            console.warn('Failed to generate VICAR label for XYZ product');
            resolve(surfaceModelResult);
          }
        }
        // translate the projection origin to match the XYZ product
        // both should either be in LOCAL_LEVEL or SITE frame
        const xyzFrame = xyzVicarLabel.DERIVED_IMAGE_PARMS.REFERENCE_COORD_SYSTEM_NAME;
        const imageCameraModel = getModelForProduct(baseImage);
        let translatedOrigin = imageCameraModel.origin;
        const queryFrame = `rover(${vicar.SURFACE_PROJECTION_PARMS.REFERENCE_COORD_SYSTEM_INDEX.join(',')})`; // PLACES doesn't know about LL
        const xyzQueryFrame = `site(${
          xyzVicarLabel.SITE_COORDINATE_SYSTEM
            ? xyzVicarLabel.SITE_COORDINATE_SYSTEM.COORDINATE_SYSTEM_INDEX
            : getPropFromProduct(xyzProduct, config.es_mappings.site)
        })`;
        if (imageCameraModel.origin.frame.indexOf('LEVEL') !== -1 && xyzFrame.indexOf('LEVEL') === -1) {
          translatedOrigin = await convertPointWithPlaces({ x: 0, y: 0, z: 0 }, queryFrame, xyzQueryFrame, true); // translate frame origin because PLACES doesn't support LL
          translatedOrigin = {
            x: translatedOrigin[0] + imageCameraModel.origin.x,
            y: translatedOrigin[1] + imageCameraModel.origin.y,
            z: translatedOrigin[2] + imageCameraModel.origin.z,
          };
        } else if (imageCameraModel.origin.frame.indexOf('ROVER') !== -1 && xyzFrame.indexOf('ROVER') === -1) {
          translatedOrigin = await convertPointWithPlaces(
            { x: imageCameraModel.origin.x, y: imageCameraModel.origin.y, z: imageCameraModel.origin.z },
            queryFrame,
            xyzQueryFrame,
            true
          );
          translatedOrigin = {
            x: translatedOrigin[0],
            y: translatedOrigin[1],
            z: translatedOrigin[2],
          };
        }

        // compute scale from the XYZ product
        getScaleDataFromXYZProduct({
          xyzProduct,
          projectionOriginVector: new Vector3(translatedOrigin.x, translatedOrigin.y, translatedOrigin.z),
          line,
          sample,
          iFOV,
          fallback: surfaceModelResult,
          signal,
        })
          .then((data) => resolve(data))
          .catch((err) => {
            console.warn(err);
            resolve(surfaceModelResult);
          });
      } catch (err) {
        console.warn(err);
        resolve(surfaceModelResult);
      }
    } else {
      const rangeProduct = getMatchingRdr(baseImage, groups, 'RNG', preferredImageForType);
      if (typeof rangeProduct !== 'undefined') {
        // compute scale from the range product
        getScaleDataFromRangeProduct({ rangeProduct, line, sample, iFOV, fallback: surfaceModelResult })
          .then((data) => resolve(data))
          .catch((err) => {
            console.warn(err);
            resolve(surfaceModelResult);
          });
      } else {
        resolve(surfaceModelResult);
      }
    }
  });
}

function getSingleFrameIFOV(baseImage, line, sample) {
  const config = getConfig();
  // images line/sample start at (1,1) but camera model math starts at (0,0)
  // assume input line/sample is in image space
  const pixVec1 = new Vector2(sample - 1, line - 1); // target pixel, adjusted for camera model space
  const pixVec2 = new Vector2(
    sample >= getPropFromProduct(baseImage, config.es_mappings.width, 0) - 1 ? sample - 2 : sample,
    line - 1
  ); // pixel next to target, adjusted for camera model space
  const cameraModel = getModelForProduct(baseImage);
  try {
    const ray1 = cameraModel.ProjectRay(pixVec1);
    const ray2 = cameraModel.ProjectRay(pixVec2);
    const dot = ray1.direction.dot(ray2.direction);
    const lengthRatio = dot / (ray1.direction.length() * ray2.direction.length());
    const iFOV = Math.acos(lengthRatio);
    return iFOV;
  } catch (err) {
    console.warn(err);
    return 0;
  }
}

function getScaleDataSimpleNonMosaic(baseImage, groups, line, sample, preferredImageForType, signal) {
  const config = getConfig();
  return new Promise(async (resolve, reject) => {
    // calculate iFOV from camera model
    const iFOV = getSingleFrameIFOV(baseImage, line, sample);

    const rangeProduct = getMatchingRdr(baseImage, groups, 'RNG', preferredImageForType);

    if (typeof rangeProduct !== 'undefined') {
      getScaleDataFromRangeProduct({ rangeProduct, line, sample, iFOV, signal })
        .then((data) => resolve(data))
        .catch((err) => reject(err));
    } else {
      const cameraModel = getModelForProduct(baseImage);
      const xyzProduct = getMatchingRdrPriority(baseImage, groups, ['XYZ', 'XYM'], preferredImageForType);
      if (typeof xyzProduct !== 'undefined') {
        // transform camera model to XYZ site frame
        const vicarProduct = parseVicarLabel(baseImage.vicar_label);
        const camFrame = vicarProduct.CameraModel.frame;

        let xyzVicarLabel = xyzProduct.vicar_label;
        if (!xyzVicarLabel) {
          xyzVicarLabel = await getNormalizeImageLabel(xyzProduct);
          if (xyzVicarLabel) {
            // TODO - update the base layer with the new vicar label (dispatch doesn't work from here)
            // newBaseLayer = { ...newBaseLayer, vicar_label: xyzVicarLabel };
            // dispatch({ type: 'UPDATE_LAYER', layer: newBaseLayer });
          } else {
            reject(new Error('Failed to generate VICAR label for XYZ product'));
          }
        }

        const xyzFrame = `SITE=${
          xyzVicarLabel.SITE_COORDINATE_SYSTEM
            ? xyzVicarLabel.SITE_COORDINATE_SYSTEM.COORDINATE_SYSTEM_INDEX
            : getPropFromProduct(xyzProduct, config.es_mappings.site)
        }`;
        const camCenter = new ASTTROVector3({ ...cameraModel.GetCameraCenter(), frame: camFrame });
        try {
          const camOrigin = await frameConversion.convertPoint(camCenter, xyzFrame);
          getScaleDataFromXYZProduct({
            xyzProduct,
            projectionOriginVector: new Vector3(camOrigin.x, camOrigin.y, camOrigin.z),
            line,
            sample,
            iFOV,
            signal,
          })
            .then((data) => resolve(data))
            .catch((err) => reject(err));
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error('no scale products available'));
      }
    }
  });
}

function getScaleDataFromRangeProduct(options) {
  const { rangeProduct, line, sample, iFOV, fallback, signal } = options;

  return new Promise((resolve, reject) => {
    fetchDataForProduct(rangeProduct, line, sample, signal)
      .then((result) => {
        if (result.hasOwnProperty('range')) {
          // pull range from query
          const range = result.range;

          if (range === 0 && fallback) {
            resolve(fallback); // assume that 0 range is missing data
          } else {
            // calculate pixel size
            const pixelSize = range * Math.tan(iFOV);
            resolve({ pixelSize, approximate: false });
          }
        } else if (fallback) {
          resolve(fallback);
        } else {
          reject(new Error('no range data'));
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          if (fallback) {
            resolve(fallback);
          } else {
            reject(err);
          }
        }
      });
  });
}

function getScaleDataFromXYZProduct(options) {
  const { xyzProduct, projectionOriginVector, line, sample, iFOV, fallback, signal } = options;
  return new Promise((resolve, reject) => {
    // fetch the data
    fetchDataForProduct(xyzProduct, line, sample, signal)
      .then((result) => {
        result = [result.x, result.y, result.z];
        const resultSum = result.reduce((acc, el) => acc + Math.abs(el), 0);
        // sanity check that we have data
        if (resultSum !== 0) {
          // range is now the distance from the origin to the intersection xyz point
          const range = new Vector3(...result).sub(projectionOriginVector).length();

          if (range === 0 && fallback) {
            resolve(fallback); // assume that 0 range is missing data
          } else {
            // calculate pixel size
            const pixelSize = range * Math.tan(iFOV);
            resolve({ pixelSize, approximate: false });
          }
        } else if (fallback) {
          resolve(fallback);
        } else {
          reject(new Error('no xyz data'));
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          if (fallback) {
            resolve(fallback);
          } else {
            reject(err);
          }
        }
      });
  });
}

export function scaleDataSupportedWATSON(baseImage) {
  if (baseImage.vicar_label) {
    const focusMotorCount = getWATSONFocusMotorCount(baseImage);
    // make sure we're between 1.8cm and 210cm
    if (focusMotorCount <= 15420 && focusMotorCount >= 12205) {
      return true;
    }
  }
  return false;
}

export function scaleDataSupportedACI(baseImage) {
  if (baseImage.vicar_label) {
    const focusMotorCount = baseImage.vicar_label.INSTRUMENT_STATE_PARMS.FOCUS_POSITION_COUNT;
    // make sure we're between 40mm and 56mm
    if (focusMotorCount <= 15270 && focusMotorCount >= 12072) {
      return true;
    }
  }
  return false;
}

export function scaleDataSupportedRMI(baseImage) {
  if (baseImage.vicar_label && baseImage.vicar_label.OBSERVATION_REQUEST_PARMS) {
    const focusDistance = parseFloat(baseImage.vicar_label.OBSERVATION_REQUEST_PARMS.INSTRUMENT_FOCUS_DISTANCE);
    const focusDistanceUnit = baseImage.vicar_label.OBSERVATION_REQUEST_PARMS.INSTRUMENT_FOCUS_DISTANCE__UNIT;
    const dist = convertToMeters(focusDistance, focusDistanceUnit);
    // make sure we're less than 31m distant
    if (dist < 31) {
      return true;
    }
  }
  return false;
}

// duplicate the calculations from WATSON_ACI_Calulator_Refined_Oct2021.xlsx
export function getScaleForWATSON(options) {
  return new Promise((resolve, reject) => {
    const { baseImage } = options;

    if (baseImage.vicar_label) {
      const focusMotorCount = getWATSONFocusMotorCount(baseImage);

      // make sure we're between 1.8cm and 210cm
      if (focusMotorCount <= 15420 && focusMotorCount >= 12205) {
        let range = round(
          1 /
            (1091060 / focusMotorCount +
              -332.921 +
              0.0382592 * focusMotorCount +
              -0.00000196922 * focusMotorCount ** 2 +
              0.0000000000384562 * focusMotorCount ** 3),
          2
        );

        let rangeUncertainty = 0.1; // default for small distances
        if (range >= 4.5) {
          rangeUncertainty =
            (1 /
              (1091060 / (focusMotorCount - 15) +
                -332.921 +
                0.0382592 * (focusMotorCount - 15) +
                -0.00000196922 * (focusMotorCount - 15) ** 2 +
                0.0000000000384562 * (focusMotorCount - 15) ** 3) -
              range +
              (range -
                1 /
                  (1091060 / (focusMotorCount + 15) +
                    -332.921 +
                    0.0382592 * (focusMotorCount + 15) +
                    -0.00000196922 * (focusMotorCount + 15) ** 2 +
                    0.0000000000384562 * (focusMotorCount + 15) ** 3))) /
            2;
        }

        let pixelSize =
          6.528 + 3.7261 * range + -0.0057102 * range ** 2 + 0.000040576 * range ** 3 + -0.000000083282 * range ** 4;

        let pixelSizeUncertainty = 0.1; // default for small distances
        if (range >= 2.7) {
          pixelSizeUncertainty =
            (Math.abs(
              pixelSize -
                (7.1244 +
                  3.474 * range +
                  -0.0063308 * range ** 2 +
                  0.000044869 * range ** 3 +
                  -0.00000009283 * range ** 4)
            ) +
              Math.abs(
                pixelSize -
                  (5.897 +
                    3.9814 * range +
                    -0.0051608 * range ** 2 +
                    0.000036832 * range ** 3 +
                    -0.000000075067 * range ** 4)
              )) /
            2;
        }

        // convert range from cm to m
        range /= 100;
        rangeUncertainty /= 100;

        // convert pixel scale from µm to m
        pixelSize /= 1000000;
        pixelSizeUncertainty /= 1000000;
        resolve({
          range,
          rangeUncertainty,
          pixelSize,
          pixelSizeUncertainty,
          approximate: range >= 0.4, // model not as accurate past 40cm
          message: 'success',
        });
      } else {
        reject(new Error('focus outside reliable range'));
      }
    } else {
      reject(new Error('missing vicar label'));
    }
  });
}

export function getWATSONFocusMotorCount(baseImage) {
  if (baseImage.vicar_label) {
    let focusMotorCount = baseImage.vicar_label.INSTRUMENT_STATE_PARMS.FOCUS_POSITION_COUNT;
    if (!getWATSONCoverOpen(baseImage)) {
      // convert cover closed motor count to a cover open motor count
      focusMotorCount = 16890 - focusMotorCount;
    }
    return focusMotorCount;
  }
  return -1;
}

export function getWATSONCoverOpen(baseImage) {
  if (baseImage.vicar_label) {
    const ind = baseImage.vicar_label.MINI_HEADER.INSTRUMENT_STATE_NAME.indexOf('COVER_HALL_STATE');
    return baseImage.vicar_label.MINI_HEADER.INSTRUMENT_STATE[ind] === 'TRUE';
  }
  return false;
}

// duplicate the calculations from WATSON_ACI_Calulator_Refined_Oct2021.xlsx
export function getScaleForACI(options) {
  return new Promise((resolve, reject) => {
    const { baseImage } = options;

    if (baseImage.vicar_label) {
      const focusMotorCount = baseImage.vicar_label.INSTRUMENT_STATE_PARMS.FOCUS_POSITION_COUNT;
      // make sure we're between 40mm and 56mm
      if (focusMotorCount <= 15270 && focusMotorCount >= 12072) {
        let range = 0.005 * focusMotorCount - 20.34;
        let pixelSize = 10.1;

        // convert range from mm to m
        range /= 1000;

        // convert pixel scale from µm to m
        pixelSize /= 1000000;
        resolve({ range, pixelSize, approximate: true });
      } else {
        reject(new Error('focus outside reliable range'));
      }
    } else {
      reject(new Error('missing vicar label'));
    }
  });
}

export function getScaleForRMI(options) {
  return new Promise((resolve, reject) => {
    const config = getConfig();
    const { baseImage } = options;
    if (baseImage.vicar_label) {
      const focusDistance = parseFloat(baseImage.vicar_label.OBSERVATION_REQUEST_PARMS.INSTRUMENT_FOCUS_DISTANCE);
      const focusDistanceUnit = baseImage.vicar_label.OBSERVATION_REQUEST_PARMS.INSTRUMENT_FOCUS_DISTANCE__UNIT;
      const range = convertToMeters(focusDistance, focusDistanceUnit);

      // calculate iFOV from camera model at image center
      const width = getPropFromProduct(baseImage, config.es_mappings.width, 0);
      const height = getPropFromProduct(baseImage, config.es_mappings.height, 0);
      const midSample = parseInt(width / 2);
      const midLine = parseInt(height / 2);
      const iFOV = getSingleFrameIFOV(baseImage, midLine, midSample);

      // calculate scale
      const pixelSize = range * Math.tan(iFOV);
      resolve({ pixelSize, approximate: range >= 15 });
    }
    reject(new Error('missing vicar label'));
  });
}

export function getDistanceMeasurement(baseImage, groups, lsPoint1, lsPoint2, signal, preferredImageForType) {
  return new Promise((resolve, reject) => {
    const xyzProduct = getMatchingRdrPriority(baseImage, groups, ['XYZ', 'XYM', 'XYR'], preferredImageForType);
    if (xyzProduct) {
      // we can't use the getXYZForLineSample with fallbacks because there could be data at one end and not the other
      Promise.all(
        [lsPoint1, lsPoint2].map((point) => fetchDataForProduct(xyzProduct, point.line, point.sample, signal))
      )
        .then((data) => {
          const xyz1 = new Vector3(data[0].x, data[0].y, data[0].z);
          const xyz2 = new Vector3(data[1].x, data[1].y, data[1].z);
          if (xyz1.length() === 0 || xyz2.length() === 0) {
            // query succeeded but no data available
            resolve({ dist: -1, dataAvailable: false, queryOk: true });
          } else {
            // query succeeded and data available
            const dist = xyz2.distanceTo(xyz1);
            resolve({ dist, dataAvailable: true, queryOk: true });
          }
        })
        .catch((err) => {
          let aborted = false;
          if (err.name === 'AbortError') aborted = true;
          resolve({ dist: -1, dataAvailable: false, queryOk: false, aborted });
        });
    } else {
      reject(new Error('no XYZ data'));
    }
  });
}

/**
 * Filters list of products to specified overlay_id and latest version for each product_type
 *
 * @param {Array} ocs products groups list
 * @returns {Array} filtered list of products
 */
export function getLatestVersionsForOverlayId(groups, overlayId, preferredImageForType, specialProcessingFlag) {
  const config = getConfig();
  const matchingOverlayIdProducts = groups.filter(
    (item) => getPropFromProduct(item, config.es_mappings.overlay_id) === overlayId
  );
  return getLatestVersionsByType(matchingOverlayIdProducts, preferredImageForType, specialProcessingFlag);
}

/**
 * Filters list of products to latest version for each product_type
 *
 * @param {Array} list of ocs products
 * @returns {Array} filtered list of products
 */
export function getLatestVersionsByType(products, preferredImageForType = {}, specialProcessingFlag = undefined) {
  const config = getConfig();
  // Group products by type
  const groupedByProductType = groupProductsBy(products, config.es_mappings.product_type);

  // Keep only the latest version for each group of products
  const latestVersionImages = Object.values(groupedByProductType).map((groupedProducts) => {
    // check overrides
    const preferredProduct =
      preferredImageForType[getPropFromProduct(groupedProducts[0], config.es_mappings.product_type)];
    if (preferredProduct) {
      return preferredProduct;
    }
    // find the highest version
    return groupedProducts.reduce((prev, current) => {
      if (specialProcessingFlag) {
        // prev product matches spec_flag and current does not
        if (
          prev &&
          getPropFromProduct(prev, config.es_mappings.spec_flag) === specialProcessingFlag &&
          getPropFromProduct(current, config.es_mappings.spec_flag) !== specialProcessingFlag
        ) {
          return prev;
        }
        // current product matches spec_flag and prev does not
        if (
          prev &&
          getPropFromProduct(prev, config.es_mappings.spec_flag) !== specialProcessingFlag &&
          getPropFromProduct(current, config.es_mappings.spec_flag) === specialProcessingFlag
        ) {
          return current;
        }
      }
      // either both match or neither match
      return +getPropFromProduct(prev, config.es_mappings.version, 0) >
        +getPropFromProduct(current, config.es_mappings.version, 0)
        ? prev
        : current;
    });
  });

  return latestVersionImages;
}

/**
 * Fetches mosaic or reconstructed image source products from list in the VICAR label
 *
 * @param {Object} source product
 * @returns {Array} list of source products from ocs
 */
export function getSourceProductsForImage(product) {
  return new Promise(async (resolve) => {
    const config = getConfig();
    try {
      if (!isCustomProduct(product) && !!product[config.label_key]) {
        let sourceProductNames = [];
        const tileSourceProducts = getDescendantProp(product, config.es_mappings.tile_source_images.key);
        const mosaicSourceProducts = getDescendantProp(product, config.es_mappings.mosaic_source_images.key);
        // If tile source images exists in the vicar label, then it is a reconstructed image. Use that list to get the
        // source images.
        if (tileSourceProducts !== config.missing_property_value) {
          sourceProductNames = tileSourceProducts;
        } else if (
          // Otherwise, check if the object type is m20-mosaic. All products include the vicar field used here so a
          // check for that is not sufficient.
          getPropFromProduct(product, config.es_mappings.object_type, null, false, false) ===
            config.object_type_mappings.mosaic &&
          mosaicSourceProducts !== config.missing_property_value
        ) {
          sourceProductNames = mosaicSourceProducts;
        }

        // field can either be a string or an array
        let sourceNamesList = typeof sourceProductNames === 'string' ? [sourceProductNames] : sourceProductNames;

        // Filter out browse images from PDS4 metadata given the clobbering issue in ES
        // and remove duplicates
        // TODO remove workaround once clobbering is resolved on their side
        if (config.data_provider_type === 'pds') {
          sourceNamesList = [...new Set(sourceNamesList.filter((s) => s.indexOf('browse:') < 0))];
        }
        const ocs_products = await Promise.all(
          sourceNamesList.map(async (p, i) => {
            let productName = p;
            let key = '';
            if (config.label_key === 'vicar_label') {
              productName = p.split('.')[0] + '.IMG';
              key = config.es_mappings.filename.key;
            } else {
              key = `${config.es_mappings.lidvid.key}.keyword`;
            }
            try {
              const sourceProduct = await fetchESDataForProduct(productName, null, key);
              sourceProduct._activeImageIndex = i;
              return sourceProduct;
            } catch (err) {
              telemetry.logError(`Error fetching source images for ${productName}`, err);

              // Return placeholder product
              return {
                _error: true,
                _activeImageIndex: i,
                ocs_url: productName,
                ocs_name: productName,
              };
            }
          })
        );
        resolve(ocs_products);
      } else {
        resolve([]);
      }
    } catch (err) {
      telemetry.logError(`Error fetching source images for ${getPropFromProduct(product, config.es_mappings.id)}`, err);
      resolve([]);
    }
  });
}

/**
 * Fetches source image footprints for a product
 *
 * @param {Object} source product
 * @returns {Array} list of footprints
 */
export function getSourceImageFootprintsForImage(product) {
  return new Promise(async (resolve) => {
    const config = getConfig();
    try {
      // If product is not a mosaic we will not look for footprints
      if (getPropFromProduct(product, config.es_mappings.object_type) !== 'm20-mosaic') {
        resolve([]);
        return;
      }

      const path = getPropFromProduct(product, config.es_mappings.img_url).split('.')[0] + '.bbox.csv';
      const bboxFile = await datadriveGetOCSObjectDownloadPathForOCSURL(path);

      // Download and parse the CSV
      Papa.parse(bboxFile, {
        download: true,
        withCredentials: true,
        error: function () {
          resolve([]);
        },
        complete: function (results) {
          const footprints = [];
          if (results.data.length > 0) {
            // Skip first row which is the header
            for (let i = 1; i < results.data.length; i++) {
              const row = results.data[i];

              // Skip empty rows
              if (row.length < 2) continue;

              // Bounds
              let minLinePoly = Number.POSITIVE_INFINITY;
              let maxLinePoly = Number.NEGATIVE_INFINITY;
              let minSamplePoly = Number.POSITIVE_INFINITY;
              let maxSamplePoly = Number.NEGATIVE_INFINITY;

              const ocs_name = row[0].split('.')[0] + '.IMG'; //Ensure the file extension is IMG
              const wktString = row[1];
              const geometry = parseWKTString(wktString);
              if (!geometry) continue;

              const polygon = geometry.coords.map((x) => {
                const point = { sample: x[0], line: x[1] };
                minLinePoly = Math.min(minLinePoly, point.line);
                maxLinePoly = Math.max(maxLinePoly, point.line);
                minSamplePoly = Math.min(minSamplePoly, point.sample);
                maxSamplePoly = Math.max(maxSamplePoly, point.sample);
                return point;
              });

              const footprint = {
                ocs_name,
                polygon,
                instrument_id: '__',
                color: '',
                bounds: {
                  line: [minLinePoly, maxLinePoly],
                  sample: [minSamplePoly, maxSamplePoly],
                },
              };
              footprints.unshift(footprint);
            }
          }
          resolve(footprints);
        },
      });
    } catch (err) {
      telemetry.logError(
        `Error fetching source image footprints for ${getPropFromProduct(product, config.es_mappings.id)}`,
        err
      );
      resolve([]);
    }
  });
}

/**
 * Fetches mosaic or reconstructed image source products from list in the VICAR label
 *
 * @param {Object} single frame product
 * @returns {Array} list of mosaic products from ocs
 */
export function getAssociatedMosaicsForImage(product, ocsPackages, signal1, signal2) {
  return new Promise(async (resolve, _reject) => {
    const config = getConfig();
    try {
      if (!isCustomProduct(product) && !!product.vicar_label && isSingleFrame(product)) {
        // Get filename without extension as this is what is listed in INPUT_PRODUCT_ID and TILE_PRODUCT_ID
        const filename = getPropFromProduct(product, config.es_mappings.filename).split('.')[0];

        /*
          Use * to blank out parts of the filename we want to generally match

          Chars to wildcard:
          - 3: Color/Filter
          - 4: Special Flag
          - 24,25,26: Product Type
          - 27: Geometry
          - 28: Thumbnail
          - 45,46,47,48: Camera Specific
          - 49: Downsample
          - 50,51: Compression
          - 53,54: Version
        */
        const replaceSequence = (string, from, to, replacement) => {
          return string.substr(0, from) + replacement + string.substr(to + 1);
        };

        const wildcardCharSequences = [
          [3, 4],
          [24, 25, 26, 27, 28],
          [45, 46, 47, 48, 49, 50, 51],
          [53, 54],
        ];
        let modifiedFilename = filename;
        wildcardCharSequences.forEach((sequence) => {
          modifiedFilename = replaceSequence(
            modifiedFilename,
            sequence[0] - 1, // subtract one as these are 1 indexed
            sequence[sequence.length - 1] - 1, // subtract one as these are 1 indexed
            '#'.repeat(sequence.length)
          );
        });
        const wildcardedFilename = modifiedFilename.replace(/[#]+/g, '*');
        const searchQuery = [];

        const productIsTile = isTile(product);
        const inputField = productIsTile
          ? 'vicar_label.INSTRUMENT_STATE_PARMS.TILE_PRODUCT_ID.keyword'
          : 'vicar_label.DERIVED_IMAGE_PARMS.INPUT_PRODUCT_ID.keyword';

        const searchObjectType = productIsTile
          ? config.object_type_mappings.single_frame
          : config.object_type_mappings.mosaic;

        const must = [];
        const ocsPackagesQuery = getOCSPackagesQuery(ocsPackages);
        if (ocsPackagesQuery) {
          must.push(ocsPackagesQuery);
        }
        searchQuery.push({
          bool: {
            must: must.concat([
              { match: { [config.es_base_filter.key]: config.es_base_filter.value } },
              // query all the matching images the footprints were derived from
              {
                query_string: {
                  query: wildcardedFilename,
                  fields: [inputField],
                },
              },
              {
                bool: {
                  must_not: [{ match: { [config.es_mappings.ext.key]: 'VIC' } }],
                },
              },
              {
                match: {
                  [config.es_mappings.object_type.key]: searchObjectType,
                },
              },
            ]),
          },
        });

        const searchOutput = await performESImageSearch({
          query: { bool: { must: searchQuery } },
          size: 500,
          sort: [{ time1: { order: 'desc', unmapped_type: 'long' } }],
          groupResults: true,
          includes: getImageRankingCriteriaKeys().concat([
            'vicar_label.DERIVED_IMAGE_PARMS.INPUT_PRODUCT_ID',
            'vicar_label.INSTRUMENT_STATE_PARMS.TILE_PRODUCT_ID',
            'instrument_id',
            'ocs_name',
            'ocs_path',
            'ocs_type_name',
            'ocs_package_name',
            'ocs_url',
            'overlay_id',
            'group_id',
            'time1',
          ]),
          signal1,
        });

        if (searchOutput.error) {
          resolve({ error: searchOutput.error });
          return;
        }

        // Get full metadata for best images (already determined by previous query)
        const ocsMetadata = await getMetadataForProducts(
          searchOutput.results,
          ocsPackages,
          'ocs_name',
          false,
          null,
          null,
          signal2
        );
        const sortedOCSProducts = searchOutput.results
          .map((product) => {
            const productName = getPropFromProduct(product, config.es_mappings.filename);
            if (ocsMetadata.hasOwnProperty(productName)) {
              return ocsMetadata[productName];
            }
            // Return placeholder product
            telemetry.logWarning(`Error fetching metadata for associated product: ${productName}`);
            return {
              _error: true,
              ocs_url: productName,
              ocs_name: productName,
            };
          })
          .sort((a, b) => {
            const rankedProjections = ['Cylindrical', 'Cylindrical Perspective'];
            return rankedProjections.indexOf(getPropFromProduct(a, config.es_mappings.projection)) <
              rankedProjections.indexOf(getPropFromProduct(b, config.es_mappings.projection))
              ? 1
              : -1;
          });
        resolve({ results: sortedOCSProducts });
      } else {
        resolve({ results: [] });
      }
    } catch (error) {
      telemetry.logError(
        `Error fetching associated mosaics for ${getPropFromProduct(product, config.es_mappings.id)}`,
        error
      );
      resolve({ error });
    }
  });
}

export function getTargetsForImage(product) {
  // if anything fails we resolve an empty array so that other overlays are not blocked
  return new Promise(async (resolve) => {
    const config = getConfig();
    // get site and drive for the target search
    const site = getPropFromProduct(product, config.es_mappings.site);
    const drive = getPropFromProduct(product, config.es_mappings.drive);

    try {
      const targets = await fetchTargetsFromDB({ site, drive });
      const transformedTargets = await transformTargetToProductFrame(product, targets);
      resolve(
        transformedTargets.map((targetObj) => {
          // modify x,y pixel locations to account for targets and camera model math starting at (0,0) and line/sample starting at (1,1)
          targetObj.pixelLocation.pixel.x += 1;
          targetObj.pixelLocation.pixel.y += 1;

          return {
            [config.es_mappings.object_type.key]: 'm20-target',
            [config.es_mappings.overlayable.key]: true,
            [config.es_mappings.overlay_id.key]: getPropFromProduct(product, config.es_mappings.overlay_id),
            [config.es_mappings.geometry.key]: getPropFromProduct(product, config.es_mappings.geometry),
            [config.es_mappings.eye_type.key]: getPropFromProduct(product, config.es_mappings.eye_type),
            [config.es_mappings.image_type.key]: getPropFromProduct(product, config.es_mappings.image_type),
            [config.es_mappings.package_name.key]: getPropFromProduct(product, config.es_mappings.package_name),
            [config.es_mappings.path.key]: getPropFromProduct(product, config.es_mappings.path),
            [config.es_mappings.filename.key]: targetObj.dbContent.uuid,
            [config.es_mappings.id.key]: targetObj.dbContent.uuid,
            target: targetObj,
            title: targetObj.dbContent.name,
            description: targetObj.dbContent.creator,
          };
        })
      );
    } catch (err) {
      telemetry.logError(`Error fetching targets for site: ${site}, drive: ${drive}`, err);
      resolve([]);
    }
  });
}

export function fetchTargetsFromDB(options) {
  return new Promise((resolve, reject) => {
    const config = getConfig();
    // cancel previous request if there was one
    targetsControllers.forEach((controller) => controller.abort());

    // create new request controller
    const controller = new AbortController();
    const signal = controller.signal;
    targetsControllers.push(controller);

    const targetServiceUrl = config.api_endpoints.targetDB.search;

    const { site, drive } = options;
    const body = {
      site,
      drive,
    };

    fetch(targetServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(config.using_csso ? { credentials: 'include' } : null),
      body: JSON.stringify(body),
      signal,
    })
      .then((response) => {
        if (!response.ok) {
          reject(new Error('Target DB query failed'));
        } else {
          return response.json();
        }
      })
      .then((targets) => {
        if (targets) {
          resolve(
            targets.map((t) => {
              return {
                dbContent: t,
                content:
                  typeof t.content === 'string' ? new Target(JSON.parse(t.content)) : new Target({ ...t.content }),
              };
            })
          );
        } else {
          resolve([]);
        }
      })
      .catch((err) => {
        reject(err);
      });
  });
}

export function transformTargetToProductFrame(product, targets) {
  const config = getConfig();
  return new Promise(async (resolve, reject) => {
    try {
      const edrType = EDRType(product);
      if (edrType >= 0) {
        const vicarProduct = parseVicarLabel(product.vicar_label);
        const toFrame = vicarProduct.CameraModel.frame;
        await Promise.all(
          targets.map((target) => {
            return new Promise(async (res, _rej) => {
              if (target.content.isShapeTarget()) {
                console.warn('shape targets not supported');
                res(true);
              } else if (target.content.type === TargetType.AZEL && edrType === 0) {
                // project Az/El target into mosaic only
                let origin = target.content.properties.origin;
                if (typeof origin === 'string') {
                  origin = JSON.parse(origin);
                }
                origin = new ASTTROVector3({ ...origin });

                try {
                  const org = await frameConversion.convertPoint(origin, toFrame);
                  const frame = frameDefinition.getTargetFrame(target.content);
                  const azEl = await coordinateConversionHelpers.convertAzEl(
                    target.content.azimuth,
                    target.content.elevation,
                    frame,
                    toFrame
                  );
                  const modPos = {
                    origin: org,
                    azimuth: azEl.az,
                    elevation: azEl.el,
                  };

                  const cameraModel = getModelForProduct(product);
                  const pixelLoc = cameraModel.getXYFromAzEl(modPos.azimuth, modPos.elevation);
                  target.camPosition = modPos;
                  target.pixelLocation = { pixel: pixelLoc };
                  res(true);
                } catch (err) {
                  telemetry.logError(`Error transforming AZEL target with ID: ${target.content.id}`, err);
                  res(true);
                }
              } else if (
                target.content.imageId &&
                `${target.content.imageId}.IMG` === getPropFromProduct(product, config.es_mappings.filename, null) &&
                typeof target.content.i !== 'undefined' &&
                typeof target.content.j !== 'undefined'
              ) {
                // target paired with source image
                const pos = new ASTTROVector3({
                  x: target.content.x,
                  y: target.content.y,
                  z: target.content.z,
                  frame: frameDefinition.getTargetFrame(target.content),
                });
                try {
                  const modPos = await frameConversion.convertPoint(pos, toFrame);
                  const pixelLoc = { pixel: { x: target.content.i, y: target.content.j }, accurate: true };
                  target.camPosition = modPos;
                  target.pixelLocation = pixelLoc;
                  res(true);
                } catch (err) {
                  telemetry.logError(`Error transforming Point target with ID: ${target.content.id}`, err);
                  res(true);
                }
              } else {
                // assume 3D target. If it fails to project, camPosition/pixelLocation will be null and it will be filtered out
                const pos = new ASTTROVector3({
                  x: target.content.x,
                  y: target.content.y,
                  z: target.content.z,
                  frame: frameDefinition.getTargetFrame(target.content),
                });
                try {
                  const modPos = await frameConversion.convertPoint(pos, toFrame);
                  const cameraModel = getModelForProduct(product);
                  const pixelLoc = cameraModel.Backproject(new Vector3(modPos.x, modPos.y, modPos.z));
                  target.camPosition = modPos;
                  target.pixelLocation = pixelLoc;

                  res(true);
                } catch (_err) {
                  res(true);
                }
              }
            });
          })
        );

        // filter out targets that didn't resolve a location or are outside the image
        const imagePixelWidth = getPropFromProduct(product, config.es_mappings.width, 0);
        const imagePixelHeight = getPropFromProduct(product, config.es_mappings.height, 0);
        resolve(
          targets.filter(
            (t) =>
              t.camPosition &&
              t.pixelLocation &&
              t.pixelLocation.pixel.x >= 0 &&
              t.pixelLocation.pixel.y >= 0 &&
              t.pixelLocation.pixel.x <= imagePixelWidth &&
              t.pixelLocation.pixel.y <= imagePixelHeight
          )
        );
      } else {
        reject(new Error('No applicable camera model'));
      }
    } catch (err) {
      reject(err);
    }
  });
}

export function getXYZForLineSample(
  baseImage,
  groups,
  lsPoint,
  preferredType = ['XYZ', 'XYM', 'XOZ'],
  preferredImageForType
) {
  const config = getConfig();
  return new Promise((resolve, reject) => {
    if (!Array.isArray(preferredType)) {
      preferredType = [preferredType];
    }
    const xyzProduct = getMatchingRdrPriority(baseImage, groups, preferredType, preferredImageForType);
    const xyzProductType = getPropFromProduct(xyzProduct, config.es_mappings.product_type);

    if (xyzProduct) {
      fetchDataForProduct(xyzProduct, lsPoint.line, lsPoint.sample)
        .then((xyzData) => {
          // if there was no data, attempt a fallback
          if (xyzData.x === 0 && xyzData.y === 0 && xyzData.z === 0) {
            const currTypeIndex = preferredType.indexOf(xyzProductType);
            // ensure this isn't the final fallback
            if (currTypeIndex < preferredType.length - 1) {
              getXYZForLineSample(
                baseImage,
                groups,
                lsPoint,
                preferredType.slice(currTypeIndex + 1),
                preferredImageForType
              )
                .then((recurseData) => resolve({ ...recurseData }))
                .catch(() => resolve({ xyz: xyzData, xyzProductType }));
            } else {
              resolve({ xyz: xyzData, xyzProductType });
            }
          } else {
            resolve({ xyz: xyzData, xyzProductType });
          }
        })
        .catch((err) => reject(err));
    } else {
      reject(new Error('Missing XYZ data product'));
    }
  });
}

export function getOrbitalForXYZ(x, y, z, frame) {
  return new Promise((resolve, reject) => {
    convertPointWithPlaces({ x, y, z }, frame, 'orbital(0)')
      .then((offset) => {
        resolve([offset[0], offset[1], -Math.abs(offset[2])]); // "proper" elevations are negative
      })
      .catch((err) => reject(err));
  });
}

export function getLatLonForXYZ(x, y, z, frame) {
  return new Promise((resolve, reject) => {
    getOrbitalForXYZ(x, y, z, frame)
      .then((offset) => {
        const latLon = orbitalCoordsToLatLon(offset);
        resolve({ latLon, offset });
      })
      .catch((err) => reject(err));
  });
}

export function padGeoJSONBoundingBox(geoJSON, meters = 0, range = [0, 360], angle = 0) {
  if (!geoJSON) return;

  const parsedMeters = isNaN(meters) ? 0 : meters;
  let parsedRange = [0, 360];
  if (range.length !== 2 || (range.length === 2 && !isNaN(range[0]) && !isNaN(range[1]))) {
    parsedRange = range;
  }
  const parsedAngle = isNaN(angle) ? 0 : angle;

  try {
    const centerPoint = centroid(geoJSON).geometry.coordinates;

    // Enscribe a circle around the bounds of the geoJSON
    let maxDistance = 0;
    if (geoJSON.type !== 'Point') {
      geoJSON.coordinates[0].forEach((point) => {
        const distanceDegrees = distance(point, centerPoint, { units: 'degrees' });
        maxDistance = distanceDegrees > maxDistance ? distanceDegrees : maxDistance;
      });
    }
    const paddingDegrees = metersToDegrees(parsedMeters);
    const newCircle = circle(centerPoint, maxDistance + paddingDegrees, { units: 'degrees', steps: 180 });
    if (parsedRange[0] === 0 && parsedRange[1] === 360) return newCircle;

    let newPoints = [];
    let closedAtFirstPoint = false;
    newCircle.geometry.coordinates[0].forEach((point, i) => {
      let degrees = rad2deg(Math.atan2(centerPoint[0] - point[0], centerPoint[1] - point[1])) - 180;
      if (degrees < 0) degrees += 360;
      const include = degrees >= parsedRange[0] && degrees <= parsedRange[1];
      if (include) {
        if (!newPoints.length) {
          if (i === 0) closedAtFirstPoint = true;
          else newPoints.push(centerPoint);
        }
        newPoints.push(point);
      }
    });
    // Close the polygon if needed
    if (newPoints.length && (newPoints[0][0] !== newPoints.at(-1)[0] || newPoints[0][1] !== newPoints.at(-1)[1])) {
      newPoints.push(newPoints.at(0));
    }

    if (closedAtFirstPoint) {
      // Move first point to last point if needed
      const firstPoint = newPoints.shift();
      newPoints.push(firstPoint);

      // Add center point
      newPoints.push(centerPoint);

      // Close with last point
      newPoints.push(newPoints.at(0));
    } else if (
      newPoints.length &&
      (newPoints[0][0] !== newPoints.at(-1)[0] || newPoints[0][1] !== newPoints.at(-1)[1])
    ) {
      newPoints.push(newPoints.at(0));
    }

    // Add point between first and last point
    // newPoints.splice(newPoints.length - 1, 0, centerPoint);

    if (newPoints.length < 4) {
      return newCircle;
    }
    const rotatedShape = transformRotate(polygon([newPoints]), parsedAngle, { pivot: centerPoint });
    if (rotatedShape.geometry.coordinates[0].length < 4) {
      return newCircle;
    }
    try {
      const newPoly = cleanCoords(rotatedShape);
      return newPoly;
    } catch (_err) {
      return newCircle;
    }
  } catch (_err2) {
    return geoJSON;
  }
}

export function getGeoJSONPolygonApproximatingLatLonCircle(latLon, radius) {
  radius = parseFloat(radius);

  // if there's no radius, use a single point, if we have a radius construct a hexagon
  if (radius && !isNaN(radius) && radius > 0) {
    const orb = latLonToOrbitalCoords(latLon);
    const orbPoints = [
      [orb.x + radius, orb.y],
      [orb.x + radius / 2, orb.y + radius],
      [orb.x - radius / 2, orb.y + radius],
      [orb.x - radius, orb.y],
      [orb.x - radius / 2, orb.y - radius],
      [orb.x + radius / 2, orb.y - radius],
      [orb.x + radius, orb.y],
    ];

    return {
      type: 'Polygon',
      coordinates: [
        orbPoints.map((point) => {
          const latLon = orbitalCoordsToLatLon(point);
          return [latLon.longitude, latLon.latitude];
        }),
      ],
    };
  } else {
    return {
      type: 'Point',
      coordinates: [latLon.longitude, latLon.latitude],
    };
  }
}

export async function getFootprintsForLatLon(
  latLon,
  searchRadius,
  ocsPackages,
  signal = null,
  includes = ['footprint_for_edr']
) {
  const geoJSON = getGeoJSONPolygonApproximatingLatLonCircle(latLon, searchRadius);
  return await getFootprintsForGeoJSON(geoJSON, ocsPackages, null, [], signal, 1000, includes, false);
}

export function getFootprintsForGeoJSON(
  geoJSON,
  ocsPackages,
  rmcShape = null,
  instrumentIds = [],
  signal = null,
  limit = 1000,
  includes = ['footprint_for_edr'],
  aggregate = true
) {
  return new Promise((resolve, reject) => {
    const config = getConfig();
    const queries = geoJSON
      ? [
          {
            geo_shape: {
              footprint: {
                shape: { ...geoJSON },
                relation: 'intersects',
              },
            },
          },
        ]
      : [];
    if (rmcShape)
      queries.push({
        geo_shape: {
          rmc_localization: {
            shape: rmcShape,
            relation: 'intersects',
          },
        },
      });
    if (instrumentIds.length) {
      queries.push({ terms: { instrument_id: instrumentIds } });
    }
    const searchFilter = {
      bool: {
        must: queries,
      },
    };

    const sort = geoJSON
      ? {
          _geo_distance: {
            'pin.location': centroid(geoJSON).geometry.coordinates,
            order: 'asc',
            mode: 'min',
            distance_type: 'arc',
            ignore_unmapped: true,
          },
        }
      : [];

    let aggs;
    if (aggregate) {
      aggs = {
        instrument_id: {
          terms: {
            field: 'instrument_id',
            size: 100,
            order: { _count: 'desc' },
          },
          aggs: {
            collection_count: {
              cardinality: {
                field: 'collection_id',
              },
            },
          },
        },
      };
    }

    // query all the matching footprint objects from OCS
    const body = {
      query: {
        bool: {
          must: [
            { match: { ocs_type_name: 'm20-ids-scilo-footprint' } },
            {
              match: {
                [config.es_mappings.package_name.key]: ocsPackages
                  ? ocsPackages.active
                  : config.api_endpoints.SciLo.package,
              },
            },
            { range: { scilo_version: { gte: 'G7.6' } } },
          ],
          filter: searchFilter,
        },
      },
      aggs,
      sort,
      collapse: {
        field: 'collection_id',
        inner_hits: {
          name: 'collection_members',
          _source: includes,
          size: 1,
          sort: [
            {
              footprint_version: {
                order: 'desc',
              },
            },
          ],
        },
      },
      _source: {
        excludes: ['*'],
      },
      size: limit,
    };

    const ES_QUERY_STRING = `${config.es_url}/${config.api_endpoints.SciLo.footprint_es_type}/_search?`;
    fetch(ES_QUERY_STRING, {
      method: 'POST',
      ...(config.using_csso ? { credentials: 'include' } : null),
      body: JSON.stringify(body),
      signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw Error(response.statusText);
        } else {
          return response.json();
        }
      })
      .then((sciLoData) => {
        if (!sciLoData.hits || !sciLoData.hits.hits) {
          resolve({ footprints: [], aggs: [] });
        } else {
          const footprints = sciLoData.hits.hits.map((h) => {
            return h.inner_hits.collection_members.hits.hits[0]._source;
          });
          let aggregationResults = [];
          if (aggregate) {
            aggregationResults = sciLoData.aggregations.instrument_id.buckets.map((o) => {
              return {
                name: o.key,
                value: o.key,
                count: o.collection_count.value,
              };
            });
          }
          resolve({ footprints, aggs: aggregationResults });
        }
      })
      .catch((err) => reject(err));
  });
}

export function getFootprintForImage(product, ocsPackages) {
  return new Promise((resolve, reject) => {
    const config = getConfig();
    // query all the matching footprint objects from OCS
    const body = {
      query: {
        bool: {
          must: [
            { match: { ocs_type_name: 'm20-ids-scilo-footprint' } },
            {
              match: {
                [config.es_mappings.package_name.key]: ocsPackages
                  ? ocsPackages.active
                  : config.api_endpoints.SciLo.package,
              },
            },
            {
              bool: {
                should: [
                  {
                    query_string: {
                      query: getPropFromProduct(product, config.es_mappings.filename, '')
                        .replace(getPropFromProduct(product, config.es_mappings.product_type), '*')
                        .replace('IMG', '*')
                        .replace('VIC', '*'),
                      fields: ['footprint_for_edr'],
                      boost: 1.0, // prefer this field over "footprint_derived_from" but the field may not be available for historical footprints
                    },
                  },
                  {
                    query_string: {
                      query: getPropFromProduct(product, config.es_mappings.filename, '').replace(
                        getPropFromProduct(product, config.es_mappings.product_type),
                        '*'
                      ),
                      fields: ['footprint_derived_from'],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      size: 1,
    };

    const ES_QUERY_STRING = `${config.es_url}/${config.api_endpoints.SciLo.footprint_es_type}/_search?`;
    fetch(ES_QUERY_STRING, {
      method: 'POST',
      headers: { 'content-type': 'application/x-ndjson', accept: 'application/json' },
      ...(config.using_csso ? { credentials: 'include' } : null),
      body: JSON.stringify(body),
    })
      .then((response) => {
        if (!response.ok) {
          throw Error(response.statusText);
        } else {
          return response.json();
        }
      })
      .then((sciLoData) => {
        if (!sciLoData.hits || !sciLoData.hits.hits || !sciLoData.hits.hits.length) {
          resolve([]);
        } else {
          const footprint = sciLoData.hits.hits;
          if (footprint.length < 0) resolve();
          else resolve(footprint[0]._source);
        }
      })
      .catch((err) => reject(err));
  });
}

export function getImagesForFootprints(footprints, ocsPackages, exclude = []) {
  return new Promise(async (resolve, reject) => {
    const config = getConfig();
    const fNameKey = config.es_mappings.filename.key;

    // make sure we don't have duplicates and remove excluded products
    let filenames = new Set(footprints.map((x) => x.footprint_for_edr.replace('.VIC', '.IMG')));
    filenames = Array.from(filenames);

    const searchQuery = [];

    // add basic packages and filter keys
    if (ocsPackages) {
      const ocsPackagesQuery = getOCSPackagesQuery(ocsPackages);
      if (ocsPackagesQuery) searchQuery.push(ocsPackagesQuery);
    }

    // filter out video frames and excluded products
    searchQuery.push({
      bool: {
        should: [{ match: { [config.es_base_filter.key]: config.es_base_filter.value } }],
      },
    });

    // query all the matching images the footprints were derived from
    searchQuery.push({
      terms: {
        [fNameKey]: filenames,
      },
    });

    const searchOutput = await performESImageSearch({
      query: {
        bool: {
          must: searchQuery,
          // ignore video frames and images that match the excluded products
          must_not: [{ match: { [config.es_mappings.image_kind.key]: 'video' } }].concat(
            exclude.map((product) => {
              return {
                match: {
                  [config.es_mappings.overlay_id.key]: getPropFromProduct(product, config.es_mappings.overlay_id),
                },
              };
            })
          ),
        },
      },
      size: filenames.length,
      groupResults: true,
      // this includes set is very limited because
      // 1. we don't need the full ranking criteria since we're searching on filenames
      // 2. we don't have a good way to paginate these results so we must make a big query
      // 3. only need enough metadata for result display and backprojection
      includes: [
        'sol',
        'instrument_id',
        'instrument_category',
        'ocs_name',
        'ocs_path',
        'eye_type',
        'ocs_type_name',
        'base_id',
        'ocs_url',
        'overlay_id',
        'group_id',
        'time1',
        'time2',
        'site',
        'title',
        'drive',
        'flight',
        'activity_name_rtt',
        'target_name_rtt',
        'vicar_label.GEOMETRIC_CAMERA_MODEL*',
        'vicar_label.ROVER_COORDINATE_SYSTEM*',
        'vicar_label.SURFACE_MODEL_PARMS.SURFACE_MODEL_TYPE',
        'vicar_label.SURFACE_MODEL_PARMS.MAP_PROJECTION_TYPE',
        'vicar_label.SURFACE_MODEL_PARMS.REFERENCE_COORD_SYSTEM_INDEX',
        'vicar_label.INSTRUMENT_STATE_PARMS.AZIMUTH_FOV',
        'vicar_label.INSTRUMENT_STATE_PARMS.AZIMUTH_FOV__UNIT',
        'vicar_label.IDENTIFICATION.SPACECRAFT_CLOCK_STOP_COUNT',
        'vicar_label.IDENTIFICATION.ROVER_MOTION_COUNTER',
        'vicar_label.IDENTIFICATION.SEQUENCE_ID',
        'vicar_label.PRODUCT_ID',
        'vicar_label.INSTRUMENT_ID',
        'vicar_label.system.NL',
        'vicar_label.system.NS',
      ],
    });

    if (searchOutput.error) {
      reject(searchOutput.error);
    } else {
      resolve(searchOutput.results);
    }
  });
}

export function getFootprintImagesForLineSample(
  product,
  groups,
  lsPoint,
  searchRadius,
  ocsPackages,
  preferredImageForType
) {
  return new Promise(async (resolve, reject) => {
    const config = getConfig();
    try {
      const { xyz, xyzProductType } = await getXYZForLineSample(
        product,
        groups,
        lsPoint,
        ['XYR', 'XYZ', 'XYM', 'XOZ'],
        preferredImageForType
      );
      // no data is all 0s for some reason
      if (xyz.x !== 0 || xyz.y !== 0 || xyz.z !== 0) {
        // frame definition inputs for the various services
        let posFrame = `SITE=${getPropFromProduct(product, config.es_mappings.site)}`;
        let queryFrame = `site(${getPropFromProduct(product, config.es_mappings.site)})`;

        // special case for the rover frame XYZ we know about
        if (xyzProductType === 'XYR') {
          posFrame = `ROVER=${product.vicar_label.IDENTIFICATION.ROVER_MOTION_COUNTER.slice(0, 3).join(',')}`;
          queryFrame = `rover(${getPropFromProduct(product, config.es_mappings.site)},${getPropFromProduct(
            product,
            config.es_mappings.drive
          )})`;
        }

        const pos = {
          x: xyz.x,
          y: xyz.y,
          z: xyz.z,
          frame: posFrame,
        };

        const latLon = await getLatLonForXYZ(xyz.x, xyz.y, xyz.z, queryFrame);
        const { footprints } = await getFootprintsForLatLon(latLon.latLon, searchRadius, ocsPackages);

        // Chunk requests each 300 footprints to avoid queries timing out
        const requests = [];
        for (let i = 0; i < footprints.length; i += 300) {
          requests.push(getImagesForFootprints(footprints.slice(i, i + 300), ocsPackages, [product]));
        }
        const images = (await Promise.all(requests)).flat();

        // backproject pixel location for each image to get distance
        Promise.all(
          images.map((img) => {
            return new Promise(async (resolve, _reject) => {
              try {
                const pixelLoc = await backprojectLocationIntoImage(pos, img);
                if (pixelLoc) {
                  // only trust backprojection in the same site/drive
                  pixelLoc.approximate =
                    getPropFromProduct(product, config.es_mappings.site) !==
                      getPropFromProduct(img, config.es_mappings.site) ||
                    getPropFromProduct(product, config.es_mappings.drive) !==
                      getPropFromProduct(img, config.es_mappings.drive);
                }
                img.backprojectPixelLoc = pixelLoc;
                resolve(img);
              } catch (err) {
                console.warn(err);
                resolve(img);
              }
            });
          })
        )
          .then((imagesWithDist) => {
            resolve({ xyz, latLon, footprints, images: imagesWithDist });
          })
          .catch((err) => reject(err));
      } else {
        reject(new Error('No XYZ data found'));
      }
    } catch (err) {
      reject(err);
    }
  });
}

export function getOrbitalCoordsForLineSample(
  product,
  groups,
  lsPoint,
  preferredType = ['XYZ', 'XYM', 'XOZ'],
  preferredImageForType = {}
) {
  return new Promise(async (resolve, reject) => {
    const config = getConfig();
    try {
      const { xyz } = await getXYZForLineSample(product, groups, lsPoint, preferredType, preferredImageForType);
      if (xyz.x !== 0 || xyz.y !== 0 || xyz.z !== 0) {
        let queryFrame = `site(${getPropFromProduct(product, config.es_mappings.site)})`;
        const { latLon, offset } = await getLatLonForXYZ(xyz.x, xyz.y, xyz.z, queryFrame);
        resolve({ latLon, offset, lineSample: lsPoint });
      }
      reject(new Error('No XYZ data'));
    } catch (err) {
      reject(err);
    }
  });
}

export async function backprojectLocationIntoImage(location, product, attemptAccurateRange = true) {
  try {
    const { x, y, z, frame } = location;
    const vicarProduct = parseVicarLabel(product.vicar_label);
    const toFrame = vicarProduct.CameraModel.frame;
    const pos = new ASTTROVector3({ x, y, z, frame });
    const modPos = await frameConversion.convertPoint(pos, toFrame);

    // // try conversion with places
    // let framePlaces = `${frame.toLowerCase().replace('=', '(')})`;
    // let toFramePlaces = `${toFrame.toLowerCase().replace('=', '(')})`;
    // const modPosPlaces = await convertPointWithPlaces(pos, framePlaces, toFramePlaces);

    const cameraModel = getModelForProduct(product);
    const pixelLoc = cameraModel.Backproject(new Vector3(modPos.x, modPos.y, modPos.z));
    pixelLoc.pixel.x = Math.ceil(pixelLoc.pixel.x);
    pixelLoc.pixel.y = Math.ceil(pixelLoc.pixel.y);
    // const pixelLoc = cameraModel.Backproject(new Vector3(modPosPlaces[0], modPosPlaces[1], modPosPlaces[2]));
    pixelLoc.range = Math.abs(pixelLoc.range); // saw some negative ranges coming out of backproject?

    // calculate a range based on SITE frame positions and store that instead of the derived range estimate
    if (attemptAccurateRange) {
      try {
        const rovFrameLoc = await frameConversion.convertPoint(pos, vicarProduct.RoverSiteOffset.frame);
        const rovDist = new Vector3(
          vicarProduct.RoverSiteOffset.x,
          vicarProduct.RoverSiteOffset.y,
          vicarProduct.RoverSiteOffset.z
        ).distanceTo(new Vector3(rovFrameLoc.x, rovFrameLoc.y, rovFrameLoc.z));
        pixelLoc.range = rovDist;
      } catch (err) {
        console.warn('ROCs query failed, using estimate position', err);
        return pixelLoc;
      }
    }

    return pixelLoc;
  } catch (err) {
    console.warn('Failed to backproject', err);
    return false;
  }
}

export function convertFrameWithPlaces(fromFrame, toFrame, useTelemetryFrame = false) {
  return new Promise((resolve, reject) => {
    const config = getConfig();
    const baseUrl = config.api_endpoints.PLACES.API;

    // ignore pose in rover frames
    if (fromFrame.indexOf('rover') !== -1) {
      fromFrame = `rover(${fromFrame.match(/\d+/gi).slice(0, 2).join(',')},^)`;
    }
    if (toFrame.indexOf('rover') !== -1) {
      toFrame = `rover(${toFrame.match(/\d+/gi).slice(0, 2).join(',')},^)`;
    }

    // construct url
    const url = `${baseUrl}query/primary/${
      useTelemetryFrame ? 'telemetry' : 'best_tactical'
    }?from=${fromFrame}&to=${toFrame}&output=json`;

    const cached = cachedPlacesOffsets[url];
    if (cached && typeof cached.then !== 'function') {
      // assume it fulfilled promise data
      resolve(cached);
    } else {
      // assume cached doesn't exist or is already a promise
      let fetchProm = cached;
      if (!fetchProm) {
        fetchProm = new Promise((res, rej) => {
          fetch(url, { ...(config.using_csso ? { credentials: 'include' } : null) })
            .then((response) => {
              if (!response.ok) {
                throw Error(response.statusText);
              } else {
                return response.json();
              }
            })
            .then((placesLoc) => {
              try {
                const offset = placesLoc.translations[0].offset;
                if (offset) {
                  cachedPlacesOffsets[url] = offset;
                  res(offset);
                } else {
                  rej(new Error('Missing PLACES offset'));
                }
              } catch (err) {
                rej(err);
              }
            })
            .catch((err) => rej(err));
        });
        cachedPlacesOffsets[url] = fetchProm;
      }
      fetchProm.then((data) => resolve(data)).catch((err) => reject(err));
    }
  });
}

export function convertPointWithPlaces(xyz, fromFrame, toFrame, useTelemetryFrame = false) {
  return new Promise((resolve, reject) => {
    const config = getConfig();
    const baseUrl = config.api_endpoints.PLACES.API;

    // ignore pose in rover frames
    if (fromFrame.indexOf('rover') !== -1) {
      fromFrame = `rover(${fromFrame.match(/\d+/gi).slice(0, 2).join(',')},^)`;
    }
    if (toFrame.indexOf('rover') !== -1) {
      toFrame = `rover(${toFrame.match(/\d+/gi).slice(0, 2).join(',')},^)`;
    }

    // construct url
    const url = `${baseUrl}query/translation/point/(${xyz.x},${xyz.y},${xyz.z})/${
      useTelemetryFrame ? 'telemetry' : 'best_tactical'
    }?from=${fromFrame}&to=${toFrame}&toView=best_tactical&output=json`;

    const cached = cachedPlacesOffsets[url];
    if (cached && typeof cached.then !== 'function') {
      // assume it fulfilled promise data
      resolve(cached);
    } else {
      // assume cached doesn't exist or is already a promise
      let fetchProm = cached;
      if (!fetchProm) {
        fetchProm = new Promise((res, rej) => {
          fetch(url, { ...(config.using_csso ? { credentials: 'include' } : null) })
            .then((response) => {
              if (!response.ok) {
                throw Error(response.statusText);
              } else {
                return response.json();
              }
            })
            .then((placesLoc) => {
              try {
                const offset = placesLoc.translations[0].offset;
                if (offset) {
                  cachedPlacesOffsets[url] = offset;
                  res(offset);
                } else {
                  rej(new Error('Missing PLACES offset'));
                }
              } catch (err) {
                rej(err);
              }
            })
            .catch((err) => rej(err));
        });
        cachedPlacesOffsets[url] = fetchProm;
      }
      fetchProm.then((data) => resolve(data)).catch((err) => reject(err));
    }
  });
}

export async function projectLatLonIntoImage(latLon, product) {
  const config = getConfig();
  // convert lat lon to orbital (northing/easting) xy
  const orbCoords = latLonToOrbitalCoords(latLon);

  // convert the current rover position to orbital (northing/easting) xyz for approximate elevation
  const roverOffset = await convertFrameWithPlaces(
    `rover(${getPropFromProduct(product, config.es_mappings.site)},${getPropFromProduct(
      product,
      config.es_mappings.drive
    )}`,
    'orbital(0)',
    false
  );

  // convert to site frame
  const siteFrameRocs = `SITE=${getPropFromProduct(product, config.es_mappings.site)}`;
  const siteFramePlaces = `site(${getPropFromProduct(product, config.es_mappings.site)})`;
  const camFrameOffset = await convertPointWithPlaces(
    { x: orbCoords.x, y: orbCoords.y, z: roverOffset[2] },
    'orbital(0)',
    siteFramePlaces,
    false
  );

  // backproject site frame into the image
  const pixelLoc = await backprojectLocationIntoImage(
    {
      x: camFrameOffset[0],
      y: camFrameOffset[1],
      z: camFrameOffset[2],
      frame: siteFrameRocs,
    },
    product,
    false // no need for refined range here
  );

  return pixelLoc;
}

export async function getMetadataForProducts(
  products,
  ocsPackages,
  idField = 'ocs_name',
  groupResults = false,
  includes = null,
  excludes = null,
  signal = null
) {
  return new Promise(async (resolve, reject) => {
    const config = getConfig();
    const ids = [...new Set(products.map((x) => x[idField]))]; // remove duplicates

    const searchQuery = [];

    // add basic packages and filter keys
    if (ocsPackages) searchQuery.push(getOCSPackagesQuery(ocsPackages));

    searchQuery.push({
      bool: {
        should: [{ match: { [config.es_base_filter.key]: config.es_base_filter.value } }],
      },
    });

    // query all the matching images
    searchQuery.push({
      terms: {
        [idField]: ids,
      },
    });

    const searchOutput = await performESImageSearch({
      query: { bool: { must: searchQuery } },
      size: ids.length,
      groupResults,
      includes,
      excludes,
      signal,
    });

    // Create a map of filename to metadata
    if (searchOutput.error) reject(searchOutput.error);
    else {
      const metadataMap = {};
      searchOutput.results.forEach((product) => (metadataMap[product[idField]] = product));
      resolve(metadataMap);
    }
  });
}

export function getOrientationForProduct(product) {
  // for now only support SITE frame quaternion because they are already north-aligned
  if (
    product &&
    product.vicar_label &&
    product.vicar_label.ROVER_COORDINATE_SYSTEM &&
    product.vicar_label.ROVER_COORDINATE_SYSTEM.REFERENCE_COORD_SYSTEM_NAME.indexOf('SITE') !== -1
  ) {
    // convert quaternion to roll/pitch/yaw per sis 20.11
    const quat = product.vicar_label.ROVER_COORDINATE_SYSTEM.ORIGIN_ROTATION_QUATERNION;
    const s = quat[0];
    const x = quat[1];
    const y = quat[2];
    const z = quat[3];

    const R00 = s ** 2 + x ** 2 - y ** 2 - z ** 2;
    const _R01 = 2 * x * y - 2 * s * z;
    const _R02 = 2 * x * z + 2 * s * y;
    const R10 = 2 * x * y + 2 * s * z;
    const _R11 = s ** 2 - x ** 2 + y ** 2 - z ** 2;
    const _R12 = 2 * y * z - 2 * s * x;
    const R20 = 2 * x * z - 2 * s * y;
    const R21 = 2 * y * z + 2 * s * x;
    const R22 = s ** 2 - x ** 2 - y ** 2 + z ** 2;

    const roll = Math.atan2(R21, R22);
    const pitch = Math.atan2(-R20, Math.sqrt(R00 * 2 + R10 ** 2));
    const yaw = -Math.atan2(R10, R00); // flipping the sign on this seemed to fix some things

    return { roll, pitch, yaw };
  }
  return { roll: 0, pitch: 0, yaw: 0 };
}

export async function fetchFreshestProduct(product, ocsPackages, signal1, signal2) {
  return new Promise(async (resolve, _reject) => {
    const config = getConfig();
    try {
      if (!isCustomProduct(product) && !!product.vicar_label && isMosaic(product)) {
        const filename = getPropFromProduct(product, config.es_mappings.filename);

        /*
          Use * to blank out parts of the filename we want to generally match

          Chars to wildcard:
          - 8,9,10,11: Sol
          - 12: Multi-sol flag
          - 39,40: Version
        */
        const replaceSequence = (string, from, to, replacement) => {
          return string.substr(0, from) + replacement + string.substr(to + 1);
        };

        const wildcardCharSequences = [[8, 9, 10, 11], [12], [39, 40]];
        let modifiedFilename = filename;
        wildcardCharSequences.forEach((sequence) => {
          modifiedFilename = replaceSequence(
            modifiedFilename,
            sequence[0] - 1, // subtract one as these are 1 indexed
            sequence[sequence.length - 1] - 1, // subtract one as these are 1 indexed
            '#'.repeat(sequence.length)
          );
        });
        const wildcardedFilename = modifiedFilename.replace(/[#]+/g, '*');
        const searchQuery = [];

        const must = [];
        const ocsPackagesQuery = getOCSPackagesQuery(ocsPackages);
        if (ocsPackagesQuery) {
          must.push(ocsPackagesQuery);
        }

        searchQuery.push({
          bool: {
            must: must.concat([
              { match: { [config.es_base_filter.key]: config.es_base_filter.value } },
              {
                query_string: {
                  query: wildcardedFilename,
                  fields: [config.es_mappings.filename.key],
                },
              },
              {
                bool: {
                  must_not: [{ match: { [config.es_mappings.ext.key]: 'VIC' } }],
                },
              },
              {
                match: {
                  [config.es_mappings.object_type.key]: config.object_type_mappings.mosaic,
                },
              },
            ]),
          },
        });

        const searchOutput = await performESImageSearch({
          query: { bool: { must: searchQuery } },
          size: 500,
          sort: [{ time1: { order: 'desc', unmapped_type: 'long' } }],
          groupResults: true,
          includes: getImageRankingCriteriaKeys().concat([
            // TODO use config properties here?
            'instrument_id',
            'ocs_name',
            'ocs_path',
            'ocs_type_name',
            'ocs_package_name',
            'ocs_url',
            'overlay_id',
            'group_id',
            'time1',
          ]),
          signal1,
        });

        if (searchOutput.error) {
          resolve({ error: searchOutput.error });
          return;
        }

        // Get full metadata for best images (already determined by previous query)
        const ocsMetadata = await getMetadataForProducts(
          searchOutput.results,
          ocsPackages,
          'ocs_name',
          false,
          null,
          null,
          signal2
        );
        const ocsProducts = searchOutput.results.map((p) => {
          const productName = getPropFromProduct(p, config.es_mappings.filename);
          if (ocsMetadata.hasOwnProperty(productName)) {
            return ocsMetadata[productName];
          }
          // Return placeholder product
          telemetry.logWarning(`Error fetching metadata for associated product: ${productName}`);
          return {
            _error: true,
            ocs_url: productName,
            ocs_name: productName,
          };
        });
        let freshestProduct = null;
        const productTime1 = getPropFromProduct(product, config.es_mappings.time1);
        ocsProducts.forEach((p) => {
          // Only consider newer products from a different group or products from the same time
          // with multi-day=true, current product multi-day=false
          if (
            getPropFromProduct(p, config.es_mappings.group_id) !==
              getPropFromProduct(product, config.es_mappings.group_id) && // same group
            (getPropFromProduct(p, config.es_mappings.time1) > productTime1 || // newer
              (getPropFromProduct(p, config.es_mappings.time1) === productTime1 && // same sol and prefer multi-sol
                getPropFromProduct(p, config.es_mappings.multi_time1) &&
                !getPropFromProduct(product, config.es_mappings.multi_time1)))
          ) {
            if (!freshestProduct) {
              freshestProduct = p;
            } else {
              // Take higher time
              if (
                getPropFromProduct(p, config.es_mappings.time1) >
                getPropFromProduct(freshestProduct, config.es_mappings.time1)
              ) {
                freshestProduct = p;
              } else if (
                getPropFromProduct(p, config.es_mappings.time1) ===
                  getPropFromProduct(freshestProduct, config.es_mappings.time1) &&
                getPropFromProduct(p, config.es_mappings.multi_time1) &&
                !getPropFromProduct(freshestProduct, config.es_mappings.multi_time1)
              ) {
                // Prefer multi-sol
                freshestProduct = p;
              }
            }
          }
        });
        resolve({ product: freshestProduct });
      } else {
        resolve({ product: null });
      }
    } catch (error) {
      telemetry.logError(
        `Error fetching associated mosaics for ${getPropFromProduct(product, config.es_mappings.id)}`,
        error
      );
      resolve({ error });
    }
  });
}
