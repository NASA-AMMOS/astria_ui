import moment from 'moment';
import 'moment-timezone';
import queryString from 'query-string';
import { getConfig } from './configRegistry.js';
import { getDescendantProp, getPropFromProduct } from './sharedUtils.js';

export const getESBaseQueryString = () => {
  const config = getConfig();
  return config.es_type ? `${config.es_url}/${config.es_type}/_search?` : `${config.es_url}/_search?`;
};

function defaultEquality(i1, i2) {
  return i1 === i2;
}

export function isDefined(val, isNumber = false) {
  const stdCheck = typeof val !== 'undefined' && val !== null;
  if (isNumber) {
    return stdCheck && !isNaN(parseFloat(val));
  }
  return stdCheck;
}

// useful in place of `val1 || val2` where `false` is a valid value
export function getDefined(val1, val2, isNumber = false) {
  if (isDefined(val1, isNumber)) {
    return val1;
  }
  return val2;
}

export function flattenObjectKeys(obj, prefix = '') {
  return Object.keys(obj).reduce((keys, key) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenObjectKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
    return keys;
  }, []);
}

export function replaceInString(string, index, str) {
  return `${string.substr(0, index)}${str}${string.substr(index + str.length)}`;
}

export function arraysEqual(a, b, itemsEqualPredicate = defaultEquality) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  // If you don't care about the order of the elements inside
  // the array, you should sort both arrays here.

  for (let i = 0; i < a.length; ++i) {
    if (!itemsEqualPredicate(a[i], b[i])) {
      return false;
    }
  }

  return true;
}

