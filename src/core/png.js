import { crc32, deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ACCEPTED_COLOR_TYPES = new Set([0, 2, 3, 4, 6]);
const CHANNELS_BY_COLOR_TYPE = new Map([
  [0, 1],
  [2, 3],
  [3, 1],
  [4, 2],
  [6, 4],
]);
const MAX_DECODED_BYTES = 256 * 1024 * 1024;

export class PngError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'PngError';
    this.code = code;
  }
}

function fail(code, message, options) {
  throw new PngError(code, message, options);
}

function readUint32(bytes, offset) {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}

function hasSignature(bytes) {
  if (bytes.length < SIGNATURE.length) return false;
  for (let index = 0; index < SIGNATURE.length; index += 1) {
    if (bytes[index] !== SIGNATURE[index]) return false;
  }
  return true;
}

function parseChunks(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    fail('PNG_INVALID_INPUT', 'PNG input must be a Uint8Array');
  }
  if (bytes.length < SIGNATURE.length) {
    fail('PNG_TRUNCATED', 'PNG data ends before the signature is complete');
  }
  if (!hasSignature(bytes)) {
    fail('PNG_INVALID_SIGNATURE', 'PNG signature is missing or invalid');
  }

  const chunks = [];
  let offset = SIGNATURE.length;
  let sawIend = false;

  while (offset < bytes.length) {
    if (bytes.length - offset < 12) {
      fail('PNG_TRUNCATED', 'PNG data ends inside a chunk header');
    }

    const length = readUint32(bytes, offset);
    const typeStart = offset + 4;
    const dataStart = typeStart + 4;
    const dataEnd = dataStart + length;
    const crcStart = dataEnd;

    if (dataEnd + 4 > bytes.length) {
      fail('PNG_TRUNCATED', 'PNG data ends before the declared chunk boundary');
    }

    const type = String.fromCharCode(
      bytes[typeStart],
      bytes[typeStart + 1],
      bytes[typeStart + 2],
      bytes[typeStart + 3],
    );
    if (!/^[A-Za-z]{4}$/.test(type)) {
      fail('PNG_INVALID_CHUNK', 'PNG chunk type is not valid ASCII');
    }
    if (type === 'IHDR' && chunks.length > 0) {
      fail('PNG_INVALID_IHDR', 'IHDR must be the first PNG chunk');
    }
    if (type === 'IEND' && length !== 0) {
      fail('PNG_INVALID_CHUNK', 'IEND chunk must be empty');
    }

    const expectedCrc = readUint32(bytes, crcStart);
    const actualCrc = crc32(bytes.subarray(typeStart, dataEnd)) >>> 0;
    if (actualCrc !== expectedCrc) {
      fail('PNG_CRC_MISMATCH', `CRC mismatch in ${type} chunk`);
    }

    chunks.push({ type, data: bytes.subarray(dataStart, dataEnd) });
    offset = crcStart + 4;

    if (type === 'IEND') {
      sawIend = true;
      break;
    }
  }

  if (!sawIend) {
    fail('PNG_TRUNCATED', 'PNG data does not contain an IEND chunk');
  }

  return chunks;
}

function parseHeader(chunks) {
  if (chunks.length === 0 || chunks[0].type !== 'IHDR') {
    fail('PNG_INVALID_IHDR', 'IHDR must be the first PNG chunk');
  }

  const { data } = chunks[0];
  if (data.length !== 13) {
    fail('PNG_INVALID_IHDR', 'IHDR chunk must contain exactly 13 bytes');
  }

  const width = readUint32(data, 0);
  const height = readUint32(data, 4);
  const bitDepth = data[8];
  const colorType = data[9];
  const compression = data[10];
  const filterMethod = data[11];
  const interlace = data[12];

  if (width === 0 || height === 0) {
    fail('PNG_INVALID_IHDR', 'PNG dimensions must be greater than zero');
  }
  if (compression !== 0 || filterMethod !== 0) {
    fail('PNG_UNSUPPORTED_VARIANT', 'PNG compression and filter methods must be 0');
  }
  if (interlace !== 0) {
    fail('PNG_UNSUPPORTED_VARIANT', 'Interlaced PNG input is not supported');
  }
  if (bitDepth !== 8) {
    fail('PNG_UNSUPPORTED_VARIANT', `PNG bit depth ${bitDepth} is not supported`);
  }
  if (!ACCEPTED_COLOR_TYPES.has(colorType)) {
    fail('PNG_UNSUPPORTED_VARIANT', `PNG color type ${colorType} is not supported`);
  }

  return { width, height, bitDepth, colorType };
}

function parsePalette(chunks) {
  const chunk = chunks.find((candidate) => candidate.type === 'PLTE');
  if (!chunk) return null;
  if (chunk.data.length === 0 || chunk.data.length % 3 !== 0 || chunk.data.length > 768) {
    fail('PNG_INVALID_CHUNK', 'PLTE chunk does not contain a valid palette');
  }
  return chunk.data;
}

