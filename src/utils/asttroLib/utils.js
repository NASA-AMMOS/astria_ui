import { Vector3 } from 'src/utils/asttroLib/vector3';
import * as frameConversion from 'src/utils/asttroLib/frames';

export async function transformCameraModelToFrame(cameraModel, toFrame) {
  const convertedCameraModel = cameraModel;
  if (cameraModel.components) {
    const { components } = cameraModel;
    if (components.C) {
      convertedCameraModel.components.C = await frameConversion.convertPoint(components.C, toFrame);
    }
    if (components.A) {
      convertedCameraModel.components.A = await frameConversion.convertDirection(components.A, toFrame);
    }
    if (components.H) {
      convertedCameraModel.components.H = await frameConversion.convertDirection(components.H, toFrame);
    }
    if (components.V) {
      convertedCameraModel.components.V = await frameConversion.convertDirection(components.V, toFrame);
    }
    if (components.O) {
      convertedCameraModel.components.O = await frameConversion.convertDirection(components.O, toFrame);
    }
  } else {
    if (cameraModel.C) {
      let nPoint = new Vector3({
        x: convertedCameraModel.C.x,
        y: convertedCameraModel.C.y,
        z: convertedCameraModel.C.z,
        frame: convertedCameraModel.C.frame,
      });
      nPoint = await frameConversion.convertPoint(nPoint, toFrame);
      convertedCameraModel.C.x = nPoint.x;
      convertedCameraModel.C.y = nPoint.y;
      convertedCameraModel.C.z = nPoint.z;
    }
    if (cameraModel.A) {
      let nPoint = new Vector3({
        x: convertedCameraModel.A.x,
        y: convertedCameraModel.A.y,
        z: convertedCameraModel.A.z,
        frame: convertedCameraModel.A.frame,
      });
      nPoint = await frameConversion.convertDirection(nPoint, toFrame);
      convertedCameraModel.A.x = nPoint.x;
      convertedCameraModel.A.y = nPoint.y;
      convertedCameraModel.A.z = nPoint.z;
    }
    if (cameraModel.H) {
      let nPoint = new Vector3({
        x: convertedCameraModel.H.x,
        y: convertedCameraModel.H.y,
        z: convertedCameraModel.H.z,
        frame: convertedCameraModel.H.frame,
      });
      nPoint = await frameConversion.convertDirection(nPoint, toFrame);
      convertedCameraModel.H.x = nPoint.x;
      convertedCameraModel.H.y = nPoint.y;
      convertedCameraModel.H.z = nPoint.z;
    }
    if (cameraModel.V) {
      let nPoint = new Vector3({
        x: convertedCameraModel.V.x,
        y: convertedCameraModel.V.y,
        z: convertedCameraModel.V.z,
        frame: convertedCameraModel.V.frame,
      });
      nPoint = await frameConversion.convertDirection(nPoint, toFrame);
      convertedCameraModel.V.x = nPoint.x;
      convertedCameraModel.V.y = nPoint.y;
      convertedCameraModel.V.z = nPoint.z;
    }
    if (cameraModel.O) {
      let nPoint = new Vector3({
        x: convertedCameraModel.O.x,
        y: convertedCameraModel.O.y,
        z: convertedCameraModel.O.z,
        frame: convertedCameraModel.O.frame,
      });
      nPoint = await frameConversion.convertDirection(nPoint, toFrame);
      convertedCameraModel.O.x = nPoint.x;
      convertedCameraModel.O.y = nPoint.y;
      convertedCameraModel.O.z = nPoint.z;
    }
  }

  return convertedCameraModel;
}
