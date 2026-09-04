/* eslint-disable no-param-reassign */
import * as frameDefinition from 'src/utils/asttroLib/frameDefinition';
import { Point } from 'src/utils/asttroLib/point';
import { Quaternion } from 'src/utils/asttroLib/quaternion';
import * as TargetType from 'src/utils/asttroLib/targetType';
import { Vector3 } from 'src/utils/asttroLib/vector3';

/**
 * @class Target
 * @classdesc Represents an instance of a Target, as represented in the TargetAPI and Target DB.
 * These properties have been mapped from the V1 target documentation provided by Jay Torres and Ara Kassabian.
 * Description of these properties have also been mapped from their documentation.
 */
export class Target extends Point {
  /**
   * @constructs Target
   * @param {Object} args
   */
  constructor(args = {}) {
    if (args.$) {
      // Target came in with the crazy XMl-to-JSON schema
      // TODO this no longer happens do we want to rip out this code
      args = Target.convertFromRMLJSON(args);
    }
    super(args);
    /**
     * @member Target#owner
     * @description Owner, either person or application that created the target
     * @type {String}
     */
    this.owner = args.owner || 'ASTTRO';
    /**
     * @member Target#id
     * @description UUID ID for the target as it exists in the TargetDB
     * @type {String}
     */
    this.id = args.id;
    /**
     * @memeber Target#version
     * @description Represents the current version number of a target
     * @type {Number}
     */
    this.version = args.version ? Number(args.version) : 0;
    /**
     * @member Target#name
     * @description The name of the target.
     * @type {String}
     */
    this.name = args.name;
    /**
     * @member Target#type
     * @description The target type, specified by the offical TargetType enum.
     * @type {TargetType}
     */
    this.type = args.type || null;
    /**
     * @member Target#frame
     * @description Coordinate frame in which the target is specified.
     * @type {TargetFrame}
     */
    this.frame = args.frame || null;
    /**
     * @member Target#rmc
     * @description Rover Motion Counter (RMC) value needed to fully specify the designated frame.
     * @type {String}
     */
    this.rmc = args.rmc || null;
    /**
     * @member Target#locationEstimated
     * @description Indicates whether or not the XYZ location information in this target is estimated from a mesh model.
     * @type {bool}
     */
    this.locationEstimated = args.locationEstimated !== undefined ? args.locationEstimated : true; // Assume estimated
    /**
     * @member Target#normalEstimated
     * @description Indicates whether or not the orientation information in this target is estimated from a mesh model.
     * @type {bool}
     */
    this.normalEstimated = args.normalEstimated !== undefined ? args.normalEstimated : true; // Assume estimated
    /**
     * @member Target#quat1
     * @description First component of marker quaternion.
     */
    this.quat1 = new Quaternion(args.quat1 || {});
    /**
     * @member Target#quat2
     * @description First component of marker quaternion.
     */
    this.quat2 = new Quaternion(args.quat2 || {});
    /**
     * @member Target#quat3
     * @description First component of marker quaternion.
     */
    this.quat3 = new Quaternion(args.quat3 || {});
    /**
     * @member Target#quat4
     * @description First component of marker quaternion.
     */
    this.quat4 = new Quaternion(args.quat4 || {});
    /**
     * @member Target#sourcefile
     * @description The name of the source file from which the target was  designated from.
     * Typically an RDR file (e.g., image or mesh).
     * This field can optionally be left blank, e.g., if the target is designated without a source file.
     * Required for 2D targets.
     */
    this.sourceFile = args.sourceFile || null;
    /**
     * @member Target#properties
     * @description Miscellaneous collection of string properties to be stored on the RML Properties tag
     */
    this.properties = args.properties ? { ...args.properties } : {};

    /**
     * @member Target#points
     * @description Array of all Vector3 points that comprise a Region or Path target.
     * @type {Vector3}
     */
    this.points = (args.points || []).map((p) => new Vector3(p));

    if (typeof this.i !== 'number') {
      // The property "may" exist inside of the generic properties object
      this.i = this.properties.i;
    }
    if (typeof this.j !== 'number') {
      // The property "may" exist inside of the generic properties object
      this.j = this.properties.j;
    }
    if (typeof this.rangeFromCamera !== 'number') {
      // The property "may" exist inside of the generic properties object
      this.rangeFromCamera = this.properties.rangeFromCamera;
    }
    if (!this.imageId) {
      // The property "may" exist inside of the generic properties object
      this.imageId = this.properties.imageId;
    }
    // Need to coalesce the target strings to numbers (if they're not already)
    // this method exists on the base class
    this._coalesceStringsToNums();
  }

