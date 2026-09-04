// NOTE: This file is written without using ES6 so that it can be imported by both the non-compiled server, dev CRA, and built CRA.
// Built CRA does not appear to correctly compile commonJS with ES6 (async, spread, etc).
import moment from 'moment';
import urljoin from 'url-join';
import { round } from '../utils/index.js';
import { logError } from '../utils/telemetryUtils.js';
import { getConfig } from './configRegistry.js';
// let fetch = require('node-fetch');
// const moment = require('moment');
// const urlJoin = require('url-join');
// const { logError } = require('./telemetryUtils');

// if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
//   fetch = window.fetch;
// }

const MOSAICS_QUERY_PAGE_SIZE = 2000;

/**
 * Build a reverse lookup of es_mappings keyed by each mapping's dot-path key
 * @returns {Object} map of dot-path key (e.g. 'gather.common.instrument') to its es_mappings entry
 * @example getEsMappingsByKey()['gather.common.instrument'] -> { key: 'gather.common.instrument', label: 'Instrument ID', alias: true }
 */
export function getEsMappingsByKey() {
  return Object.values(getConfig().es_mappings).reduce((accum, mapping) => {
    accum[mapping.key] = mapping;
    return accum;
  }, {});
}

/**
 * Get property from object using dot separated path
 * @param {Object} obj
 * @param {Strings} desc
 * @example getDescendantProp({ foo: { bar: 1 }}, 'foo.bar') -> 1
 * @example getDescendantProp({ foo: { bar: 1 }}, 'foo.no') -> undefined
 */
export function getDescendantProp(obj, desc, defaultValue) {
  if (defaultValue === undefined) defaultValue = getConfig().missing_property_value;
  if (!desc || !obj) {
    console.warn(`Unable to get descendent property ${desc} from ${obj}, using default value.`);
    return defaultValue;
  }
  return desc.split('.').reduce((a, b) => (a && a.hasOwnProperty(b) ? a[b] : defaultValue), obj);
}

/**
 * Get property from an ES result using config-defined alias for the property
 * if the config key is defined in the config's alias list and the property key is
 * found in the alias list for that config key.
 *
 * @param {Object} product Elasticsearch json product
 * @param {Object} configItem config item defining value access, ex: { key: 'instrument_id', label: 'Instrument', alias: true }
 * @param {*} defaultValue value to return if requested property not found for product
 * @param {boolean} asArray if true, signals that the value is actually an array and not just a value nested in an array
 */
export function getPropFromProduct(product, configItem, defaultValue, asArray = false, useAlias = true) {
  let value = defaultValue;
  if (!configItem) {
    return !asArray && Array.isArray(value) ? value[0] : value;
  }

  const key = configItem.key;
  const alias = configItem.alias;
  let rawValue = getDescendantProp(product, key, defaultValue);
  if (!asArray && Array.isArray(rawValue)) {
    rawValue = rawValue[0];
  }

  return useAlias && alias ? getAlias(key, rawValue) : rawValue;
}

/**
 * Set property on an object using dot separated path
 * @param {Object} obj object to set property on
 * @param {Object} configItem config item defining value access, ex: { key: 'instrument_id', label: 'Instrument' }
 * @param {*} value value to set at the specified path
 * @example setPropForProduct({ foo: {} }, { key: 'foo.bar' }, 1) -> { foo: { bar: 1 }}
 */
export function setPropForProduct(obj, configItem, value) {
  if (!configItem || !obj) {
    console.warn(`Unable to set property ${configItem?.key} on ${obj}`);
    return;
  }

  const key = configItem.key;
  if (!key) {
    console.warn('Config item missing key property');
    return;
  }

  const keys = key.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!current[k] || typeof current[k] !== 'object') {
      current[k] = {};
    }
    current = current[k];
  }

  current[keys[keys.length - 1]] = value;
}

