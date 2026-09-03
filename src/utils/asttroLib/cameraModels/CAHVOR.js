import { Ray, Vector2, Vector3 } from 'three';
import CAHV from './CAHV';

export class CAHVOR extends CAHV {
  MAXITER = 20;
  CONV = 1.0e-6;

  O; // Vector3
  R; // Vector3

  /**
   * Creates an instance of CAHVOR.
   * @param {Vector3} c
   * @param {Vector3} a
   * @param {Vector3} h
   * @param {Vector3} v
   * @param {Vector3} o
   * @param {Vector3} r
   * @param {string} [t]
   * @memberof CAHVOR
   */
  constructor(c, a, h, v, o, r, t) {
    super(c, a, h, v, t || 'CAHVOR');
    this.O = o;
    this.R = r;
  }

  /**
   * @param {Vector2} pixelPos
   * @returns {Ray}
   * @memberof CAHVOR
   */
  ProjectRay(pixelPos) {
    let uvec3;
    /* The projection point is merely the C of the camera model. */
    const pos3 = this.C; // copy3(c, pos3);

    /* Calculate the projection ray assuming normal vector directions, */
    /* neglecting distortion.                                          */
    let f = new Vector3();
    let g = new Vector3();
    let rr = new Vector3();
    let t = new Vector3();
    let magi;

    f = this.A.clone().multiplyScalar(pixelPos.y); // scale3(pixelPos[1], a, f);
    f = this.V.clone().sub(f); // sub3(v, f, f);
    g = this.A.clone().multiplyScalar(pixelPos.x); // scale3(pixelPos[0], a, g);
    g = this.H.clone().sub(g); // sub3(h, g, g);
    rr = f.cross(g); // cross3(f, g, rr);
    magi = rr.length();
    if (magi < this.EPSILON) {
      throw new Error('Divide by zero');
    } // Don't know if this is possible but might as well be sure
    magi = 1.0 / rr.clone().length(); // magi = 1.0 / mag3(rr);
    rr = rr.clone().multiplyScalar(magi); // scale3(magi, rr, rr);

    t = this.V.clone().cross(this.H.clone()); // cross3(v, h, t);

    if (t.clone().dot(this.A.clone()) < 0) {
      // if (dot3(t, a) < 0)
      rr = rr.clone().multiplyScalar(-1); // scale3(-1.0, rr, rr);
    }

    /* Remove the radial lens distortion.  Preliminary values of omega,  */
    /* lambda, and tau are computed from the rr vector including         */
    /* distortion, in order to obtain the coefficients of the equation   */
    /* k5*u^5 + k3*u^3 + k1*u = 1, which is solved for u by means of     */
    /* Newton's method.  This value is used to compute the corrected rr. */
    let u_2; //number

    const omega = rr.clone().dot(this.O.clone()); // dot3(rr, o);
    const omega_2 = omega * omega;
    const wo = this.O.clone().multiplyScalar(omega); // scale3(omega, o, wo);
    const lambda = rr.clone().sub(wo.clone()); // sub3(rr, wo, lambda);
    const tau = lambda.clone().dot(lambda.clone()) / omega_2; // tau = dot3(lambda, lambda) / omega_2;
    const k1 = 1 + this.R.clone().x; // k1 = 1 + r[0];              /*  1 + rho0 */
    const k3 = this.R.clone().y * tau; // k3 = r[1] * tau;            /*  rho1*tau  */
    const k5 = this.R.clone().z * tau * tau; // k5 = r[2] * tau * tau;      /*  rho2*tau^2  */
    let mu = this.R.clone().x + k3 + k5; // mu = r[0] + k3 + k5;

    let u = 1.0 - mu; /* initial approximation for iterations */
    let i = 0;
    for (i = 0; i < this.MAXITER; i++) {
      let du; // number
      u_2 = u * u;
      const poly = ((k5 * u_2 + k3) * u_2 + k1) * u - 1;
      const deriv = (5 * k5 * u_2 + 3 * k3) * u_2 + k1;
      if (deriv <= 0) {
        throw new Error('cmod_cahvor_2d_to_3d(): Distortion is too negative\n');
        // Console.WriteLine();
      } else {
        du = poly / deriv;
        u -= du;
        if (Math.abs(du) < this.CONV) break;
      }
    }
    if (i >= this.MAXITER) {
      throw new Error(`cmod_cahvor_2d_to_3d(): Too many iterations ${i}\n`);
      // Console.WriteLine("cmod_cahvor_2d_to_3d(): Too many iterations (%d)\n", i);
    }

    mu = 1 - u;
    const pp = lambda.clone().multiplyScalar(mu); // scale3(mu, lambda, pp);
    uvec3 = rr.clone().sub(pp.clone()); // sub3(rr, pp, uvec3);
    const magv = uvec3.clone().length(); // magv = mag3(uvec3);
    if (magv < this.EPSILON) {
      throw new Error('Divide by zero'); // not sure if this is possible but might as well check
    }
    uvec3 = uvec3.multiplyScalar(1.0 / magv); // scale3(1.0 / magv, uvec3, uvec3);

    const ray = new Ray();
    ray.origin = pos3;
    ray.direction = uvec3;
    return ray;
  }

  /**
   * @param {Vector3} pos
   * @returns {{ pixel: Vector2, range: number }}
   * @memberof CAHVOR
   */
  Backproject(pos) {
    const pos2 = new Vector2();
    let alpha;
    let beta;
    let gamma;
    let lambda = new Vector3();
    let mu;
    let omega;
    let omega_2;
    let p_c = new Vector3();
    let pp = new Vector3();
    let pp_c = new Vector3();
    let tau;
    let wo = new Vector3();

    /* Calculate p' and other necessary quantities */
    p_c = pos.clone().sub(this.C); // sub3(pos3, c, p_c);
    omega = p_c.dot(this.O); // omega = dot3(p_c, o);
    omega_2 = omega * omega;
    if (Math.abs(omega_2) <= this.EPSILON) {
      throw new Error('warning: omega_2 is too small');
      // Console.WriteLine("warning: omega_2 is too small");
    }
    wo = this.O.clone().multiplyScalar(omega); // scale3(omega, o, wo);
    lambda = p_c.clone().sub(wo); // sub3(p_c, wo, lambda);
    tau = lambda.dot(lambda) / omega_2; // tau = dot3(lambda, lambda) / omega_2;
    mu = this.R.x + this.R.y * tau + this.R.z * tau * tau; // mu = r[0] + (r[1] * tau) + (r[2] * tau * tau);
    pp = lambda.clone().multiplyScalar(mu); // scale3(mu, lambda, pp);
    pp = pos.clone().add(pp); // add3(pos3, pp, pp);

    /* Calculate alpha, beta, gamma, which are (p' - c) */
    /* dotted with a, h, v, respectively                */
    pp_c = pp.sub(this.C); // sub3(pp, c, pp_c);
    alpha = pp_c.dot(this.A); // alpha = dot3(pp_c, a);
    beta = pp_c.dot(this.H); // beta = dot3(pp_c, h);
    gamma = pp_c.dot(this.V); // gamma = dot3(pp_c, v);
    if (Math.abs(alpha) <= this.EPSILON) {
      throw new Error('warning: alpha is too small');
      // Console.WriteLine("warning: alpha is too small");
    }

    /* Calculate the projection */
    pos2.x = beta / alpha; // pos2[0] = xh = beta / alpha;
    pos2.y = gamma / alpha; // pos2[1] = yh = gamma / alpha;
    return {
      pixel: pos2,
      range: alpha,
    };
  }
}

export default CAHVOR;