  /**
   * @description For region and path targets, returns the centroid of the points
   * that make up the shape. For point targets, returns the XYZ point of the target.
   * For target other types, returns a zero vector.
   * @type Vector3
   */
  get centerPoint() {
    const myFrame = frameDefinition.getTargetFrame(this);
    if (this.points) {
      // Compute the mean of the points in the shape
      const avgPoint = new Vector3({ x: 0, y: 0, z: 0, frame: myFrame });
      const nPoints = this.points.length;

      for (let i = 0; i < nPoints; i++) {
        avgPoint.x += this.points[i].x;
        avgPoint.y += this.points[i].y;
        avgPoint.z += this.points[i].z;
      }

      avgPoint.x /= nPoints;
      avgPoint.y /= nPoints;
      avgPoint.z /= nPoints;
      return avgPoint;
    }
    // If this is a point target, return the xyz point
    return new Vector3({ x: this.x, y: this.y, z: this.z, frame: myFrame });
  }

  clone() {
    return convertFromRMLJSON(convertToRMLJSON(this));
  }

  compareMajorDifference(comparisonTarget = new Target()) {
    if (!comparisonTarget || !(comparisonTarget instanceof Target)) return true;

    // Different types automatically considered major change.
    // Otherwise inspect frame/position to determine if actual change.
    if (this.type !== comparisonTarget.type) return true;
    if (this.frame !== comparisonTarget.frame) return true;
    if (this.rmc !== comparisonTarget.rmc) return true;

    if (this.x !== comparisonTarget.x || this.y !== comparisonTarget.y || this.z !== comparisonTarget.z) return true;

    if (this.u !== comparisonTarget.u || this.v !== comparisonTarget.v || this.w !== comparisonTarget.w) return true;

    if (this.azimuth !== comparisonTarget.azimuth || this.elevation !== comparisonTarget.elevation) return true;

    return false;
  }

  isShapeTarget() {
    return this.type === TargetType.Region || this.type === TargetType.Path || this.type === TargetType.Rimfax;
  }
}

/**
 * Parses all Path and PathTarget objects out of RML JSON.
 * Modifies the out parameter, as it is pass-by-reference.
 * @param {Object} rmlJSON - RML-to-JSON representation of a Target
 * @param {Object} out - Reference to the target formatted output
 * @private
 */
function _convertFromRMLPathTarget(rmlJSON, out) {
  // Prefer new format, but support deprecated format
  const pathTargets = rmlJSON.PathTarget || rmlJSON.Region || rmlJSON.Path;
  if (pathTargets) {
    out.points = (pathTargets.PointTarget || []).map((p) => {
      let pOut = {};
      const { XYZ3D, Img2D } = p;
      if (XYZ3D) {
        pOut = Object.assign({}, pOut, {
          x: XYZ3D.$.X,
          y: XYZ3D.$.Y,
          z: XYZ3D.$.Z,
          u: XYZ3D.$.U,
          v: XYZ3D.$.V,
          w: XYZ3D.$.W,
          rmc: XYZ3D.$.RMC,
          frame: XYZ3D.$.Frame,
          frameVersion: XYZ3D.$.FrameVersion || undefined,
          locationEstimated: XYZ3D.$.LocationEstimated,
          imageId: XYZ3D.$.ImageId,
        });
      }
      if (Img2D) {
        pOut = Object.assign({}, pOut, {
          i: Img2D.$.I,
          j: Img2D.$.J,
          imageId: Img2D.$.ImageId,
          rmc: Img2D.$.RMC,
        });
      }
      return pOut;
    });
    // TODO: This may or may not be safe.
    // According to RML spec, the points themselves have the rmc and frame data in them.
    // What we're going to do is take the first target in the path object and use the frame and RMC from that
    const firstTarget = out.points[0];
    if (firstTarget) {
      out.rmc = firstTarget.rmc;
      out.frame = firstTarget.frame;
      try {
        if ('Region' in rmlJSON) {
          out.type = TargetType.Region;
        } else {
          const props = (rmlJSON.Properties && rmlJSON.Properties.Property) || [];
          const instrumentProp = props.find((v) => v.$.Name === 'Instruments') || '';
          const isRimfax = instrumentProp.includes('RIMFAX');
          if (isRimfax) {
            out.type = TargetType.Rimfax;
          } else {
            out.type = TargetType.Path;
          }
        }
      } catch (_error) {
        // default to type Path
        out.type = TargetType.Path;
      }
    }
  }
}

