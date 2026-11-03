export class BackgroundError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'BackgroundError';
    this.code = code;
  }
}

function fail(code, message, options) {
  throw new BackgroundError(code, message, options);
}

function validateOptions(options) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    fail('BACKGROUND_INVALID_OPTIONS', 'Background options must be an object');
  }

  const { color, tolerance } = options;
  if (color === null || typeof color !== 'object' || Array.isArray(color)) {
    fail('BACKGROUND_INVALID_OPTIONS', 'Background color must be an object');
  }

  for (const channel of ['red', 'green', 'blue']) {
    const value = color[channel];
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      fail(
        'BACKGROUND_INVALID_OPTIONS',
        `Background color ${channel} must be an integer from 0 through 255`,
      );
    }
  }

  if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 255) {
    fail(
      'BACKGROUND_INVALID_OPTIONS',
      'Background tolerance must be an integer from 0 through 255',
    );
  }

  return {
    color: {
      red: color.red,
      green: color.green,
      blue: color.blue,
    },
    tolerance,
  };
}

function copyImage(image) {
  const result = {
    width: image.width,
    height: image.height,
    pixels: new Uint8Array(image.pixels),
  };
  if (image.physicalResolution !== undefined) {
    result.physicalResolution = image.physicalResolution;
  }
  return result;
}

export function removeUniformBackground(image, options) {
  if (options === undefined) {
    return copyImage(image);
  }

  const { color, tolerance } = validateOptions(options);
  const result = copyImage(image);
  const { pixels } = result;

  for (let offset = 0; offset < pixels.length; offset += 4) {
    const matches =
      Math.abs(pixels[offset] - color.red) <= tolerance &&
      Math.abs(pixels[offset + 1] - color.green) <= tolerance &&
      Math.abs(pixels[offset + 2] - color.blue) <= tolerance;

    if (matches) {
      pixels[offset + 3] = 0;
    }
  }

  return result;
}
