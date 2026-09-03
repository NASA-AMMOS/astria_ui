import { type } from './type';

export default function isPrimitive(value) {
  var t = type(value);
  return t !== 'Object' && t !== 'Array';
}
