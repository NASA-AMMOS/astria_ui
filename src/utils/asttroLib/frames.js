/**
 * Functions for converting between coordinate frames.
 */

import * as frameDefinition from 'src/utils/asttroLib/frameDefinition';
import { Vector3 } from 'src/utils/asttroLib/vector3';
import { getConfig } from 'src/utils/configRegistry';
const requestHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const quaternionCache = {}; // cache of quaternions to convert directions between frames
const offsetCache = {};

/**
 * Add a transform to the solution cache.
 */
export function addFrameTransform(fromFrame, toFrame, offset, quaternion) {
  const key = `${fromFrame}; ${toFrame}`;
  offsetCache[key] = {
    x: offset.x,
    y: offset.y,
    z: offset.z,
  };
  quaternionCache[key] = {
    qx: quaternion.x,
    qy: quaternion.y,
    qz: quaternion.z,
    qc: quaternion.w,
  };
}

function handleResponse(resolve, reject, onSuccessCallback, response) {
  if (typeof onSuccessCallback !== 'function') {
    // Third param is actually the response
    response = onSuccessCallback;
    onSuccessCallback = null;
  }
  if (response.body.error) {
    reject(
      new Error(
        `${response.status}: ${
          response.body.error.message || response.body.error || response.error.message || response.error
        }`
      )
    );
  } else if (response.status >= 200 && response.status < 300) {
    if (typeof onSuccessCallback === 'function') {
      onSuccessCallback(response.body);
    } else {
      resolve(response.body);
    }
  } else {
    reject(new Error(`${response.status}: ${response.error || response.body.error || response.body}`));
  }
}

/**
 * Rotate a vector by a quaternion
 * @param {*} vec - vector to be rotated
 * @param {*} quaternion - rotation
 * @return {*} rotated vector
 */
function rotateVector(vec, quaternion) {
  const result = {};
  const x = 2 * (quaternion.qy * vec.z - quaternion.qz * vec.y);
  const y = 2 * (quaternion.qz * vec.x - quaternion.qx * vec.z);
  const z = 2 * (quaternion.qx * vec.y - quaternion.qy * vec.x);

  result.x = vec.x + x * quaternion.qc + (quaternion.qy * z - quaternion.qz * y);
  result.y = vec.y + y * quaternion.qc + (quaternion.qz * x - quaternion.qx * z);
  result.z = vec.z + z * quaternion.qc + (quaternion.qx * y - quaternion.qy * x);
  return result;
}

/**
 * Queries ROCS to convert a position vector between coordinate frames.
 * @param {Vector3} pos - position vector
 * @param {toFrame} toFrame - identifier of the frame to conver to.
 * @return {Promise} Resolved with the conversion values from ROCS. Rejected if request fails.
 */
export async function convertPoint(pos, toFrame) {
  if (!pos) {
    throw new Error('No position provided');
  }
  if (!pos.frame) {
    throw new Error('Cannot convert vector with no frame information');
  }
  if (pos.frame === toFrame) {
    return pos;
  }

  // The ROCS frame service cannot convert directly to RMECH.
  // We need to convert to RNAV and then to RMECH.
  if (toFrame.startsWith('RMECH')) {
    const roverFrame = toFrame.replace('RMECH', 'ROVER');
    return convertMultistep(pos, convertPointSimple, [
      { fromFrame: pos.frame, toFrame: roverFrame },
      { fromFrame: 'RNAV', toFrame: 'RMECH' },
    ]);
  }
  // The ROCS frame service cannot convert directly from RMECH
  // We need to convert to RNAV and then to the requested frame
  if (pos.frame.startsWith('RMECH')) {
    const roverFrame = pos.frame.replace('RMECH', 'ROVER');
    return convertMultistep(pos, convertPointSimple, [
      { fromFrame: 'RMECH', toFrame: 'RNAV' },
      { fromFrame: roverFrame, toFrame },
    ]);
  }
  return convertPointSimple(pos, pos.frame, toFrame);
}

export function getOffsetQuaternion(fromFrame, toFrame) {
  return new Promise((resolve, reject) => {
    function doneFunc(offset, quaternion, error) {
      if (error) {
        return reject(error);
      }
      return resolve({
        offset,
        quaternion,
      });
    }
    if (!fromFrame || !toFrame) {
      throw new Error('Missing frame information');
    }
    _getOffsetQuaternion(fromFrame, toFrame, doneFunc);
  });
}

