import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  linkSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  CliPngError,
  main,
  readPngFile,
  verifyConvertedOutput,
} from '../src/cli/index.js';
import {
  decodePng,
  ditherAlphaBayer8,
  encodePng,
  removeUniformBackground,
} from '../src/core/index.js';

function createDirectory(t) {
  const directory = mkdtempSync(join(tmpdir(), 'alpha-binary-convert-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function image(width, height, pixelAt) {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue, alpha] = pixelAt(x, y);
      const offset = (y * width + x) * 4;
      pixels[offset] = red;
      pixels[offset + 1] = green;
      pixels[offset + 2] = blue;
      pixels[offset + 3] = alpha;
    }
  }
  return { width, height, pixels };
}

function semiTransparentImage(width = 8, height = 8) {
  return image(width, height, (x, y) => [x * 20, y * 20, (x + y) * 10, (x * 37 + y * 53) % 256]);
}

function createSource(directory, sourceImage, name = 'source.png') {
  const sourcePath = join(directory, name);
  writeFileSync(sourcePath, encodePng(sourceImage));
  return sourcePath;
}

function alphas(decoded) {
  const values = [];
  for (let offset = 3; offset < decoded.pixels.length; offset += 4) {
    values.push(decoded.pixels[offset]);
  }
  return values;
}

