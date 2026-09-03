import { Ray, Vector2, Vector3 } from 'three';
import { CameraModel } from './CameraModel';

export class CAHV extends CameraModel {
  EPSILON = 1e-15;

  C; // Vector3

  // Position of the camera
  A; // Vector3
  H; // Vector3
  V; // Vector3

  /**
   * Creates an instance of CAHV.
   * @param {Vector3} c
   * @param {Vector3} a
   * @param {Vector3} h
   * @param {Vector3} v
   * @param {string} [t]
   * @memberof CAHV
   */
  constructor(c, a, h, v, t) {
    super(t || 'CAHV');
    this.C = c;
    this.A = a;
    this.H = h;
    this.V = v;
  }

  /**
   * Construct a CAHV camera model with a set of conventional camera parameters.
   * Port from Mark :-)
   *
   * @static
   * @param {number} imageWidth
   * @param {number} imageHeight
   * @param {number} hfov
   * @param {number} vfov
   * @param {Vector3} position
   * @param {Vector3} direction
   * @param {Vector3} hPrime
   * @returns {CAHV}
   * @memberof CAHV
   */
  static fromParams(imageWidth, imageHeight, hfov, vfov, position, direction, hPrime) {
    direction = direction.normalize();
    hPrime = hPrime.normalize();
    const C = position;
    const A = direction;
    const vPrime = A.cross(hPrime); // ??? reverse?
    // Vector3 vPrime = Vector3.Cross( hPrime,this.A); // ??? reverse?

    const i0 = imageWidth / 2;
    const j0 = imageHeight / 2;
    const fx = i0 / Math.tan(hfov / 2);
    const fy = j0 / Math.tan(vfov / 2);

    const h1 = hPrime.multiplyScalar(fx);
    const v1 = vPrime.multiplyScalar(fy);

    const h2 = A.multiplyScalar(i0);
    const v2 = A.multiplyScalar(j0);

    const H = h1.add(h2);
    const V = v1.add(v2);
    return new CAHV(C, A, H, V);
  }

  /**
   *
   *
   * @param {Vector3} pos
   * @returns {{ pixel: Vector2, range: number }}
   * @memberof CAHV
   */
  Backproject(pos) {
    const pixelPos = new Vector2();
    /* Calculate the projection */
    const d = pos.clone().sub(this.C); // sub3(pos3, c, d);
    const range = d.dot(this.A); // range = dot3(d, a);
    if (Math.abs(range) <= this.EPSILON) {
      throw new Error('Divide by zero');
    }
    const r_1 = 1.0 / range;
    pixelPos.x = d.dot(this.H) * r_1; // pos2[0] = dot3(d, h) * r_1;
    pixelPos.y = d.dot(this.V) * r_1; // pos2[1] = dot3(d, v) * r_1;
    return {
      pixel: pixelPos,
      range,
    };
  }

  /**
   * @returns {Vector3}
   * @memberof CAHV
   */
  GetCameraAxis() {
    return this.A.clone();
  }

  /**
   * @returns {Vector3}
   * @memberof CAHV
   */
  GetCameraCenter() {
    return this.C.clone();
  }

  /**
   * @returns {Vector3}
   * @memberof CAHV
   */
  GetCameraHorizontalVector() {
    return this.H.clone();
  }

  /**
   * @returns {Vector3}
   * @memberof CAHV
   */
  GetCameraVerticalVector() {
    return this.V.clone();
  }

  /**
   * @param {Vector2} pixelPos
   * @returns {Ray}
   * @memberof CAHV
   */
  ProjectRay(pixelPos) {
    let pos3 = new Vector3();
    let f = new Vector3();
    let g = new Vector3();
    let t = new Vector3();
    let magi;

    let uvec3 = new Vector3();

    /* The projection point is merely the C of the camera model */
    pos3 = this.C.clone(); // copy3(c, pos3);

    /* Calculate the projection ray assuming normal vector directions */
    f = this.A.clone().multiplyScalar(pixelPos.y); // scale3(pixelPos[1], A, f);
    f = this.V.clone().sub(f); // sub3(V, f, f);
    g = this.A.clone().multiplyScalar(pixelPos.x); // scale3(pixelPos[0], A, g);
    g = this.H.clone().sub(g); // sub3(H, g, g);
    uvec3 = f.clone().cross(g); // cross3(f, g, uvec3);
    magi = uvec3.length(); // magi = mag3(uvec3);
    if (magi <= this.EPSILON) throw new Error('Divide by zero');
    magi = 1.0 / magi;
    uvec3 = uvec3.clone().multiplyScalar(magi); // scale3(magi, uvec3, uvec3);
    t = this.V.clone().cross(this.H); // cross3(V, H, t);

    if (t.dot(this.A) < 0) {
      // dot3(t, A)
      uvec3 = uvec3.clone().multiplyScalar(-1); // scale3(-1.0, uvec3, uvec3);
    }
    const r = new Ray();
    r.origin = pos3;
    r.direction = uvec3;
    return r;
  }
}

export default CAHV;
