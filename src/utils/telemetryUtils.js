import moment from 'moment';
import platform from 'platform';
import { v4 as uuidv4 } from 'uuid';
import config from '../../configs/config.js';
import { csso } from '../utils/csso.js';

let appPassword = process.env.APP_ACCOUNT_PASS || null; // check for existence of app password from Docker, this should exist for all non-local deployments
let appAccount = process.env.APP_ACCOUNT_USER || config?.mosaic_timeline?.app_account_user; // check for existence of app account from Docker, this should exist for all non-local deployments

let isometricFetch = fetch;
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  isometricFetch = window.fetch;
}

const isNode = typeof process === 'object' && typeof window === 'undefined';

// Inspired by ASTTRO telemetry logging:
// https://github.jpl.nasa.gov/OnSight/OnSight/blob/main/web/asttronsight/script/app/utils/telemetryHelpers.js

const pid = uuidv4();
const startTime = moment.now();
let deviceId;
if (typeof localStorage === 'object' && localStorage.getItem('deviceId')) {
  deviceId = localStorage.getItem('deviceId');
} else deviceId = uuidv4();

if (typeof localStorage === 'object') localStorage.setItem('deviceId', deviceId);

const baseTelemetryEvent = {
  pid,
  deviceId,
  appVersion: process.env.ASTRIA_APP_VERSION,
  origin: !isNode ? window.location.origin : 'server',
  browser: platform.name,
  os: platform.os.toString(),
  ua: platform.ua,
  level: 'info',
  source: !isNode ? config.app_title : `${config.app_title}Server`,
};

export const timeSinceAwake = () => {
  return moment.now() - startTime;
};

export const send = (eventType, eventData) => {
  try {
    if (!config.telemetry_url || !config.feature_flags.general.enable_telemetry_logging) {
      return null; // No telemetry service available
    }

    const obj = {
      eventType,
      timestamp: moment.utc().toISOString(),
    };

    // Manually spread the eventData properties
    Object.keys(eventData).forEach((key) => (obj[key] = eventData[key]));

    const e = Object.assign({}, baseTelemetryEvent, obj);

    if (!isNode) e.url = window.location.href.toString();

    // Log service only supports string values, so convert everything to string
    Object.keys(e).forEach((key) => {
      if (typeof e[key] === 'number' || typeof e[key] === 'boolean') {
        e[key] = e[key].toString();
      }
    });

    const postTelemetry = (ssosession = '') => {
      const headers = {};
      let credentials = '';
      if (ssosession) headers.cookie = 'ssosession=' + ssosession;
      else credentials = 'include';

      isometricFetch(config.telemetry_url, {
        method: 'POST',
        body: JSON.stringify(e),
        ...(credentials ? { credentials } : null),
        headers,
      });
    };

    // If this is node we'll have to get app account session to auth the request
    if (isNode) {
      const loginAndPost = () => {
        // Get ssosession and then post telemetry
        csso({ user: appAccount, pass: appPassword })
          .then((ssosession) => postTelemetry(ssosession))
          .catch((err) => {
            console.log(err);
          });
      };
      if (!appPassword) {
        console.log('No app password provided, cannot send telemetry');
        return;
      } else loginAndPost(); // if we have the app password we can post right away
    } else {
      // Client-side scenario
      postTelemetry();
    }
  } catch (err) {
    console.warn(err);
    return false;
  }
  return true;
};

export function logError(message, exception) {
  console.error(`${message}:`, exception);
  sendError(
    `${message}: ${exception.message}. Stack trace: ${
      exception.stack ? exception.stack.toString() : 'Trace unavailable'
    }`
  );
}

export function logWarning(message) {
  console.warn(message);
  sendWarning(message);
}

export function sendError(exception) {
  const e = Object.assign({}, baseTelemetryEvent, { level: 'error' }, { exception });
  send('error', e);
}

export function sendWarning(warning) {
  const e = Object.assign(
    {},
    baseTelemetryEvent,
    { level: 'error' }, // info and error are the only two options for this OCS service
    { warning }
  );
  send('warning', e);
}

export const initialDataLoaded = () => {
  send('initialDataLoaded', { loadTimeMS: timeSinceAwake() });
};

/* TODO discount initial searches performed on page load? */
export const searchPerformed = (searchTab, searchTimeMS, queryString) => {
  send('searchPerformed', { searchTab, searchTimeMS, queryString });
};

/* TODO: filename or ocs_url? Technically get the full ocs_url in the URL we send too, might be easier to scan filename in logs? Or could send both... */
export const searchProductClicked = (filename, sol, objectType, instrument) => {
  send('searchProductClicked', { filename, sol, objectType, instrument });
};

export const imageGroupLoaded = (filename, sol, objectType, loadTimeMS, success) => {
  send('imageGroupLoaded', { filename, sol, objectType, loadTimeMS, success });
};

export const rdrOverlayAdded = (filename, instrument, productType) => {
  send('rdrOverlayAdded', { filename, instrument, productType });
};

export const measurementAdded = (filename, instrument) => {
  send('measurementAdded', { filename, instrument });
};

export const imageExported = (filename, options, imageExportTimeMS, exportedImageDimensions) => {
  send('imageExported', {
    filename,
    imageExportOptions: JSON.stringify(options),
    imageExportTimeMS,
    exportedImageDimensions: JSON.stringify(exportedImageDimensions),
  });
};

export const targetAdded = (objectType) => {
  send('targetAdded', { objectType });
};

export const mosaicsGathered = (mosaicGatherTimeMS, mosaicGatherKB, mosaicGatherCount) => {
  send('mosaicsGathered', { mosaicGatherTimeMS, mosaicGatherKB, mosaicGatherCount });
};

// Initialize our onerror handler
if (typeof window !== 'undefined' && window !== null) {
  window.onerror = function (message, url, lineNumber, columnNumber, error) {
    // TODO do we want to send stack trace? How useful will it be without sourcemaps once we build this?
    const stack = error ? error.stack.toString() : '';
    sendError(`${message}\nIn script ${url} at line #${lineNumber} and column #${columnNumber}. Stack trace: ${stack}`);
  };
}
