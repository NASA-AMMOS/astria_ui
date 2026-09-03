import { Vector3 } from 'src/utils/asttroLib/vector3';
import * as frameConversion from 'src/utils/asttroLib/frames';

const deg2Rad = Math.PI / 180.0;

/*
 * Converts azimuth/elevation in degrees to directional unit vector.
 * @export
 * @param {Number} azDeg - Azimuth
 * @param {Number} elDeg - Elevation
 * @param {String} frame - Optional frame definition, if provided the resulting Vector3 will specify it is defined in the same frame. Otherwise the frame will be undefined.
 * @returns {Vector3} { x, y, z }
 */
export function azElToDirection(azDeg, elDeg, frame) {
  const x = Math.cos(elDeg * deg2Rad) * Math.cos(azDeg * deg2Rad);
  const y = Math.cos(elDeg * deg2Rad) * Math.sin(azDeg * deg2Rad);
  const z = -1 * Math.sin(elDeg * deg2Rad); // +El and -Z are in the up direction, we need to flip signs to convert between them.
  return new Vector3({ x, y, z, frame });
}

/*
 * Converts a directional unit vector to azimuth and elevation.
 * @export
 * @param {Vector3} xyzDirection - Azimuth
 * @returns {Object} { az, el }
 */
export function directionToAzEl(xyzDirection = new Vector3()) {
  const { x, y, z } = xyzDirection.normalize();
  let az = Math.atan2(y, x) / deg2Rad;
  while (az < 0) {
    az += 360;
  }
  while (az >= 360) {
    az -= 360;
  }
  const el = Math.asin(-z) / deg2Rad; // +El and -Z are in the up direction, we need to flip signs to convert between them.
  return {
    az,
    el,
  };
}

/**
 * Convert an azimuth elevation measure between coordinate frames.
 * @param {number} azDeg Azimuth in degrees.
 * @param {number} elDeg Elevaiton in degrees.
 * @param {string} fromFrame Convert from this frame.
 * @param {string} toFrame Convert to this frame.
 */
export async function convertAzEl(azDeg, elDeg, fromFrame, toFrame) {
  const fromDir = azElToDirection(azDeg, elDeg, fromFrame);
  const toDir = await frameConversion.convertDirection(fromDir, toFrame);
  return directionToAzEl(toDir);
}
