import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { main } from '../src/cli/index.js';

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

function assertHelp(io) {
  const output = io.output();

  assert.match(output, /Usage: alpha-binary/);
  assert.match(output, /alpha-binary/);
  assert.doesNotMatch(output, /\bconvert\b/);
  assert.doesNotMatch(output, /\binspect\b/);
  assert.equal(io.error(), '');
}

test('no arguments prints concise help and exits 0', () => {
  const io = createIo();

  assert.equal(main([], io), 0);
  assertHelp(io);
});

test('-h prints concise help and exits 0', () => {
  const io = createIo();

  assert.equal(main(['-h'], io), 0);
  assertHelp(io);
});

test('--help prints concise help and exits 0', () => {
  const io = createIo();

  assert.equal(main(['--help'], io), 0);
  assertHelp(io);
});

test('unknown command fails with a concise diagnostic', () => {
  const io = createIo();

  const exitCode = main(['unknown'], io);

  assert.notEqual(exitCode, 0);
  assert.equal(io.output(), '');
  assert.match(io.error(), /unknown command 'unknown'/);
  assert.match(io.error(), /Usage: alpha-binary/);
  assert.doesNotMatch(io.error(), /\n\s+at /);
});

test('bin wrapper prints help and exits 0', () => {
  const result = spawnSync(process.execPath, ['bin/alpha-binary.js', '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage: alpha-binary/);
  assert.match(result.stdout, /alpha-binary/);
  assert.doesNotMatch(result.stdout, /\bconvert\b/);
  assert.doesNotMatch(result.stdout, /\binspect\b/);
  assert.equal(result.stderr, '');
});

test('bin wrapper fails for an unknown command', () => {
  const result = spawnSync(process.execPath, ['bin/alpha-binary.js', 'unknown'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown command 'unknown'/);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
});

test('executable wrapper runs on POSIX', { skip: process.platform === 'win32' }, () => {
  const result = spawnSync('./bin/alpha-binary.js', ['--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage: alpha-binary/);
});
