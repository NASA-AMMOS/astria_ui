export const TwoDimensional = '2D';
export const ThreeDimensional = '3D';
export const AZEL = 'AZEL';
export const Marker = 'MARKER';
export const Path = 'PATH';
export const Region = 'REGION';
export const Rimfax = 'RIMFAX';
export const Point = 'POINT';
export const None = 'NONE';

export const UnityLineTarget = 'LineTarget';
export const UnityPolygonTarget = 'PolygonTarget';

export const TargetTypeList = [TwoDimensional, ThreeDimensional, AZEL, Marker, Path, Region, Rimfax, None];

const displayNames = new Map([
  [TwoDimensional, 'Point Target (2D)'],
  [ThreeDimensional, 'Point Target (3D)'],
  [AZEL, 'Az/El Target'],
  [Marker, 'Proximity Target'],
  [Path, 'Path Target'],
  [Region, 'Region Target'],
  [Rimfax, 'RIMFAX Target'],
  [Point, 'Point Target'],
]);

/**
 * Get's a user friendly string representing a target type.
 * @param {string} targetType Identifier for the target type.
 * @returns A display name for the specified target type, or the
 *          target type string unmodified if no display name is available.
 */
export function getDisplayName(targetType) {
  return displayNames.get(targetType) || targetType;
}

/**
 * Converts the ASTTROnsight Target types,
 * which correspond to the types expected by the TargetDB,
 * to the types that are expected by the ITarget interface in the Unity definition.
 * @param {String} t - Target type to convert
 * @returns {Number} Converted target type (see ITarget.cs)
 */
export function toUnityTargetType(t) {
  // Point = 0,
  // Path = 1,
  // Region = 2,
  // Rimfax = 3,
  // AzEl = 4,
  // Marker = 5
  switch (t) {
    case exports.TwoDimensional:
    case exports.ThreeDimensional:
      return 0;
    case exports.Path:
      return 1;
    case exports.Region:
      return 2;
    case exports.Rimfax:
      return 3;
    case exports.AZEL:
      return 4;
    case exports.Marker:
      return 5;
    default:
      return -1;
  }
}
