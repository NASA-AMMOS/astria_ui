import { Ray, Vector2, Vector3 } from 'three';
import CAHVOR from './CAHVOR';

export class LinearityMode {
  Linearity; // should be double orint?

  static perspective = new LinearityMode(1);

  static fisheye = new LinearityMode(0);

  static Perspective() {
    return LinearityMode.perspective;
  }

  static Fisheye() {
    return LinearityMode.fisheye;
  }

  /**
   * Creates an instance of LinearityMode.
   * @param {number} linearity
   * @memberof LinearityMode
   */
  constructor(linearity) {
    this.Linearity = linearity;
  }
}

export class CAHVORE extends CAHVOR {
  MAX_NEWTON = 100;

  E; // Vector3

  linearityMode;

  /**
   * Creates an instance of CAHVORE.
   * @param {Vector3} c
   * @param {Vector3} a
   * @param {Vector3} h
   * @param {Vector3} v
   * @param {Vector3} o
   * @param {Vector3} r
   * @param {Vector3} e
   * @param {LinearityMode} linearityMode
   * @memberof CAHVORE
   */
  constructor(c, a, h, v, o, r, e, linearityMode) {
    super(c, a, h, v, o, r, 'CAHVORE');
    this.E = e;
    this.linearityMode = linearityMode;
  }

  /**
   * @param {Vector2} pixelPos
   * @returns {Ray}
   * @memberof CAHVORE
   */
  ProjectRay(pixelPos) {
    let zetap;
    let lambdap;
    let chip;
    let avh1;
    let chi;
    let chi2;
    let chi3;
    let chi4;
    let chi5;
    let linchi;
    let theta;
    let theta2;
    let theta3;
    let theta4;

    /* In the following there is a mixture of nomenclature from several */
    /* versions of Gennery's write-ups and Litwin's software. Beware!   */

    chi = 0;
    chi3 = 0;
    theta = 0;
    theta2 = 0;
    theta3 = 0;
    theta4 = 0;

    /* Calculate initial terms */

    let u3 = new Vector3();
    let v3 = new Vector3();
    let w3 = new Vector3();
    let rp = new Vector3();
    let lambdap3 = new Vector3();

    u3 = this.A.clone().multiplyScalar(pixelPos.y); // scale3(pixelPos[1], a, u3);
    u3 = this.V.clone().sub(u3.clone()); // sub3(v, u3, u3);
    v3 = this.A.clone().multiplyScalar(pixelPos.x); // scale3(pixelPos[0], a, v3);
    v3 = this.H.clone().sub(v3.clone()); // sub3(h, v3, v3);
    w3 = u3.clone().cross(v3.clone()); // cross3(u3, v3, w3);
    u3 = this.V.clone().cross(this.H.clone()); // cross3(v, h, u3);
    const tmp = this.A.clone().dot(u3.clone()); // avh1 = 1 / dot3(a, u3);
    if (Math.abs(tmp) < this.EPSILON) {
      throw new Error('Divide by zero'); // Not sure if this is possible
    }
    avh1 = 1 / tmp;
    rp = w3.clone().multiplyScalar(avh1); // scale3(avh1, w3, rp);

    zetap = rp.clone().dot(this.O.clone()); // zetap = dot3(rp, o);

    u3 = this.O.clone().multiplyScalar(zetap); // scale3(zetap, o, u3);
    lambdap3 = rp.clone().sub(u3.clone()); // sub3(rp, u3, lambdap3);

    lambdap = lambdap3.length(); // lambdap = mag3(lambdap3);

    chip = lambdap / zetap;

    let cp = new Vector3();
    let ri = new Vector3();
    /* Approximations for small angles */
    if (chip < 1e-8) {
      cp = this.C.clone(); // copy3(c, cp);
      ri = this.O.clone(); // copy3(o, ri);
    } else {
      /* Full calculations */
      let n;
      let dchi;
      let s;

      /* Calculate chi using Newton's Method */
      n = 0;
      chi = chip;
      dchi = 1;
      for (;;) {
        let deriv;

        /* Make sure we don't iterate forever */
        if (++n > this.MAX_NEWTON) {
          throw new Error('cahvore_2d_to_3d(): too many iterations\n');
          // Console.WriteLine("cahvore_2d_to_3d(): too many iterations\n");
          // break;
        }

        /* Compute terms from the current value of chi */
        chi2 = chi * chi;
        chi3 = chi * chi2;
        chi4 = chi * chi3;
        chi5 = chi * chi4;

        /* Check exit criterion from last update */
        if (Math.abs(dchi) < 1e-8) break;

        /* Update chi */
        deriv = 1 + this.R.x + 3 * this.R.y * chi2 + 5 * this.R.z * chi4;
        dchi = ((1 + this.R.x) * chi + this.R.y * chi3 + this.R.z * chi5 - chip) / deriv;
        chi -= dchi;
      }
      const linearity = this.linearityMode.Linearity;
      /* Compute the incoming ray's angle */
      linchi = linearity * chi;
      if (linearity < -this.EPSILON) theta = Math.asin(linchi) / linearity;
      else if (linearity > this.EPSILON) theta = Math.atan(linchi) / linearity;
      else theta = chi;

      theta2 = theta * theta;
      theta3 = theta * theta2;
      theta4 = theta * theta3;

      /* Compute the shift of the entrance pupil */
      s = (theta / Math.sin(theta) - 1) * (this.E.x + this.E.y * theta2 + this.E.z * theta4);

      /* The position of the entrance pupil */
      cp = this.O.clone().multiplyScalar(s); // scale3(s, o, cp);
      cp = this.C.clone().add(cp); // add3(c, cp, cp);

      /* The unit vector along the ray */
      u3 = lambdap3.normalize(); // unit3(lambdap3, u3);
      u3 = u3.clone().multiplyScalar(Math.sin(theta)); // scale3(Math.Sin(theta), u3, u3);
      v3 = this.O.clone().multiplyScalar(Math.cos(theta)); // scale3(Math.Cos(theta), o, v3);
      ri = u3.clone().add(v3); // add3(u3, v3, ri);
    }
    return new Ray(cp, ri); // copy3(cp, pos3);
    // copy3(ri, uvec3);
  }

