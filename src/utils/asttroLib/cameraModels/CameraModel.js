import { Ray, Vector2 } from 'three';

export class CameraModel {
  type;

  /**
   * Creates an instance of CameraModel.
   * @param {String} t type
   * @memberof CameraModel
   */
  constructor(t) {
    if (!this.type) this.type = t;
  }

  /**
   * @param {Vector2} pixelPos
   * @returns {Ray}
   * @memberof CameraModel
   */
  ProjectRay(_pixelPos) {
    return new Ray();
  }

  /**
   * @param {Vector2} pixelPos
   * @param {Number} range
   * @returns {Vector3}
   * @memberof CameraModel
   */
  ProjectPoint(pixelPos, range) {
    const r = this.ProjectRay(pixelPos);
    return r.origin.add(r.direction.multiplyScalar(range));
  }

  /**
   * @param {number} imageWidth
   * @param {number} imageHeight
   * @returns {number}
   * @memberof CameraModel
   */
  GetHorizontalFieldOfView(imageWidth, imageHeight) {
    let leftMiddleRay;
    let rightMiddleRay;

    let midY = imageHeight / 2.0;

    let leftMidPixel = new Vector2(0, midY);
    let rightMidPixel = new Vector2(imageWidth, midY);

    leftMiddleRay = this.ProjectRay(leftMidPixel);
    rightMiddleRay = this.ProjectRay(rightMidPixel);

    leftMiddleRay.direction.normalize();
    rightMiddleRay.direction.normalize();

    return Math.acos(leftMiddleRay.direction.dot(rightMiddleRay.direction));
  }

  /**
   * @param {number} imageWidth
   * @param {number} imageHeight
   * @returns {number}
   * @memberof CameraModel
   */
  GetVerticalFieldOfView(imageWidth, imageHeight) {
    let topMiddleRay;
    let bottomMiddleRay;

    let midX = imageWidth / 2.0;

    let topMidPixel = new Vector2(midX, 0);
    let bottomMidPixel = new Vector2(midX, imageHeight);

    topMiddleRay = this.ProjectRay(topMidPixel);
    bottomMiddleRay = this.ProjectRay(bottomMidPixel);

    topMiddleRay.direction.normalize();
    bottomMiddleRay.direction.normalize();

    return Math.acos(topMiddleRay.direction.dot(bottomMiddleRay.direction));
  }

  /**
   * @param {Vector3} pos
   * @returns {{ pixel: Vector2, range: number }}
   * @memberof CameraModel
   */
  Backproject(_pos) {}

  /**
   * @returns {Vector3}
   * @memberof CameraModel
   */
  GetCameraCenter() {}

  /**
   * @returns {Vector3}
   * @memberof CameraModel
   */
  GetCameraAxis() {}
  /**
   * @returns {Vector3}
   * @memberof CameraModel
   */
  GetCameraHorizontalVector() {}
  /**
   * @returns {Vector3}
   * @memberof CameraModel
   */
  GetCameraVerticalVector() {}
}

export default CameraModel;
