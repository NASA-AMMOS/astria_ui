import { v4 as uuidv4 } from 'uuid';

export class Point {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    /**
     * @member Target#i
     * @description The column number of the target location in the source image. Required for 2D target types.
     * @type {Number}
     */
    this.i = typeof options.i !== 'undefined' ? options.i : null;
    /**
     * @member Target#j
     * @description The row number of the target location in the source image. Required for 2D target types.
     * @type {Number}
     */
    this.j = typeof options.j !== 'undefined' ? options.j : null;
    /**
     * @member Target#imageId
     * @description Corresponding image data product in which this target was created
     * @type {String}
     */
    this.imageId = options.imageId || null;
    /**
     * @member Target#azimuth
     * @description Azimuth of the target. Required for AZEL target types.
     * @type {Float}
     */
    this.azimuth = typeof options.azimuth !== 'undefined' ? options.azimuth : null;
    /**
     * @member Target#elevation
     * @description Elevation of the target. Required for AZEL target types.
     */
    this.elevation = typeof options.elevation !== 'undefined' ? options.elevation : null;
    /**
     * @member Target#x
     * @description x location of the target. Required for 3D target types.
     */
    this.x = typeof options.x !== 'undefined' ? options.x : null;
    /**
     * @member Target#y
     * @description y location of the target. Required for 3D target types.
     */
    this.y = typeof options.y !== 'undefined' ? options.y : null;
    /**
     * @member Target#z
     * @description z location of the target. Required for 3D target types.
     */
    this.z = typeof options.z !== 'undefined' ? options.z : null;
    /**
     * @member Target#u
     * @description u component of the target. Required for MARKER target types.
     */
    this.u = typeof options.u !== 'undefined' ? options.u : null;
    /**
     * @member Target#v
     * @description v component of the target. Required for MARKER target types.
     */
    this.v = typeof options.v !== 'undefined' ? options.v : null;
    /**
     * @member Target#w
     * @description w component of the target. Required for MARKER target types.
     */
    this.w = typeof options.w !== 'undefined' ? options.w : null;
    this._coalesceStringsToNums();
  }

  _coalesceStringsToNums() {
    this.x = typeof this.x === 'string' ? parseFloat(this.x, 10) : this.x;
    this.y = typeof this.y === 'string' ? parseFloat(this.y, 10) : this.y;
    this.z = typeof this.z === 'string' ? parseFloat(this.z, 10) : this.z;

    this.u = typeof this.u === 'string' ? parseFloat(this.u, 10) : this.u;
    this.v = typeof this.v === 'string' ? parseFloat(this.v, 10) : this.v;
    this.w = typeof this.w === 'string' ? parseFloat(this.w, 10) : this.w;

    this.i = typeof this.i === 'string' ? parseFloat(this.i, 10) : this.i;
    this.j = typeof this.j === 'string' ? parseFloat(this.j, 10) : this.j;

    this.azimuth = typeof this.azimuth === 'string' ? parseFloat(this.azimuth, 10) : this.azimuth;
    this.elevation = typeof this.elevation === 'string' ? parseFloat(this.elevation, 10) : this.elevation;
  }
}

export default Point;
