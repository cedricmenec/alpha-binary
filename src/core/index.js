export { decodePng, encodePng, PngError } from './png.js';

const CORE_DESCRIPTION = Object.freeze({ name: 'alpha-binary' });

export function describeCore() {
  return CORE_DESCRIPTION;
}
