import { Vector3 } from 'src/utils/asttroLib/vector3';

/**
 * @class Quaternion
 * @classdesc Represents a Quaternion
 * @extends Vector3
 */
export class Quaternion extends Vector3 {
  /**
   * @contstructs Quaternion
   * @param {object} args - Object of arguments representing a Quaternion {x, y, z, w}
   */
  constructor(args = {}) {
    super(args);
    /**
     * w property of a Quaternion
     * @instance Quaternion#w
     * @type {float}
     */
    this.w = parseFloat(args.w, 10);
  }

  /**
   * Returns true if the Quaternion instance has proper number values set for its properties.
   * Returns false if otherwise.
   * @returns {Boolean}
   */
  isValid() {
    return Vector3.prototype.isValid.call(this) && !Number.isNaN(this.w);
  }

  inverse() {
    // https://www.mathworks.com/help/aeroblks/quaternioninverse.html
    const sumsq = this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
    const invSumsq = 1.0 / sumsq;
    return new Quaternion({
      x: -this.x * invSumsq,
      y: -this.y * invSumsq,
      z: -this.z * invSumsq,
      w: this.w * invSumsq,
      frame: this.frame,
    });
  }

  toReducedPrecision(precision = 3) {
    return new Quaternion({
      x: this.x.toFixed(precision),
      y: this.y.toFixed(precision),
      z: this.z.toFixed(precision),
      w: this.w.toFixed(precision),
    });
  }

  /**
   * Compare two quaternions. Quaternions are considered equal if all components differ by less than an epison value.
   *
   * @param {Quaternion} q1 First quaternion.
   * @param {Quaternion} q2 Second quaternion.
   * @param {number} epsilon Comparison tolerance. Quaternions are considered
   * equal if all components are within the tolerance.
   *
   * @returns true if quaternions are equal (within epsilon). Returns false if either (or both) arguments
   * are not instance of Quaternion.
   */
  static equal(q1, q2, epsilon = 1e-6) {
    // Both null or both undefined, consider equal
    if ((q1 === null && q2 == null) || (q1 === undefined && q2 === undefined)) {
      return true;
    }
    if (q1 === q2) {
      return true;
    }
    if (!(q1 instanceof Quaternion) || !(q2 instanceof Quaternion)) {
      return false;
    }
    return (
      Math.abs(q1.x - q2.x) < epsilon &&
      Math.abs(q1.y - q2.y) < epsilon &&
      Math.abs(q1.z - q2.z) < epsilon &&
      Math.abs(q1.w - q2.w) < epsilon
    );
  }

  static fromArray(ary, frame, order = 'WXYZ') {
    switch (order) {
      case 'WXYZ':
        return new Quaternion({
          w: ary[0],
          x: ary[1],
          y: ary[2],
          z: ary[3],
          frame,
        });
      case 'XYZW':
        return new Quaternion({
          x: ary[0],
          y: ary[1],
          z: ary[2],
          w: ary[3],
          frame,
        });
      default:
        throw new Error('Expected order to be either WXZY or XYZW');
    }
  }
}

/**
 * Default Quaternion that's available on the Quaternion namespace
 * @static
 * @type {Quaternion}
 */
Quaternion.default = new Quaternion();

export default Quaternion;
