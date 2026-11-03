import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { main } from '../src/cli/index.js';
import { encodePng, inspectAlpha } from '../src/core/index.js';

function createDirectory(t) {
  const directory = mkdtempSync(join(tmpdir(), 'alpha-binary-inspect-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function image(width, height, alphaAt) {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      pixels[offset] = x * 10;
      pixels[offset + 1] = y * 10;
      pixels[offset + 2] = 40;
      pixels[offset + 3] = alphaAt(x, y);
    }
  }
  return { width, height, pixels };
}

function mixedImage(width = 8, height = 8) {
  return image(width, height, (x, y) => (x * 37 + y * 53) % 256);
}

function createSource(directory, sourceImage, name = 'source.png') {
  const sourcePath = join(directory, name);
  writeFileSync(sourcePath, encodePng(sourceImage));
  return sourcePath;
}

function runCli(args) {
  return spawnSync(process.execPath, ['bin/alpha-binary.js', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

function createIo() {
  const stdout = [];
  const stderr = [];

  return {
    stdout: { write: (text) => stdout.push(text) },
    stderr: { write: (text) => stderr.push(text) },
    output: () => stdout.join(''),
    error: () => stderr.join(''),
  };
}

const invalidInvocations = [
  ['missing source', () => []],
  ['extra positional', (source) => [source, 'extra.png']],
  ['unknown option', (source) => [source, '--unknown']],
  ['output option', (source) => [source, '--output', 'out.png']],
  ['resize option', (source) => [source, '--resize', '2']],
  ['crop option', (source) => [source, '--crop', '1x1']],
  ['algorithm option', (source) => [source, '--algorithm', 'bayer-8x8']],
  ['missing printed width value', (source) => [source, '--printed-width']],
  ['duplicate printed width', (source) => [source, '--printed-width', '10', '--printed-width', '20']],
  ['duplicate json', (source) => ['--json', '--json', source]],
  ['zero printed width', (source) => [source, '--printed-width', '0']],
  ['negative printed width', (source) => [source, '--printed-width', '-1']],
  ['non-numeric printed width', (source) => [source, '--printed-width', 'abc']],
  ['non-finite printed width', (source) => [source, '--printed-width', 'Infinity']],
  ['exponent printed width', (source) => [source, '--printed-width', '1e2']],
];

test('invalid inspect invocations exit 2 without reading or analysing', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory, mixedImage(2, 2));

  for (const [name, buildArguments] of invalidInvocations) {
    const io = createIo();
    let reads = 0;
    let analyses = 0;

    const exitCode = main(['inspect', ...buildArguments(sourcePath)], io, {
      readPngFile: () => {
        reads += 1;
        throw new Error('should not read');
      },
      inspectAlpha: () => {
        analyses += 1;
        throw new Error('should not analyse');
      },
    });

    assert.equal(exitCode, 2, name);
    assert.equal(reads, 0, name);
    assert.equal(analyses, 0, name);
    assert.equal(io.output(), '', name);
    assert.notEqual(io.error(), '', name);
    assert.doesNotMatch(io.error(), /\n\s+at /, name);
  }
});

test('inspect succeeds without modifying the source or creating files', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory, mixedImage(5, 3));
  const sourceBytes = readFileSync(sourcePath);
  const before = readdirSync(directory).sort();

  const result = runCli(['inspect', sourcePath]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.deepEqual(readFileSync(sourcePath), sourceBytes);
  assert.deepEqual(readdirSync(directory).sort(), before);
  assert.equal(existsSync(join(directory, 'out.png')), false);
});