const maxRetries = 5;
const retryWaitTimeStepMs = 1000;
const offsetQuaternionCallbacks = {};
async function _getOffsetQuaternion(fromFrame, toFrame, callback, retryCount = 0) {
  const config = getConfig();
  if (fromFrame === toFrame) {
    callback({ x: 0, y: 0, z: 0 }, { qx: 0, qy: 0, qz: 0, qc: 1 });
    return;
  }

  const key = `${fromFrame}; ${toFrame}`;
  let quaternion = quaternionCache[key];
  let offset = offsetCache[key];
  if (quaternion && offset && callback) {
    callback(offset, quaternion);
    return;
  }
  let callbacks = offsetQuaternionCallbacks[key];
  if (callbacks && callback) {
    callbacks.push(callback);
  } else {
    if (callback) {
      offsetQuaternionCallbacks[key] = [callback];
    }
    try {
      const response = await fetch(`${config.api_endpoints.ROCS.frames}/offset_quaternion/${fromFrame}/${toFrame}`, {
        headers: requestHeaders,
        ...(config.using_csso ? { credentials: 'include' } : null),
      });
      if (isErrorResponse(response)) throw Error('Bad ROCS response');
      const transform = await response.json();

      // If the server response with code 202 (Request Accepted) then the server is trying to refresh it's database.
      // Schedule another call to this function after a short dalay. We will retry up to the max number of tries, with
      // an increasing wait between attempts.
      if (response.status === 202 && retryCount < maxRetries) {
        // Callback has already been registered, so don't pass callback.
        const newRetryCount = retryCount + 1;
        const retryWaitTime = newRetryCount * retryWaitTimeStepMs;
        setTimeout(
          () => _getOffsetQuaternion(fromFrame, toFrame, undefined, newRetryCount),
          retryWaitTime * newRetryCount
        );
        return;
      }

      callbacks = offsetQuaternionCallbacks[key]; // Update callbacks after async operation

      // If we get here with a 202 then we hit the max number of retries, so consider it an error
      if (response.status === 202) {
        if (callbacks) {
          callbacks.forEach((call) => call(null, null, new Error('Bad ROCS response')));
        }
        delete offsetQuaternionCallbacks[key];
      } else {
        quaternion = transform.quaternion;
        offset = transform.offset;
        quaternionCache[key] = quaternion;
        offsetCache[key] = offset;
        if (callbacks) {
          callbacks.forEach((call) => call(offset, quaternion));
        }
        delete offsetQuaternionCallbacks[key];
      }
    } catch (err) {
      callbacks = offsetQuaternionCallbacks[key]; // Update callbacks after async operation
      if (callbacks) {
        callbacks.forEach((call) => call(null, null, err));
      }
      delete offsetQuaternionCallbacks[key];
    }
  }
}

function convertPointSimple(pos, fromFrame, toFrame) {
  return new Promise((resolve, reject) => {
    function doneFunc(offset, quaternion, error) {
      if (error) {
        return reject(error);
      }
      const point = rotateVector(pos, quaternion);
      const ret = new Vector3({
        x: point.x + offset.x,
        y: point.y + offset.y,
        z: point.z + offset.z,
        frame: toFrame,
      });
      return resolve(ret);
    }
    if (!pos || !(pos instanceof Vector3) || !pos.isValid()) {
      reject(Error('No position provided'));
    }
    if (!pos.frame) {
      reject(Error('Cannot convert vector with no frame information'));
    }
    _getOffsetQuaternion(fromFrame, toFrame, doneFunc);
  });
}

/**
 * Queries ROCS to convert a direction vector between coordinate frames.
 * @param {Vector3} pos - position vector
 * @param {toFrame} toFrame - identifier of the frame to conver to.
 * @return {Promise} Resolved with the conversion values from ROCS. Rejected if request fails.
 */
