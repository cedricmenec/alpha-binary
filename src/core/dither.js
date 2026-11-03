const BAYER_8 = Object.freeze([
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
]);

export function ditherAlphaBayer8(image) {
  const { width, height, pixels } = image;
  const dithered = new Uint8Array(pixels);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const threshold = BAYER_8[(y % 8) * 8 + (x % 8)];
      dithered[offset + 3] = pixels[offset + 3] * 64 >= threshold * 255 + 128 ? 255 : 0;
    }
  }

  const result = { width, height, pixels: dithered };
  if (image.physicalResolution !== undefined) {
    result.physicalResolution = image.physicalResolution;
  }
  return result;
}
