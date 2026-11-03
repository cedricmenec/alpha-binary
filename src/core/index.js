export { AlphaMetricsError, inspectAlpha } from './alpha-metrics.js';
export { BackgroundError, removeUniformBackground } from './background.js';
export { ditherAlphaBayer8 } from './dither.js';
export { decodePng, encodePng, PngError } from './png.js';

const CORE_DESCRIPTION = Object.freeze({ name: 'alpha-binary' });

export function describeCore() {
  return CORE_DESCRIPTION;
}
