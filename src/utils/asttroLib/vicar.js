import { Vector3 } from 'src/utils/asttroLib/vector3';
import { Quaternion } from 'src/utils/asttroLib/quaternion';
import * as frameDefinition from 'src/utils/asttroLib/frameDefinition';
import * as units from 'src/utils/asttroLib/units';

const LinearityMode = {
  Perspective: { id: 1, linearity: 1 },
  Fisheye: { id: 2, linearity: 0 },
  General: { id: 3 },
};

const anyUndefined = (values) => !values.every((value) => typeof value !== 'undefined');

const tupleToVector3 = (components, frame) => {
  if (components.length !== 3 || anyUndefined(components)) return new Vector3();
  const [x, y, z] = components;
  return new Vector3({ x, y, z, frame });
};

const tupleToQuaternion = (components) => {
  if (components.length !== 4 || anyUndefined(components)) return new Quaternion();
  const [w, x, y, z] = components;
  return new Quaternion({ x, y, z, w });
};

export const imageIdFromVicarLabel = (vicarLabel) =>
  (vicarLabel && vicarLabel.IDENTIFICATION && vicarLabel.IDENTIFICATION.PRODUCT_ID) || '';

export const instrumentIdFromVicarLabel = (vicarLabel) =>
  (vicarLabel && vicarLabel.IDENTIFICATION && vicarLabel.IDENTIFICATION.INSTRUMENT_ID) || '';

export const imageDimensionsFromVicarLabel = (vicarLabel) => {
  let height;
  let width;

  if (vicarLabel && vicarLabel.system && vicarLabel.system.ORG) {
    // TODO populate with additional cases we need to handle
    switch (vicarLabel.system.ORG) {
      case 'BSQ':
      default:
        height = Number(vicarLabel.system.NL);
        width = Number(vicarLabel.system.NS);
    }
  }

  return { height, width };
};

const roverSiteOffsetFromVicarLabel = (vicarLabel = {}) => {
  const { ROVER_COORDINATE_SYSTEM } = vicarLabel;
  if (ROVER_COORDINATE_SYSTEM && ROVER_COORDINATE_SYSTEM.ORIGIN_OFFSET_VECTOR) {
    const refFrameName = ROVER_COORDINATE_SYSTEM.REFERENCE_COORD_SYSTEM_NAME;
    const refFrameIndex = ROVER_COORDINATE_SYSTEM.REFERENCE_COORD_SYSTEM_INDEX;

    const frame = refFrameName === 'SITE_FRAME' ? frameDefinition.siteFrame(refFrameIndex) : null;
    if (!frame) {
      console.warn(`Unknown reference frame ${refFrameName}`);
    }
    return tupleToVector3(ROVER_COORDINATE_SYSTEM.ORIGIN_OFFSET_VECTOR, frame);
  }
  return undefined;
};

const roverRotationFromVicarLabel = (vicarLabel = {}) => {
  const { ROVER_COORDINATE_SYSTEM } = vicarLabel;
  return ROVER_COORDINATE_SYSTEM && ROVER_COORDINATE_SYSTEM.ORIGIN_ROTATION_QUATERNION
    ? tupleToQuaternion(ROVER_COORDINATE_SYSTEM.ORIGIN_ROTATION_QUATERNION)
    : undefined;
};