export function getAlias(key, value) {
  const config = getConfig();
  // Ensure config has requested alias entry (e.g. config has 'instrument_id')
  if (!config.es_value_aliases.hasOwnProperty(key)) {
    // console.warn(
    //   `Aliased value requested for ${key} but not found in 'config.es_value_aliases', defaulting to un-aliased value.`
    // );
    return value;
  }

  // Ensure alias entry has property and that the property is a string or number
  const aliases = config.es_value_aliases[key];
  if (aliases.hasOwnProperty('_alias_type')) {
    if (aliases['_alias_type'] === 'format') {
      const { _format_args: fargs = {} } = aliases;
      const { type, precision } = fargs;
      if (type === 'number_round') {
        return round(value, precision);
      }
    }
  } else if (
    !aliases.hasOwnProperty(value) ||
    (typeof aliases[value] !== 'string' && typeof aliases[value] !== 'number')
  ) {
    // console.warn(
    //   `Aliased value requested for ${key}:${value} but not found in 'config.es_value_aliases.${value}', defaulting to un-aliased value.`
    // );
    return value;
  }
  return aliases[value];
}

/**
 * Transform a string with "." separated keys into an object with the requested value
 * Ex: descendentPropertyToObject("a.b.c", 1) => {a: {b: {c: 1}}}
 *
 * @param {String} stringKeyPath string representing object key path, ex: 'a.b.c'
 * @param {*} value value to use for last key in the resulting object
 */
export function descendentPropertyToObject(stringKeyPath, value) {
  return stringKeyPath
    .split('.')
    .reverse()
    .reduce((obj, prop) => {
      if (!obj) {
        const newObj = {};
        newObj[prop] = value;
        return newObj;
      }
      const newObj = {};
      newObj[prop] = obj;
      return newObj;
    }, null);
}

/**
 * Group a list of products by product type mapping
 *
 * @param {Array} list of ocs products
 * @returns {Map} products by product type
 */
export function groupProductsBy(products, mapping) {
  // Group products by type
  return products.reduce((r, a) => {
    const value = getPropFromProduct(a, mapping);
    r[value] = r[value] || [];
    r[value].push(a);
    return r;
  }, {});
}

export function determineBestImageInGroup(images, criteria) {
  if (!images.length) {
    console.warn('No images given to determineBestImageInGroup');
    return;
  }

  let bestMatches = images;
  let newBestMatches = bestMatches.slice(0); // make a copy of best matches so we can refer to the previous set of best matches
  criteria.forEach((item) => {
    if (item.type === 'best_match') {
      bestMatches = processBestMatchCriteriaType(bestMatches, item.key, item.best_options);
    } else {
      // Still look for best matches for numeric and string comparisons because we
      // add to best_options for criteria to preserve active options
      const possibleBestMatches = processBestMatchCriteriaType(bestMatches, item.key, item.best_options);
      if (possibleBestMatches.length) bestMatches = possibleBestMatches;
      else {
        // If we don't find any best matches, use the specified ranking algorithm
        if (item.type === 'highest_value_numeric') {
          bestMatches = processHighestNumericValueCriteriaType(bestMatches, item.key);
        } else if (item.type === 'lowest_value_numeric') {
          bestMatches = processLowestNumericValueCriteriaType(bestMatches, item.key);
        } else if (item.type === 'highest_value_string') {
          bestMatches = processHighestStringValueCriteriaType(bestMatches, item.key);
        } else if (item.type === 'lowest_value_string') {
          bestMatches = processLowestStringValueCriteriaType(bestMatches, item.key);
        } else {
          console.warn('Unrecognized image ranking type', item.type);
        }
      }
    }
    if (!bestMatches.length) {
      // If we don't find any matching images for this criteria we'll revert to the set
      // of best matches from the previous criteria.
      bestMatches = newBestMatches.slice(0);
    }

    // Update newBestMatches to reflect current best match set so we can refer to it next iteration
    newBestMatches = bestMatches.slice(0);
  });

  // If we have more than one best match, try to figure out why since this is unexpected
  // except for the case where base image selection does not try to get best version
  if (bestMatches.length > 1) {
    // Investigate if the images are duplicates
    const config = getConfig();
    const identicalS3Paths = new Set(bestMatches.map((x) => getPropFromProduct(x, config.es_mappings.id))).size === 1;
    if (identicalS3Paths) {
      console.warn('Images with the same S3 path found in the same image group', images);
    }

    // Investigate if the images have the same filenames
    const identicalFilenames =
      new Set(bestMatches.map((x) => getPropFromProduct(x, config.es_mappings.filename))).size === 1;
    if (identicalFilenames) {
      console.warn('Images with the same filename found in the same image group', images);
    }

    if (!identicalFilenames && !identicalS3Paths) {
      // TODO we don't need to log this for base image selector since it
      // takes care of highest version (so you'd see this every time there are multiple versions)
      // but for image search it is useful since search takes everything into account so this would be a
      // legitimate warning.
      // console.warn(
      //   'More than one best image found in group',
      //   images,
      //   'using criteria:',
      //   criteria,
      //   ', best matches:',
      //   bestMatches
      // );
    }
  }
  return bestMatches[0];
}

