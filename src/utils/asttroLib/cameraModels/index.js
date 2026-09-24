import { CAHV } from 'src/utils/asttroLib/cameraModels/CAHV.js';
import { CAHVOR } from 'src/utils/asttroLib/cameraModels/CAHVOR.js';
import { CAHVORE } from 'src/utils/asttroLib/cameraModels/CAHVORE.js';
import { CylindricalMosaicCameraModel } from 'src/utils/asttroLib/cameraModels/cylindricalMosaic.js';
import { Vector3 } from 'three';

import { getConfig } from 'src/utils/configRegistry';
import { getPropFromProduct } from 'src/utils/sharedUtils';
const LinearityMode = {
  Perspective: { id: 1, linearity: 1 },
  Fisheye: { id: 2, linearity: 0 },
  General: { id: 3 },
};

export function getModelForProduct(product) {
  const config = getConfig();
  const { vicar_label } = product;
  const { GEOMETRIC_CAMERA_MODEL } = vicar_label;
  const type = GEOMETRIC_CAMERA_MODEL ? GEOMETRIC_CAMERA_MODEL.MODEL_TYPE : null;

  // shortcut for mosaics first
  const surfaceProjKey = vicar_label.SURFACE_PROJECTION_PARMS
    ? 'SURFACE_PROJECTION_PARMS'
    : 'SURFACE_PROJECTION_PARAMS'; // stupid
  if (vicar_label[surfaceProjKey]) {
    return new CylindricalMosaicCameraModel({
      site: getPropFromProduct(product, config.es_mappings.site),
      drive: getPropFromProduct(product, config.es_mappings.drive),
      projectionOriginVector: [...vicar_label[surfaceProjKey].PROJECTION_ORIGIN_VECTOR],
      frame: vicar_label[surfaceProjKey].REFERENCE_COORD_SYSTEM_NAME,
      frameIndex: vicar_label[surfaceProjKey].REFERENCE_COORD_SYSTEM_INDEX,
      startAzimuth: vicar_label[surfaceProjKey].START_AZIMUTH,
      mapResolution: [...vicar_label[surfaceProjKey].MAP_RESOLUTION],
      zeroElevationLine: vicar_label[surfaceProjKey].ZERO_ELEVATION_LINE,
    });
  }

  switch (type) {
    case 'CAHV':
      return new CAHV(
        new Vector3(...GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_1.map((x) => parseFloat(x))),
        new Vector3(...GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_2.map((x) => parseFloat(x))),
        new Vector3(...GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_3.map((x) => parseFloat(x))),
        new Vector3(...GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_4.map((x) => parseFloat(x)))
      );
    case 'CAHVOR':
      return new CAHVOR(
        new Vector3(...GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_1.map((x) => parseFloat(x))),
        new Vector3(...GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_2.map((x) => parseFloat(x))),
        new Vector3(...GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_3.map((x) => parseFloat(x))),
        new Vector3(...GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_4.map((x) => parseFloat(x))),
        new Vector3(...GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_5.map((x) => parseFloat(x))),
        new Vector3(...GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_6.map((x) => parseFloat(x)))
      );
    case 'CAHVORE':
      const { MODEL_COMPONENT_8, MODEL_COMPONENT_9 } = GEOMETRIC_CAMERA_MODEL;
      const comp8 = parseFloat(MODEL_COMPONENT_8);
      const comp9 = parseFloat(MODEL_COMPONENT_9);
      let linearity = comp9;
      if (comp8 === LinearityMode.Fisheye.id) {
        linearity = LinearityMode.Fisheye.linearity;
      } else if (comp8 === LinearityMode.Perspective.id) {
        linearity = LinearityMode.Perspective.linearity;
      }
      return new CAHVORE(
        new Vector3(...GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_1.map((x) => parseFloat(x))),
        new Vector3(...GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_2.map((x) => parseFloat(x))),
        new Vector3(...GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_3.map((x) => parseFloat(x))),
        new Vector3(...GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_4.map((x) => parseFloat(x))),
        new Vector3(...GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_5.map((x) => parseFloat(x))),
        new Vector3(...GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_6.map((x) => parseFloat(x))),
        new Vector3(...GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_7.map((x) => parseFloat(x))),
        linearity
      );
    default:
      return null;
  }
}