test('text output includes every metric with a coherent bucket sum', (t) => {
  const directory = createDirectory(t);
  const sourceImage = image(4, 2, (x, y) => [0, 255, 1, 254, 128, 2, 253, 64][y * 4 + x]);
  const sourcePath = createSource(directory, sourceImage);

  const result = runCli(['inspect', sourcePath]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, new RegExp(`Source: ${sourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(result.stdout, /Dimensions: 4x2/);
  assert.match(result.stdout, /Total pixels: 8/);
  assert.match(result.stdout, /Alpha 0: 1/);
  assert.match(result.stdout, /Alpha 255: 1/);
  assert.match(result.stdout, /Alpha intermediate: 6/);
  assert.match(result.stdout, /Isolated opaque: 1/);
  assert.match(result.stdout, /Isolated\/opaque: 1$/m);
  assert.match(result.stdout, /Isolated\/total: 0\.125$/m);
  assert.match(result.stdout, /Physical pixel size: not computed/);
});

test('text output reports N/A for isolated/opaque without opaque pixels', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory, image(2, 2, () => 128));

  const result = runCli(['inspect', sourcePath]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Alpha 255: 0/);
  assert.match(result.stdout, /Isolated\/opaque: N\/A/);
  assert.match(result.stdout, /Isolated\/total: 0/);
});

test('JSON output has the documented shape and agrees with text output', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory, mixedImage());

  const text = runCli(['inspect', sourcePath]);
  const json = runCli(['inspect', sourcePath, '--json']);

  assert.equal(text.status, 0, text.stderr);
  assert.equal(json.status, 0, json.stderr);
  assert.equal(json.stderr, '');

  const parsed = JSON.parse(json.stdout);
  assert.deepEqual(Object.keys(parsed), [
    'source',
    'width',
    'height',
    'total',
    'alpha',
    'isolatedOpaque',
    'ratios',
    'physical',
  ]);
  assert.equal(parsed.source, sourcePath);
  assert.equal(parsed.width, 8);
  assert.equal(parsed.height, 8);
  assert.equal(parsed.total, 64);
  assert.deepEqual(Object.keys(parsed.alpha), ['zero', 'full', 'intermediate']);
  assert.equal(parsed.alpha.zero + parsed.alpha.full + parsed.alpha.intermediate, parsed.total);
  assert.deepEqual(Object.keys(parsed.ratios), ['isolatedToOpaque', 'isolatedToTotal']);
  assert.equal(parsed.physical, null);

  assert.match(text.stdout, new RegExp(`Dimensions: ${parsed.width}x${parsed.height}`));
  assert.match(text.stdout, new RegExp(`Total pixels: ${parsed.total}`));
  assert.match(text.stdout, new RegExp(`Alpha 0: ${parsed.alpha.zero}`));
  assert.match(text.stdout, new RegExp(`Alpha 255: ${parsed.alpha.full}`));
  assert.match(text.stdout, new RegExp(`Alpha intermediate: ${parsed.alpha.intermediate}`));
  assert.match(text.stdout, new RegExp(`Isolated opaque: ${parsed.isolatedOpaque}`));
});

test('printed width yields a physical pixel size in text and JSON', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory, mixedImage(8, 2));

  const text = runCli(['inspect', sourcePath, '--printed-width', '80']);
  const json = runCli(['inspect', sourcePath, '--printed-width', '80', '--json']);

  assert.equal(text.status, 0, text.stderr);
  assert.equal(json.status, 0, json.stderr);
  assert.match(text.stdout, /Physical pixel size: 10 mm\/pixel \(printed width 80 mm\)/);
  assert.deepEqual(JSON.parse(json.stdout).physical, {
    printedWidth: 80,
    millimetresPerPixel: 10,
  });
});

test('success output makes no print-readiness or certification claim', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory, mixedImage(4, 4));

  const text = runCli(['inspect', sourcePath]);
  const json = runCli(['inspect', sourcePath, '--json']);

  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /fragility/);
  assert.doesNotMatch(text.stdout, /ready to print|print[- ]ready|certified for print/i);
  assert.doesNotMatch(json.stdout, /ready to print|print[- ]ready|certified/i);
  const parsed = JSON.parse(json.stdout);
  assert.equal('certification' in parsed, false);
  assert.equal('printReady' in parsed, false);
});

test('exit codes and diagnostics distinguish success, invocation, and source failures', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory, mixedImage(3, 3));
  const missingSource = join(directory, 'missing.png');
  const invalidSource = join(directory, 'invalid.png');
  writeFileSync(invalidSource, Buffer.from('not a png'));

  const success = runCli(['inspect', sourcePath]);
  assert.equal(success.status, 0, success.stderr);

  const invocation = runCli(['inspect']);
  assert.equal(invocation.status, 2, invocation.stderr);
  assert.equal(invocation.stdout, '');
  assert.match(invocation.stderr, /CLI_MISSING_PATHS/);
  assert.doesNotMatch(invocation.stderr, /\n\s+at /);

  const invocationJson = runCli(['inspect', '--json']);
  assert.equal(invocationJson.status, 2, invocationJson.stderr);
  assert.equal(invocationJson.stdout, '');
  const invocationDiagnostic = JSON.parse(invocationJson.stderr);
  assert.equal(typeof invocationDiagnostic.error.code, 'string');
  assert.equal(typeof invocationDiagnostic.error.message, 'string');
  assert.doesNotMatch(invocationJson.stderr, /\n\s+at /);

  const invalidWidth = runCli(['inspect', sourcePath, '--printed-width', '0']);
  assert.equal(invalidWidth.status, 2, invalidWidth.stderr);
  assert.equal(invalidWidth.stdout, '');

  const missing = runCli(['inspect', missingSource]);
  assert.equal(missing.status, 3, missing.stderr);
  assert.equal(missing.stdout, '');
  assert.match(missing.stderr, /CLI_READ_FAILED/);
  assert.match(missing.stderr, /missing\.png/);
  assert.doesNotMatch(missing.stderr, /\n\s+at /);

  const invalid = runCli(['inspect', invalidSource, '--json']);
  assert.equal(invalid.status, 3, invalid.stderr);
  assert.equal(invalid.stdout, '');
  const invalidDiagnostic = JSON.parse(invalid.stderr);
  assert.equal(invalidDiagnostic.error.code, 'PNG_INVALID_SIGNATURE');
  assert.equal(invalidDiagnostic.error.path, invalidSource);
  assert.equal(typeof invalidDiagnostic.error.message, 'string');
  assert.doesNotMatch(invalid.stderr, /\n\s+at /);
});

test('top-level help advertises convert and inspect', () => {
  const result = runCli(['--help']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /\bconvert\b/);
  assert.match(result.stdout, /convert <source\.png> <output\.png>/);
  assert.match(result.stdout, /\binspect\b/);
  assert.match(result.stdout, /inspect <source\.png>/);
});

test('inspect --help exits 0 and shows only the inspect surface', () => {
  const result = runCli(['inspect', '--help']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Usage: alpha-binary inspect <source\.png> \[options\]/);
  assert.match(result.stdout, /--printed-width/);
  assert.match(result.stdout, /--json/);
  assert.match(result.stdout, /--help/);
  assert.doesNotMatch(result.stdout, /\bconvert\b/);
});

test('inspect delegates to the in-memory metrics operation once', (t) => {
  const directory = createDirectory(t);
  const sourceImage = mixedImage(2, 2);
  const sourcePath = createSource(directory, sourceImage);
  const io = createIo();
  let analyses = 0;

  const exitCode = main(['inspect', sourcePath, '--json'], io, {
    inspectAlpha: (input, options) => {
      analyses += 1;
      return inspectAlpha(input, options);
    },
  });

  assert.equal(exitCode, 0, io.error());
  assert.equal(analyses, 1);
  assert.equal(io.error(), '');
  assert.equal(JSON.parse(io.output()).source, sourcePath);
});