export function processBestMatchCriteriaType(images, key, bestOptions) {
  let matches = [];
  for (let i = 0; i < bestOptions.length; i++) {
    matches = images.filter((image) => image[key] === bestOptions[i]);
    if (matches.length) break;
  }
  return matches;
}

export function processHighestNumericValueCriteriaType(images, key) {
  let maxValue = -Infinity;
  const keyToImageMap = images.reduce((imageMap, image) => {
    let value = image[key];
    if (typeof value !== 'number') value = 0;
    if (value > maxValue) maxValue = value;
    if (!imageMap.hasOwnProperty(value)) imageMap[value] = [];
    imageMap[value].push(image);
    return imageMap;
  }, {});
  return keyToImageMap[maxValue] || [];
}

export function processLowestNumericValueCriteriaType(images, key) {
  let minValue = Infinity;
  const keyToImageMap = images.reduce((imageMap, image) => {
    let value = image[key];
    if (typeof value !== 'number') value = 0;
    if (value < minValue) minValue = value;
    if (!imageMap.hasOwnProperty(value)) imageMap[value] = [];
    imageMap[value].push(image);
    return imageMap;
  }, {});
  return keyToImageMap[minValue] || [];
}

export function processHighestStringValueCriteriaType(images, key) {
  let maxValue = '';
  const keyToImageMap = images.reduce((imageMap, image) => {
    let value = image[key];
    if (typeof value !== 'string') {
      try {
        value = value.toString();
      } catch (_err) {
        value = '';
      }
    }
    if (value > maxValue) maxValue = value;
    if (!imageMap.hasOwnProperty(value)) imageMap[value] = [];
    imageMap[value].push(image);
    return imageMap;
  }, {});
  return keyToImageMap[maxValue] || [];
}

export function processLowestStringValueCriteriaType(images, key) {
  let minValue = '___HIGH_VALUE___';
  const keyToImageMap = images.reduce((imageMap, image) => {
    let value = image[key];
    if (minValue === '___HIGH_VALUE___') minValue = value;
    if (typeof value !== 'string')
      try {
        value = value.toString();
      } catch (_err) {
        value = '';
      }
    if (value < minValue) minValue = value;
    if (!imageMap.hasOwnProperty(value)) imageMap[value] = [];
    imageMap[value].push(image);
    return imageMap;
  }, {});
  return keyToImageMap[minValue] || [];
}

export function getMosaics(ssosession, minutesLimitFromNow = -1) {
  const config = getConfig();
  return new Promise((resolve, reject) => {
    // Handle paginated results
    let page = 0;
    let from = page * MOSAICS_QUERY_PAGE_SIZE;
    let allImages = [];
    let totalKB = 0;
    let ocsCreatedAt = '';
    const getMosaicsFn = (from) => {
      return new Promise((resolve, reject) => {
        fetchMosaicsWithAutoRetry(ssosession, minutesLimitFromNow, from, ocsCreatedAt)
          .then((results) => {
            if (!results) {
              resolve(-1);
            } else {
              const { images, numResults, kbytes, lastOcsCreatedAt } = results;
              allImages = allImages.concat(images);
              totalKB += kbytes;
              if (numResults === -1) resolve({ mosaics: [], totalKB, numResults: allImages.length, success: false });
              page += 1;
              let newFrom = page * MOSAICS_QUERY_PAGE_SIZE;
              // If we're about to go over the 10k ES result limit, start a new query from
              // where the previous page left off
              if (newFrom + MOSAICS_QUERY_PAGE_SIZE > 10000) {
                newFrom = 0;
                page = 0;
                ocsCreatedAt = lastOcsCreatedAt;
                resolve(getMosaicsFn(newFrom, ocsCreatedAt));
              } else if (newFrom < numResults) {
                resolve(getMosaicsFn(newFrom, ocsCreatedAt));
              } else {
                // Remove all duplicate images that can occur due to the issue with group ID collapse
                // causing the same product to appear multiple times if group members vary enough in
                // the sort field, in this case ocs_created_date. Ideally we'd do a lexigraphical sort
                // on the group_id field but this sort of range query on a string is quite slow (works quickly on numbers)
                // so we'll need to instead accept the duplicate products and group once we have all of the requested and flattened
                // group members together.
                const imageSet = filterDupesByKey(allImages, config.es_mappings.id.key);

                // Group all images and get best images
                const groupedImages = groupProductsBy(imageSet, config.es_mappings.group_id);
                const bestImages = [];
                Object.values(groupedImages).forEach((images) => {
                  if (images.length > 0) {
                    // Compute best image within the group
                    const bestImage = determineBestImageInGroup(images, config.image_ranking_criteria);
                    bestImages.push(bestImage);
                  }
                });
                resolve({ mosaics: bestImages, totalKB, numResults: allImages.length, success: true });
              }
            }
          })
          .catch((err) => reject(err));
      });
    };
    // Fetch first page of results
    getMosaicsFn(from)
      .then((obj) => resolve(obj))
      .catch((err) => reject(err));
  });
}