export function objAlphaSort(arr, key, reverse = false, ignoreCase = true, numeric = false) {
  const sorted = [...arr].sort((a, b) => {
    let valA = `${getDescendantProp(a, key)}` || '';
    let valB = `${getDescendantProp(b, key)}` || '';

    // ignore upper and lowercase
    if (ignoreCase) {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    const comparison = valA.localeCompare(valB, undefined, { numeric });
    if (comparison < 0) {
      return reverse ? 1 : -1;
    }
    if (comparison > 0) {
      return reverse ? -1 : 1;
    }
    return 0;
  });

  return sorted;
}

/**
 * Send support email
 *
 * @param {String} subject
 * @param {String} message
 * @param {String} url
 */
export function openSupportEmail({ subject, message }) {
  const config = getConfig();
  const url = window.location.toString();
  const address = config.support_email_address;
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(`URL: ${url}\nIssue: ${message}`);
  window.open(`mailto:${address}?subject=${encodedSubject}&body=${encodedBody}`, '_blank');
}

/**
 * Send generic email
 *
 * @param {String} subject
 * @param {String} message
 * @param {String} url
 */
export function openGenericEmail({ subject, message }) {
  const config = getConfig();
  const address = config.api_endpoints.ScienceIntent.science_information_manager_email;
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(message);
  console.log(encodedBody);
  window.open(`mailto:${address}?subject=${encodedSubject}&body=${encodedBody}`, '_blank');
}

/**
 * Get file extension without the dot
 *
 * @param {Object} ES OCS object
 */
export function getFileExtensionFromProduct(product) {
  const config = getConfig();
  const filename = getPropFromProduct(product, config.es_mappings.filename);
  return getExtension(filename).toLocaleLowerCase();
}

/**
 * Determine if OCS object is a supported
 * file type for regular image viewing in ASTRIA
 *
 * @param {Object} ES OCS object
 */
export function isOSDViewableFileType(product) {
  return getConfig().non_OSD_file_extensions.indexOf(getFileExtensionFromProduct(product)) < 0;
}

/**
 * Determine if a product is a GIF or PDF nicely
 *
 * @param {Object} ES OCS object
 */
export function getProductFileType(product) {
  const config = getConfig();
  let isPDF = false;
  let isGIF = false;

  if (getPropFromProduct(product, config.es_mappings.filename, null)) {
    const productIsOSDViewable = isOSDViewableFileType(product);
    if (!productIsOSDViewable) {
      const ext = getFileExtensionFromProduct(product);
      if (ext === 'gif') isGIF = true;
      else if (ext === 'pdf') isPDF = true;
    }
  }
  return {
    isPDF,
    isGIF,
  };
}

/**
 * Open url in new tab
 *
 * @param {String} url
 */
export function openInNewTab(url, encode = true) {
  window.open(encode ? encodeURI(url) : url, '_blank', 'noreferrer');
}

/**
 * Determine whether a product is a custom product (e.g. in practice not an edr-rdr or mosaic type)
 *
 * @param {Object} product
 */
export function isCustomProduct(product) {
  const config = getConfig();
  return config.custom_product_types.indexOf(getPropFromProduct(product, config.es_mappings.object_type)) > -1;
}

/**
 * Determine whether a product is a tile.
 *
 * @param {Object} product
 */
export function isTile(product) {
  return getPropFromProduct(product, getConfig().es_mappings.tile_flag, false);
}

/**
 * Determine whether a product is an annotatable custom product
 * This includes single frame images, mosaics, quicklook images (png, jpeg, tiff), and user upload images (png, jpeg, tiff).
 *
 * @param {Object} product
 */
export function isAnnotatableProduct(product) {
  const acceptedImageExtensions = ['png', 'jpg', 'jpeg', 'tiff'];
  return (
    !isCustomProduct(product) ||
    acceptedImageExtensions.indexOf(
      getExtension(getPropFromProduct(product, getConfig().es_mappings.filename)).toLowerCase()
    ) > -1 // determine extension ourselves since the "ext" field is not always populated
  );
}

/**
 * Get extension from path
 *
 * @param {string} path
 */
export function getExtension(path) {
  return path.split('.').pop();
}

/**
 * Determine whether a product is an annotation product
 * @param {Object} product
 */
export function isAnnotation(product) {
  const config = getConfig();
  return getPropFromProduct(product, config.es_mappings.object_type) === config.object_type_mappings.annotation;
}

/**
 * Determine whether a product is a target
 * @param {Object} product
 */
export function isTarget(product) {
  return getPropFromProduct(product, getConfig().es_mappings.object_type) === 'm20-target';
}

/**
 * Determine whether a product is a feature
 * @param {Object} product
 */
export function isFeature(product) {
  const config = getConfig();
  return getPropFromProduct(product, config.es_mappings.object_type) === config.object_type_mappings.image_feature;
}

/**
 * Determine whether a product is a Mosaic
 * @param {Object} product
 */
export function isMosaic(product) {
  const config = getConfig();
  return (
    getPropFromProduct(product, config.es_mappings.object_type, null, false, false) ===
    config.object_type_mappings.mosaic
  );
}

/**
 * Determine whether a product is a edr/rdr
 * @param {Object} product
 */
export function isSingleFrame(product) {
  const config = getConfig();
  return (
    getPropFromProduct(product, config.es_mappings.object_type, null, false, false) ===
    config.object_type_mappings.single_frame
  );
}

/**
 * Determine whether a product is a Heli product
 * @param {Object} product
 */
export function isHeli(product) {
  const heliInstrumentIDs = ['HN', 'HS', 'V', 'H'];
  return heliInstrumentIDs.indexOf(getPropFromProduct(product, getConfig().es_mappings.instrument_id)) > -1;
}

export function getIDForLayer(layer) {
  return getPropFromProduct(layer, getConfig().es_mappings.id);
}

/**
 * Round a number to a specified precision
 */
export function round(num, prec = 4) {
  return Number(Math.round(num + 'e' + prec) + 'e-' + prec);
}

/**
 * Convert a number to a float string representation with at least one decimal point
 *
 * @param {Number} num the number to convert
 * @param {Number} prec (optional) precision
 * @returns
 */
export function toFloatStr(num, prec) {
  if (num % 1 === 0) {
    return num.toFixed(prec || 1);
  }

  if (prec) {
    return round(num, prec).toString();
  }

  return num.toString();
}

/**
 * format a number according to power of 10s
 *
 * @param {Number} value the value to format
 * @param {String} unitSuffix the unit
 * @returns
 */
export function formatWithUnit(value, unitSuffix = 'm', dec = 3) {
  if (value < 0.000001) {
    value *= 1000000000;
    unitSuffix = `n${unitSuffix}`;
  } else if (value < 0.001) {
    value *= 1000000;
    unitSuffix = `μ${unitSuffix}`;
  } else if (value < 0.01) {
    value *= 1000;
    unitSuffix = `m${unitSuffix}`;
  } else if (value < 1) {
    value *= 100;
    unitSuffix = `c${unitSuffix}`;
  } else if (value >= 1000) {
    value /= 1000;
    unitSuffix = `k${unitSuffix}`;
  }
  return `${round(value, dec)} ${unitSuffix}`;
}

// From https://github.com/NASA-AMMOS/MMGIS/blob/58fc382ad26557a0cd18ca7cb9385e50fbb34990/src/essence/Basics/Formulae_/Formulae_.js#L86
export function metersToDegrees(meters) {
  return (meters / getConfig().constants.body_radius) * (180 / Math.PI);
}

export function convertToMeters(value, unit = 'm') {
  const strippedUnit = unit.slice(0, -1);
  switch (strippedUnit) {
    case 'n':
      return value / 1000000000;
    case 'μ':
      return value / 1000000;
    case 'm':
      return value / 1000;
    case 'c':
      return value / 100;
    case 'k':
      return value * 1000;
    default:
      return value;
  }
}

/**
 * Floor a number to a specified precision
 */
export function floor(num, prec = 4) {
  return Number(Math.floor(num + 'e' + prec) + 'e-' + prec);
}

/**
 * Convert a value in degrees to radians
 *
 * @param {Number} deg number in degrees
 * @returns {Number} number in radians
 */
export function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Convert a value in radians to degrees
 *
 * @param {Number} rad number in radians
 * @returns {Number} number in degrees
 */
export function rad2deg(rad) {
  return rad * (180 / Math.PI);
}

/**
 * Get the angle between the
 *
 * @export
 * @param {Point} p1 {x,y}
 * @param {Point} p2 {x,y}
 * @param {Bool} perp true if the angle should have a 90deg perpendicular
 */
export function angleBetween(p1, p2, perp = false) {
  // make right-to-left consistent
  if (p1.x > p2.x) {
    const tmp = p1;
    p1 = p2;
    p2 = tmp;
  }
  return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI - (perp ? 90 : 0);
}

/**
 * Convert a base 10 value to a base 16 (hex) value
 * It will pad the result to at least 2 digits (i.e. for 256 values)
 *
 * @export
 * @param {Number} c to value to be converted
 * @returns {Number} the value in hex with zero padding
 */
export function componentToHex(c) {
  const hex = c.toString(16);
  return hex.length === 1 ? '0' + hex : hex;
}

/**
 * Convert rgb components to a hex value
 *
 * @export
 * @param {Number} r the red color value [0,256)
 * @param {Number} g the green color value [0,256)
 * @param {Number} b the blue color value [0,256)
 * @returns {String} hex string value of color
 */
export function rgbToHex(r, g, b) {
  return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

/**
 * Convert hex color to rgb
 *
 * @export
 * @param {String} hex value of the color
 * @returns {Object} {r,g,b} representation of the color
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert a string rgb(a) to an object
 *
 * @export
 * @param {String} rgbString the rgb string rgb(255,255,255)
 * @returns {Object} {r,g,b,a} representation of the color
 */
export function rgbStringToObject(rgbString) {
  const rgbPieces = rgbString
    .split('(')[1]
    .split(')')[0]
    .split(',')
    .map((x) => parseFloat(x));
  return { r: rgbPieces[0], g: rgbPieces[1], b: rgbPieces[2], a: rgbPieces[3] };
}

/**
 * Get the alpha component of a color string
 *
 * @param {String} color the color string rgb or hex
 * @returns {Number} the opacity (alpha) of the color string
 * @export
 */
export function getOpacityFromColor(color) {
  if (color.indexOf('rgb') !== -1) {
    const rgb = rgbStringToObject(color);
    if (typeof rgb.a !== 'undefined') {
      return rgb.a;
    }
    return 1;
  }
  return 1; // assume hex values do not use alpha
}

/**
 * Check if two areas intersect
 *
 * @param {Array} areaA area [left, top, right, bottom] of the first area
 * @param {Array} areaB area [left, top, right, bottom] of the second area
 * @returns {Bool} true if the areas intersect
 */
export function areaIntersect(areaA, areaB) {
  return !(areaB[0] > areaA[2] || areaB[2] < areaA[0] || areaB[1] > areaA[3] || areaB[3] < areaA[1]);
}

/**
 * Check if a point is within an area
 *
 * @param {Array} point point [x,y] of the point
 * @param {Array} area area [left, top, right, bottom] of the area
 * @returns {Bool} true if the point is within the area
 */
export function pointAreaIntersect(point, area) {
  return !(area[0] > point[0] || area[2] < point[0] || area[1] > point[1] || area[3] < point[1]);
}

/**
 * Calculate the 2D distance between two points
 *
 * @param {Point} point1 point {x,y} of the first point
 * @param {Point} point2 point {x,y} of the second point
 * @returns {Number} distance between the two points
 */
export function calc2dDistance(point1, point2) {
  return Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2));
}

