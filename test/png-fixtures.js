import { crc32, deflateSync } from 'node:zlib';

export const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const payload = Buffer.from(data);
  const chunk = Buffer.alloc(12 + payload.length);
  chunk.writeUInt32BE(payload.length, 0);
  typeBytes.copy(chunk, 4);
  payload.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, payload])) >>> 0, 8 + payload.length);
  return chunk;
}

export function scanline(filterType, bytes) {
  return Buffer.concat([Buffer.from([filterType]), Buffer.from(bytes)]);
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

export function filterRow(filterType, row, prior, bytesPerPixel) {
  const output = Buffer.alloc(row.length);

  for (let index = 0; index < row.length; index += 1) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
    const up = prior ? prior[index] : 0;
    const upperLeft = prior && index >= bytesPerPixel ? prior[index - bytesPerPixel] : 0;

    let predictor = 0;
    if (filterType === 1) predictor = left;
    else if (filterType === 2) predictor = up;
    else if (filterType === 3) predictor = Math.floor((left + up) / 2);
    else if (filterType === 4) predictor = paethPredictor(left, up, upperLeft);

    output[index] = (row[index] - predictor) & 0xff;
  }

  return output;
}

export function makePng({
  width,
  height,
  colorType = 6,
  bitDepth = 8,
  compression = 0,
  filterMethod = 0,
  interlace = 0,
  palette,
  transparency,
  physicalResolution,
  scanlines = [],
  idatPayload,
  includeIend = true,
}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = bitDepth;
  header[9] = colorType;
  header[10] = compression;
  header[11] = filterMethod;
  header[12] = interlace;

  const chunks = [makeChunk('IHDR', header)];

  if (palette) chunks.push(makeChunk('PLTE', Buffer.from(palette)));
  if (transparency) chunks.push(makeChunk('tRNS', Buffer.from(transparency)));

  if (physicalResolution) {
    const resolution = Buffer.alloc(9);
    resolution.writeUInt32BE(physicalResolution.x, 0);
    resolution.writeUInt32BE(physicalResolution.y, 4);
    resolution[8] = physicalResolution.unit;
    chunks.push(makeChunk('pHYs', resolution));
  }

  if (idatPayload !== null) {
    const payload = idatPayload ?? deflateSync(Buffer.concat(scanlines));
    chunks.push(makeChunk('IDAT', payload));
  }

  if (includeIend) chunks.push(makeChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat([PNG_SIGNATURE, ...chunks]);
}

export function corruptCrc(bytes) {
  const copy = Buffer.from(bytes);
  copy[29] ^= 0xff;
  return copy;
}