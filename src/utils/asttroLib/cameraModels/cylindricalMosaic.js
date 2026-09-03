import { Vector3 } from 'src/utils/asttroLib/vector3';
import * as frameDefinition from 'src/utils/asttroLib/frameDefinition';
import * as targetFrame from 'src/utils/asttroLib/targetFrame';

/**
 * Get the modulus of two numbers even if one of them is negative.
 * (Workaround for quirky JavaScript modulo operator: https://web.archive.org/web/20090717035140if_/javascript.about.com/od/problemsolving/a/modulobug.htm)
 * a % b
 * @param {*} a
 * @param {*} b
 */
function mod(a, b) {
  return ((a % b) + b) % b;
}

/**
 * @class CylindricalMosaicCameraModel
 * @classdesc Contains functions for translating pixels within a cylindrical mosaic into 3D rays.
 */
export class CylindricalMosaicCameraModel {
  constructor(options = {}) {
    // reformat projection origin if its an array
    if (Array.isArray(options.projectionOriginVector)) {
      options.projectionOriginVector = {
        x: options.projectionOriginVector[0],
        y: options.projectionOriginVector[1],
        z: options.projectionOriginVector[2],
      };
    }

    this.site = options.site;
    this.drive = options.drive;
    this.origin = new Vector3({
      ...options.projectionOriginVector,
      frame:
        options.frame.indexOf(targetFrame.LocalLevel) !== -1
          ? frameDefinition.localLevelFrame(...options.frameIndex)
          : frameDefinition.siteFrame(this.site),
    });
    this.startAzimuth = options.startAzimuth;
    this.mapResolution = options.mapResolution;
    this.zeroElevationLine = options.zeroElevationLine;
  }

  getAzElWithOriginForPixel(x, y) {
    const az = mod(x / this.mapResolution[0] + this.startAzimuth, 360);
    const el = (this.zeroElevationLine - y) / this.mapResolution[1];
    return {
      origin: this.origin,
      az,
      el,
    };
  }

  getXYFromAzEl(az, el) {
    const azimuthDiff = az - this.startAzimuth;
    const x = mod(azimuthDiff, 360) * this.mapResolution[0];
    const y = this.zeroElevationLine - el * this.mapResolution[1];
    return {
      x,
      y,
    };
  }

  // stub function
  Backproject(pos) {}
}

export default CylindricalMosaicCameraModel;