/**
 * Calculate the midpoint between two points
 * @param {Point} point1 point {x,y} of the first point
 * @param {Point} point2 point {x,y} of the second point
 * @returns {Point} mid-point {x,y} of the two points
 */
export function findMidPoint(point1, point2) {
  return { x: (point1.x + point2.x) / 2, y: (point1.y + point2.y) / 2 };
}

/**
 * Convert a base64 encoded data URI to a blob for exporting
 * see: https://stackoverflow.com/questions/4998908/convert-data-uri-to-file-then-append-to-formdata
 * @param {String} dataURI base64/URLEncoded data string
 * @returns {Blob} representation of the dataURI
 */
export function dataURItoBlob(dataURI) {
  // convert base64/URLEncoded data component to raw binary data held in a string
  let byteString;
  if (dataURI.split(',')[0].indexOf('base64') >= 0) byteString = atob(dataURI.split(',')[1]);
  else byteString = unescape(dataURI.split(',')[1]);

  // separate out the mime component
  let mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

  // write the bytes of the string to a typed array
  let ia = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  return new Blob([ia], { type: mimeString });
}

/**
 * Convert an ArrayBuffer to a bse64 encoded string
 *
 * @param {ArrayBuffer} buffer the buffer to convert
 */
export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = [].slice.call(new Uint8Array(buffer));
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return window.btoa(binary);
}

