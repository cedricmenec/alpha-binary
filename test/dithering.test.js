import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { ditherAlphaBayer8, describeCore } from '../src/core/index.js';

const CORE_URL = new URL('../src/core/index.js', import.meta.url).href;

function image(width, height, pixelAt) {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = pixelAt(x, y);
      const offset = (y * width + x) * 4;
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
      pixels[offset + 3] = a;
    }
  }
  return { width, height, pixels };
}

function alphas(result) {
  const values = [];
  for (let offset = 3; offset < result.pixels.length; offset += 4) {
    values.push(result.pixels[offset]);
  }
  return values;
}

function countAlphas(result) {
  const counts = new Map();
  for (const alpha of alphas(result)) {
    counts.set(alpha, (counts.get(alpha) ?? 0) + 1);
  }
  return counts;
}

const EXPECTED_ALPHA_128_PATTERN = [
  [255, 0, 255, 0, 255, 0, 255, 0],
  [0, 255, 0, 255, 0, 255, 0, 255],
  [255, 0, 255, 0, 255, 0, 255, 0],
  [0, 255, 0, 255, 0, 255, 0, 255],
  [255, 0, 255, 0, 255, 0, 255, 0],
  [0, 255, 0, 255, 0, 255, 0, 255],
  [255, 0, 255, 0, 255, 0, 255, 0],
  [0, 255, 0, 255, 0, 255, 0, 255],
];

test('ditherAlphaBayer8 returns a new image and preserves dimensions and metadata', () => {
  const physicalResolution = { x: 2835, y: 2835, unit: 1 };
  const input = image(5, 3, (x, y) => [x * 10, y * 20, 128, 128]);
  input.physicalResolution = physicalResolution;
  const originalPixels = input.pixels.slice();
  const originalResult = { ...input };

  const result = ditherAlphaBayer8(input);

  assert.notEqual(result, input);
  assert.notEqual(result.pixels, input.pixels);
  assert.equal(result.width, input.width);
  assert.equal(result.height, input.height);
  assert.equal(result.physicalResolution, physicalResolution);
  assert.deepEqual(input, originalResult);
  assert.deepEqual(input.pixels, originalPixels);
});

test('a uniform alpha of 128 produces the expected anchored 8 x 8 Bayer pattern', () => {
  const input = image(8, 8, () => [10, 20, 30, 128]);

  const result = ditherAlphaBayer8(input);

  for (let y = 0; y < 8; y += 1) {
    assert.deepEqual(alphas(result).slice(y * 8, (y + 1) * 8), EXPECTED_ALPHA_128_PATTERN[y]);
  }
});

test('opaque RGB colors and endpoint alpha values are preserved', () => {
  const input = image(4, 1, (x) => {
    if (x === 0) return [1, 2, 3, 255];
    if (x === 1) return [4, 5, 6, 255];
    if (x === 2) return [7, 8, 9, 0];
    return [10, 11, 12, 0];
  });

  const result = ditherAlphaBayer8(input);

  assert.deepEqual([...result.pixels.subarray(0, 4)], [1, 2, 3, 255]);
  assert.deepEqual([...result.pixels.subarray(4, 8)], [4, 5, 6, 255]);
  assert.deepEqual([...result.pixels.subarray(8, 12)], [7, 8, 9, 0]);
  assert.deepEqual([...result.pixels.subarray(12, 16)], [10, 11, 12, 0]);
});

test('alpha counts across the full input range contain only 0 and 255', () => {
  const input = image(256, 1, (x) => [x, 255 - x, x, x]);

  const result = ditherAlphaBayer8(input);
  const counts = countAlphas(result);
  const zero = counts.get(0) ?? 0;
  const opaque = counts.get(255) ?? 0;
  let intermediate = 0;

  for (const [alpha, count] of counts) {
    if (alpha !== 0 && alpha !== 255) intermediate += count;
  }

  assert.equal(intermediate, 0);
  assert.equal(zero + opaque, input.width * input.height);
});

test('dithering is byte-identical across repeated calls and separate processes', () => {
  const input = image(13, 9, (x, y) => [x, y, (x + y) % 256, (x * 17 + y * 31) % 256]);
  const first = ditherAlphaBayer8(input);
  const second = ditherAlphaBayer8(input);
  const third = ditherAlphaBayer8(input);

  assert.deepEqual(second, first);
  assert.deepEqual(third, first);

  const expected = Buffer.from(first.pixels).toString('hex');
  const code = [
    `import { ditherAlphaBayer8 } from ${JSON.stringify(CORE_URL)};`,
    `const image = ${JSON.stringify({
      width: input.width,
      height: input.height,
      pixels: [...input.pixels],
    })};`,
    'image.pixels = Uint8Array.from(image.pixels);',
    'const result = ditherAlphaBayer8(image);',
    'process.stdout.write(Buffer.from(result.pixels).toString("hex"));',
  ].join('\n');

  const spawned = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(spawned.status, 0, spawned.stderr);
  assert.equal(spawned.stderr, '');
  assert.equal(spawned.stdout, expected);
});

test('physical resolution is preserved when present and never invented', () => {
  const withResolution = image(2, 2, (x) => [x, x, x, 128]);
  const resolution = { x: 72, y: 144, unit: 0 };
  withResolution.physicalResolution = resolution;
  const withoutResolution = image(2, 2, (x) => [x, x, x, 128]);

  const resultWith = ditherAlphaBayer8(withResolution);
  const resultWithout = ditherAlphaBayer8(withoutResolution);

  assert.deepEqual(resultWith.physicalResolution, resolution);
  assert.equal(Object.hasOwn(resultWithout, 'physicalResolution'), false);
});

test('importing and calling Core dithering has no CLI, file, or service side effects', () => {
  const code = [
    `import { ditherAlphaBayer8, describeCore } from ${JSON.stringify(CORE_URL)};`,
    'ditherAlphaBayer8({',
    '  width: 2,',
    '  height: 1,',
    '  pixels: Uint8Array.from([1, 2, 3, 64, 4, 5, 6, 255]),',
    '});',
    'describeCore();',
  ].join('\n');

  const spawned = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(spawned.status, 0, spawned.stderr);
  assert.equal(spawned.stdout, '');
  assert.equal(spawned.stderr, '');
});