function parseTransparency(chunks, colorType, palette) {
  const chunk = chunks.find((candidate) => candidate.type === 'tRNS');
  if (!chunk) return null;

  if (colorType === 0) {
    if (chunk.data.length !== 2) {
      fail('PNG_INVALID_CHUNK', 'tRNS chunk has an invalid grayscale payload');
    }
    return { gray: (chunk.data[0] << 8) | chunk.data[1] };
  }

  if (colorType === 2) {
    if (chunk.data.length !== 6) {
      fail('PNG_INVALID_CHUNK', 'tRNS chunk has an invalid RGB payload');
    }
    return {
      red: (chunk.data[0] << 8) | chunk.data[1],
      green: (chunk.data[2] << 8) | chunk.data[3],
      blue: (chunk.data[4] << 8) | chunk.data[5],
    };
  }

  if (colorType === 3) {
    if (!palette) {
      fail('PNG_INVALID_CHUNK', 'Palette transparency requires a PLTE chunk');
    }
    if (chunk.data.length > palette.length / 3) {
      fail('PNG_INVALID_CHUNK', 'tRNS chunk has more entries than the palette');
    }
    return { alpha: chunk.data };
  }

  return null;
}

function parsePhysicalResolution(chunks) {
  const chunk = chunks.find((candidate) => candidate.type === 'pHYs');
  if (!chunk) return undefined;
  if (chunk.data.length !== 9) return undefined;

  const unit = chunk.data[8];
  if (unit !== 0 && unit !== 1) return undefined;

  return {
    x: readUint32(chunk.data, 0),
    y: readUint32(chunk.data, 4),
    unit,
  };
}

function paethPredictor(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpperLeft = Math.abs(estimate - upperLeft);

  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpperLeft) return left;
  if (distanceUp <= distanceUpperLeft) return up;
  return upperLeft;
}

function unfilterRows(inflated, width, height, bytesPerPixel) {
  const stride = width * bytesPerPixel;
  const pixels = new Uint8Array(stride * height);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const rowOffset = y * stride;
    const previousOffset = rowOffset - stride;

    if (filter > 4) {
      fail('PNG_INVALID_SCANLINE', `PNG row ${y} uses invalid filter type ${filter}`);
    }

    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[sourceOffset];
      sourceOffset += 1;
      const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[previousOffset + x] : 0;
      const upperLeft =
        y > 0 && x >= bytesPerPixel ? pixels[previousOffset + x - bytesPerPixel] : 0;

      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paethPredictor(left, up, upperLeft);

      pixels[rowOffset + x] = (raw + predictor) & 0xff;
    }
  }

  return pixels;
}

function expandToRgba(samples, width, height, colorType, palette, transparency) {
  const pixelCount = width * height;
  if (!Number.isSafeInteger(pixelCount) || pixelCount * 4 > MAX_DECODED_BYTES) {
    fail('PNG_INVALID_IHDR', 'PNG dimensions exceed the supported decoded size');
  }

  const rgba = new Uint8Array(pixelCount * 4);

  for (let index = 0; index < pixelCount; index += 1) {
    const target = index * 4;

    if (colorType === 0) {
      const gray = samples[index];
      rgba[target] = gray;
      rgba[target + 1] = gray;
      rgba[target + 2] = gray;
      rgba[target + 3] =
        transparency && gray === transparency.gray ? 0 : 255;
      continue;
    }

    if (colorType === 2) {
      const source = index * 3;
      const red = samples[source];
      const green = samples[source + 1];
      const blue = samples[source + 2];
      rgba[target] = red;
      rgba[target + 1] = green;
      rgba[target + 2] = blue;
      rgba[target + 3] =
        transparency &&
        red === transparency.red &&
        green === transparency.green &&
        blue === transparency.blue
          ? 0
          : 255;
      continue;
    }

    if (colorType === 3) {
      const paletteIndex = samples[index];
      if (!palette || paletteIndex * 3 + 2 >= palette.length) {
        fail('PNG_INVALID_SCANLINE', `Palette index ${paletteIndex} is out of range`);
      }
      const source = paletteIndex * 3;
      rgba[target] = palette[source];
      rgba[target + 1] = palette[source + 1];
      rgba[target + 2] = palette[source + 2];
      rgba[target + 3] =
        transparency && paletteIndex < transparency.alpha.length
          ? transparency.alpha[paletteIndex]
          : 255;
      continue;
    }

    if (colorType === 4) {
      const source = index * 2;
      const gray = samples[source];
      rgba[target] = gray;
      rgba[target + 1] = gray;
      rgba[target + 2] = gray;
      rgba[target + 3] = samples[source + 1];
      continue;
    }

    const source = index * 4;
    rgba[target] = samples[source];
    rgba[target + 1] = samples[source + 1];
    rgba[target + 2] = samples[source + 2];
    rgba[target + 3] = samples[source + 3];
  }

  return rgba;
}