export function isFullscreen() {
  return !!(
    document.fullscreenElement ||
    document.mozFullScreen ||
    document.webkitIsFullScreen ||
    document.msIsFullscreen
  );
}

export function enterFullscreen(node) {
  const docElm = node || document.documentElement;

  if (docElm.requestFullscreen) {
    docElm.requestFullscreen();
  } else if (docElm.mozRequestFullScreen) {
    docElm.mozRequestFullScreen();
  } else if (docElm.webkitRequestFullScreen) {
    docElm.webkitRequestFullScreen();
  } else if (docElm.msRequestFullscreen) {
    docElm.msRequestFullscreen();
  }
}

export function exitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.webkitCancelFullScreen) {
    document.webkitCancelFullScreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
}

export function formatDate(date, utc = false) {
  if (utc) {
    // Convert to UTC time
    return `${moment(date).tz('utc').format('M/DD/YY, h:mm a')} UTC`;
  }
  // Convert to local time
  const localTime = moment(date).format('M/DD/YY, h:mm a');
  const timeZone = moment.tz.guess();
  const currentTime = new Date();
  const timeZoneOffset = currentTime.getTimezoneOffset();
  const abbrev = moment.tz.zone(timeZone).abbr(timeZoneOffset);
  return `${localTime} ${abbrev}`;
}

export function formatTargetDate(date) {
  // Convert to UTC time
  return `${moment(date).tz('utc').format('MMM DD YYYY hh:mm:ss')} UTC`;
}

export class DeepDiffMapper {
  static VALUE_CREATED = 'created';
  static VALUE_UPDATED = 'updated';
  static VALUE_DELETED = 'deleted';
  static VALUE_UNCHANGED = 'unchanged';