/**
 * Parses all varying types of single Point targets contained within RML JSON.
 * Modifies the out parameter, as it is pass-by-reference.
 * @param {Object} rmlJSON - RML-to-JSON representation of a Target
 * @param {Object} out - Reference to the target formatted output
 * @private
 */
function _convertFromRMLPointTarget(rmlJSON, out) {
  if (rmlJSON.Point) {
    if (rmlJSON.Point.XYZ) {
      const XYZ = rmlJSON.Point.XYZ.$;
      out.x = XYZ.X;
      out.y = XYZ.Y;
      out.z = XYZ.Z;
      out.rmc = XYZ.RMC;
      out.frame = XYZ.Frame;
      out.frameVersion = XYZ.FrameVersion || undefined;
      out.type = TargetType.ThreeDimensional;
      out.locationEstimated = XYZ.LocationEstimated;
    }
    if (rmlJSON.Point.XYZUVW) {
      const XYZUVW = rmlJSON.Point.XYZUVW.$;
      out.x = XYZUVW.X;
      out.y = XYZUVW.Y;
      out.z = XYZUVW.Z;
      out.u = XYZUVW.U;
      out.v = XYZUVW.V;
      out.w = XYZUVW.W;
      out.rmc = XYZUVW.RMC;
      out.frame = XYZUVW.Frame;
      out.frameVersion = XYZUVW.FrameVersion || undefined;
      out.type = TargetType.Marker;
      out.locationEstimated = XYZUVW.LocationEstimated;
      out.normalEstimated = XYZUVW.NormalEstimated;
    }
    if (rmlJSON.Point.ImageIJ) {
      const ImageIJ = rmlJSON.Point.ImageIJ.$;
      out.i = ImageIJ.I;
      out.j = ImageIJ.J;
      out.imageId = ImageIJ.ImageId;
      out.type = TargetType.TwoDimensional;
    }
    if (rmlJSON.Point.AzEl) {
      const AZEL = rmlJSON.Point.AzEl.$;
      out.azimuth = AZEL.Az;
      out.elevation = AZEL.El;
      out.frame = AZEL.Frame;
      out.frameVersion = AZEL.FrameVersion || undefined;
      out.rmc = AZEL.RMC;
      out.imageId = AZEL.ImageId;
      out.type = TargetType.AZEL;
    }
  } else if (rmlJSON.Marker) {
    const XYZUVW = rmlJSON.Marker.$;
    out.x = XYZUVW.X;
    out.y = XYZUVW.Y;
    out.z = XYZUVW.Z;
    out.u = XYZUVW.U || 0;
    out.v = XYZUVW.V || 0;
    out.w = XYZUVW.W || 0;
    out.rmc = XYZUVW.RMC;
    out.frame = XYZUVW.Frame;
    out.frameVersion = XYZUVW.FrameVersion || undefined;
    out.type = TargetType.Marker;
    out.locationEstimated = XYZUVW.LocationEstimated;
    out.normalEstimated = XYZUVW.NormalEstimated;
  } else if (rmlJSON.XYZ3D) {
    const XYZ = rmlJSON.XYZ3D.$;
    out.x = XYZ.X;
    out.y = XYZ.Y;
    out.z = XYZ.Z;
    out.rmc = XYZ.RMC;
    out.frame = XYZ.Frame;
    out.frameVersion = XYZ.FrameVersion || undefined;
    out.type = XYZ.ImageId ? TargetType.TwoDimensional : TargetType.ThreeDimensional;
    out.locationEstimated = XYZ.LocationEstimated;
  } else if (rmlJSON.AzEl) {
    const azel = rmlJSON.AzEl.$;
    out.azimuth = azel.Az;
    out.elevation = azel.El;
    out.rmc = azel.RMC;
    out.frame = azel.Frame;
    out.frameVersion = azel.FrameVersion || undefined;
    out.imageId = azel.ImageId;
    out.type = TargetType.AZEL;
  }
}