export function fetchMosaicsWithAutoRetry(ssosession, minutesLimitFromNow, from, ocsCreatedAt, retriesRemaining = 5) {
  return new Promise((resolve, reject) => {
    let retryWaitTime = 1000; // ms to wait before retrying a query
    let nextPageWaitTime = 100; // ms to wait before getting the next page
    fetchMosaics(ssosession, minutesLimitFromNow, from, ocsCreatedAt)
      .then((mosaics) => {
        sleep(nextPageWaitTime).promise.then(() => {
          resolve(mosaics);
        });
      })
      .catch((err) => {
        let newRetriesRemaining = retriesRemaining - 1;
        if (newRetriesRemaining > 0) {
          // double wait time if we've failed twice
          sleep(retryWaitTime < 3 ? retryWaitTime * 2 : retryWaitTime).promise.then(() => {
            fetchMosaicsWithAutoRetry(ssosession, minutesLimitFromNow, from, ocsCreatedAt, newRetriesRemaining)
              .then((mosaics) => resolve(mosaics))
              .catch((err) => {
                reject(err);
              });
          });
        } else {
          logError('Unable to fetch mosaics, retry limit of 5 exceeded', err);
          reject(err);
        }
      });
  });
}

export function fetchMosaics(ssosession, minutesLimitFromNow, from = 0, ocsCreatedAt = '') {
  const config = getConfig();
  return new Promise((resolve, reject) => {
    // Fetch mosaics given ssosession, if no ssosession attempt to use cookies, implement auto retry for failed requests
    // should also automatically handle pagination of results to avoid request failures
    const quicklookQuery = [
      { terms: { ocs_package_name: config.mosaic_timeline.quicklook_packages } },
      { terms: { ocs_type_name: ['m20-quicklook'] } },
      {
        bool: {
          should: [{ match: { is_source_product: true } }],
        },
      },
      {
        bool: {
          should: [
            // Mastcam-Z quicklooks
            {
              query_string: {
                query: `QZCAM*`,
                fields: ['ocs_name'],
              },
            },
            // SuperCam mosaic quicklooks
            { terms: { instrument_id: ['SCAM-RMI-Mosaics'] } },
          ],
        },
      },
    ];
    const mosaicsQuery = [
      { terms: { ocs_package_name: config.mosaic_timeline.mosaic_packages } },
      { terms: { ocs_type_name: ['m20-mosaic'] } },
      {
        bool: {
          should: [{ match: { is_source_product: true } }],
          must_not: [{ match: { ext: 'VIC' } }],
        },
      },
      {
        bool: {
          should: [
            // Navcam, Supercam RMI Mosaic, SHERLOC Watson Mosaic, ZCAM Mosaics, Heli mosaics
            { terms: { projection: ['Cylindrical', 'Perspective'] } },
            {
              bool: {
                must: [{ terms: { instrument_id: ['Z'] } }, { terms: { projection: ['Cylindrical', 'Perspective'] } }],
              },
            },
            // Colorglyphs
            {
              bool: {
                must: [{ terms: { projection: ['Cylindrical Perspective'] } }, { terms: { eye_type: ['Colorglyph'] } }],
              },
            },
            // MSSS SHERLOC mosaics
            {
              bool: {
                must: [
                  { terms: { producer: ['MSSS'] } },
                  { terms: { instrument_id: ['I', 'S', 'C'] } }, // I, S, C are SHERLOC (I and S are the same)
                ],
              },
            },
            // Heli mosaics
            {
              bool: {
                must: [
                  { terms: { projection: ['Orthorectified'] } },
                  { terms: { instrument_id: ['V', 'H'] } }, // V and H are both Heli
                ],
              },
            },
            // Heli vertical mosaics
            {
              bool: {
                must: [{ terms: { projection: ['Vertical'] } }, { terms: { instrument_id: ['V', 'H'] } }],
              },
            },
          ],
        },
      },
    ];
    let lastUpdatedQuery;
    let createdAtQuery;
    if (!ssosession && minutesLimitFromNow > 0) {
      const QUERY_TIME_FORMAT = 'YYYY-MM-DD[T]HH:mm:ss[Z]';
      const minDate = moment(new Date()).subtract(minutesLimitFromNow, 'minutes').format(QUERY_TIME_FORMAT);
      lastUpdatedQuery = { range: { ocs_updated_at: { format: 'date_optional_time', gte: minDate } } };
      quicklookQuery.push(lastUpdatedQuery);
      mosaicsQuery.push(lastUpdatedQuery);
    }
    if (ocsCreatedAt) {
      createdAtQuery = { range: { ocs_created_at: { format: 'date_optional_time', lte: ocsCreatedAt } } };
      quicklookQuery.push(createdAtQuery);
      mosaicsQuery.push(createdAtQuery);
    }
    const body = {
      query: { bool: { should: [{ bool: { must: quicklookQuery } }, { bool: { must: mosaicsQuery } }] } },
      sort: [{ ocs_created_at: { order: 'desc', unmapped_type: 'long' } }],
      size: MOSAICS_QUERY_PAGE_SIZE,
      from,
      track_total_hits: true,
      aggs: {
        group_count: {
          cardinality: {
            field: 'group_id',
          },
        },
      },
      collapse: {
        field: 'group_id',
        inner_hits: {
          size: 200,
          name: 'group_members',
          ignore_unmapped: true,
          _source: {
            includes: [
              'activity_name_rtt',
              'target_name_rtt',
              'seq_id_rtt',
              'sol',
              'instrument_id',
              'instrument2_id',
              'ocs_name',
              'ocs_path',
              'ocs_type_name',
              'ocs_package_name',
              'ocs_url',
              'eye_type',
              'overlay_id',
              'group_id',
              'product_type',
              'description',
              'description_field',
              'time1',
              'producer',
              'site',
              'drive',
              'flight',
              'projection',
              'version',
              'vicar_label.system.NL',
              'vicar_label.system.NS',
            ],
          },
        },
      },
      _source: { includes: ['ocs_created_at'] },
    };
    const bodyString = JSON.stringify(body);
    const headers = {
      accept: 'application/json',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/json',
    };
    let credentials = '';
    if (ssosession) headers.cookie = 'ssosession=' + ssosession;
    else credentials = 'include';

    const url = urljoin(config.es_url, config.mosaic_timeline.es_types, '_search?');
    fetch(url, {
      headers,
      body: bodyString,
      method: 'POST',
      ...(credentials ? { credentials } : null),
    })
      .then((results) => {
        results
          .json()
          .then((json) => {
            try {
              const hits = json.hits;
              const aggregations = json.aggregations;
              if (!hits) {
                console.error('No hits found in query');
                return reject(new Error('No hits found in query'));
              }
              const kbytes = results.headers.get('Content-Length') / 1000;

              // Collect all the individual group members
              const allImages = [];
              hits.hits.map((group, _i) =>
                group.inner_hits.group_members.hits.hits.forEach((x) => {
                  allImages.push(x._source);
                })
              );
              const numResults = aggregations.group_count.value;
              const lastOcsCreatedAt =
                hits.hits.length > 0 ? getPropFromProduct(hits.hits.at(-1)._source, config.es_mappings.created_at) : -1;
              resolve({
                images: allImages,
                numResults,
                kbytes,
                lastOcsCreatedAt,
              });
            } catch (err) {
              console.error('Unable to fetch mosaics, error parsing response:', err);
              reject(err);
            }
          })
          .catch((err) => {
            console.error('Unable to fetch mosaics, bad JSON response:', err);
            reject(err);
          });
      })
      .catch((err) => {
        console.error('Unable to fetch mosaics:', err);
        reject(err);
      });
  });
}