export async function convertDirection(dir, toFrame) {
  if (!dir) {
    throw new Error('No position provided');
  }
  if (!dir.frame) {
    throw new Error('Cannot convert vector with no frame information');
  }

  if (dir.frame === toFrame) {
    return dir;
  }

  // The ROCS frame service cannot convert directly to RMECH.
  // We need to convert to RNAV and then to RMECH.
  if (toFrame.startsWith('RMECH')) {
    const roverFrame = toFrame.replace('RMECH', 'ROVER');
    return convertMultistep(dir, convertDirectionSimple, [
      { fromFrame: dir.frame, toFrame: roverFrame },
      { fromFrame: 'RNAV', toFrame: 'RMECH' },
    ]);
  }
  // The ROCS frame service cannot convert directly from RMECH
  // We need to convert to RNAV and then to the requested frame
  if (dir.frame.startsWith('RMECH')) {
    const roverFrame = dir.frame.replace('RMECH', 'ROVER');
    return convertMultistep(dir, convertPointSimple, [
      { fromFrame: 'RMECH', toFrame: 'RNAV' },
      { fromFrame: roverFrame, toFrame },
    ]);
  }
  return convertDirectionSimple(dir, dir.frame, toFrame);
}

function convertDirectionSimple(dir, fromFrame, toFrame) {
  return new Promise((resolve, reject) => {
    if (!dir || !dir.isValid()) {
      reject(Error('No position provided'));
    }
    function doneFunc(offset, quaternion, error) {
      if (error) {
        return reject(error);
      }
      const rotatedVector = rotateVector(dir, quaternion);
      return resolve(
        new Vector3({
          x: rotatedVector.x,
          y: rotatedVector.y,
          z: rotatedVector.z,
          frame: toFrame,
        })
      );
    }
    const { x, y, z } = dir;
    if (isTranslationOnly(fromFrame, toFrame)) {
      resolve(
        new Vector3({
          x,
          y,
          z,
          frame: toFrame,
        })
      );
    }
    _getOffsetQuaternion(fromFrame, toFrame, doneFunc);
  });
}

async function convertMultistep(pos, convertFunc, steps) {
  if (!pos) {
    throw new Error('No position provided');
  }
  if (!pos.frame) {
    throw new Error('Cannot convert vector with no frame information');
  }

  let pt = pos;
  for (let i = 0; i < steps.length; i++) {
    const { fromFrame, toFrame } = steps[i];
    pt = await convertFunc(pt, fromFrame, toFrame);
  }
  return pt;
}

const positionToModelFrameArgs = function (prefix, pos) {
  return [`${prefix}ROVER_X=${pos.x}`, `${prefix}ROVER_Y=${pos.y}`, `${prefix}ROVER_Z=${pos.z}`];
};

const quaternionToModelFrameArgs = function (prefix, quat) {
  return [
    `${prefix}QUAT_X=${quat.x}`,
    `${prefix}QUAT_Y=${quat.y}`,
    `${prefix}QUAT_Z=${quat.z}`,
    `${prefix}QUAT_C=${quat.w}`,
  ];
};

/**
 * Internal function for converting both points and directions in model frames.
 */