const cameraModelFromVicarLabel = (vicarLabel = {}) => {
  const cameraModel = { type: '', components: {}, frame: '' };
  if (vicarLabel.GEOMETRIC_CAMERA_MODEL) {
    const { GEOMETRIC_CAMERA_MODEL } = vicarLabel;

    cameraModel.type = (GEOMETRIC_CAMERA_MODEL && GEOMETRIC_CAMERA_MODEL.MODEL_TYPE) || '';
    const { REFERENCE_COORD_SYSTEM_NAME, REFERENCE_COORD_SYSTEM_INDEX } = GEOMETRIC_CAMERA_MODEL;
    const cameraModelComponentIds = cameraModel.type.split('');
    const frame =
      REFERENCE_COORD_SYSTEM_NAME === 'ROVER_NAV_FRAME'
        ? frameDefinition.roverNavFrame(
            REFERENCE_COORD_SYSTEM_INDEX[0],
            REFERENCE_COORD_SYSTEM_INDEX[1],
            REFERENCE_COORD_SYSTEM_INDEX[2]
          )
        : frameDefinition.localLevelFrame(
            REFERENCE_COORD_SYSTEM_INDEX[0],
            REFERENCE_COORD_SYSTEM_INDEX[1],
            REFERENCE_COORD_SYSTEM_INDEX[2]
          );
    cameraModel.frame = frame;
    if (
      GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_ID &&
      Object.keys(GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_ID).length >= cameraModelComponentIds.length
    ) {
      cameraModelComponentIds.forEach((modelComponentId) => {
        const componentIndex = GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_ID.indexOf(modelComponentId);
        const componentValues = GEOMETRIC_CAMERA_MODEL[`MODEL_COMPONENT_${componentIndex + 1}`] || [];
        cameraModel.components[modelComponentId] = tupleToVector3(componentValues, frame);
      });
      // Check for the linearity type for CAHVORE models
      // https://github.jpl.nasa.gov/pages/telitwin/ccal/doc/www/ccal-parameters.html
      // MODEL_COMPONENT_8 can be 1, 2, 3 where 1 is Perspective, 2 is Fisheye, and 3 is General
      // If the linearity type is General, then MODEL_COMPONENT_9 represents the linearity type where 0 is Fisheye and 1 is Perspective
      if (cameraModel.type === 'CAHVORE') {
        const { MODEL_COMPONENT_8, MODEL_COMPONENT_9 } = GEOMETRIC_CAMERA_MODEL;
        const comp8 = parseFloat(MODEL_COMPONENT_8);
        const comp9 = parseFloat(MODEL_COMPONENT_9);
        if (comp8 === LinearityMode.Fisheye.id) {
          cameraModel.components.Linearity = LinearityMode.Fisheye.linearity;
        } else if (comp8 === LinearityMode.Perspective.id) {
          cameraModel.components.Linearity = LinearityMode.Perspective.linearity;
        } else {
          // General
          cameraModel.components.Linearity = comp9;
        }
      }
    }
  } else if (
    vicarLabel.SURFACE_MODEL_PARMS &&
    vicarLabel.SURFACE_MODEL_PARMS.SURFACE_MODEL_TYPE === 'PLANE' &&
    vicarLabel.SURFACE_PROJECTION_PARMS.MAP_PROJECTION_TYPE === 'CYLINDRICAL'
  ) {
    const { SURFACE_MODEL_PARMS } = vicarLabel;
    cameraModel.type = 'CYLINDRICAL';
    const { REFERENCE_COORD_SYSTEM_INDEX } = SURFACE_MODEL_PARMS;
    const frame = frameDefinition.siteFrame(REFERENCE_COORD_SYSTEM_INDEX);
    cameraModel.frame = frame;
  }

  return cameraModel;
};

const instrumentFOVFromVicarLabel = (vicarLabel = {}) => {
  const { INSTRUMENT_STATE_PARMS } = vicarLabel;
  const { AZIMUTH_FOV: azimuthFov, AZIMUTH_FOV__UNIT: azFovUnits } = INSTRUMENT_STATE_PARMS || {};
  if (Number.isNaN(Number(azimuthFov))) return 0;
  const fovUnits = azFovUnits || 'deg'; // Assume degree if unit is not specified
  return fovUnits === 'deg' ? units.degToRadians(Number(azimuthFov)) : Number(azimuthFov);
};

