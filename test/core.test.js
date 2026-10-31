import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { describeCore } from '../src/core/index.js';

test('Core exports a callable skeleton function', () => {
  assert.equal(typeof describeCore, 'function');

  const result = describeCore();

  assert.equal(typeof result, 'object');
  assert.equal(result.name, 'alpha-binary');
});

test('Core returns a frozen description', () => {
  const result = describeCore();

  assert.equal(result, describeCore());
  assert.equal(Object.isFrozen(result), true);
});

test('importing and calling Core produces no output', () => {
  const code = [
    "import { describeCore } from './src/core/index.js';",
    'describeCore();',
  ].join('\n');

  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});
