import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  BackgroundError,
  ditherAlphaBayer8,
  removeUniformBackground,
} from '../src/core/index.js';

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

function pixelAt(imageValue, x, y) {
  const offset = (y * imageValue.width + x) * 4;
  return [...imageValue.pixels.subarray(offset, offset + 4)];
}

function expectBackgroundError(fn) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof BackgroundError);
    assert.equal(error.code, 'BACKGROUND_INVALID_OPTIONS');
    return true;
  });
}

test('removal returns a new image and preserves dimensions, metadata, and input', () => {
  const physicalResolution = { x: 2835, y: 2835, unit: 1 };
  const input = image(5, 3, (x, y) => [10 + x * 20, 20 + y * 20, 50, 255]);
  input.physicalResolution = physicalResolution;
  const originalPixels = input.pixels.slice();
  const originalObject = { ...input };

  const result = removeUniformBackground(input, {
    color: { red: 10, green: 20, blue: 50 },
    tolerance: 0,
  });

  assert.notEqual(result, input);
  assert.notEqual(result.pixels, input.pixels);
  assert.equal(result.width, input.width);
  assert.equal(result.height, input.height);
  assert.equal(result.physicalResolution, physicalResolution);
  assert.deepEqual(input, originalObject);
  assert.deepEqual(input.pixels, originalPixels);
  assert.deepEqual(pixelAt(result, 0, 0), [10, 20, 50, 0]);
});

test('physical resolution is never invented when the input has none', () => {
  const input = image(2, 1, (x) => [x, x + 1, x + 2, 255]);

  const withoutOptions = removeUniformBackground(input);
  const withOptions = removeUniformBackground(input, {
    color: { red: 0, green: 1, blue: 2 },
    tolerance: 0,
  });

  assert.equal(Object.hasOwn(withoutOptions, 'physicalResolution'), false);
  assert.equal(Object.hasOwn(withOptions, 'physicalResolution'), false);
});

test('no options leave every pixel unchanged, including likely backgrounds', () => {
  const input = image(3, 1, (x) => {
    if (x === 0) return [12, 34, 56, 255];
    if (x === 1) return [0, 0, 0, 255];
    return [255, 255, 255, 128];
  });

  const result = removeUniformBackground(input);

  assert.deepEqual(result.pixels, input.pixels);
  assert.equal(pixelAt(result, 0, 0)[3], 255);
});

test('complete valid options activate background removal', () => {
  const input = image(3, 1, (x) => {
    if (x === 0) return [12, 34, 56, 255];
    if (x === 1) return [0, 0, 0, 255];
    return [255, 255, 255, 128];
  });

  const result = removeUniformBackground(input, {
    color: { red: 12, green: 34, blue: 56 },
    tolerance: 0,
  });

  assert.deepEqual(pixelAt(result, 0, 0), [12, 34, 56, 0]);
  assert.deepEqual(pixelAt(result, 1, 0), [0, 0, 0, 255]);
  assert.deepEqual(pixelAt(result, 2, 0), [255, 255, 255, 128]);
});

test('exact RGB matches become transparent at tolerance zero', () => {
  const input = image(2, 1, (x) => {
    if (x === 0) return [1, 2, 3, 255];
    return [2, 2, 3, 255];
  });

  const result = removeUniformBackground(input, {
    color: { red: 1, green: 2, blue: 3 },
    tolerance: 0,
  });

  assert.deepEqual(pixelAt(result, 0, 0), [1, 2, 3, 0]);
  assert.deepEqual(pixelAt(result, 1, 0), [2, 2, 3, 255]);
});

test('tolerance is inclusive per channel and ignores alpha', () => {
  const input = image(4, 1, (x) => {
    if (x === 0) return [100, 100, 100, 200];
    if (x === 1) return [110, 90, 100, 255];
    if (x === 2) return [110, 100, 111, 77];
    return [100, 100, 100, 0];
  });

  const result = removeUniformBackground(input, {
    color: { red: 100, green: 100, blue: 100 },
    tolerance: 10,
  });

  assert.deepEqual(pixelAt(result, 0, 0), [100, 100, 100, 0]);
  assert.deepEqual(pixelAt(result, 1, 0), [110, 90, 100, 0]);
  assert.deepEqual(pixelAt(result, 2, 0), [110, 100, 111, 77]);
  assert.deepEqual(pixelAt(result, 3, 0), [100, 100, 100, 0]);
});

