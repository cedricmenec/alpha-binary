import assert from 'node:assert/strict';
import {
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { CliPngError, readPngFile, writePngFile } from '../src/cli/index.js';
import { decodePng, encodePng } from '../src/core/index.js';

const IMAGE = Object.freeze({
  width: 2,
  height: 2,
  pixels: Uint8Array.from([
    255, 0, 0, 255,
    0, 255, 0, 128,
    0, 0, 255, 0,
    17, 34, 51, 64,
  ]),
});

function createDirectory(t) {
  const directory = mkdtempSync(join(tmpdir(), 'alpha-binary-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function createSource(directory, name = 'source.png', image = IMAGE) {
  const sourcePath = join(directory, name);
  writeFileSync(sourcePath, encodePng(image));
  return sourcePath;
}

function expectCliError(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof CliPngError);
    assert.equal(error.code, code);
    return true;
  });
}

test('reads a valid source PNG and leaves it unchanged', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory);
  const sourceBytes = readFileSync(sourcePath);

  const image = readPngFile(sourcePath);

  assert.equal(image.width, IMAGE.width);
  assert.equal(image.height, IMAGE.height);
  assert.deepEqual(Array.from(image.pixels), Array.from(IMAGE.pixels));
  assert.deepEqual(readFileSync(sourcePath), sourceBytes);
});

test('reports a missing source with a path-specific diagnostic', (t) => {
  const directory = createDirectory(t);
  const sourcePath = join(directory, 'missing.png');
  let diagnostic;

  try {
    readPngFile(sourcePath);
  } catch (error) {
    diagnostic = error;
  }

  assert.ok(diagnostic instanceof CliPngError);
  assert.equal(diagnostic.code, 'CLI_READ_FAILED');
  assert.equal(diagnostic.path, sourcePath);
  assert.match(diagnostic.message, /missing\.png/);
  assert.deepEqual(readdirSync(directory), []);
});

test('reports invalid source PNG data with the source path', (t) => {
  const directory = createDirectory(t);
  const sourcePath = join(directory, 'invalid.png');
  const bytes = Buffer.from('not a png');
  writeFileSync(sourcePath, bytes);
  let diagnostic;

  try {
    readPngFile(sourcePath);
  } catch (error) {
    diagnostic = error;
  }

  assert.ok(diagnostic instanceof CliPngError);
  assert.equal(diagnostic.code, 'PNG_INVALID_SIGNATURE');
  assert.equal(diagnostic.path, sourcePath);
  assert.match(diagnostic.message, /invalid\.png/);
  assert.deepEqual(readFileSync(sourcePath), bytes);
});

test('writes a new output path without changing the source', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory);
  const outputPath = join(directory, 'output.png');
  const sourceBytes = readFileSync(sourcePath);

  const result = writePngFile(readPngFile(sourcePath), sourcePath, outputPath);

  assert.equal(result.path, outputPath);
  assert.equal(result.bytesWritten, readFileSync(outputPath).length);
  const decoded = decodePng(readFileSync(outputPath));
  assert.equal(decoded.width, IMAGE.width);
  assert.equal(decoded.height, IMAGE.height);
  assert.deepEqual(Array.from(decoded.pixels), Array.from(IMAGE.pixels));
  assert.deepEqual(readFileSync(sourcePath), sourceBytes);
});

test('supports reading and writing in one call with explicit paths', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory);
  const outputPath = join(directory, 'output.png');

  writePngFile(sourcePath, outputPath);

  const decoded = decodePng(readFileSync(outputPath));
  assert.deepEqual(Array.from(decoded.pixels), Array.from(IMAGE.pixels));
});

test('refuses an output path that is the source path', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory);
  const sourceBytes = readFileSync(sourcePath);

  expectCliError(
    () => writePngFile(readPngFile(sourcePath), sourcePath, sourcePath),
    'CLI_OUTPUT_IS_SOURCE',
  );

  assert.deepEqual(readFileSync(sourcePath), sourceBytes);
});