function assertBinaryAlpha(decoded) {
  let zero = 0;
  let full = 0;
  let intermediate = 0;
  for (const alpha of alphas(decoded)) {
    if (alpha === 0) zero += 1;
    else if (alpha === 255) full += 1;
    else intermediate += 1;
  }
  assert.equal(intermediate, 0);
  assert.equal(zero + full, decoded.width * decoded.height);
  return { zero, full, intermediate };
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

test('convert writes a binary-alpha PNG and leaves the source unchanged', (t) => {
  const directory = createDirectory(t);
  const sourceImage = semiTransparentImage();
  const sourcePath = createSource(directory, sourceImage);
  const outputPath = join(directory, 'output.png');
  const sourceBytes = readFileSync(sourcePath);

  const result = runCli(['convert', sourcePath, outputPath]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, new RegExp(`Source: ${sourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(result.stdout, new RegExp(`Output: ${outputPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(result.stdout, /Dimensions: 8x8/);
  assert.match(result.stdout, /Algorithm: bayer-8x8/);
  assert.match(result.stdout, /Alpha 0: \d+/);
  assert.match(result.stdout, /Alpha 255: \d+/);
  assert.match(result.stdout, /Alpha intermediate: 0/);
  assert.doesNotMatch(result.stdout, /print[- ]ready|ready to print/i);

  assert.deepEqual(readFileSync(sourcePath), sourceBytes);
  const decoded = decodePng(readFileSync(outputPath));
  assert.equal(decoded.width, sourceImage.width);
  assert.equal(decoded.height, sourceImage.height);
  assertBinaryAlpha(decoded);
});

test('convert rejects invalid invocations with exit code 2 and no output', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory, semiTransparentImage(2, 2));

  const invalidCases = [
    ['missing paths', () => []],
    ['one path', () => [sourcePath]],
    ['extra path', (output) => [sourcePath, output, 'extra.png']],
    ['unknown option', (output) => ['--unknown', sourcePath, output]],
    ['algorithm option', (output) => ['--algorithm', 'bayer-8x8', sourcePath, output]],
    ['resize option', (output) => ['--resize', '2', sourcePath, output]],
    ['crop option', (output) => ['--crop', '1x1', sourcePath, output]],
    ['AI cutout option', (output) => ['--ai-cutout', sourcePath, output]],
    ['remote option', (output) => ['--remote', 'https://example.test', sourcePath, output]],
    ['missing background value', () => ['--background']],
    ['missing tolerance value', () => ['--tolerance']],
    ['background only', (output) => ['--background', '#ffffff', sourcePath, output]],
    ['tolerance only', (output) => ['--tolerance', '0', sourcePath, output]],
    ['short hex', (output) => ['--background', 'fff', '--tolerance', '0', sourcePath, output]],
    ['non-hex background', (output) => ['--background', '#12345g', '--tolerance', '0', sourcePath, output]],
    ['decimal tolerance', (output) => ['--background', '#ffffff', '--tolerance', '1.5', sourcePath, output]],
    ['negative tolerance', (output) => ['--background', '#ffffff', '--tolerance', '-1', sourcePath, output]],
    ['tolerance above range', (output) => ['--background', '#ffffff', '--tolerance', '256', sourcePath, output]],
    ['duplicate background', (output) => ['--background', '#ffffff', '--background', '#000000', '--tolerance', '0', sourcePath, output]],
    ['duplicate tolerance', (output) => ['--background', '#ffffff', '--tolerance', '0', '--tolerance', '1', sourcePath, output]],
    ['duplicate json', (output) => ['--json', '--json', sourcePath, output]],
    ['duplicate overwrite', (output) => ['--overwrite', '--overwrite', sourcePath, output]],
  ];

  for (const [name, buildArguments] of invalidCases) {
    const outputPath = join(directory, `invalid-${name.replace(/\W+/g, '-')}.png`);
    const result = runCli(['convert', ...buildArguments(outputPath)]);

    assert.equal(result.status, 2, `${name}: ${result.stderr}`);
    assert.equal(existsSync(outputPath), false, `${name} created an output`);
    assert.equal(result.stdout, '', name);
    assert.notEqual(result.stderr, '', name);
    assert.doesNotMatch(result.stderr, /\n\s+at /, name);
  }
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

test('convert --help lists convert usage and options, not inspect', () => {
  const result = runCli(['convert', '--help']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Usage: alpha-binary convert <source\.png> <output\.png>/);
  assert.match(result.stdout, /--background/);
  assert.match(result.stdout, /--tolerance/);
  assert.match(result.stdout, /--overwrite/);
  assert.match(result.stdout, /--json/);
  assert.doesNotMatch(result.stdout, /\binspect\b/);
});

test('background removal activates only when both options are supplied', (t) => {
  const directory = createDirectory(t);
  const background = [10, 20, 30, 255];
  const foreground = [200, 100, 50, 128];
  const sourceImage = image(8, 1, (x) => (x < 4 ? background : foreground));
  const sourcePath = createSource(directory, sourceImage);
  const plainPath = join(directory, 'plain.png');
  const removedPath = join(directory, 'removed.png');

  const plain = runCli(['convert', sourcePath, plainPath]);
  assert.equal(plain.status, 0, plain.stderr);
  const plainAlphas = alphas(decodePng(readFileSync(plainPath)));
  assert.deepEqual(plainAlphas.slice(0, 4), [255, 255, 255, 255]);
  assert.deepEqual(plainAlphas.slice(4), [255, 0, 255, 0]);

  const removed = runCli([
    'convert',
    sourcePath,
    removedPath,
    '--background',
    '#0a141e',
    '--tolerance',
    '0',
  ]);
  assert.equal(removed.status, 0, removed.stderr);
  const removedAlphas = alphas(decodePng(readFileSync(removedPath)));
  assert.deepEqual(removedAlphas.slice(0, 4), [0, 0, 0, 0]);
  assert.deepEqual(removedAlphas.slice(4), [255, 0, 255, 0]);

  const expected = ditherAlphaBayer8(
    removeUniformBackground(sourceImage, {
      color: { red: 10, green: 20, blue: 30 },
      tolerance: 0,
    }),
  );
  assert.deepEqual(removedAlphas, alphas(expected));
});

test('convert preserves dimensions and existing physical resolution without inventing one', (t) => {
  const directory = createDirectory(t);
  const physicalResolution = { x: 2835, y: 2835, unit: 1 };
  const withResolution = {
    ...semiTransparentImage(5, 3),
    physicalResolution,
  };
  const withoutResolution = semiTransparentImage(5, 3);

  const withSource = createSource(directory, withResolution, 'with-resolution.png');
  const withoutSource = createSource(directory, withoutResolution, 'without-resolution.png');
  const withBytes = readFileSync(withSource);
  const withoutBytes = readFileSync(withoutSource);
  const withOutput = join(directory, 'with-resolution-output.png');
  const withoutOutput = join(directory, 'without-resolution-output.png');

  assert.equal(runCli(['convert', withSource, withOutput]).status, 0);
  assert.equal(runCli(['convert', withoutSource, withoutOutput]).status, 0);

  assert.deepEqual(readFileSync(withSource), withBytes);
  assert.deepEqual(readFileSync(withoutSource), withoutBytes);

  const withDecoded = decodePng(readFileSync(withOutput));
  const withoutDecoded = decodePng(readFileSync(withoutOutput));
  assert.equal(withDecoded.width, 5);
  assert.equal(withDecoded.height, 3);
  assert.equal(withoutDecoded.width, 5);
  assert.equal(withoutDecoded.height, 3);
  assert.deepEqual(withDecoded.physicalResolution, physicalResolution);
  assert.equal(Object.hasOwn(withoutDecoded, 'physicalResolution'), false);
});

test('convert refuses same-path, linked, and existing outputs without overwrite', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory, semiTransparentImage(3, 3));
  const sourceBytes = readFileSync(sourcePath);

  const samePath = runCli(['convert', sourcePath, sourcePath]);
  assert.equal(samePath.status, 3, samePath.stderr);
  assert.match(samePath.stderr, /CLI_OUTPUT_IS_SOURCE/);
  assert.equal(samePath.stdout, '');
  assert.deepEqual(readFileSync(sourcePath), sourceBytes);

  const symlinkOutput = join(directory, 'source-link.png');
  try {
    symlinkSync(sourcePath, symlinkOutput);
  } catch (error) {
    if (error.code !== 'EPERM' && error.code !== 'EACCES') throw error;
  }
  if (existsSync(symlinkOutput)) {
    const symlinkResult = runCli(['convert', sourcePath, symlinkOutput]);
    assert.equal(symlinkResult.status, 3, symlinkResult.stderr);
    assert.match(symlinkResult.stderr, /CLI_OUTPUT_IS_SOURCE/);
    assert.equal(lstatSync(symlinkOutput).isSymbolicLink(), true);
    assert.deepEqual(readFileSync(sourcePath), sourceBytes);
  }

  const hardLinkOutput = join(directory, 'source-hard-link.png');
  linkSync(sourcePath, hardLinkOutput);
  const hardLinkResult = runCli(['convert', sourcePath, hardLinkOutput]);
  assert.equal(hardLinkResult.status, 3, hardLinkResult.stderr);
  assert.match(hardLinkResult.stderr, /CLI_OUTPUT_IS_SOURCE/);
  assert.deepEqual(readFileSync(sourcePath), sourceBytes);
  assert.deepEqual(readFileSync(hardLinkOutput), sourceBytes);

  const existingOutput = join(directory, 'existing.png');
  const existingBytes = Buffer.from('existing output');
  writeFileSync(existingOutput, existingBytes);
  const existingResult = runCli(['convert', sourcePath, existingOutput]);
  assert.equal(existingResult.status, 3, existingResult.stderr);
  assert.match(existingResult.stderr, /CLI_OUTPUT_EXISTS/);
  assert.deepEqual(readFileSync(existingOutput), existingBytes);
  assert.deepEqual(readFileSync(sourcePath), sourceBytes);
});

test('explicit overwrite replaces only the output', (t) => {
  const directory = createDirectory(t);
  const sourceImage = semiTransparentImage(4, 4);
  const sourcePath = createSource(directory, sourceImage);
  const outputPath = join(directory, 'output.png');
  const sourceBytes = readFileSync(sourcePath);
  writeFileSync(outputPath, Buffer.from('old output'));

  const result = runCli(['convert', sourcePath, outputPath, '--overwrite']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.deepEqual(readFileSync(sourcePath), sourceBytes);
  const decoded = decodePng(readFileSync(outputPath));
  assert.equal(decoded.width, sourceImage.width);
  assert.equal(decoded.height, sourceImage.height);
  assertBinaryAlpha(decoded);
});

test('output control rejects intermediate alpha and mismatched dimensions', () => {
  const source = image(2, 1, () => [0, 0, 0, 255]);

  assert.throws(
    () =>
      verifyConvertedOutput(
        source,
        image(2, 1, (x) => [0, 0, 0, x === 0 ? 128 : 255]),
        'out.png',
      ),
    (error) => {
      assert.ok(error instanceof CliPngError);
      assert.equal(error.code, 'CLI_VERIFY_FAILED');
      assert.equal(error.path, 'out.png');
      assert.match(error.message, /intermediate alpha/);
      return true;
    },
  );

  assert.throws(
    () => verifyConvertedOutput(source, image(3, 1, () => [0, 0, 0, 255]), 'out.png'),
    (error) => {
      assert.ok(error instanceof CliPngError);
      assert.equal(error.code, 'CLI_VERIFY_FAILED');
      assert.equal(error.path, 'out.png');
      assert.match(error.message, /dimensions/);
      return true;
    },
  );
});

test('a controlled verification failure exits 3 and prints no success diagnostic', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory, semiTransparentImage(4, 4));
  const outputPath = join(directory, 'output.png');
  const controlled = image(4, 4, (x) => [0, 0, 0, x === 0 ? 128 : 255]);
  const io = createIo();
  let readCount = 0;

  const exitCode = main(['convert', sourcePath, outputPath], io, {
    readPngFile: (path) => {
      readCount += 1;
      return readCount === 1 ? readPngFile(path) : controlled;
    },
  });

  assert.equal(exitCode, 3);
  assert.equal(io.output(), '');
  assert.match(io.error(), /CLI_VERIFY_FAILED/);
  assert.doesNotMatch(io.error(), /\n\s+at /);
});

test('JSON success reports the documented shape with and without background removal', (t) => {
  const directory = createDirectory(t);
  const sourceImage = semiTransparentImage(8, 8);
  const sourcePath = createSource(directory, sourceImage);
  const plainOutput = join(directory, 'plain.json.png');
  const removedOutput = join(directory, 'removed.json.png');

  const plain = runCli(['convert', sourcePath, plainOutput, '--json']);
  assert.equal(plain.status, 0, plain.stderr);
  assert.equal(plain.stderr, '');
  const plainDiagnostic = JSON.parse(plain.stdout);
  assert.equal(plainDiagnostic.source, sourcePath);
  assert.equal(plainDiagnostic.output, plainOutput);
  assert.equal(plainDiagnostic.width, 8);
  assert.equal(plainDiagnostic.height, 8);
  assert.equal(plainDiagnostic.algorithm, 'bayer-8x8');
  assert.equal(plainDiagnostic.backgroundRemoval, null);
  assert.equal(plainDiagnostic.alpha.intermediate, 0);
  assert.equal(plainDiagnostic.alpha.zero + plainDiagnostic.alpha.full, 64);

  const removed = runCli([
    'convert',
    sourcePath,
    removedOutput,
    '--background',
    '#0a141e',
    '--tolerance',
    '7',
    '--json',
  ]);
  assert.equal(removed.status, 0, removed.stderr);
  const removedDiagnostic = JSON.parse(removed.stdout);
  assert.deepEqual(removedDiagnostic.backgroundRemoval, {
    color: { red: 10, green: 20, blue: 30 },
    tolerance: 7,
  });
  assert.equal(removedDiagnostic.alpha.intermediate, 0);
});

test('JSON failures use the error shape for invocation and processing errors', (t) => {
  const directory = createDirectory(t);
  const invocation = runCli(['convert', '--json']);
  assert.equal(invocation.status, 2, invocation.stderr);
  assert.equal(invocation.stdout, '');
  const invocationDiagnostic = JSON.parse(invocation.stderr);
  assert.equal(typeof invocationDiagnostic.error.code, 'string');
  assert.equal(typeof invocationDiagnostic.error.message, 'string');
  assert.doesNotMatch(invocation.stderr, /\n\s+at /);

  const missingSource = join(directory, 'missing.png');
  const outputPath = join(directory, 'output.png');
  const processing = runCli(['convert', missingSource, outputPath, '--json']);
  assert.equal(processing.status, 3, processing.stderr);
  assert.equal(processing.stdout, '');
  const processingDiagnostic = JSON.parse(processing.stderr);
  assert.equal(processingDiagnostic.error.code, 'CLI_READ_FAILED');
  assert.equal(processingDiagnostic.error.path, missingSource);
  assert.equal(typeof processingDiagnostic.error.message, 'string');
  assert.equal(existsSync(outputPath), false);
});

test('text failures name the stable code and path without a stack trace', (t) => {
  const directory = createDirectory(t);
  const missingSource = join(directory, 'missing.png');
  const outputPath = join(directory, 'output.png');

  const result = runCli(['convert', missingSource, outputPath]);

  assert.equal(result.status, 3, result.stderr);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /CLI_READ_FAILED/);
  assert.match(result.stderr, /missing\.png/);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
  assert.equal(existsSync(outputPath), false);
});