test('matching pixels keep their RGB bytes and only alpha is cleared', () => {
  const input = image(4, 1, (x) => {
    if (x === 0) return [50, 60, 70, 255];
    if (x === 1) return [52, 58, 70, 200];
    if (x === 2) return [55, 55, 75, 128];
    return [56, 60, 70, 99];
  });

  const result = removeUniformBackground(input, {
    color: { red: 50, green: 60, blue: 70 },
    tolerance: 5,
  });

  assert.deepEqual(pixelAt(result, 0, 0), [50, 60, 70, 0]);
  assert.deepEqual(pixelAt(result, 1, 0), [52, 58, 70, 0]);
  assert.deepEqual(pixelAt(result, 2, 0), [55, 55, 75, 0]);
  assert.deepEqual(pixelAt(result, 3, 0), [56, 60, 70, 99]);
});

test('incomplete or out-of-range options are rejected with a stable diagnostic', () => {
  const input = image(1, 1, () => [1, 2, 3, 255]);
  const originalPixels = input.pixels.slice();
  const invalidOptions = [
    null,
    [],
    {},
    { color: { red: 1, green: 2, blue: 3 } },
    { tolerance: 0 },
    { color: { red: 1, green: 2 }, tolerance: 0 },
    { color: { red: -1, green: 2, blue: 3 }, tolerance: 0 },
    { color: { red: 256, green: 2, blue: 3 }, tolerance: 0 },
    { color: { red: 1.5, green: 2, blue: 3 }, tolerance: 0 },
    { color: { red: 1, green: 2, blue: 3 }, tolerance: -1 },
    { color: { red: 1, green: 2, blue: 3 }, tolerance: 256 },
    { color: { red: 1, green: 2, blue: 3 }, tolerance: 1.5 },
  ];

  for (const options of invalidOptions) {
    expectBackgroundError(() => removeUniformBackground(input, options));
  }

  assert.deepEqual(input.pixels, originalPixels);
});

test('matching pixels stay transparent after Bayer dithering', () => {
  const background = [200, 100, 50];
  const semiTransparent = [10, 20, 30, 128];
  const input = image(8, 8, (x, y) => {
    if (
      (x === 0 && y === 0) ||
      (x === 3 && y === 0) ||
      (x === 0 && y === 4) ||
      (x === 7 && y === 7)
    ) {
      return semiTransparent;
    }
    return [...background, 255];
  });

  const removed = removeUniformBackground(input, {
    color: { red: 200, green: 100, blue: 50 },
    tolerance: 0,
  });
  const dithered = ditherAlphaBayer8(removed);

  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const alpha = pixelAt(dithered, x, y)[3];
      const isSemiTransparent =
        (x === 0 && y === 0) ||
        (x === 3 && y === 0) ||
        (x === 0 && y === 4) ||
        (x === 7 && y === 7);

      if (isSemiTransparent) {
        assert.ok(alpha === 0 || alpha === 255);
      } else {
        assert.equal(alpha, 0);
      }
    }
  }

  assert.equal(pixelAt(removed, 3, 0)[3], 128);
  assert.equal(pixelAt(dithered, 3, 0)[3], 0);
  assert.equal(pixelAt(dithered, 0, 0)[3], 255);
  assert.equal(pixelAt(dithered, 0, 4)[3], 255);
  assert.equal(pixelAt(dithered, 7, 7)[3], 255);
});

test('removal is byte-identical across repeated calls and separate processes', () => {
  const input = image(9, 7, (x, y) => [
    (x * 13 + y * 7) % 256,
    (x * 17 + y * 31) % 256,
    (x + y * 11) % 256,
    (x * 29 + y * 23) % 256,
  ]);
  const options = {
    color: { red: 40, green: 50, blue: 60 },
    tolerance: 12,
  };
  const originalPixels = input.pixels.slice();
  const first = removeUniformBackground(input, options);
  const second = removeUniformBackground(input, options);
  const third = removeUniformBackground(input, options);

  assert.deepEqual(second, first);
  assert.deepEqual(third, first);
  assert.deepEqual(input.pixels, originalPixels);

  const expected = Buffer.from(first.pixels).toString('hex');
  const code = [
    `import { removeUniformBackground } from ${JSON.stringify(CORE_URL)};`,
    `const image = ${JSON.stringify({
      width: input.width,
      height: input.height,
      pixels: [...input.pixels],
    })};`,
    'image.pixels = Uint8Array.from(image.pixels);',
    `const result = removeUniformBackground(image, ${JSON.stringify(options)});`,
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

test('importing and calling removal has no CLI, file, or service side effects', () => {
  const code = [
    `import { removeUniformBackground } from ${JSON.stringify(CORE_URL)};`,
    'removeUniformBackground({',
    '  width: 2,',
    '  height: 1,',
    '  pixels: Uint8Array.from([1, 2, 3, 255, 4, 5, 6, 128]),',
    '}, {',
    '  color: { red: 1, green: 2, blue: 3 },',
    '  tolerance: 0,',
    '});',
  ].join('\n');

  const spawned = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(spawned.status, 0, spawned.stderr);
  assert.equal(spawned.stdout, '');
  assert.equal(spawned.stderr, '');
});