const jointsFromVicarLabel = (vicarLabel = {}) => {
  const nMatching = {
    'LEFT FRONT WHEEL STEER MOTOR': 'LF_STEER',
    'RIGHT FRONT WHEEL STEER MOTOR': 'RF_STEER',
    'LEFT REAR WHEEL STEER MOTOR': 'LR_STEER',
    'RIGHT REAR WHEEL STEER MOTOR': 'RR_STEER',
    'LEFT BOGIE': 'LEFT_BOGIE',
    'RIGHT BOGIE': 'RIGHT_BOGIE',
    'JOINT 1 AZIMUTH-HALL SENSOR': 'JOINT1_ENC',
    'JOINT 2 ELEVATION-HALL SENSOR': 'JOINT2_ENC',
    'JOINT 3 ELBOW-HALL SENSOR': 'JOINT3_ENC',
    'JOINT 4 WRIST-HALL SENSOR': 'JOINT4_ENC',
    'JOINT 5 TURRET-HALL SENSOR': 'JOINT5_ENC',
    'AZIMUTH FINAL-RESOLVER': 'RSM_AZ',
    'ELEVATION FINAL-RESOLVER': 'RSM_EL',
  };

  const { CHASSIS_ARTICULATION_STATE, ARM_ARTICULATION_STATE, RSM_ARTICULATION_STATE } = vicarLabel;
  const retval = {};
  if (CHASSIS_ARTICULATION_STATE && CHASSIS_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE_NAME) {
    CHASSIS_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE_NAME.forEach((n, i) => {
      const jName = nMatching[n] || n;
      const unit = CHASSIS_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE__UNIT
        ? CHASSIS_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE__UNIT[i]
        : 'deg';
      retval[jName] =
        unit === 'deg'
          ? units.degToRadians(Number(CHASSIS_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE[i] || 0))
          : Number(CHASSIS_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE[i] || 0);
    });
  }

  if (ARM_ARTICULATION_STATE && ARM_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE_NAME) {
    ARM_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE_NAME.forEach((n, i) => {
      const jName = nMatching[n] || n;
      const unit = ARM_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE__UNIT
        ? ARM_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE__UNIT[i]
        : 'deg';
      retval[jName] =
        unit === 'deg'
          ? units.degToRadians(Number(ARM_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE[i] || 0))
          : Number(ARM_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE[i] || 0);
    });
  }

  if (RSM_ARTICULATION_STATE && RSM_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE_NAME) {
    RSM_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE_NAME.forEach((n, i) => {
      const jName = nMatching[n] || n;
      const unit = RSM_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE__UNIT
        ? RSM_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE__UNIT[i]
        : 'deg';
      retval[jName] =
        unit === 'deg'
          ? units.degToRadians(Number(RSM_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE[i] || 0))
          : Number(RSM_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE[i] || 0);
    });
  }
  // remove no-data values and replace them with 0
  // eslint-disable-next-line no-restricted-syntax
  for (const k in retval) {
    // eslint-disable-next-line no-prototype-builtins
    if (retval.hasOwnProperty(k) && retval[k] === Number('1e30')) {
      retval[k] = 0;
    }
  }
  return retval;
};

// Simplified parsing of a Vicar image label which returns: Camera model, Instrument field of view, and Rover orientation
// This matches the properties expected from Unity for adding an image to the scene
export function parseVicarLabel(vicarLabel) {
  const RoverSiteOffset = roverSiteOffsetFromVicarLabel(vicarLabel);
  const RoverRotation = roverRotationFromVicarLabel(vicarLabel);
  const FovRadians = instrumentFOVFromVicarLabel(vicarLabel);
  const CameraModel = cameraModelFromVicarLabel(vicarLabel);
  let Joints;
  try {
    Joints = jointsFromVicarLabel(vicarLabel);
  } catch (err) {
    console.warn('Error parsing joints from image header', err);
    Joints = {};
  }

  return {
    RoverSiteOffset,
    RoverRotation,
    FovRadians,
    CameraModel,
    Time: vicarLabel.IDENTIFICATION.SPACECRAFT_CLOCK_STOP_COUNT,
    Joints,
  };
}
