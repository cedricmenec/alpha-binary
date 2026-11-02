import assert from 'node:assert/strict';
import test from 'node:test';

import { decodePng, encodePng, PngError } from '../src/core/index.js';
import {
  corruptCrc,
  filterRow,
  makeChunk,
  makePng,
  PNG_SIGNATURE,
  scanline,
} from './png-fixtures.js';

function expectPngError(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof PngError);
    assert.equal(error.code, code);
    return true;
  });
}

function readChunks(bytes) {
  const chunks = [];
  let offset = PNG_SIGNATURE.length;

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
  }

  return chunks;
}

function rgbaPng(width, height, pixels, extra = {}) {
  const rows = [];
  const stride = width * 4;
  for (let y = 0; y < height; y += 1) {
    rows.push(scanline(0, pixels.subarray(y * stride, (y + 1) * stride)));
  }
  return makePng({ width, height, colorType: 6, scanlines: rows, ...extra });
}

test('decodes RGBA pixels, dimensions, and semi-transparent alpha', () => {
  const pixels = Uint8Array.from([
    255, 0, 0, 255,
    0, 255, 0, 128,
    0, 0, 255, 0,
    17, 34, 51, 64,
  ]);

  const image = decodePng(rgbaPng(2, 2, pixels));

  assert.equal(image.width, 2);
  assert.equal(image.height, 2);
  assert.deepEqual(Array.from(image.pixels), Array.from(pixels));
  assert.equal(image.pixels.length, 2 * 2 * 4);
});

test('decodes grayscale samples as opaque RGBA', () => {
  const image = decodePng(
    makePng({
      width: 2,
      height: 1,
      colorType: 0,
      scanlines: [scanline(0, [0, 200])],
    }),
  );

  assert.deepEqual(Array.from(image.pixels), [
    0, 0, 0, 255,
    200, 200, 200, 255,
  ]);
});

test('decodes grayscale transparency', () => {
  const image = decodePng(
    makePng({
      width: 2,
      height: 1,
      colorType: 0,
      transparency: [0, 200],
      scanlines: [scanline(0, [0, 200])],
    }),
  );

  assert.deepEqual(Array.from(image.pixels), [
    0, 0, 0, 255,
    200, 200, 200, 0,
  ]);
});

test('decodes RGB transparency', () => {
  const image = decodePng(
    makePng({
      width: 2,
      height: 1,
      colorType: 2,
      transparency: [0, 10, 0, 20, 0, 30],
      scanlines: [scanline(0, [10, 20, 30, 1, 2, 3])],
    }),
  );

  assert.deepEqual(Array.from(image.pixels), [
    10, 20, 30, 0,
    1, 2, 3, 255,
  ]);
});

test('decodes grayscale with alpha', () => {
  const image = decodePng(
    makePng({
      width: 2,
      height: 1,
      colorType: 4,
      scanlines: [scanline(0, [10, 255, 20, 64])],
    }),
  );

  assert.deepEqual(Array.from(image.pixels), [
    10, 10, 10, 255,
    20, 20, 20, 64,
  ]);
});

test('decodes a palette PNG with transparent palette entries', () => {
  const image = decodePng(
    makePng({
      width: 3,
      height: 1,
      colorType: 3,
      palette: [255, 0, 0, 0, 255, 0, 0, 0, 255],
      transparency: [0, 128],
      scanlines: [scanline(0, [0, 1, 2])],
    }),
  );

  assert.deepEqual(Array.from(image.pixels), [
    255, 0, 0, 0,
    0, 255, 0, 128,
    0, 0, 255, 255,
  ]);
});

test('decodes every PNG filter type without changing pixels', () => {
  const width = 3;
  const height = 5;
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const rawRows = [];
  const scanlines = [];

  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      row[x] = (y * 41 + x * 13 + 7) & 0xff;
    }
    rawRows.push(row);
    const prior = y > 0 ? rawRows[y - 1] : null;
    const filterType = y;
    scanlines.push(scanline(filterType, filterRow(filterType, row, prior, bytesPerPixel)));
  }

  const image = decodePng(makePng({ width, height, colorType: 6, scanlines }));

  assert.equal(image.width, width);
  assert.equal(image.height, height);
  assert.deepEqual(Array.from(image.pixels), Array.from(Buffer.concat(rawRows)));
});

