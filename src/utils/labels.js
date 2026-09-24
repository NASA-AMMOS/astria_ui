import { getConfig } from 'src/utils/configRegistry';
import { fetchESDataForProduct } from 'src/utils/dataQuery';
import { pdsGetDownloadPathForProduct } from 'src/utils/endpoints';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import { logError } from 'src/utils/telemetryUtils';

let labelAbortController = null;

const pds2vicarAliases = {
  planar: 'PLANE',
};

export async function getNormalizeImageLabel(imageProduct) {
  const config = getConfig();
  console.time('Normalizing Label');
  // since it was the first, VICAR will be our standard and we will normalize to that
  let { [config.label_key]: label } = imageProduct;
  switch (config.label_key) {
    case 'vicar_label':
      break; // nothing to do
    case 'pds4_label':
      label = await convertPDS4ToVICAR(imageProduct);
      break;
    default:
      console.warn(`Cannot normalize image label. Unknown key: ${config.label_key}`);
  }
  console.timeEnd('Normalizing Label');
  if (Object.keys(label).length > 0) return label;
}

export async function convertPDS4ToVICAR(imageProduct) {
  const config = getConfig();
  // https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_mission/document_camera/Mars2020_Camera_SIS_Labels_sort_vicar.html is garbage, we're going for the XML parse

  const xmlID = getPropFromProduct(imageProduct, { key: config.label_xml_url_key });
  try {
    const label = {};

    // prep the 'top-level' objects
    label.IDENTIFICATION = {};
    label.INSTRUMENT_STATE_PARMS = {};
    label.DERIVED_IMAGE_PARMS = {};
    label.OBSERVATION_REQUEST_PARMS = {};
    label.INSTRUMENT_ID = {};
    label.MINI_HEADER = {};
    label.GEOMETRIC_CAMERA_MODEL = {};
    label.SITE_COORDINATE_SYSTEM = {};
    label.ROVER_COORDINATE_SYSTEM = {};
    label.CHASSIS_ARTICULATION_STATE = {};
    label.ARM_ARTICULATION_STATE = {};
    label.RSM_ARTICULATION_STATE = {};
    label.SURFACE_MODEL_PARMS = {};
    label.SURFACE_PROJECTION_PARMS = {};
    label.system = {};

    // fetch the XML
    labelAbortController?.abort(); // only be fetching one at a time
    labelAbortController = new AbortController();
    const xmlProduct = await fetchESDataForProduct(xmlID, labelAbortController.signal);
    const xmlURL = pdsGetDownloadPathForProduct(xmlProduct);
    const data = await fetch(xmlURL, { ...(config.using_csso ? { credentials: 'include' } : null) });
    const xmlText = await data.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    // Begin parsing
    let root = xmlDoc
      ?.getElementsByTagName('Product_Observational')[0]
      ?.getElementsByTagName('Observation_Area')[0]
      ?.getElementsByTagName('Discipline_Area')[0];

    label.IDENTIFICATION.SEQUENCE_ID = root
      ?.getElementsByTagName('msn_surface:Surface_Mission_Information')[0]
      ?.getElementsByTagName('msn_surface:Command_Execution')[0]
      ?.getElementsByTagName('msn_surface:sequence_id')[0].textContent;
    label.IDENTIFICATION.SPACECRAFT_CLOCK_STOP_COUNT = root
      ?.getElementsByTagName('msn:Mission_Information')[0]
      ?.getElementsByTagName('msn:spacecraft_clock_stop')[0].textContent;

    const imagingNode = root?.getElementsByTagName('img:Imaging')[0];
    const imagingCommandNode = imagingNode?.getElementsByTagName('img:Commanded_Parameters')[0];
    const imagingFocusNode = imagingCommandNode?.getElementsByTagName('img:Focus')[0];
    label.INSTRUMENT_STATE_PARMS.FOCAL_LENGTH = imagingNode
      ?.getElementsByTagName('img:Optical_Properties')[0]
      ?.getElementsByTagName('img:focal_length')[0].textContent;
    label.INSTRUMENT_STATE_PARMS.FOCUS_POSITION_COUNT =
      imagingFocusNode?.getElementsByTagName('img:focus_position_count')[0]?.textContent;
    label.OBSERVATION_REQUEST_PARMS.INSTRUMENT_FOCUS_DISTANCE =
      imagingFocusNode?.getElementsByTagName('img:focus_distance')[0]?.textContent;
    label.OBSERVATION_REQUEST_PARMS.INSTRUMENT_FOCUS_DISTANCE__UNIT = imagingFocusNode
      ?.getElementsByTagName('img:focus_distance')[0]
      ?.getAttribute('unit');

    const imageTileNode = imagingNode?.getElementsByTagName('img:Tiling')[0];
    label.INSTRUMENT_STATE_PARMS.TILE_PRODUCT_ID = Array.from(
      imageTileNode?.getElementsByTagName('img:Tile') || []
    )?.map(
      (n) => n.getElementsByTagName('Internal_Reference')[0]?.getElementsByTagName('lidvid_reference')[0]?.textContent
    );
    label.DERIVED_IMAGE_PARMS.INPUT_PRODUCT_ID = [...label.INSTRUMENT_STATE_PARMS.TILE_PRODUCT_ID];

    const subframeNode = imagingNode?.getElementsByTagName('img:Subframe')[0];
    label.INSTRUMENT_STATE_PARMS.AZIMUTH_FOV = subframeNode?.getElementsByTagName('img:sample_fov')[0]?.textContent;
    label.INSTRUMENT_STATE_PARMS.AZIMUTH_FOV__UNIT = subframeNode
      ?.getElementsByTagName('img:sample_fov')[0]
      ?.getAttribute('unit');

    const surfaceImagingNode = root?.getElementsByTagName('img_surface:Surface_Imaging')[0];
    label.INSTRUMENT_ID = surfaceImagingNode
      ?.getElementsByTagName('img_surface:Instrument_Information')[0]
      ?.getElementsByTagName('img_surface:ops_instrument_key')[0]?.textContent;
    label.DERIVED_IMAGE_PARMS.REFERENCE_COORD_SYSTEM_NAME = surfaceImagingNode
      ?.getElementsByTagName('img_surface:Derived_Product_Parameters')[0]
      ?.getElementsByTagName('geom:Coordinate_Space_Reference')[0]
      ?.getElementsByTagName('Local_Internal_Reference')[0]
      ?.getElementsByTagName('local_identifier_reference')[0]?.textContent;

    const msssComponentNode = Array.from(
      root
        ?.getElementsByTagName('msss_cam_mh:MSSS_Camera_Mini_Header')[0]
        ?.getElementsByTagName('img:Instrument_State')[0]
        ?.getElementsByTagName('img:Device_Component_States')[0]
        ?.getElementsByTagName('img:Device_Component_State') || []
    );
    label.MINI_HEADER.INSTRUMENT_STATE_NAME = msssComponentNode?.map(
      (n) => n.getElementsByTagName('img:device_name')[0]?.textContent
    );
    label.MINI_HEADER.INSTRUMENT_STATE = msssComponentNode?.map(
      (n) => n.getElementsByTagName('img:device_state')[0]?.textContent
    );

    const geometryNode = root?.getElementsByTagName('geom:Geometry')[0];
    const geomLanderNode = geometryNode?.getElementsByTagName('geom:Geometry_Lander')[0];
    const modelParmsNode = geomLanderNode?.getElementsByTagName('geom:Camera_Model_Parameters')[0];
    label.GEOMETRIC_CAMERA_MODEL.MODEL_TYPE = modelParmsNode?.getElementsByTagName('geom:model_type')[0]?.textContent;
    const camModelNode = modelParmsNode?.getElementsByTagName(
      `geom:${label.GEOMETRIC_CAMERA_MODEL.MODEL_TYPE}_Model`
    )[0];
    label.GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_1 = [
      camModelNode?.getElementsByTagName('geom:Vector_Center')[0]?.getElementsByTagName('geom:x_position')[0]
        ?.textContent,
      camModelNode?.getElementsByTagName('geom:Vector_Center')[0]?.getElementsByTagName('geom:y_position')[0]
        ?.textContent,
      camModelNode?.getElementsByTagName('geom:Vector_Center')[0]?.getElementsByTagName('geom:z_position')[0]
        ?.textContent,
    ];
    label.GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_2 = [
      camModelNode?.getElementsByTagName('geom:Vector_Axis')[0]?.getElementsByTagName('geom:x_unit')[0]?.textContent,
      camModelNode?.getElementsByTagName('geom:Vector_Axis')[0]?.getElementsByTagName('geom:y_unit')[0]?.textContent,
      camModelNode?.getElementsByTagName('geom:Vector_Axis')[0]?.getElementsByTagName('geom:z_unit')[0]?.textContent,
    ];
    label.GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_3 = [
      camModelNode?.getElementsByTagName('geom:Vector_Horizontal')[0]?.getElementsByTagName('geom:x_pixel')[0]
        ?.textContent,
      camModelNode?.getElementsByTagName('geom:Vector_Horizontal')[0]?.getElementsByTagName('geom:y_pixel')[0]
        ?.textContent,
      camModelNode?.getElementsByTagName('geom:Vector_Horizontal')[0]?.getElementsByTagName('geom:z_pixel')[0]
        ?.textContent,
    ];
    label.GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_4 = [
      camModelNode?.getElementsByTagName('geom:Vector_Vertical')[0]?.getElementsByTagName('geom:x_pixel')[0]
        ?.textContent,
      camModelNode?.getElementsByTagName('geom:Vector_Vertical')[0]?.getElementsByTagName('geom:y_pixel')[0]
        ?.textContent,
      camModelNode?.getElementsByTagName('geom:Vector_Vertical')[0]?.getElementsByTagName('geom:z_pixel')[0]
        ?.textContent,
    ];
    label.GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_5 = [
      camModelNode?.getElementsByTagName('geom:Vector_Optical')[0]?.getElementsByTagName('geom:x_unit')[0]?.textContent,
      camModelNode?.getElementsByTagName('geom:Vector_Optical')[0]?.getElementsByTagName('geom:y_unit')[0]?.textContent,
      camModelNode?.getElementsByTagName('geom:Vector_Optical')[0]?.getElementsByTagName('geom:z_unit')[0]?.textContent,
    ];
    label.GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_6 = [
      camModelNode?.getElementsByTagName('geom:Radial_Terms')[0]?.getElementsByTagName('geom:c0')[0]?.textContent,
      camModelNode?.getElementsByTagName('geom:Radial_Terms')[0]?.getElementsByTagName('geom:c1')[0]?.textContent,
      camModelNode?.getElementsByTagName('geom:Radial_Terms')[0]?.getElementsByTagName('geom:c2')[0]?.textContent,
    ];
    label.GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_7 = [
      camModelNode?.getElementsByTagName('geom:Entrance_Terms')[0]?.getElementsByTagName('geom:c0')[0]?.textContent,
      camModelNode?.getElementsByTagName('geom:Entrance_Terms')[0]?.getElementsByTagName('geom:c1')[0]?.textContent,
      camModelNode?.getElementsByTagName('geom:Entrance_Terms')[0]?.getElementsByTagName('geom:c2')[0]?.textContent,
    ];
    label.GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_8 =
      camModelNode?.getElementsByTagName('geom:cahvore_model_type')[0]?.textContent;
    label.GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_9 =
      camModelNode?.getElementsByTagName('geom:cahvore_model_parameter')[0]?.textContent;

    const camModelFrameNode = modelParmsNode
      ?.getElementsByTagName('geom:Coordinate_Space_Reference')[0]
      ?.getElementsByTagName('geom:Coordinate_Space_Indexed')[0];
    label.GEOMETRIC_CAMERA_MODEL.REFERENCE_COORD_SYSTEM_NAME = camModelFrameNode?.getElementsByTagName(
      'geom:coordinate_space_frame_type'
    )[0]?.textContent;
    label.GEOMETRIC_CAMERA_MODEL.REFERENCE_COORD_SYSTEM_INDEX = Array.from(
      camModelFrameNode?.getElementsByTagName('geom:Coordinate_Space_Index') || []
    )?.map((n) => n.getElementsByTagName('geom:index_value_number')[0]?.textContent);

    label.GEOMETRIC_CAMERA_MODEL.MODEL_COMPONENT_ID = label.GEOMETRIC_CAMERA_MODEL?.MODEL_TYPE?.split('');

    label.SITE_COORDINATE_SYSTEM.COORDINATE_SYSTEM_INDEX = Array.from(
      geomLanderNode?.getElementsByTagName('geom:Coordinate_Space_Definition') || []
    )
      ?.filter((n) => /^SITE_FRAME/i.test(n.getElementsByTagName('local_identifier')[0]?.textContent))[0]
      ?.getElementsByTagName('geom:Coordinate_Space_Present')[0]
      ?.getElementsByTagName('geom:Coordinate_Space_Indexed')[0]
      ?.getElementsByTagName('geom:Coordinate_Space_Index')[0]
      ?.getElementsByTagName('geom:index_value_number')[0]?.textContent;

    const rnavNode = Array.from(geomLanderNode?.getElementsByTagName('geom:Coordinate_Space_Definition'))?.filter((n) =>
      /^ROVER_NAV_FRAME/i.test(n.getElementsByTagName('local_identifier')[0]?.textContent)
    )[0];
    let { name = '', index = '' } =
      rnavNode
        ?.getElementsByTagName('geom:Coordinate_Space_Reference')[0]
        ?.getElementsByTagName('Local_Internal_Reference')[0]
        ?.getElementsByTagName('local_identifier_reference')[0]
        ?.textContent.match(/^(?<name>\w+)_FRAME_(?<index>\d+)/i).groups || {};
    label.ROVER_COORDINATE_SYSTEM.REFERENCE_COORD_SYSTEM_NAME = name;
    label.ROVER_COORDINATE_SYSTEM.REFERENCE_COORD_SYSTEM_INDEX = index;
    label.ROVER_COORDINATE_SYSTEM.ORIGIN_ROTATION_QUATERNION = [
      rnavNode?.getElementsByTagName('geom:Quaternion_Plus_Direction')[0]?.getElementsByTagName('geom:qcos')[0]
        ?.textContent,
      rnavNode?.getElementsByTagName('geom:Quaternion_Plus_Direction')[0]?.getElementsByTagName('geom:qsin1')[0]
        ?.textContent,
      rnavNode?.getElementsByTagName('geom:Quaternion_Plus_Direction')[0]?.getElementsByTagName('geom:qsin2')[0]
        ?.textContent,
      rnavNode?.getElementsByTagName('geom:Quaternion_Plus_Direction')[0]?.getElementsByTagName('geom:qsin3')[0]
        ?.textContent,
    ];
    label.ROVER_COORDINATE_SYSTEM.ORIGIN_OFFSET_VECTOR = [
      rnavNode?.getElementsByTagName('geom:Vector_Origin_Offset')[0]?.getElementsByTagName('geom:x_position')[0]
        ?.textContent,
      rnavNode?.getElementsByTagName('geom:Vector_Origin_Offset')[0]?.getElementsByTagName('geom:y_position')[0]
        ?.textContent,
      rnavNode?.getElementsByTagName('geom:Vector_Origin_Offset')[0]?.getElementsByTagName('geom:z_position')[0]
        ?.textContent,
    ];
    label.IDENTIFICATION.ROVER_MOTION_COUNTER = Array.from(
      geomLanderNode
        ?.getElementsByTagName('geom:Motion_Counter')[0]
        ?.getElementsByTagName('geom:Motion_Counter_Index') || []
    )?.map((n) => n.getElementsByTagName('geom:index_value_number')[0]?.textContent);

    const chassisNode = Array.from(
      Array.from(geomLanderNode?.getElementsByTagName('geom:Articulation_Device_Parameters') || [])
        ?.filter((n) => n.getElementsByTagName('geom:device_id')[0]?.textContent === 'CHASSIS')[0]
        ?.getElementsByTagName('geom:Device_Angle')[0]
        ?.getElementsByTagName('geom:Device_Angle_Index') || []
    );
    label.CHASSIS_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE_NAME = chassisNode?.map(
      (n) => n.getElementsByTagName('geom:index_id')[0]?.textContent
    );
    label.CHASSIS_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE__UNIT = chassisNode?.map((n) =>
      n.getElementsByTagName('geom:index_value_angle')[0]?.getAttribute('unit')
    );
    label.CHASSIS_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE = chassisNode?.map(
      (n) => n.getElementsByTagName('geom:index_value_angle')[0]?.textContent
    );

    const armNode = Array.from(
      Array.from(geomLanderNode?.getElementsByTagName('geom:Articulation_Device_Parameters') || [])
        ?.filter((n) => n.getElementsByTagName('geom:device_id')[0]?.textContent === 'ARM')[0]
        ?.getElementsByTagName('geom:Device_Angle')[0]
        ?.getElementsByTagName('geom:Device_Angle_Index') || []
    );
    label.ARM_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE_NAME = armNode?.map(
      (n) => n.getElementsByTagName('geom:index_id')[0]?.textContent
    );
    label.ARM_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE__UNIT = armNode?.map((n) =>
      n.getElementsByTagName('geom:index_value_angle')[0]?.getAttribute('unit')
    );
    label.ARM_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE = armNode?.map(
      (n) => n.getElementsByTagName('geom:index_value_angle')[0]?.textContent
    );

    const rsmNode = Array.from(
      Array.from(geomLanderNode?.getElementsByTagName('geom:Articulation_Device_Parameters') || [])
        ?.filter((n) => n.getElementsByTagName('geom:device_id')[0]?.textContent === 'RSM')[0]
        ?.getElementsByTagName('geom:Device_Angle')[0]
        ?.getElementsByTagName('geom:Device_Angle_Index') || []
    );
    label.RSM_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE_NAME = rsmNode?.map(
      (n) => n.getElementsByTagName('geom:index_id')[0]?.textContent
    );
    label.RSM_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE__UNIT = rsmNode?.map((n) =>
      n.getElementsByTagName('geom:index_value_angle')[0]?.getAttribute('unit')
    );
    label.RSM_ARTICULATION_STATE.ARTICULATION_DEVICE_ANGLE = rsmNode?.map(
      (n) => n.getElementsByTagName('geom:index_value_angle')[0]?.textContent
    );

    const localCartNode = root
      ?.getElementsByTagName('cart:Cartography')[0]
      ?.getElementsByTagName('cart:Spatial_Reference_Information')[0]
      ?.getElementsByTagName('cart:Horizontal_Coordinate_System_Definition')[0]
      ?.getElementsByTagName('cart:Local')[0];
    label.SURFACE_MODEL_PARMS.SURFACE_MODEL_TYPE = pds2vicarAlias(
      localCartNode
        ?.getElementsByTagName('cart:Surface_Model_Parameters')[0]
        ?.getElementsByTagName('cart:surface_model_type')[0]?.textContent
    );
    label.SURFACE_MODEL_PARMS.REFERENCE_COORD_SYSTEM_INDEX = Array.from(
      localCartNode
        ?.getElementsByTagName('cart:Surface_Model_Parameters')[0]
        ?.getElementsByTagName('geom:Coordinate_Space_Reference')[0]
        ?.getElementsByTagName('geom:Coordinate_Space_Indexed')[0]
        ?.getElementsByTagName('geom:Coordinate_Space_Index') || []
    )?.map((n) => n.getElementsByTagName('geom:index_value_number')[0]?.textContent);
    label.SURFACE_MODEL_PARMS.MAP_PROJECTION_TYPE = localCartNode
      ?.getElementsByTagName('cart:Map_Projection_Lander')[0]
      ?.getElementsByTagName('cart:lander_map_projection_name')[0]?.textContent;
    label.SURFACE_MODEL_PARMS.SURFACE_GROUND_LOCATION = [
      localCartNode
        ?.getElementsByTagName('cart:Surface_Model_Parameters')[0]
        ?.getElementsByTagName('cart:Surface_Model_Planar')[0]
        ?.getElementsByTagName('cart:Vector_Surface_Ground_Location')[0]
        ?.getElementsByTagName('cart:x_position')[0]?.textContent,
      localCartNode
        ?.getElementsByTagName('cart:Surface_Model_Parameters')[0]
        ?.getElementsByTagName('cart:Surface_Model_Planar')[0]
        ?.getElementsByTagName('cart:Vector_Surface_Ground_Location')[0]
        ?.getElementsByTagName('cart:y_position')[0]?.textContent,
      localCartNode
        ?.getElementsByTagName('cart:Surface_Model_Parameters')[0]
        ?.getElementsByTagName('cart:Surface_Model_Planar')[0]
        ?.getElementsByTagName('cart:Vector_Surface_Ground_Location')[0]
        ?.getElementsByTagName('cart:z_position')[0]?.textContent,
    ];
    label.SURFACE_MODEL_PARMS.SURFACE_NORMAL_VECTOR = [
      localCartNode
        ?.getElementsByTagName('cart:Surface_Model_Parameters')[0]
        ?.getElementsByTagName('cart:Surface_Model_Planar')[0]
        ?.getElementsByTagName('cart:Vector_Surface_Normal')[0]
        ?.getElementsByTagName('cart:x_unit')[0]?.textContent,
      localCartNode
        ?.getElementsByTagName('cart:Surface_Model_Parameters')[0]
        ?.getElementsByTagName('cart:Surface_Model_Planar')[0]
        ?.getElementsByTagName('cart:Vector_Surface_Normal')[0]
        ?.getElementsByTagName('cart:y_unit')[0]?.textContent,
      localCartNode
        ?.getElementsByTagName('cart:Surface_Model_Parameters')[0]
        ?.getElementsByTagName('cart:Surface_Model_Planar')[0]
        ?.getElementsByTagName('cart:Vector_Surface_Normal')[0]
        ?.getElementsByTagName('cart:z_unit')[0]?.textContent,
    ];
    label.SURFACE_PROJECTION_PARMS.PROJECTION_ORIGIN_VECTOR = [
      localCartNode
        ?.getElementsByTagName('cart:Map_Projection_Lander')[0]
        ?.getElementsByTagName(`cart:${label.SURFACE_MODEL_PARMS.MAP_PROJECTION_TYPE}`)[0]
        ?.getElementsByTagName('cart:Vector_Projection_Origin')[0]
        ?.getElementsByTagName('cart:x_position')[0]?.textContent,
      localCartNode
        ?.getElementsByTagName('cart:Map_Projection_Lander')[0]
        ?.getElementsByTagName(`cart:${label.SURFACE_MODEL_PARMS.MAP_PROJECTION_TYPE}`)[0]
        ?.getElementsByTagName('cart:Vector_Projection_Origin')[0]
        ?.getElementsByTagName('cart:y_position')[0]?.textContent,
      localCartNode
        ?.getElementsByTagName('cart:Map_Projection_Lander')[0]
        ?.getElementsByTagName(`cart:${label.SURFACE_MODEL_PARMS.MAP_PROJECTION_TYPE}`)[0]
        ?.getElementsByTagName('cart:Vector_Projection_Origin')[0]
        ?.getElementsByTagName('cart:z_position')[0]?.textContent,
    ];
    label.SURFACE_PROJECTION_PARMS.REFERENCE_COORD_SYSTEM_NAME = localCartNode
      ?.getElementsByTagName('cart:Map_Projection_Lander')[0]
      ?.getElementsByTagName('geom:Coordinate_Space_Reference')[0]
      ?.getElementsByTagName('geom:Coordinate_Space_Indexed')[0]
      ?.getElementsByTagName('geom:coordinate_space_frame_type')[0]?.textContent;
    label.SURFACE_PROJECTION_PARMS.REFERENCE_COORD_SYSTEM_INDEX = Array.from(
      localCartNode
        ?.getElementsByTagName('cart:Map_Projection_Lander')[0]
        ?.getElementsByTagName('geom:Coordinate_Space_Reference')[0]
        ?.getElementsByTagName('geom:Coordinate_Space_Indexed')[0]
        ?.getElementsByTagName('geom:Coordinate_Space_Index') || []
    )?.map((n) => n.getElementsByTagName('geom:index_value_number')[0]?.textContent);
    label.SURFACE_PROJECTION_PARMS.START_AZIMUTH = localCartNode
      ?.getElementsByTagName('cart:Map_Projection_Lander')[0]
      ?.getElementsByTagName(`cart:${label.SURFACE_MODEL_PARMS.MAP_PROJECTION_TYPE}`)[0]
      ?.getElementsByTagName('cart:start_azimuth')[0]?.textContent;
    label.SURFACE_PROJECTION_PARMS.MAP_RESOLUTION = [
      localCartNode
        ?.getElementsByTagName('cart:Map_Projection_Lander')[0]
        ?.getElementsByTagName(`cart:${label.SURFACE_MODEL_PARMS.MAP_PROJECTION_TYPE}`)[0]
        ?.getElementsByTagName('cart:pixel_scale_x')[0]?.textContent,
      localCartNode
        ?.getElementsByTagName('cart:Map_Projection_Lander')[0]
        ?.getElementsByTagName(`cart:${label.SURFACE_MODEL_PARMS.MAP_PROJECTION_TYPE}`)[0]
        ?.getElementsByTagName('cart:pixel_scale_y')[0]?.textContent,
    ];
    label.SURFACE_PROJECTION_PARMS.MAP_RESOLUTION__UNIT = [
      localCartNode
        ?.getElementsByTagName('cart:Map_Projection_Lander')[0]
        ?.getElementsByTagName(`cart:${label.SURFACE_MODEL_PARMS.MAP_PROJECTION_TYPE}`)[0]
        ?.getElementsByTagName('cart:pixel_scale_x')[0]
        ?.getAttribute('unit'),
    ];
    label.SURFACE_PROJECTION_PARMS.ZERO_ELEVATION_LINE = (
      localCartNode
        ?.getElementsByTagName('cart:Map_Projection_Lander')[0]
        ?.getElementsByTagName(`cart:${label.SURFACE_MODEL_PARMS.MAP_PROJECTION_TYPE}`)[0]
        ?.getElementsByTagName('cart:zero_elevation_line')[0] ||
      localCartNode
        ?.getElementsByTagName('cart:Map_Projection_Lander')[0]
        ?.getElementsByTagName(`cart:${label.SURFACE_MODEL_PARMS.MAP_PROJECTION_TYPE}`)[0]
        ?.getElementsByTagName('cart:projection_elevation_line')[0]
    )?.textContent;

    label.PRODUCT_ID = Array.from(
      xmlDoc
        ?.getElementsByTagName('Product_Observational')[0]
        ?.getElementsByTagName('Identification_Area')[0]
        ?.getElementsByTagName('Alias_List')[0]
        ?.getElementsByTagName('Alias') || []
    )
      ?.filter((n) => n.getElementsByTagName('comment')[0]?.textContent === 'VICAR PRODUCT_ID')[0]
      ?.getElementsByTagName('alternate_id')[0]?.textContent;
    label.system.NL = Array.from(
      xmlDoc
        ?.getElementsByTagName('Product_Observational')[0]
        ?.getElementsByTagName('File_Area_Observational')[0]
        ?.getElementsByTagName('Array_3D_Image')[0]
        ?.getElementsByTagName('Axis_Array') || []
    )
      ?.filter((n) => n.getElementsByTagName('axis_name')[0]?.textContent === 'Line')[0]
      ?.getElementsByTagName('elements')[0]?.textContent;
    label.system.NS = Array.from(
      xmlDoc
        ?.getElementsByTagName('Product_Observational')[0]
        ?.getElementsByTagName('File_Area_Observational')[0]
        ?.getElementsByTagName('Array_3D_Image')[0]
        ?.getElementsByTagName('Axis_Array') || []
    )
      ?.filter((n) => n.getElementsByTagName('axis_name')[0]?.textContent === 'Sample')[0]
      ?.getElementsByTagName('elements')[0]?.textContent;

    label.system.ORG = 'UNK'; // TODO - is the default BSQ?

    return label;
  } catch (error) {
    if (error.name !== 'AbortError') {
      logError(`Unable to parse xml label: ${xmlID}`, error);
    }
  }

  return {};
}

function pds2vicarAlias(key) {
  if (key) {
    return pds2vicarAliases[key.toLowerCase()] || key;
  }
  return key;
}
