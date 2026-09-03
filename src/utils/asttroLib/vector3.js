/**
 * @class Vector3
 * @classdesc Represents a Vector3
 */
export class Vector3 {
  /**
   * @constructs Vector3
   * @param {Object} args - Object of arguments representing a Vector3 {x, y, z}
   * @param {Float} args.x
   * @param {Float} args.y
   * @param {Float} args.z
   */
  constructor(args = {}) {
    /**
     * x magnitude of the vector
     * @member Vector3#x
     * @type {float}
     */
    this.x = parseFloat(args.x, 10);
    /**
     * y magnitude of the vector
     * @member Vector3#y
     * @type {float}
     */
    this.y = parseFloat(args.y, 10);
    /**
     * z magnitude of the vector
     * @member Vector3#z
     * @type {float}
     */
    this.z = parseFloat(args.z, 10);
    /**
     * Coordinate frame identifier.
     * @member Vector3@frame
     * @type {string}
     */
    this.frame = args.frame;
  }

  /**
   * Adds either a Number or another Vector 3 from this instance
   * @param {Number|Vector3} arg - Number or Vector3 to add to this instance
   * @return {Vector3} Returns a new Vector3
   */
  add(arg) {
    if (arg instanceof Vector3) {
      return new Vector3({
        x: this.x + arg.x,
        y: this.y + arg.y,
        z: this.z + arg.z,
      });
    }
    // Add a number to each property of the vector
    return new Vector3({
      x: this.x + arg,
      y: this.y + arg,
      z: this.z + arg,
    });
  }

  /**
   * Subtracts either a Number or another Vector 3 from this instance
   * @param {Number|Vector3} arg - Number or Vector3 to subtract from this instance
   * @return {Vector3} Returns a new Vector3
   */
  subtract(arg) {
    if (arg instanceof Vector3) {
      // Subtract one vector from another
      return new Vector3({
        x: this.x - arg.x,
        y: this.y - arg.y,
        z: this.z - arg.z,
      });
    }
    return new Vector3({
      x: this.x - arg,
      y: this.y - arg,
      z: this.z - arg,
    });
  }

  /**
   * Multiplies either a Number or another Vector 3 from this instance
   * @param {Number|Vector3} arg - Number or Vector3 to multiply to this instance
   * @return {Vector3} Returns a new Vector3
   */
  multiply(arg) {
    if (arg instanceof Vector3) {
      return new Vector3({
        x: this.x * arg.x,
        y: this.y * arg.y,
        z: this.z * arg.z,
      });
    }
    return new Vector3({
      x: this.x * arg,
      y: this.y * arg,
      z: this.z * arg,
    });
  }

  /**
   * Divides either a Number or another Vector 3 from this instance
   * @param {Number|Vector3} arg - Number or Vector3 to divide this instance by
   * @return {Vector3} Returns a new Vector3
   */
  divide(arg) {
    if (arg instanceof Vector3) {
      return new Vector3({
        x: this.x / arg.x,
        y: this.y / arg.y,
        z: this.z / arg.z,
      });
    }
    return new Vector3({
      x: this.x / arg,
      y: this.y / arg,
      z: this.z / arg,
    });
  }

  /**
   * Compute the magnitude of the vector.
   * @return {number} Returns a new Vector3
   */
  magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  /**
   * Normalizes the Vector 3 instance into a unit vector
   * @return {Vector3} Returns a new Vector3
   */
  normalize() {
    const magnitude = this.magnitude();
    return this.divide(magnitude);
  }

  dot(arg) {
    return this.x * arg.x + this.y * arg.y + this.z * arg.z;
  }

  /**
   * Returns true if the Vector3 instance has proper number values set for its properties.
   * Returns false if otherwise.
   * @returns {Boolean}
   */
  isValid() {
    return !Number.isNaN(this.x) && !Number.isNaN(this.y) && !Number.isNaN(this.z);
  }

  toReducedPrecision(precision = 3) {
    return new Vector3({
      x: this.x.toFixed(precision),
      y: this.y.toFixed(precision),
      z: this.z.toFixed(precision),
    });
  }

  static get up() {
    return new Vector3({
      x: 0,
      y: 0,
      z: -1,
    });
  }

  /**
   * Create a new vector with zero components.
   *
   * @param {string} frame Coordinate frame for this vector.
   */
  static zero(frame = undefined) {
    return new Vector3({
      x: 0,
      y: 0,
      z: 0,
      frame,
    });
  }

  /**
   * Compare two vectors. Vectors are considered equal if all components differ by less
   * than an epison value, and the frames are equal.
   *
   * @param {Vector} v1 First vector.
   * @param {Vector} v2 Second vector.
   * @param {number} epsilon Comparison tolerance. Vector are considered
   * equal if all components are within the tolerance, and the frames are equal.
   *
   * @returns true if vectors are equal (within epsilon). Returns false if either (or both) arguments
   * are not instance of Vector3.
   */
  static equal(v1, v2, epsilon = 1e-6) {
    // Both null or both undefined, consider equal
    if ((v1 === null && v2 == null) || (v1 === undefined && v2 === undefined)) {
      return true;
    }
    if (v1 === v2) {
      return true;
    }
    if (!(v1 instanceof Vector3) || !(v2 instanceof Vector3)) {
      return false;
    }
    if (v1.frame !== v2.frame) {
      return false;
    }
    return Math.abs(v1.x - v2.x) < epsilon && Math.abs(v1.y - v2.y) < epsilon && Math.abs(v1.z - v2.z) < epsilon;
  }

  static fromArray(ary, frame) {
    return new Vector3({
      x: ary[0],
      y: ary[1],
      z: ary[2],
      frame,
    });
  }
}

/**
 * Default Vector3 that's available on the Vector3 namespace
 * @static
 * @type {Vector3}
 */
Vector3.default = new Vector3();

export default Vector3;