const convertModelFramePointOrDirection = async function ({
  posOrDir,
  toFrame,
  fromSite,
  fromRoverPos,
  fromRoverQuat,
  toSite,
  toRoverPos,
  toRoverQuat,
  fromMastJoints,
  fromArmJoints,
  toMastJoints,
  toArmJoints,
  method,
}) {
  const fromFrame = posOrDir.frame;
  if (!fromFrame) {
    throw new Error('Cannot convert vector with no frame information');
  }
  if (!toFrame) {
    throw new Error("Parameter 'toFrame' is required");
  }
  if (fromFrame.startsWith('MODEL=')) {
    if (!fromRoverPos) {
      throw new Error(`Parameter 'fromRoverPos' is required when transforming from model frame ${fromFrame}`);
    }
    if (!fromRoverQuat) {
      throw new Error(`Parameter 'fromRoverQuat' is required when transforming from model frame ${fromFrame}`);
    }
    if (!fromSite) {
      throw new Error(`Parameter 'fromSite' is required when transforming from model frame ${fromFrame}`);
    }
  }
  if (toFrame.startsWith('MODEL=')) {
    if (!toRoverPos) {
      throw new Error(`Parameter 'toRoverPos' is required when transforming from model frame ${toFrame}`);
    }
    if (!toRoverQuat) {
      throw new Error(`Parameter 'toRoverQuat' is required when transforming from model frame ${toFrame}`);
    }
    if (!toSite) {
      throw new Error(`Parameter 'toSite' is required when transforming from model frame ${toFrame}`);
    }
  }

  const allQueryArgs = [];
  if (fromRoverPos) {
    const fromRoverPosSite = await convertPoint(fromRoverPos, frameDefinition.siteFrame(fromSite));
    allQueryArgs.push(`fRMC_SITE=${fromSite}`);
    allQueryArgs.push(...positionToModelFrameArgs('f', fromRoverPosSite));
    allQueryArgs.push(...quaternionToModelFrameArgs('f', fromRoverQuat));
  }
  if (toRoverPos) {
    const toRoverPosSite = await convertPoint(toRoverPos, frameDefinition.siteFrame(toSite));
    allQueryArgs.push(`tRMC_SITE=${toSite}`);
    allQueryArgs.push(...positionToModelFrameArgs('t', toRoverPosSite));
    allQueryArgs.push(...quaternionToModelFrameArgs('t', toRoverQuat));
  }
  if (fromMastJoints) {
    allQueryArgs.push(`fRSM_AZ_ENC=${fromMastJoints[0]}`);
    allQueryArgs.push(`fRSM_EL_ENC=${fromMastJoints[1]}`);
  }
  if (toMastJoints) {
    allQueryArgs.push(`tRSM_AZ_ENC=${toMastJoints[0]}`);
    allQueryArgs.push(`tRSM_EL_ENC=${toMastJoints[1]}`);
  }
  if (fromArmJoints) {
    fromArmJoints.forEach((n, i) => {
      allQueryArgs.push(`fJOINT${i + 1}_ENC=${n}`);
    });
  }
  if (toArmJoints) {
    toArmJoints.forEach((n, i) => {
      allQueryArgs.push(`tJOINT${i + 1}_ENC=${n}`);
    });
  }

  // Current version of ROCS Frames does not support scientific notation, so
  // explicity serialize very large or small values.
  const serializeNum = (num) => {
    if (num > 1e10 || num < 1e-10) {
      return Number(num).toFixed(10);
    }
    return num.toString();
  };

  const { x, y, z } = posOrDir;
  const config = getConfig();
  const url = `${config.api_endpoints.ROCS.frames}/${method}/${fromFrame}/${serializeNum(x)}/${serializeNum(
    y
  )}/${serializeNum(z)}/${toFrame}?${allQueryArgs.join('&')}`;
  const resp = await fetch(url, {
    headers: requestHeaders,
    ...(config.using_csso ? { credentials: 'include' } : null),
  });
  return resp;
};

/**
 * Convert a point between model frames. Model frames require a rover pose (in a site frame) and orientation. Frames on the
 * remote sensing mast also require the mast azimuth and elevation values, and frames on the robotic arm require
 * the joint angles for the five joints of the arm. This function accepts 'from' and 'to' parameters to set the
 * source and destination rover state. The 'to' parameters are only used if the target frame is a model frame,
 * and the 'from' parameters are only used if the source frame is a model frame. See ROCS frame documentation for more information.
 *
 * Rover position vector will converted to site frame in the toSite and fromFrom site frames. Rover quaternion gives rover orientation
 * within this site frame.
 *
 * @param {Vector3} args.pos vector to transform
 * @param {string} args.toFrame frame to transform into.
 * @param {number} args.fromSite site identifier for the 'from' rover position. Required if 'pos' is a model frame vector.
 * @param {Vector3} args.fromRoverPos rover position in 'from' model frame. Required if 'pos' is a model frame vector.
 * @param {Quaternion} args.fromRoverQuat rover orientation in 'from' model frame. Required if 'pos' is a model frame vector.
 * @param {array[number]} args.fromMastJoints rover mast az/el in 'from' model frame. Required if 'pos' is a model frame vector on the remote sensing mast.
 * @param {array[number]} args.fromArmJoints rover arm joints [1-5] in 'from' model frame. Required if 'pos' is a model frame vector on the robotic arm.
 * @param {number} args.toSite site identifier for the 'to' rover position. Required if 'toFrame' is a model frame vector.
 * @param {Vector3} args.toRoverPos rover position in 'to' model frame. Required if 'toFrame' is a model frame vector.
 * @param {Quaternion} args.toRoverQuat rover orientation in 'to' model frame. Required if 'toFrame' is a model frame vector.
 * @param {array[number]} args.toMastJoints rover mast az/el in 'to' model frame. Required if 'toFrame' is a model frame vector on the remote sensing mast.
 * @param {array[number]} args.toArmJoints rover arm joints [1-5] in 'to' model frame. Required if 'toFrame' is a model frame vector on the robotic arm.
 *
 * @returns Vector3 of transformed point.
 * @throws Error if input is invalid, or if ROCS service returns an invalid result.
 */