  map(obj1, obj2, ignoreKeys = []) {
    if (this.isFunction(obj1) || this.isFunction(obj2)) {
      throw new Error('Invalid argument. Function given, object expected.');
    }
    if (this.isValue(obj1) || this.isValue(obj2)) {
      const type = this.compareValues(obj1, obj2);
      return {
        changed: type !== DeepDiffMapper.VALUE_UNCHANGED,
        type: this.compareValues(obj1, obj2),
        data: obj1 === undefined ? obj2 : obj1,
      };
    }

    let diff = {};
    let changed = false;
    let key;
    for (key in obj1) {
      if (this.isFunction(obj1[key]) || ignoreKeys.indexOf(key) !== -1) {
        continue;
      }

      let value2 = undefined;
      if (obj2[key] !== undefined) {
        value2 = obj2[key];
      }

      diff[key] = this.map(obj1[key], value2, ignoreKeys);
      changed = changed || diff[key].changed;
    }
    for (key in obj2) {
      if (this.isFunction(obj2[key]) || ignoreKeys.indexOf(key) !== -1 || diff[key] !== undefined) {
        continue;
      }

      diff[key] = this.map(undefined, obj2[key], ignoreKeys);
      changed = changed || diff[key].changed;
    }

    return { diff, changed };
  }
  compareValues(value1, value2) {
    if (value1 === value2) {
      return DeepDiffMapper.VALUE_UNCHANGED;
    }
    if (this.isDate(value1) && this.isDate(value2) && value1.getTime() === value2.getTime()) {
      return DeepDiffMapper.VALUE_UNCHANGED;
    }
    if (value1 === undefined) {
      return DeepDiffMapper.VALUE_CREATED;
    }
    if (value2 === undefined) {
      return DeepDiffMapper.VALUE_DELETED;
    }
    return DeepDiffMapper.VALUE_UPDATED;
  }
  isFunction(x) {
    return Object.prototype.toString.call(x) === '[object Function]';
  }
  isArray(x) {
    return Object.prototype.toString.call(x) === '[object Array]';
  }
  isDate(x) {
    return Object.prototype.toString.call(x) === '[object Date]';
  }
  isObject(x) {
    return Object.prototype.toString.call(x) === '[object Object]';
  }
  isValue(x) {
    return !this.isObject(x) && !this.isArray(x);
  }
}

export const processBestMatchCriteriaType = (images, key, bestOptions) => {
  let matches = [];
  for (let i = 0; i < bestOptions.length; i++) {
    matches = images.filter((image) => getPropFromProduct(image, { key }) === bestOptions[i]);
    if (matches.length) break;
  }
  return matches;
};

export const processHighestNumericValueCriteriaType = (images, key) => {
  let maxValue = -Infinity;
  const keyToImageMap = images.reduce((imageMap, image) => {
    let value = getPropFromProduct(image, { key });
    if (typeof value !== 'number') value = 0;
    if (value > maxValue) maxValue = value;
    if (!imageMap.hasOwnProperty(value)) imageMap[value] = [];
    imageMap[value].push(image);
    return imageMap;
  }, {});
  return keyToImageMap[maxValue] || [];
};

export const processLowestNumericValueCriteriaType = (images, key) => {
  let minValue = Infinity;
  const keyToImageMap = images.reduce((imageMap, image) => {
    let value = getPropFromProduct(image, { key });
    if (typeof value !== 'number') value = 0;
    if (value < minValue) minValue = value;
    if (!imageMap.hasOwnProperty(value)) imageMap[value] = [];
    imageMap[value].push(image);
    return imageMap;
  }, {});
  return keyToImageMap[minValue] || [];
};