test('refuses a symbolic-link output that targets the source', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory);
  const outputPath = join(directory, 'source-link.png');
  const sourceBytes = readFileSync(sourcePath);

  try {
    symlinkSync(sourcePath, outputPath);
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') {
      t.skip('symbolic links are not available');
      return;
    }
    throw error;
  }

  expectCliError(
    () => writePngFile(readPngFile(sourcePath), sourcePath, outputPath),
    'CLI_OUTPUT_IS_SOURCE',
  );

  assert.deepEqual(readFileSync(sourcePath), sourceBytes);
  assert.equal(lstatSync(outputPath).isSymbolicLink(), true);
  assert.deepEqual(readFileSync(outputPath), sourceBytes);
});

test('refuses a hard-link output that identifies the source', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory);
  const outputPath = join(directory, 'source-hard-link.png');
  const sourceBytes = readFileSync(sourcePath);

  linkSync(sourcePath, outputPath);

  expectCliError(
    () => writePngFile(readPngFile(sourcePath), sourcePath, outputPath),
    'CLI_OUTPUT_IS_SOURCE',
  );

  assert.deepEqual(readFileSync(sourcePath), sourceBytes);
  assert.deepEqual(readFileSync(outputPath), sourceBytes);
});

test('refuses an existing output by default and leaves it unchanged', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory);
  const outputPath = join(directory, 'output.png');
  const existing = Buffer.from('existing output');
  writeFileSync(outputPath, existing);
  const sourceBytes = readFileSync(sourcePath);

  expectCliError(
    () => writePngFile(readPngFile(sourcePath), sourcePath, outputPath),
    'CLI_OUTPUT_EXISTS',
  );

  assert.deepEqual(readFileSync(outputPath), existing);
  assert.deepEqual(readFileSync(sourcePath), sourceBytes);
});

test('explicit overwrite replaces only the output', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory);
  const outputPath = join(directory, 'output.png');
  writeFileSync(outputPath, Buffer.from('old output'));
  const sourceBytes = readFileSync(sourcePath);

  writePngFile(readPngFile(sourcePath), sourcePath, outputPath, { overwrite: true });

  const decoded = decodePng(readFileSync(outputPath));
  assert.deepEqual(Array.from(decoded.pixels), Array.from(IMAGE.pixels));
  assert.deepEqual(readFileSync(sourcePath), sourceBytes);
  assert.equal(readdirSync(directory).some((name) => name.endsWith('.tmp')), false);
});

test('reports an output in a missing directory and leaves no output', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory);
  const outputPath = join(directory, 'missing', 'output.png');
  const sourceBytes = readFileSync(sourcePath);
  let diagnostic;

  try {
    writePngFile(readPngFile(sourcePath), sourcePath, outputPath);
  } catch (error) {
    diagnostic = error;
  }

  assert.ok(diagnostic instanceof CliPngError);
  assert.equal(diagnostic.code, 'CLI_WRITE_FAILED');
  assert.equal(diagnostic.path, outputPath);
  assert.match(diagnostic.message, /missing[/\\]output\.png/);
  assert.deepEqual(readFileSync(sourcePath), sourceBytes);
  assert.deepEqual(readdirSync(directory), ['source.png']);
});

test('reports an invalid image before writing any output', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory);
  const outputPath = join(directory, 'output.png');
  const sourceBytes = readFileSync(sourcePath);

  expectCliError(
    () =>
      writePngFile(
        { width: 0, height: 1, pixels: new Uint8Array(0) },
        sourcePath,
        outputPath,
      ),
    'PNG_INVALID_IMAGE',
  );
  expectCliError(
    () =>
      writePngFile(
        { width: 1, height: 1, pixels: new Uint8Array(3) },
        sourcePath,
        outputPath,
      ),
    'PNG_INVALID_IMAGE',
  );

  assert.deepEqual(readFileSync(sourcePath), sourceBytes);
  assert.deepEqual(readdirSync(directory), ['source.png']);
});

test('removes a temporary output when replacement fails', (t) => {
  const directory = createDirectory(t);
  const sourcePath = createSource(directory);
  const outputPath = join(directory, 'output.png');
  mkdirSync(outputPath);
  const sourceBytes = readFileSync(sourcePath);

  expectCliError(
    () => writePngFile(readPngFile(sourcePath), sourcePath, outputPath, { overwrite: true }),
    'CLI_WRITE_FAILED',
  );

  assert.deepEqual(readFileSync(sourcePath), sourceBytes);
  assert.deepEqual(readdirSync(directory).sort(), ['output.png', 'source.png']);
});