export function sleep(ms) {
  let timeoutFn;
  const promise = new Promise((resolve) => {
    timeoutFn = setTimeout(() => resolve(), ms);
  });
  return { promise, timeoutFn };
}

export function filterDupesByKey(itemList, key) {
  return itemList.reduce(
    (acc, item) => {
      const itemVal = getDescendantProp(item, key);
      if (!acc.map[itemVal]) {
        acc.map[itemVal] = true;
        acc.list.push(item);
      }
      return acc;
    },
    { map: {}, list: [] }
  ).list;
}

export function getCategoryImages(ssosession, categoryConfig, minutesLimitFromNow = -1, disableRetries = false) {
  if (!categoryConfig || !categoryConfig.categories || !Array.isArray(categoryConfig.categories)) {
    return Promise.reject(new Error('Invalid category configuration'));
  }

  const fetchSequentially = async () => {
    const categoryResults = [];
    for (const category of categoryConfig.categories) {
      const result = await fetchSingleCategoryImages(
        ssosession,
        categoryConfig,
        category,
        minutesLimitFromNow,
        disableRetries
      );
      categoryResults.push(result);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return categoryResults;
  };

  return fetchSequentially().then((categoryResults) => {
    let allImages = [];
    let totalKB = 0;
    let success = true;

    categoryResults.forEach((result) => {
      if (result && result.images) {
        // Tag each image with its category_id
        result.images.forEach((image) => {
          image._category_id = result.category_id;
        });
        allImages = allImages.concat(result.images);
        totalKB += result.totalKB || 0;
      } else {
        success = false;
      }
    });

    return { images: allImages, totalKB, numResults: allImages.length, success };
  });
}

function fetchSingleCategoryImages(ssosession, categoryConfig, category, minutesLimitFromNow, disableRetries = false) {
  const config = getConfig();
  return new Promise((resolve, _reject) => {
    let page = 0;
    let from = page * MOSAICS_QUERY_PAGE_SIZE;
    let allImages = [];
    let totalKB = 0;
    let ocsCreatedAt = '';
    let totalPagesProcessed = 0;
    const MAX_PAGES = 50;
    let previousOcsCreatedAt = '';

    const fetchPageFn = (from) => {
      totalPagesProcessed += 1;

      if (totalPagesProcessed > MAX_PAGES) {
        console.error(`Category ${category.id}: Exceeded max pages limit (${MAX_PAGES}), stopping pagination`);
        const imageSet = filterDupesByKey(allImages, config.es_mappings.id.key);
        const groupedImages = groupProductsBy(imageSet, config.es_mappings.group_id);
        const bestImages = [];
        Object.values(groupedImages).forEach((images) => {
          if (images.length > 0) {
            const bestImage = determineBestImageInGroup(images, config.image_ranking_criteria);
            bestImages.push(bestImage);
          }
        });
        return { category_id: category.id, images: bestImages, totalKB, numResults: allImages.length, success: true };
      }

      const fetchFn = disableRetries ? fetchCategoryImages : fetchCategoryImagesWithAutoRetry;
      return fetchFn(ssosession, categoryConfig, category, minutesLimitFromNow, from, ocsCreatedAt)
        .then((results) => {
          if (!results) {
            return -1;
          }
          const { images, numResults, kbytes, lastOcsCreatedAt } = results;

          allImages = allImages.concat(images);
          totalKB += kbytes;
          if (numResults === -1) {
            return { images: [], totalKB, numResults: allImages.length, success: false };
          }

          // Check if no more images to fetch
          if (images.length === 0) {
            const imageSet = filterDupesByKey(allImages, config.es_mappings.id.key);
            const groupedImages = groupProductsBy(imageSet, config.es_mappings.group_id);
            const bestImages = [];
            Object.values(groupedImages).forEach((images) => {
              if (images.length > 0) {
                const bestImage = determineBestImageInGroup(images, config.image_ranking_criteria);
                bestImages.push(bestImage);
              }
            });
            return {
              category_id: category.id,
              images: bestImages,
              totalKB,
              numResults: allImages.length,
              success: true,
            };
          }

          page += 1;
          let newFrom = page * MOSAICS_QUERY_PAGE_SIZE;
          if (newFrom + MOSAICS_QUERY_PAGE_SIZE > 10000) {
            // Check if ocsCreatedAt is changing (if not, we're stuck)
            if (lastOcsCreatedAt === previousOcsCreatedAt && previousOcsCreatedAt !== '') {
              console.warn(
                `Category ${category.id}: ocsCreatedAt not changing (${lastOcsCreatedAt}), stopping pagination to prevent infinite loop`
              );
              const imageSet = filterDupesByKey(allImages, config.es_mappings.id.key);
              const groupedImages = groupProductsBy(imageSet, config.es_mappings.group_id);
              const bestImages = [];
              Object.values(groupedImages).forEach((images) => {
                if (images.length > 0) {
                  const bestImage = determineBestImageInGroup(images, config.image_ranking_criteria);
                  bestImages.push(bestImage);
                }
              });
              return {
                category_id: category.id,
                images: bestImages,
                totalKB,
                numResults: allImages.length,
                success: true,
              };
            }

            previousOcsCreatedAt = lastOcsCreatedAt;
            newFrom = 0;
            page = 0;
            ocsCreatedAt = lastOcsCreatedAt;
            return fetchPageFn(newFrom);
          } else if (newFrom < numResults) {
            return fetchPageFn(newFrom);
          } else {
            const imageSet = filterDupesByKey(allImages, config.es_mappings.id.key);
            const groupedImages = groupProductsBy(imageSet, config.es_mappings.group_id);
            const bestImages = [];
            Object.values(groupedImages).forEach((images) => {
              if (images.length > 0) {
                const bestImage = determineBestImageInGroup(images, config.image_ranking_criteria);
                bestImages.push(bestImage);
              }
            });
            return {
              category_id: category.id,
              images: bestImages,
              totalKB,
              numResults: allImages.length,
              success: true,
            };
          }
        })
        .catch((err) => {
          console.error(`Error fetching page for category ${category.id}:`, err);
          throw err;
        });
    };
    fetchPageFn(from)
      .then((obj) => resolve(obj))
      .catch((err) => {
        console.error(`Error fetching category ${category.id}:`, err);
        resolve({ category_id: category.id, images: [], totalKB: 0, numResults: 0, success: false });
      });
  });
}

export function fetchCategoryImagesWithAutoRetry(
  ssosession,
  categoryConfig,
  category,
  minutesLimitFromNow,
  from,
  ocsCreatedAt,
  retriesRemaining = 5
) {
  return new Promise((resolve, reject) => {
    let retryWaitTime = 1000;
    let nextPageWaitTime = 100;
    fetchCategoryImages(ssosession, categoryConfig, category, minutesLimitFromNow, from, ocsCreatedAt)
      .then((images) => {
        sleep(nextPageWaitTime).promise.then(() => {
          resolve(images);
        });
      })
      .catch((err) => {
        let newRetriesRemaining = retriesRemaining - 1;
        if (newRetriesRemaining > 0) {
          sleep(retryWaitTime < 3 ? retryWaitTime * 2 : retryWaitTime).promise.then(() => {
            fetchCategoryImagesWithAutoRetry(
              ssosession,
              categoryConfig,
              category,
              minutesLimitFromNow,
              from,
              ocsCreatedAt,
              newRetriesRemaining
            )
              .then((images) => resolve(images))
              .catch((err) => {
                reject(err);
              });
          });
        } else {
          logError('Unable to fetch category images, retry limit of 5 exceeded', err);
          reject(err);
        }
      });
  });
}

export function fetchCategoryImages(
  ssosession,
  categoryConfig,
  category,
  minutesLimitFromNow,
  from = 0,
  ocsCreatedAt = ''
) {
  const config = getConfig();
  return new Promise((resolve, reject) => {
    if (!categoryConfig || !category || !category.es_query) {
      reject(new Error('Invalid category configuration'));
      return;
    }

    // Start with arrays for different query types
    const mustArray = [];
    const shouldArray = [];
    const mustNotArray = [];

    // Merge base_query if it exists
    if (categoryConfig.base_query && categoryConfig.base_query.bool) {
      if (categoryConfig.base_query.bool.must) {
        mustArray.push(...categoryConfig.base_query.bool.must);
      }
      if (categoryConfig.base_query.bool.should) {
        shouldArray.push(...categoryConfig.base_query.bool.should);
      }
      if (categoryConfig.base_query.bool.must_not) {
        mustNotArray.push(...categoryConfig.base_query.bool.must_not);
      }
    }

    // Add category-specific query
    if (category.es_query.bool) {
      if (category.es_query.bool.must) {
        mustArray.push(...category.es_query.bool.must);
      }
      if (category.es_query.bool.should) {
        shouldArray.push(...category.es_query.bool.should);
      }
      if (category.es_query.bool.must_not) {
        mustNotArray.push(...category.es_query.bool.must_not);
      }
    }

    let lastUpdatedQuery;
    let createdAtQuery;
    if (!ssosession && minutesLimitFromNow > 0) {
      const QUERY_TIME_FORMAT = 'YYYY-MM-DD[T]HH:mm:ss[Z]';
      const minDate = moment(new Date()).subtract(minutesLimitFromNow, 'minutes').format(QUERY_TIME_FORMAT);
      lastUpdatedQuery = { range: { ocs_updated_at: { format: 'date_optional_time', gte: minDate } } };
    }
    if (ocsCreatedAt) {
      createdAtQuery = { range: { ocs_created_at: { format: 'date_optional_time', lte: ocsCreatedAt } } };
    }

    if (lastUpdatedQuery) mustArray.push(lastUpdatedQuery);
    if (createdAtQuery) mustArray.push(createdAtQuery);

    const finalQuery = {
      bool: {
        must: mustArray,
        ...(shouldArray.length > 0 && { should: shouldArray }),
        ...(mustNotArray.length > 0 && { must_not: mustNotArray }),
      },
    };

    const body = {
      query: finalQuery,
      sort: [{ ocs_created_at: { order: 'desc', unmapped_type: 'long' } }],
      size: MOSAICS_QUERY_PAGE_SIZE,
      from,
      track_total_hits: true,
      aggs: {
        group_count: {
          cardinality: {
            field: 'group_id',
          },
        },
      },
      collapse: {
        field: 'group_id',
        inner_hits: {
          size: 200,
          name: 'group_members',
          ignore_unmapped: true,
          _source: {
            includes: categoryConfig.source_fields || [
              'activity_name_rtt',
              'target_name_rtt',
              'seq_id_rtt',
              'sol',
              'instrument_id',
              'instrument2_id',
              'ocs_name',
              'ocs_path',
              'ocs_type_name',
              'ocs_package_name',
              'ocs_url',
              'eye_type',
              'overlay_id',
              'group_id',
              'product_type',
              'description',
              'description_field',
              'time1',
              'producer',
              'site',
              'drive',
              'flight',
              'projection',
              'version',
              'vicar_label.system.NL',
              'vicar_label.system.NS',
            ],
          },
        },
      },
      _source: { includes: ['ocs_created_at'] },
    };

    const bodyString = JSON.stringify(body);
    const headers = {
      accept: 'application/json',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/json',
    };
    let credentials = '';
    if (ssosession) headers.cookie = 'ssosession=' + ssosession;
    else credentials = 'include';

    const url = urljoin(config.es_url, categoryConfig.es_types.join(','), '_search?');
    fetch(url, {
      headers,
      body: bodyString,
      method: 'POST',
      ...(credentials ? { credentials } : null),
    })
      .then((results) => {
        results
          .json()
          .then((json) => {
            try {
              const hits = json.hits;
              const aggregations = json.aggregations;
              if (!hits) {
                console.error('No hits found in query');
                return reject(new Error('No hits found in query'));
              }
              const kbytes = results.headers.get('Content-Length') / 1000;
              const allImages = [];
              hits.hits.map((group) =>
                group.inner_hits.group_members.hits.hits.forEach((x) => {
                  allImages.push(x._source);
                })
              );
              const numResults = aggregations.group_count.value;
              const lastOcsCreatedAt =
                hits.hits.length > 0 ? getPropFromProduct(hits.hits.at(-1)._source, config.es_mappings.created_at) : -1;
              resolve({
                images: allImages,
                numResults,
                kbytes,
                lastOcsCreatedAt,
              });
            } catch (err) {
              console.error('Unable to fetch category images, error parsing response:', err);
              reject(err);
            }
          })
          .catch((err) => {
            console.error('Unable to fetch category images, bad JSON response:', err);
            reject(err);
          });
      })
      .catch((err) => {
        console.error('Unable to fetch category images:', err);
        reject(err);
      });
  });
}