export async function convertModelFramePoint({
  pos,
  toFrame,
  fromSite,
  fromRoverPos,
  fromRoverQuat,
  toSite,
  toRoverPos,
  toRoverQuat,
  fromMastJoints,
  fromArmJoints,
  toMastJoints,
  toArmJoints,
}) {
  // ROCS frame service cannot work with RMECH frames indexed by site,drive. If we are converting from
  // a named RMECH frame then first convert it to RNAV.
  let posToConvert = pos;
  if (pos && pos.frame && pos.frame.startsWith('RMECH=')) {
    const rnavFrame = pos.frame.replace('RMECH', 'ROVER');
    posToConvert = await convertPoint(pos, rnavFrame);
  }

  const resp = await convertModelFramePointOrDirection({
    posOrDir: posToConvert,
    toFrame,
    fromSite,
    fromRoverPos,
    fromRoverQuat,
    toSite,
    toRoverPos,
    toRoverQuat,
    fromMastJoints,
    fromArmJoints,
    toMastJoints,
    toArmJoints,
    method: 'transform',
  });
  if (!resp || !resp.body.to_point) {
    throw new Error('Frame transformation returned invalid response');
  }
  const toPoint = resp.body.to_point;
  return new Vector3({ x: toPoint[0], y: toPoint[1], z: toPoint[2], frame: toFrame });
}

/**
 * Convert a point between model frames. Model frames require a rover pose (in a site frame) and orientation. Frames on the
 * remote sensing mast also require the mast azimuth and elevation values, and frames on the robotic arm require
 * the joint angles for the five joints of the arm. This function accepts 'from' and 'to' parameters to set the
 * source and destination rover state. The 'to' parameters are only used if the target frame is a model frame,
 * and the 'from' parameters are only used if the source frame is a model frame. See ROCS frame documentation for more information.
 *
 * @param {Vector3} args.pos vector to transform
 * @param {string} args.toFrame frame to transform into.
 * @param {number} args.fromSite site identifier for the 'from' rover position. Required if 'pos' is a model frame vector.
 * @param {Vector3} args.fromRoverPos rover position in 'from' model frame. Required if 'pos' is a model frame vector.
 * @param {Quaternion} args.fromRoverQuat rover orientation in 'from' model frame. Required if 'pos' is a model frame vector.
 * @param {array[number]} args.fromMastJoints rover mast az/el in 'from' model frame. Required if 'pos' is a model frame vector on the remote sensing mast.
 * @param {array[number]} args.fromArmJoints rover arm joints [1-5] in 'from' model frame. Required if 'pos' is a model frame vector on the robotic arm.
 * @param {number} args.toSite site identifier for the 'to' rover position. Required if 'toFrame' is a model frame vector.
 * @param {Vector3} args.toRoverPos rover position in 'to' model frame. Required if 'toFrame' is a model frame vector.
 * @param {Quaternion} args.toRoverQuat rover orientation in 'to' model frame. Required if 'toFrame' is a model frame vector.
 * @param {array[number]} args.toMastJoints rover mast az/el in 'to' model frame. Required if 'toFrame' is a model frame vector on the remote sensing mast.
 * @param {array[number]} args.toArmJoints rover arm joints [1-5] in 'to' model frame. Required if 'toFrame' is a model frame vector on the robotic arm.
 *
 * @returns Vector3 of transformed point.
 * @throws Error if input is invalid, or if ROCS service returns an invalid result.
 */