export function decodePng(bytes) {
  const chunks = parseChunks(bytes);
  const { width, height, colorType } = parseHeader(chunks);
  const palette = parsePalette(chunks);
  const transparency = parseTransparency(chunks, colorType, palette);

  if (colorType === 3 && !palette) {
    fail('PNG_INVALID_CHUNK', 'Palette PNG input requires a PLTE chunk');
  }

  const idatChunks = chunks.filter((chunk) => chunk.type === 'IDAT');
  if (idatChunks.length === 0) {
    fail('PNG_INVALID_CHUNK', 'PNG input does not contain an IDAT chunk');
  }

  for (const chunk of chunks) {
    if (
      chunk.type.length === 4 &&
      chunk.type[0] >= 'A' &&
      chunk.type[0] <= 'Z' &&
      !['IHDR', 'PLTE', 'IDAT', 'IEND'].includes(chunk.type)
    ) {
      fail('PNG_UNSUPPORTED_VARIANT', `Unsupported critical chunk ${chunk.type}`);
    }
  }

  const bytesPerPixel = CHANNELS_BY_COLOR_TYPE.get(colorType);
  const stride = width * bytesPerPixel;
  const expectedLength = height * (stride + 1);
  if (!Number.isSafeInteger(expectedLength) || expectedLength > MAX_DECODED_BYTES) {
    fail('PNG_INVALID_IHDR', 'PNG dimensions exceed the supported decoded size');
  }

  const compressedLength = idatChunks.reduce((total, chunk) => total + chunk.data.length, 0);
  const compressed = new Uint8Array(compressedLength);
  let compressedOffset = 0;
  for (const chunk of idatChunks) {
    compressed.set(chunk.data, compressedOffset);
    compressedOffset += chunk.data.length;
  }

  let inflated;
  try {
    inflated = inflateSync(compressed, { maxOutputLength: expectedLength });
  } catch (error) {
    fail('PNG_INVALID_SCANLINE', `PNG image data cannot be inflated: ${error.message}`, {
      cause: error,
    });
  }

  if (inflated.length !== expectedLength) {
    fail(
      'PNG_INVALID_SCANLINE',
      `Inflated PNG data length ${inflated.length} does not match expected ${expectedLength}`,
    );
  }

  const samples = unfilterRows(inflated, width, height, bytesPerPixel);
  const pixels = expandToRgba(samples, width, height, colorType, palette, transparency);
  const physicalResolution = parsePhysicalResolution(chunks);

  return physicalResolution === undefined
    ? { width, height, pixels }
    : { width, height, pixels, physicalResolution };
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const payload = Buffer.from(data);
  const chunk = Buffer.alloc(12 + payload.length);
  chunk.writeUInt32BE(payload.length, 0);
  typeBytes.copy(chunk, 4);
  payload.copy(chunk, 8);
  const checksum = crc32(Buffer.concat([typeBytes, payload])) >>> 0;
  chunk.writeUInt32BE(checksum, 8 + payload.length);
  return chunk;
}

function validatePhysicalResolution(value) {
  if (value === undefined) return null;
  if (
    value === null ||
    typeof value !== 'object' ||
    !Number.isInteger(value.x) ||
    !Number.isInteger(value.y) ||
    value.x < 0 ||
    value.y < 0 ||
    value.x > 0xffffffff ||
    value.y > 0xffffffff ||
    (value.unit !== 0 && value.unit !== 1)
  ) {
    fail('PNG_INVALID_IMAGE', 'physicalResolution must contain valid x, y, and unit values');
  }
  return value;
}

export function encodePng(image) {
  if (image === null || typeof image !== 'object') {
    fail('PNG_INVALID_IMAGE', 'Image must be an object');
  }

  const { width, height, pixels } = image;
  if (!Number.isInteger(width) || width <= 0 || width > 0xffffffff) {
    fail('PNG_INVALID_IMAGE', 'Image width must be a positive 32-bit integer');
  }
  if (!Number.isInteger(height) || height <= 0 || height > 0xffffffff) {
    fail('PNG_INVALID_IMAGE', 'Image height must be a positive 32-bit integer');
  }

  const expectedLength = width * height * 4;
  if (!Number.isSafeInteger(expectedLength) || expectedLength > MAX_DECODED_BYTES) {
    fail('PNG_INVALID_IMAGE', 'Image dimensions exceed the supported encoded size');
  }
  if (!(pixels instanceof Uint8Array) || pixels.length !== expectedLength) {
    fail('PNG_INVALID_IMAGE', 'Image pixels must be an RGBA Uint8Array matching its dimensions');
  }

  const physicalResolution = validatePhysicalResolution(image.physicalResolution);
  const stride = width * 4;
  const rawLength = height * (stride + 1);
  const raw = new Uint8Array(rawLength);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    raw.set(pixels.subarray(y * stride, (y + 1) * stride), rowStart + 1);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const chunks = [makeChunk('IHDR', header)];

  if (physicalResolution) {
    const resolution = Buffer.alloc(9);
    resolution.writeUInt32BE(physicalResolution.x, 0);
    resolution.writeUInt32BE(physicalResolution.y, 4);
    resolution[8] = physicalResolution.unit;
    chunks.push(makeChunk('pHYs', resolution));
  }

  chunks.push(makeChunk('IDAT', deflateSync(raw)));
  chunks.push(makeChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat([Buffer.from(SIGNATURE), ...chunks]);
}
