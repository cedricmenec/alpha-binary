export class AlphaMetricsError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'AlphaMetricsError';
    this.code = code;
  }
}

function fail(code, message, options) {
  throw new AlphaMetricsError(code, message, options);
}

function validateImage(image) {
  if (image === null || typeof image !== 'object') {
    fail('ALPHA_METRICS_INVALID_IMAGE', 'Image must be an object');
  }

  const { width, height, pixels } = image;
  if (!Number.isInteger(width) || width <= 0) {
    fail('ALPHA_METRICS_INVALID_IMAGE', 'Image width must be a positive integer');
  }
  if (!Number.isInteger(height) || height <= 0) {
    fail('ALPHA_METRICS_INVALID_IMAGE', 'Image height must be a positive integer');
  }

  const total = width * height;
  if (!Number.isSafeInteger(total) || total * 4 > Number.MAX_SAFE_INTEGER) {
    fail('ALPHA_METRICS_INVALID_IMAGE', 'Image dimensions exceed the supported size');
  }
  if (!(pixels instanceof Uint8Array) || pixels.length !== total * 4) {
    fail(
      'ALPHA_METRICS_INVALID_IMAGE',
      'Image pixels must be an RGBA Uint8Array matching its dimensions',
    );
  }

  return { width, height, pixels, total };
}

function validatePrintedWidth(options) {
  if (options === undefined) return undefined;
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    fail('ALPHA_METRICS_INVALID_OPTIONS', 'Metrics options must be an object');
  }

  const { printedWidth } = options;
  if (printedWidth === undefined) return undefined;
  if (typeof printedWidth !== 'number' || !Number.isFinite(printedWidth) || printedWidth <= 0) {
    fail(
      'ALPHA_METRICS_INVALID_PRINTED_WIDTH',
      'Printed width must be a positive finite number of millimetres',
    );
  }

  return printedWidth;
}

function isOpaqueAt(pixels, width, height, x, y) {
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  return pixels[(y * width + x) * 4 + 3] === 255;
}

function hasOpaqueNeighbor(pixels, width, height, x, y) {
  for (let deltaY = -1; deltaY <= 1; deltaY += 1) {
    for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
      if (deltaX === 0 && deltaY === 0) continue;
      if (isOpaqueAt(pixels, width, height, x + deltaX, y + deltaY)) return true;
    }
  }
  return false;
}

export function inspectAlpha(image, options) {
  const { width, height, pixels, total } = validateImage(image);
  const printedWidth = validatePrintedWidth(options);

  let zero = 0;
  let full = 0;
  let intermediate = 0;
  let isolatedOpaque = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha === 0) {
        zero += 1;
      } else if (alpha === 255) {
        full += 1;
        if (!hasOpaqueNeighbor(pixels, width, height, x, y)) {
          isolatedOpaque += 1;
        }
      } else {
        intermediate += 1;
      }
    }
  }

  const physical =
    printedWidth === undefined
      ? null
      : {
          printedWidth,
          millimetresPerPixel: printedWidth / width,
        };

  return {
    width,
    height,
    total,
    alpha: { zero, full, intermediate },
    isolatedOpaque,
    ratios: {
      isolatedToOpaque: full === 0 ? null : isolatedOpaque / full,
      isolatedToTotal: isolatedOpaque / total,
    },
    physical,
  };
}