export async function convertModelFrameDirection({
  dir,
  toFrame,
  fromSite,
  fromRoverPos,
  fromRoverQuat,
  toSite,
  toRoverPos,
  toRoverQuat,
  fromMastJoints,
  fromArmJoints,
  toMastJoints,
  toArmJoints,
}) {
  // ROCS frame service cannot work with RMECH frames indexed by site,drive. If we are converting from
  // a named RMECH frame then first convert it to RNAV.
  let dirToConvert = dir;
  if (dir && dir.frame && dir.frame.startsWith('RMECH=')) {
    const rnavFrame = dir.frame.replace('RMECH', 'ROVER');
    dirToConvert = await convertDirection(dir, rnavFrame);
  }

  const resp = await convertModelFramePointOrDirection({
    posOrDir: dirToConvert,
    toFrame,
    fromSite,
    fromRoverPos,
    fromRoverQuat,
    toSite,
    toRoverPos,
    toRoverQuat,
    fromMastJoints,
    fromArmJoints,
    toMastJoints,
    toArmJoints,
    method: 'rotate',
  });
  if (!resp || !resp.body.to_vector) {
    throw new Error('Frame transformation returned invalid response');
  }
  const toPoint = resp.body.to_vector;
  return new Vector3({ x: toPoint[0], y: toPoint[1], z: toPoint[2], frame: toFrame });
}

export function getFrameTranslationOffset(targetFrame, parentFrame) {
  const config = getConfig();
  return new Promise((resolve, reject) => {
    fetch(
      `${config.api_endpoints.ROCS.frames}/transform/MODEL=${targetFrame}/0/0/0/MODEL=${parentFrame}?fROVER_X=0&fROVER_Y=0&fROVER_Z=0&tROVER_X=0&tROVER_Y=0&tROVER_Z=0&fQUAT_C=1&fQUAT_Z=0&fQUAT_X=0&fQUAT_Y=0&tQUAT_C=1&tQUAT_Z=0&tQUAT_X=0&tQUAT_Y=0&fRMC_SITE=8&tRMC_SITE=8`,
      {
        headers: requestHeaders,
        ...(config.using_csso ? { credentials: 'include' } : null),
      }
    )
      .then(handleResponse.bind(null, resolve, reject))
      .catch(reject);
  });
}

export function getFrameRotationalOffset(targetFrame, parentFrame) {
  const config = getConfig();
  return new Promise((resolve, reject) => {
    fetch(
      `${config.api_endpoints.ROCS.frames}/rotate/MODEL=${targetFrame}/0/0/0/MODEL=${parentFrame}?fROVER_X=0&fROVER_Y=0&fROVER_Z=0&tROVER_X=0&tROVER_Y=0&tROVER_Z=0&fQUAT_C=1&fQUAT_Z=0&fQUAT_X=0&fQUAT_Y=0&tQUAT_C=1&tQUAT_Z=0&tQUAT_X=0&tQUAT_Y=0&fRMC_SITE=8&tRMC_SITE=8`,
      {
        headers: requestHeaders,
        ...(config.using_csso ? { credentials: 'include' } : null),
      }
    )
      .then(handleResponse.bind(null, resolve, reject))
      .catch(reject);
  });
}

export function clearCache() {
  Object.keys(quaternionCache).forEach((key) => delete quaternionCache[key]);
  Object.keys(offsetCache).forEach((key) => delete offsetCache[key]);
}

/**
 * Is the transformation between two frames a strict translation, that we can cache and reuse?
 */
function isTranslationOnly(fromFrame, toFrame) {
  const fromNorthAligned = fromFrame.startsWith('LEVEL') || fromFrame.startsWith('SITE');
  const toNorthAligned = toFrame.startsWith('LEVEL') || toFrame.startsWith('SITE');
  const fromRoverAligned =
    fromFrame.startsWith('ROVER') || fromFrame.startsWith('RNAV') || fromFrame.startsWith('RMECH');
  const toRoverAligned = toFrame.startsWith('ROVER') || toFrame.startsWith('RNAV') || toFrame.startsWith('RMECH');
  return (fromNorthAligned && toNorthAligned) || (fromRoverAligned && toRoverAligned);
}

function isErrorResponse(response) {
  return !response.ok || response.status < 200 || response.status >= 300;
}