export const processHighestStringValueCriteriaType = (images, key) => {
  let maxValue = '';
  const keyToImageMap = images.reduce((imageMap, image) => {
    let value = getPropFromProduct(image, { key });
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
};

export const processLowestStringValueCriteriaType = (images, key) => {
  let minValue = '___HIGH_VALUE___';
  const keyToImageMap = images.reduce((imageMap, image) => {
    let value = getPropFromProduct(image, { key });
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
};

export const determineBestImageInGroup = (images, criteria) => {
  if (!images.length) {
    console.warn('No images given to determineBestImageInGroup');
    return;
  }

  const config = getConfig();

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
};

export const performElasticSearchQuery = (body, signal) => {
  /*
    Note: This function is designed to be wrapped in a try catch and is only
    meant to abstract the actual ES request and basic response sanity checking.
   */
  const config = getConfig();
  return new Promise((resolve, reject) => {
    fetch(getESBaseQueryString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      signal,
      ...(config.using_csso ? { credentials: 'include' } : null),
    })
      .then((response) => {
        if (!response || !response.ok) {
          reject(new Error(response.statusText));
          return null;
        }
        return response.json();
      })
      .then((json) => resolve(json))
      .catch((err) => reject(err));
  });
};

export const getURLParams = (url = window.location.search) => {
  return queryString.parse(url, { arrayFormat: 'comma' });
};

export const getURLForProductWithExistingParams = (product, optParams = {}) => {
  const config = getConfig();
  // Returns URL for product and includes current params that are not specific
  // to the active product

  const urlParams = getURLParams();

  /*
    Collect url keys to remove. For now we'll only preserve:
    - Search keys
    - OCS Package
  */

  const keysToRemove = Object.keys(urlParams).filter(
    (param) =>
      param !== config.url_keys.package &&
      param.indexOf(config.search_config.facet_search.url_prefix) !== 0 &&
      param.indexOf(config.search_config.time_search.url_prefix) !== 0
  );

  // Delete collected keys from urlParams object
  keysToRemove.forEach((key) => delete urlParams[key]);

  // Set search product param to our product
  urlParams[config.url_keys.searchProduct] = getPropFromProduct(product, config.es_mappings.id);

  // combine optional params
  const finalParams = { ...urlParams, ...optParams };

  return constructFullURLWithParams(finalParams);
};

export const constructFullURLWithParams = (params) => {
  // Return full URL for params where params is an object of
  // url key -> values
  return (
    window.location.protocol +
    '//' +
    window.location.host +
    window.location.pathname +
    '?' +
    queryString.stringify(params, { arrayFormat: 'comma' })
  );
};

export const orbitalCoordsToLatLon = (orbitalCoords) => {
  const config = getConfig();
  const x = orbitalCoords[0];
  const y = orbitalCoords[1];

  const ellipsoidHP = config.constants.body_radius;

  const eastingMult = config.constants.easting_multiplier; // per Tariq from CAMP

  const latitude = (x / ellipsoidHP) * (180 / Math.PI);
  const longitude = (y / (ellipsoidHP * eastingMult)) * (180 / Math.PI);

  return { latitude, longitude };
};

export const latLonToOrbitalCoords = (latLon) => {
  const config = getConfig();
  const lat = latLon.latitude;
  const lon = latLon.longitude;

  const ellipsoidHP = config.constants.body_radius;

  const eastingMult = config.constants.easting_multiplier; // per Tariq from CAMP

  const x = (lat / (180 / Math.PI)) * ellipsoidHP;
  const y = (lon / (180 / Math.PI)) * (ellipsoidHP * eastingMult);

  return { x, y };
};

export const cloneObj = (obj) => {
  // TODO - replace with structuredClone?
  return JSON.parse(JSON.stringify(obj)); // probably not quick, definitely dirty
};

export class TileInfoFetchManager {
  constructor(url, onSuccess = () => {}, onError = () => {}, retryDelayMS = 0) {
    this.abortController = null; // abort controller for the request
    this.aborted = false; // whether or not the manager has been aborted
    this.url = url; // url to fetch
    this.retryDelayMS = retryDelayMS; // MS to wait between HTTP 202 retry events
    this.onSuccess = onSuccess;
    this.onError = onError;
  }
  abort() {
    // Cancel in-flight request if active
    if (this.abortController) this.abortController.abort();
    // Indicate that the manager has been aborted so that the request does not retry after sleep timer
    this.aborted = true;
  }
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async fetchTileInfo() {
    if (this.aborted) return;
    try {
      this.abortController = new AbortController();
      const response = await fetch(this.url, { credentials: 'include', signal: this.abortController.signal });
      if (response.status === 202) {
        await this.sleep(this.retryDelayMS);
        return this.fetchTileInfo();
      } else if (response.status === 200 || response.status === 302) {
        this.onSuccess(response);
        return;
      } else {
        this.onError();
      }
    } catch (err) {
      if (err.name === 'AbortError') return; // TODO onAborted callback..?
      console.error(err);
      this.onError(err);
    }
  }
}

export class FetchPollingManager {
  constructor(options) {
    const { url, onPoll = () => {}, onError = () => {}, pollingDelayMS = 0 } = options;

    this.abortController = null; // abort controller for the request
    this.aborted = false; // whether or not the manager has been aborted
    this.url = url; // url to fetch
    this.pollingDelayMS = pollingDelayMS; // MS to wait between HTTP polling
    this.onPoll = onPoll;
    this.onError = onError;

    this.poll();
  }

  abort() {
    // Cancel in-flight request if active
    if (this.abortController) this.abortController.abort();
    // Indicate that the manager has been aborted so that the request does not retry after sleep timer
    this.aborted = true;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async poll() {
    if (this.aborted) return;
    try {
      this.abortController = new AbortController();
      const response = await fetch(this.url, { credentials: 'include', signal: this.abortController.signal });
      if (response.ok) {
        const data = await response.json();
        this.onPoll(data);
      } else {
        this.onError(new Error(response.statusText));
      }
      await this.sleep(this.pollingDelayMS);
      this.poll();
    } catch (err) {
      if (err.name === 'AbortError') return; // TODO onAborted callback..?
      this.onError(err);
    }
  }
}

export const lsToAzEl = (product, lineSample) => {
  const config = getConfig();
  const { line, sample } = lineSample;
  const MAP_RESOLUTION = parseFloat(getPropFromProduct(product, config.es_mappings.map_resolution, -1));
  const START_AZIMUTH = parseFloat(getPropFromProduct(product, config.es_mappings.start_azimuth, -1));
  const ZERO_ELEVATION_LINE = parseFloat(getPropFromProduct(product, config.es_mappings.zero_elevation_line, -1));

  const azimuth = (line) => line / MAP_RESOLUTION + START_AZIMUTH;
  const elevation = (sample) => (ZERO_ELEVATION_LINE - sample) / MAP_RESOLUTION;

  return {
    azimuth: parseFloat(azimuth(sample)),
    elevation: parseFloat(elevation(line)),
  };
};

export const getDescriptionsForProduct = (product, productDescriptions) => {
  const typeKey = getPropFromProduct(product, getConfig().es_mappings.image_type);
  if (!typeKey) return {};
  return productDescriptions[typeKey];
};

export const capitalize = (s) => {
  let capitalizedString = s;
  if (typeof s[0] === 'string') capitalizedString = s[0].toUpperCase() + s.substring(1);
  return capitalizedString;
};

export const getConfidenceLevelLabel = (confidenceLevel) => {
  // Where confidenceLevel is low, medium, or high
  return `${capitalize(confidenceLevel || 'unknown')} Confidence`;
};

export const genWKTString = (options) => {
  const { coords, shape = 'polygon', forceCircle = false } = options;
  if (shape === 'polygon') {
    // no support for inner-cutouts
    const pointPairs = coords.map((c) => {
      if (Array.isArray(c)) {
        // assume [x,y]
        return `${c[0]} ${c[1]}`;
      } else {
        // assume {x, y}
        return `${c.x} ${c.y}`;
      }
    });

    // ensure the ending points match
    if (pointPairs[0] !== pointPairs[pointPairs.length - 1]) {
      if (forceCircle) {
        pointPairs.push(pointPairs[0]);
      } else {
        console.warn('WARN: WKT requires that polygons close coordinates with circular points');
        return false;
      }
    }

    return `POLYGON ((${pointPairs.join(', ')}))`;
  } else if (shape === 'point') {
    if (coords.length !== 1 || coords[0].length !== 2) return false;
    return `POINT (${coords[0][0]} ${coords[0][1]})`;
  } else {
    console.warn('WARN: unsupported WKT shape type');
    return false;
  }
};

export const parseWKTString = (wktString) => {
  const shapeTypeRe = /^\w+/gi;
  const coordSetsRe = /\([-?\d., ]+\)/gi;

  const shapeTypeMatches = wktString.match(shapeTypeRe);
  if (shapeTypeMatches.length) {
    const shape = shapeTypeMatches[0].toLowerCase();
    if (shape === 'polygon') {
      const coordSetsMatches = wktString.match(coordSetsRe);
      if (coordSetsMatches) {
        // no support for inner-cutouts
        const coordString = coordSetsMatches[0];
        const coordPieces = coordString.replace('(', '').replace(')', '').split(',');
        const coords = coordPieces.map((cStr) => {
          return cStr
            .trim()
            .split(' ')
            .map((x) => parseFloat(x));
        });
        return {
          shape,
          coords,
        };
      } else {
        console.warn('WARN: could not parse coordinates from WKT string');
        return false;
      }
    } else {
      console.warn('WARN: unsupported WKT shape type');
      return false;
    }
  } else {
    console.warn('WARN: could not parse shape from WKT string');
    return false;
  }
};

export function getDefaultOperatorControls(imageType) {
  const config = getConfig();
  const imageControl = config.overlay_operator_controls.image_types[imageType];

  if (imageControl) {
    const controlTypes = Array.isArray(imageControl.control_type)
      ? imageControl.control_type
      : [imageControl.control_type];
    const controlGroups = controlTypes.map((type) => {
      const controlBase = config.overlay_operator_controls.control_types[type];
      const controlSet = cloneObj(controlBase); // clone
      controlSet.controls.forEach((control) => {
        control.value = cloneObj(control.default); // clone in case its an array or something

        // fill out defaults
        if (imageControl.defaults) {
          for (const defKey in imageControl.defaults) {
            if (control.key === defKey) {
              // set both the value and the default so we can reset to it easier
              control.value = imageControl.defaults[defKey];
              control.default = imageControl.defaults[defKey];
            } else if (typeof control[defKey] !== 'undefined') {
              // overriding a specific key, index_labels/index_key/etc
              control[defKey] = cloneObj(imageControl.defaults[defKey]); // clone in case its an array or something
            }
          }
        }

        return control;
      });
      return controlSet;
    });
    return controlGroups;
  }
  return [];
}

export function getQueryStringForOperatorControl(control, imageTypeKey) {
  const { type, value, key, index_key, reverse_values } = control;

  // product_type is mission specific, image_type is mission independent

  // convert values to appropriate strings
  let queryVal = value;
  if (value === '') {
    return '';
  } else if (type === 'int') {
    queryVal = `${parseInt(value)}`;
  } else if (type === 'double') {
    queryVal = toFloatStr(parseFloat(value));
  } else if (type === 'bool') {
    queryVal = `${!!value}`;
  } else if (type === 'double[]') {
    if (typeof value === 'string') {
      // assume val is currently formatted for the input ex: '1.0,3, 2.45'
      const queryArr = value
        .replace(' ', '')
        .split(',')
        .map((v) => toFloatStr(parseFloat(v)));

      // deal with legacy things
      if (reverse_values) {
        queryArr.reverse();
      }

      queryVal = `[${queryArr.join(',')}]`;
    } else {
      // assume they entered a single number that was parsed as such
      queryVal = `[${toFloatStr(parseFloat(value))}]`;
    }
  } else if (type === 'int[]') {
    if (typeof value === 'string') {
      // assume val is currently formatted for the input ex: '1.0,3, 2.45'
      const queryArr = value
        .replace(' ', '')
        .split(',')
        .map((v) => `${parseInt(v)}`);

      // deal with legacy things
      if (reverse_values) {
        queryArr.reverse();
      }

      queryVal = `[${queryArr.join(',')}]`;
    } else {
      // assume they entered a single number that was parsed as such
      queryVal = `[${parseInt(value)}]`;
    }
  } else if (type === 'bool[]') {
    const queryArr = value.map((x) => !!x);

    // deal with legacy things
    if (reverse_values) {
      queryArr.reverse();
    }

    queryVal = `[${queryArr.toString()}]`;
  }

  queryVal = `${imageTypeKey}:${index_key || key}=${queryVal}`;
  return `overlayPreference=${encodeURIComponent(queryVal)}`;
}

export function getAdditionalCustomLabelPropsForProduct(product, key, targetKey = 'title') {
  const config = getConfig();
  const additionalProps = {};
  if (
    key === 'activity_name_rtt' ||
    key === 'target_name_rtt' ||
    key === 'product_type' ||
    key === 'sequence_id' ||
    key === 'filename' ||
    key === 'instrument_category' ||
    key === 'instrument_id'
  ) {
    const value = getPropFromProduct(product, config.es_mappings[key]);
    if (value !== config.missing_property_value) {
      const stringValue = Array.isArray(value) ? value.join(', ') : value;
      additionalProps.customLabel = { [targetKey]: stringValue };
    }
  }
  return additionalProps;
}

export function pluralizeByListLength(string, list) {
  if (list.length === 1) return string;
  return string + 's';
}

export function getLocalStorageOption(key, defaultValue, options) {
  const valueType = typeof defaultValue;
  const localStorageValue = localStorage.getItem(key);
  if (!isDefined(localStorageValue, valueType === 'number')) return defaultValue;
  if (valueType === 'string') return localStorageValue;
  if (valueType === 'number') return parseInt(defaultValue); // assume int not float
  if (valueType === 'boolean') return localStorageValue === 'true';
  if (valueType === 'object' && options) {
    // assume it's {value: '', label:''}
    const matchingOption = options.find((option) => option.value.toString() === localStorageValue);
    return matchingOption || defaultValue;
  }
  return defaultValue; // if nothing else
}