/**
 * Parses all allowed / acceptable String-based properties from within the RML JSON.
 * Modifies the out parameter, as it is pass-by-reference.
 * @param {Object} rmlJSON - RML-to-JSON representation of a Target
 * @param {Object} out - Reference to the target formatted output
 * @private
 */
function _convertFromRMLProperties(rmlJSON, out) {
  if (rmlJSON.Properties && rmlJSON.Properties.Property) {
    const allProps = rmlJSON.Properties.Property;
    const readableProps = Array.isArray(allProps) ? allProps : [allProps];
    out.properties = {};
    readableProps.forEach((p) => {
      if (p.$.Name) {
        // Turn these into js-friendly var names by camelcasing them
        const toPropName = `${p.$.Name.substring(0, 1).toLowerCase()}${p.$.Name.substring(1)}`;
        if (toPropName === 'instruments') {
          const fromDbActivities = JSON.parse(p.String);
          out.properties.instruments = fromDbActivities; // TODO - fromDbActivities.map(a => new Activity(a));
        } else if (toPropName === 'activityData') {
          // Temporary holding space for ECAM activity parameters
          out.properties[toPropName] = JSON.parse(p.String);
        } else if (toPropName === 'azimuth') {
          // Az/el are saved as properties for point targets because the target spec does not
          // allow them as first class properties. Pull these out to proper target fields if
          // present, so that ASTTRO only needs to look in one place for az/el values.
          out.azimuth = parseFloat(p.String);
        } else if (toPropName === 'elevation') {
          out.elevation = parseFloat(p.String);
        } else {
          out.properties[toPropName] = p.String;
        }
      }
    });
  }
}

/**
 * Takes the RML-to-JSON representation of a target and converts it into a nicer, easy to use JSON object
 * @param {Object} rmlJSON - RML-to-JSON target
 * @return {Object} Converted JSON object
 * @static
 */
function convertFromRMLJSON(rmlJSON) {
  const out = {
    name: rmlJSON.$.Name,
    id: rmlJSON.$.Id,
    version: rmlJSON.$.Version,
    owner: rmlJSON.$.Owner,
  };
  _convertFromRMLPathTarget(rmlJSON, out);
  _convertFromRMLPointTarget(rmlJSON, out);
  _convertFromRMLProperties(rmlJSON, out);
  return new Target({ ...out });
}

/**
 * Takes an ASTTRO target and parses all region / area targets and maps them to the valid RML JSON format.
 * The out parameter is modified, as it is pass by reference.
 * @param {Target} target - Instance of target in ASTTRO
 * @param {Object} out - Reference to formatted RMLJSON target output
 * @private
 */
function _convertToRMLPathOrRegionTarget(target, out) {
  if (Array.isArray(target.points) && target.points.length) {
    const mapped = {
      PointTarget: target.points.map((p) => {
        const pOut = {};
        if (typeof p.x === 'number' && typeof p.y === 'number' && typeof p.z === 'number') {
          pOut.XYZ3D = {
            $: {
              ImageId: target.imageId,
              U: p.u,
              V: p.v,
              W: p.w,
              X: p.x,
              Y: p.y,
              Z: p.z,
              RMC: target.rmc,
              Frame: target.frame,
              FrameVersion: target.frameVersion,
              LocationEstimated: target.locationEstimated,
            },
          };
        } else if (typeof p.i === 'number' && typeof p.j === 'number' && typeof p.imageId === 'string') {
          // We're definitely dealing with an ImageIJ target
          pOut.Img2D = {
            $: {
              I: p.i,
              J: p.j,
              ImageId: p.imageId,
              RMC: target.rmc,
            },
          };
        }
        // We're going to ignore AzEl targets for now
        return pOut;
      }),
    };
    if (target.type === TargetType.Region) out.Region = mapped;
    else out.PathTarget = mapped;
  }
}

/**
 * Takes an ASTTRO target and parses the top-level Point target information and formats it in valid RML JSON spec.
 * The out parameter is modified, as it is pass by reference.
 * @param {Target} target - Instance of target in ASTTRO
 * @param {Object} out - Reference to formatted RMLJSON target output
 * @private
 */