test('exposes an existing pHYs declaration unchanged', () => {
  const pixels = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
  const image = decodePng(
    rgbaPng(2, 1, pixels, {
      physicalResolution: { x: 2835, y: 1417, unit: 1 },
    }),
  );

  assert.deepEqual(image.physicalResolution, { x: 2835, y: 1417, unit: 1 });
});

test('leaves physicalResolution absent when the PNG has no pHYs chunk', () => {
  const image = decodePng(
    makePng({
      width: 1,
      height: 1,
      colorType: 6,
      scanlines: [scanline(0, [1, 2, 3, 4])],
    }),
  );

  assert.equal(Object.hasOwn(image, 'physicalResolution'), false);
  assert.equal(image.physicalResolution, undefined);
});

test('rejects a bad PNG signature', () => {
  const png = rgbaPng(1, 1, Uint8Array.from([1, 2, 3, 4]));
  png[1] = 0;

  expectPngError(() => decodePng(png), 'PNG_INVALID_SIGNATURE');
});

test('rejects truncated chunk data', () => {
  const png = rgbaPng(2, 2, new Uint8Array(16));

  expectPngError(() => decodePng(png.subarray(0, 20)), 'PNG_TRUNCATED');
});

test('rejects a critical chunk CRC mismatch', () => {
  const png = rgbaPng(1, 1, Uint8Array.from([1, 2, 3, 4]));

  expectPngError(() => decodePng(corruptCrc(png)), 'PNG_CRC_MISMATCH');
});

test('rejects a malformed IHDR chunk', () => {
  const chunk = makeChunk('IHDR', Buffer.alloc(12));
  const png = Buffer.concat([PNG_SIGNATURE, chunk, makeChunk('IEND', Buffer.alloc(0))]);

  expectPngError(() => decodePng(png), 'PNG_INVALID_IHDR');
});

test('rejects truncated data inside an IHDR chunk', () => {
  const chunk = Buffer.alloc(12);
  chunk.writeUInt32BE(13, 0);
  chunk.write('IHDR', 4, 'ascii');
  const png = Buffer.concat([PNG_SIGNATURE, chunk]);

  expectPngError(() => decodePng(png), 'PNG_TRUNCATED');
});

test('rejects a malformed IEND chunk', () => {
  const png = makePng({
    width: 1,
    height: 1,
    colorType: 6,
    scanlines: [scanline(0, [1, 2, 3, 4])],
    includeIend: false,
  });
  const malformed = Buffer.concat([png, makeChunk('IEND', Buffer.from([1]))]);

  expectPngError(() => decodePng(malformed), 'PNG_INVALID_CHUNK');
});

test('rejects invalid scanline filter bytes', () => {
  const png = makePng({
    width: 1,
    height: 1,
    colorType: 6,
    scanlines: [scanline(5, [1, 2, 3, 4])],
  });

  expectPngError(() => decodePng(png), 'PNG_INVALID_SCANLINE');
});

test('rejects inflated scanline data with the wrong length', () => {
  const png = makePng({
    width: 2,
    height: 2,
    colorType: 6,
    scanlines: [scanline(0, new Uint8Array(8))],
  });

  expectPngError(() => decodePng(png), 'PNG_INVALID_SCANLINE');
});

test('rejects unsupported bit depth and interlace variants', () => {
  const highBitDepth = makePng({
    width: 1,
    height: 1,
    colorType: 0,
    bitDepth: 16,
    scanlines: [scanline(0, [0, 0])],
  });
  const interlaced = makePng({
    width: 1,
    height: 1,
    colorType: 6,
    interlace: 1,
    scanlines: [scanline(0, [1, 2, 3, 4])],
  });

  expectPngError(() => decodePng(highBitDepth), 'PNG_UNSUPPORTED_VARIANT');
  expectPngError(() => decodePng(interlaced), 'PNG_UNSUPPORTED_VARIANT');
});

