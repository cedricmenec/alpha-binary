import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { AlphaMetricsError, inspectAlpha } from '../src/core/index.js';

function image(width, height, alphaAt) {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      pixels[offset] = 10;
      pixels[offset + 1] = 20;
      pixels[offset + 2] = 30;
      pixels[offset + 3] = alphaAt(x, y);
    }
  }
  return { width, height, pixels };
}

function expectMetricsError(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof AlphaMetricsError);
    assert.equal(error.code, code);
    return true;
  });
}

test('mixed alpha values partition the total exactly', () => {
  const source = image(4, 2, (x, y) => [0, 255, 1, 254, 128, 2, 253, 64][y * 4 + x]);

  const metrics = inspectAlpha(source);

  assert.equal(metrics.width, 4);
  assert.equal(metrics.height, 2);
  assert.equal(metrics.total, 8);
  assert.equal(metrics.alpha.zero + metrics.alpha.full + metrics.alpha.intermediate, metrics.total);
  assert.deepEqual(metrics.alpha, { zero: 1, full: 1, intermediate: 6 });
});

test('a fully transparent image has zero full and intermediate buckets', () => {
  const metrics = inspectAlpha(image(3, 2, () => 0));

  assert.equal(metrics.alpha.zero, metrics.total);
  assert.equal(metrics.alpha.full, 0);
  assert.equal(metrics.alpha.intermediate, 0);
});

test('a lone opaque pixel without opaque neighbors is isolated', () => {
  const metrics = inspectAlpha(image(3, 3, (x, y) => (x === 1 && y === 1 ? 255 : 0)));

  assert.equal(metrics.alpha.full, 1);
  assert.equal(metrics.isolatedOpaque, 1);
});

test('out-of-bounds positions are not opaque neighbors', () => {
  const metrics = inspectAlpha(image(1, 1, () => 255));

  assert.equal(metrics.alpha.full, 1);
  assert.equal(metrics.isolatedOpaque, 1);
});

test('a diagonal opaque neighbor prevents isolation', () => {
  const metrics = inspectAlpha(
    image(2, 2, (x, y) => ((x === 0 && y === 0) || (x === 1 && y === 1) ? 255 : 0)),
  );

  assert.equal(metrics.alpha.full, 2);
  assert.equal(metrics.isolatedOpaque, 0);
});

test('intermediate alpha never creates an opaque neighbor', () => {
  const metrics = inspectAlpha(image(3, 3, (x, y) => (x === 1 && y === 1 ? 255 : 128)));

  assert.deepEqual(metrics.alpha, { zero: 0, full: 1, intermediate: 8 });
  assert.equal(metrics.isolatedOpaque, 1);
});

test('isolated ratios are exact quotients of the counts', () => {
  const metrics = inspectAlpha(
    image(4, 1, (x) => [255, 0, 255, 255][x]),
  );

  assert.equal(metrics.isolatedOpaque, 1);
  assert.equal(metrics.alpha.full, 3);
  assert.equal(metrics.total, 4);
  assert.equal(metrics.ratios.isolatedToOpaque, 1 / 3);
  assert.equal(metrics.ratios.isolatedToTotal, 1 / 4);
});

test('no opaque pixels yields N/A for isolated/opaque and zero isolated/total', () => {
  const metrics = inspectAlpha(image(2, 2, (x, y) => [0, 128, 64, 254][y * 2 + x]));

  assert.equal(metrics.alpha.full, 0);
  assert.equal(metrics.ratios.isolatedToOpaque, null);
  assert.equal(metrics.ratios.isolatedToTotal, 0);
});

test('physical pixel size uses only an explicit printed width', () => {
  const source = {
    ...image(8, 2, () => 255),
    physicalResolution: { x: 2835, y: 2835, unit: 1 },
  };

  const without = inspectAlpha(source);
  assert.equal(without.physical, null);

  const withWidth = inspectAlpha(source, { printedWidth: 80 });
  assert.deepEqual(withWidth.physical, { printedWidth: 80, millimetresPerPixel: 10 });
});

test('invalid printed widths produce a stable diagnostic and no metrics', () => {
  const source = image(2, 1, () => 255);

  for (const printedWidth of [0, -1, -0.5, Number.NaN, Number.POSITIVE_INFINITY, '80', null]) {
    expectMetricsError(
      () => inspectAlpha(source, { printedWidth }),
      'ALPHA_METRICS_INVALID_PRINTED_WIDTH',
    );
  }
});

test('repeated calls are identical and do not mutate the input', () => {
  const source = image(4, 4, (x, y) => (x * 17 + y * 31) % 256);
  const before = Uint8Array.from(source.pixels);

  const first = inspectAlpha(source);
  const second = inspectAlpha(source);

  assert.deepEqual(first, second);
  assert.deepEqual(source.pixels, before);
});

test('a separate Node.js process returns the same metrics', () => {
  const code = [
    "import { inspectAlpha } from './src/core/index.js';",
    'const pixels = new Uint8Array(4 * 3 * 4);',
    'for (let index = 0; index < 12; index += 1) {',
    '  pixels[index * 4 + 3] = (index * 37) % 256;',
    '}',
    'const metrics = inspectAlpha({ width: 4, height: 3, pixels }, { printedWidth: 50 });',
    'process.stdout.write(JSON.stringify(metrics));',
  ].join('\n');

  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');

  const pixels = new Uint8Array(4 * 3 * 4);
  for (let index = 0; index < 12; index += 1) {
    pixels[index * 4 + 3] = (index * 37) % 256;
  }
  assert.deepEqual(
    JSON.parse(result.stdout),
    inspectAlpha({ width: 4, height: 3, pixels }, { printedWidth: 50 }),
  );
});

test('importing and calling the metrics operation has no file or CLI side effects', () => {
  const code = [
    "import { inspectAlpha } from './src/core/index.js';",
    'const image = { width: 1, height: 1, pixels: Uint8Array.from([0, 0, 0, 255]) };',
    'inspectAlpha(image);',
  ].join('\n');

  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});