function _convertToRMLPointTarget(target, out) {
  // This target may or may not have the surface normal information. We're going to just default to zeroes if they're not available
  // It's a XYZUVW target
  if (target.type === TargetType.Marker) {
    out.Marker = {
      $: {
        U: target.u || 0,
        V: target.v || 0,
        W: target.w || 0,
        X: target.x,
        Y: target.y,
        Z: target.z,
        RMC: target.rmc,
        Frame: target.frame,
        FrameVersion: target.frameVersion,
        LocationEstimated: target.locationEstimated,
        NormalEstimated: target.normalEstimated,
      },
    };
  } else if (target.type === TargetType.ThreeDimensional) {
    out.XYZ3D = {
      $: {
        X: target.x,
        Y: target.y,
        Z: target.z,
        RMC: target.rmc,
        Frame: target.frame,
        FrameVersion: target.frameVersion,
        LocationEstimated: target.locationEstimated,
      },
    };
  } else if (target.type === TargetType.TwoDimensional) {
    out.XYZ3D = {
      // #####HACK### this is changed to 3d point until the rmc is no longer blocked by the database server
      $: {
        X: target.x, // #####HACK###
        Y: target.y, // #####HACK###
        Z: target.z, // #####HACK###
        // #####HACK### I: target.i,
        // #####HACK### J: target.j,
        ImageId: target.imageId,
        RMC: target.rmc,
        Frame: target.frame,
        FrameVersion: target.frameVersion,
        LocationEstimated: target.locationEstimated,
      },
    };
  } else if (target.type === TargetType.AZEL) {
    out.AzEl = {
      $: {
        Az: target.azimuth,
        El: target.elevation,
        Frame: target.frame,
        ImageId: target.imageId,
        FrameVersion: target.frameVersion,
        RMC: target.rmc,
      },
    };
  }

  // If we have az/el information, but it's not an Az/El target, then save the az/el to the properties
  const hasAzEl = typeof target.azimuth === 'number' && typeof target.elevation === 'number';
  if (hasAzEl && target.type !== TargetType.AZEL) {
    out.Properties.Property.push(_convertToRMLProperty('Azimuth', target.azimuth));
    out.Properties.Property.push(_convertToRMLProperty('Elevation', target.elevation));
  }
}

/**
 * Takes an ASTTRO target and parses the array of string properties and formats them in valid RML JSON spec.
 * The out parameter is modified, as it is pass by reference.
 * @param {Target} target - Instance of target in ASTTRO
 * @param {Object} out - Reference to formatted RMLJSON target output
 * @private
 */
function _convertToRMLProperties(target, out) {
  const props = Object.keys(target.properties);
  if (props.length) {
    // const mapTo = out.Point || out.PathTarget || out.PointTarget;
    const mapTo = out;
    mapTo.Properties = {
      Property: [],
    };
    props.forEach((prop) => {
      const propVal = target.properties[prop];
      if (propVal !== undefined) {
        mapTo.Properties.Property.push(_convertToRMLProperty(prop, propVal));
      }
    });
  }
}

function _convertToRMLProperty(name, value) {
  const rmlVal = Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : value;
  return {
    $: {
      Name: `${name.substring(0, 1).toUpperCase()}${name.substring(1)}`, // un-camelcase these
    },
    String: rmlVal,
  };
}

/**
 * Takes an instance of a Target class and converts it to RML-like JSON syntax for consumption by the TargetAPI.
 * @param {Target} target - Instance of Target class
 * @return {Object} RMLJson representation of target
 * @static
 */
function convertToRMLJSON(target, idOverride = null) {
  const out = {
    $: {
      Id: idOverride, // Needs to be here. Generated by the API though.
      Name: target.name,
      WriteProtected: false, // TODO remove for 6.4
      Version: target.version,
      Owner: target.owner, // TODO remove for 6.4 // TBD: To be populated by the current logged-in user
    },
  };
  // Properties have to come first, before the actual target details
  _convertToRMLProperties(target, out);
  _convertToRMLPathOrRegionTarget(target, out);
  _convertToRMLPointTarget(target, out);
  return out;
}

Target.convertFromRMLJSON = convertFromRMLJSON;
Target.convertToRMLJSON = convertToRMLJSON;

export default Target;
