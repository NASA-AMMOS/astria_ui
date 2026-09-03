/**
 * Unit conversion utils.
 */

export const UnitType = {
  Length: 'Length',
  Angle: 'Angle',
  Time: 'Time',
};

export const Meter = 'm';
export const Centimeter = 'cm';
export const Millimeter = 'mm';
export const Micrometer = 'um';
export const Degree = 'deg';
export const Radian = 'rad';
export const Milliradian = 'mrad';
export const Second = 's';
export const Millisecond = 'ms';
export const Minute = 'min';
export const Hour = 'h';

/**
 * Convenience function to convert radians -> degrees.
 *
 * @param rad Number in radians.
 */
export function radToDegrees(rad) {
  return (rad * 180.0) / Math.PI;
}

/**
 * Convenience function to convert degrees -> radians.
 *
 * @param rad Number in degrees.
 */
export function degToRadians(deg) {
  return (deg * Math.PI) / 180.0;
}

export const units = {};
// Length units (base unit meter)
units[Meter] = {
  label: Meter,
  name: 'meter',
  toBase: 1,
  type: UnitType.Length,
};
units[Centimeter] = {
  label: Centimeter,
  name: 'centimeter',
  toBase: 0.01,
  type: UnitType.Length,
};
units[Millimeter] = {
  label: Millimeter,
  name: 'millimeter',
  toBase: 0.001,
  type: UnitType.Length,
};
units[Micrometer] = {
  label: Micrometer,
  name: 'micrometer',
  toBase: 1e-6,
  type: UnitType.Length,
};

// Angle units (base unit radian)
units[Radian] = {
  label: Radian,
  name: 'radian',
  toBase: 1,
  type: UnitType.Angle,
};
units[Degree] = {
  label: Degree,
  name: 'degree',
  toBase: Math.PI / 180.0,
  type: UnitType.Angle,
};
units[Milliradian] = {
  label: Milliradian,
  name: 'milliradian',
  toBase: 0.001,
  type: UnitType.Angle,
};

// Time units (base unit millisecond)
units[Millisecond] = {
  label: Millisecond,
  name: 'millisecond',
  toBase: 1,
  type: UnitType.Time,
};
units[Second] = {
  label: Second,
  name: 'second',
  toBase: 1000,
  type: UnitType.Time,
};
units[Minute] = {
  label: Minute,
  name: 'minute',
  toBase: 60 * 1000,
  type: UnitType.Time,
};
units[Hour] = {
  label: Hour,
  name: 'hour',
  toBase: 60 * 60 * 1000,
  type: UnitType.Time,
};

export function ofType(type) {
  return Object.values(units)
    .filter((u) => u.type === type)
    .map((u) => u.label);
}

/**
 * Convert between units. Returns an object with a "to" function.
 * Usage: convert(1, 'cm').to('m)
 *
 * @param val Value to convert.
 * @param fromUnit Unit to convert from.
 * @throws error if unit is not recognized, or from and to units are not compatible.
 */
export function convert(val, fromUnit) {
  return {
    to: (toUnit) => {
      const to = units[toUnit];
      const from = units[fromUnit];
      if (!to) {
        throw new Error(`Unknown unit ${toUnit}`);
      }
      if (!from) {
        throw new Error(`Unknown unit ${fromUnit}`);
      }
      if (to.type !== from.type) {
        throw new Error(`Cannot convert ${from.name} to ${to.name}`);
      }
      const toBase = units[fromUnit].toBase;
      const fromBase = 1.0 / units[toUnit].toBase;
      return val * toBase * fromBase;
    },
  };
}