test('rejects impossible dimensions and missing image data', () => {
  const zeroWidth = makePng({
    width: 0,
    height: 1,
    colorType: 6,
    scanlines: [scanline(0, [])],
  });
  const withoutIdat = makePng({
    width: 1,
    height: 1,
    colorType: 6,
    idatPayload: null,
  });

  expectPngError(() => decodePng(zeroWidth), 'PNG_INVALID_IHDR');
  expectPngError(() => decodePng(withoutIdat), 'PNG_INVALID_CHUNK');
});

test('rejects palette indices outside the PLTE entries', () => {
  const png = makePng({
    width: 1,
    height: 1,
    colorType: 3,
    palette: [10, 20, 30],
    scanlines: [scanline(0, [5])],
  });

  expectPngError(() => decodePng(png), 'PNG_INVALID_SCANLINE');
});

test('encodes a structurally valid PNG', () => {
  const encoded = encodePng({
    width: 1,
    height: 1,
    pixels: Uint8Array.from([1, 2, 3, 4]),
  });

  assert.deepEqual(Array.from(encoded.subarray(0, 8)), Array.from(PNG_SIGNATURE));
  const chunks = readChunks(encoded);
  assert.equal(chunks[0].type, 'IHDR');
  assert.ok(chunks.some((chunk) => chunk.type === 'IDAT'));
  assert.equal(chunks.at(-1).type, 'IEND');
});

test('round-trips dimensions and RGBA pixels', () => {
  const image = {
    width: 3,
    height: 2,
    pixels: Uint8Array.from([
      255, 0, 0, 255,
      0, 255, 0, 128,
      0, 0, 255, 0,
      1, 2, 3, 4,
      5, 6, 7, 8,
      9, 10, 11, 12,
    ]),
  };

  const decoded = decodePng(encodePng(image));

  assert.equal(decoded.width, image.width);
  assert.equal(decoded.height, image.height);
  assert.deepEqual(Array.from(decoded.pixels), Array.from(image.pixels));
});

test('writes pHYs only when physical resolution is present', () => {
  const without = encodePng({
    width: 1,
    height: 1,
    pixels: Uint8Array.from([1, 2, 3, 4]),
  });
  const withResolution = encodePng({
    width: 1,
    height: 1,
    pixels: Uint8Array.from([1, 2, 3, 4]),
    physicalResolution: { x: 11811, y: 11811, unit: 1 },
  });

  assert.equal(readChunks(without).some((chunk) => chunk.type === 'pHYs'), false);
  const chunks = readChunks(withResolution);
  const phys = chunks.find((chunk) => chunk.type === 'pHYs');
  assert.ok(phys);
  assert.deepEqual(
    { x: phys.data.readUInt32BE(0), y: phys.data.readUInt32BE(4), unit: phys.data[8] },
    { x: 11811, y: 11811, unit: 1 },
  );

  const decoded = decodePng(withResolution);
  assert.deepEqual(decoded.physicalResolution, { x: 11811, y: 11811, unit: 1 });
  assert.equal(
    Object.hasOwn(
      decodePng(without),
      'physicalResolution',
    ),
    false,
  );
});

test('rejects invalid encoder dimensions and pixel buffers', () => {
  expectPngError(
    () => encodePng({ width: 0, height: 1, pixels: new Uint8Array(0) }),
    'PNG_INVALID_IMAGE',
  );
  expectPngError(
    () => encodePng({ width: 1, height: -1, pixels: new Uint8Array(0) }),
    'PNG_INVALID_IMAGE',
  );
  expectPngError(
    () => encodePng({ width: 1, height: 1, pixels: new Uint8Array(3) }),
    'PNG_INVALID_IMAGE',
  );
  expectPngError(
    () => encodePng({ width: 1.5, height: 1, pixels: new Uint8Array(6) }),
    'PNG_INVALID_IMAGE',
  );
});