  /**
   * @param {Vector3} pos
   * @returns {{ pixel: Vector2, range: number }}
   * @memberof CAHVORE
   */
  Backproject(pos) {
    let n;
    const linearity = this.linearityMode.Linearity;
    let zeta;
    let lambda;
    let dtheta;
    let theta;
    let theta2;
    let theta3;
    let theta4;
    let upsilon;
    let costh;
    let sinth;
    let alpha;
    let beta;
    let gamma;

    /* In the following there is a mixture of nomenclature from several */
    /* versions of Gennery's write-ups and Litwin's software. Beware!   */

    upsilon = 0;
    costh = 0;
    sinth = 0;

    /* Basic Computations */

    let p_c = new Vector3();
    let u3 = new Vector3();
    let lambda3 = new Vector3();
    /* Calculate initial terms */
    p_c = pos.clone().sub(this.C); // sub3(pos3, c, p_c);
    zeta = p_c.clone().dot(this.O); // zeta = dot3(p_c, o);
    u3 = this.O.clone().multiplyScalar(zeta); // scale3(zeta, o, u3);
    lambda3 = p_c.clone().sub(u3); // sub3(p_c, u3, lambda3);
    lambda = lambda3.length(); // lambda = mag3(lambda3);

    /* Calculate theta using Newton's Method */
    n = 0;
    theta = Math.atan2(lambda, zeta);
    dtheta = 1;
    for (;;) {
      /* Make sure we don't iterate forever */
      if (++n > this.MAX_NEWTON) {
        throw new Error('cahvore_3d_to_2d(): too many iterations\n');
        // Console.WriteLine("cahvore_3d_to_2d(): too many iterations\n");
        // break;
      }

      /* Compute terms from the current value of theta */
      costh = Math.cos(theta);
      sinth = Math.sin(theta);
      theta2 = theta * theta;
      theta3 = theta * theta2;
      theta4 = theta * theta3;
      upsilon =
        zeta * costh +
        lambda * sinth -
        (1 - costh) * (this.E.x + this.E.y * theta2 + this.E.z * theta4) - // -(1 - costh) * (e[0] + e[1] * theta2 + e[2] * theta4)
        (theta - sinth) * (2 * this.E.y * theta + 4 * this.E.z * theta3); // -(theta - sinth) * (2 * e[1] * theta + 4 * e[2] * theta3);

      /* Check exit criterion from last update */
      if (Math.abs(dtheta) < 1e-8) break;

      /* Update theta */
      if (Math.abs(upsilon) > this.EPSILON) {
        dtheta =
          (zeta * sinth - lambda * costh - (theta - sinth) * (this.E.x + this.E.y * theta2 + this.E.z * theta4)) / // - (theta - sinth) * (e[0] + e[1] * theta2 + e[2] * theta4)
          upsilon;
        theta -= dtheta;
      } else {
        dtheta = 0;
      }
    }

    /* Check the value of theta */
    if (theta * Math.abs(linearity) > Math.PI / 2.0) {
      throw new Error('cahvore_3d_to_2d(): theta out of bounds\n');
      // Console.WriteLine("cahvore_3d_to_2d(): theta out of bounds\n");
    }
    let rp = new Vector3();
    /* Approximations for small theta */
    if (theta < 1e-8) {
      rp = p_c; // copy3(p_c, rp);
    } else {
      let linth;
      let chi;
      let chi2;
      let chi3;
      let chi4;
      let zetap;
      let mu;

      linth = linearity * theta;
      if (linearity < -this.EPSILON) chi = Math.sin(linth) / linearity;
      else if (linearity > this.EPSILON) chi = Math.tan(linth) / linearity;
      else chi = theta;

      chi2 = chi * chi;
      chi3 = chi * chi2;
      chi4 = chi * chi3;
      if (Math.abs(chi) < this.EPSILON) {
        throw new Error('cahvore_3d_to_2d(): chi < EPSILON\n');
      }
      zetap = lambda / chi;

      mu = this.R.x + this.R.y * chi2 + this.R.z * chi4; // mu = r[0] + r[1] * chi2 + r[2] * chi4;

      let v3 = new Vector3();
      u3 = this.O.clone().multiplyScalar(zetap); // scale3(zetap, o, u3);
      v3 = lambda3.multiplyScalar(1 + mu); // scale3(1 + mu, lambda3, v3);
      rp = u3.clone().add(v3); // add3(u3, v3, rp);
    }

    /* Calculate the projection */
    alpha = rp.dot(this.A); // alpha = dot3(rp, a);
    beta = rp.dot(this.H); // beta = dot3(rp, h);
    gamma = rp.dot(this.V); // gamma = dot3(rp, v);
    if (Math.abs(alpha) < this.EPSILON) {
      throw new Error('Divide by zero'); // Don't know if this is possible but why not
    }
    const pixelPos = new Vector2();
    pixelPos.x = beta / alpha; // pos2[0] = beta / alpha;
    pixelPos.y = gamma / alpha; // pos2[1] = gamma / alpha;
    return {
      pixel: pixelPos,
      range: alpha,
    };
  }
}

export default CAHVORE;
