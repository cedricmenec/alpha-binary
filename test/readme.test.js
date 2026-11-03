import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const README = readFileSync('README.md', 'utf8');
const CLI_PATH = 'bin/alpha-binary.js';

function runCli(args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

function assertIncludes(text, expected) {
  assert.ok(text.includes(expected), `README is missing: ${expected}`);
}

test('README documents execution from a GitHub source checkout', () => {
  assertIncludes(README, 'Run from a GitHub source checkout');
  assertIncludes(README, '>=22.23.3 <23');
  assertIncludes(README, 'git clone');
  assertIncludes(README, 'npm ci --ignore-scripts');
  assertIncludes(README, 'node bin/alpha-binary.js --help');
  assertIncludes(README, 'npm run cli -- --help');
  assert.match(README, /no published package|not published|There is no published package/i);
  assert.doesNotMatch(README, /npm publish\s*(?:#.*)?$/m);
  assert.doesNotMatch(README, /npm install (?:-g|--global)/);
});

test('README documents convert and inspect commands that exist in the CLI', () => {
  const topLevel = runCli(['--help']);
  const convertHelp = runCli(['convert', '--help']);
  const inspectHelp = runCli(['inspect', '--help']);

  assert.equal(topLevel.status, 0, topLevel.stderr);
  assert.equal(convertHelp.status, 0, convertHelp.stderr);
  assert.equal(inspectHelp.status, 0, inspectHelp.stderr);

  assertIncludes(README, 'convert <source.png> <output.png> [options]');
  assertIncludes(README, 'inspect <source.png> [options]');
  assert.match(topLevel.stdout, /convert <source\.png> <output\.png>/);
  assert.match(topLevel.stdout, /inspect <source\.png>/);

  for (const option of ['--background', '--tolerance', '--overwrite', '--json', '--help']) {
    assertIncludes(README, option);
    assert.match(convertHelp.stdout, new RegExp(option.replace(/-/g, '\\-')));
  }

  for (const option of ['--printed-width', '--json', '--help']) {
    assertIncludes(README, option);
    assert.match(inspectHelp.stdout, new RegExp(option.replace(/-/g, '\\-')));
  }
});

test('README documents output formats, errors, and exit-code categories', () => {
  for (const field of [
    '"source"',
    '"output"',
    '"width"',
    '"height"',
    '"algorithm"',
    '"backgroundRemoval"',
    '"alpha"',
    '"zero"',
    '"full"',
    '"intermediate"',
    '"isolatedOpaque"',
    '"ratios"',
    '"isolatedToOpaque"',
    '"isolatedToTotal"',
    '"physical"',
    '"error"',
    '"code"',
    '"message"',
    '"path"',
  ]) {
    assertIncludes(README, field);
  }

  assert.match(README, /Exit code `0`/);
  assert.match(README, /Exit code `2`/);
  assert.match(README, /Exit code `3`/);
  assert.match(README, /invocation or usage error/i);
  assert.match(README, /source, output, or processing error/i);
  assertIncludes(README, 'CLI_READ_FAILED');
  assertIncludes(README, 'CLI_OUTPUT_EXISTS');
  assertIncludes(README, 'CLI_OUTPUT_IS_SOURCE');
  assertIncludes(README, 'CLI_VERIFY_FAILED');
});

test('README documents accepted inputs and prototype limits', () => {
  assert.match(README, /non-interlaced/i);
  assert.match(README, /bit depth 8/i);
  assert.match(README, /color type 0, 2, 3, 4, or 6/i);
  assert.match(README, /does not resize/i);
  assert.match(README, /crop/i);
  assert.match(README, /AI cutout/i);
  assert.match(README, /remote service/i);
  assert.match(README, /publish/i);
  assert.match(README, /fragility/i);
  assert.match(README, /not a print certification/i);
});

test('README makes no positive print-readiness or certification claim', () => {
  const forbidden = /ready to print|print-ready|certified for print|print certification/i;

  for (const line of README.split('\n')) {
    if (!forbidden.test(line)) continue;
    assert.match(
      line,
      /\bnot\b|\bno\b|\bnever\b/i,
      `README contains a positive print-readiness claim: ${line}`,
    );
  }

  assert.match(
    README,
    /No result is claimed to be ready to print or certified for printing\./,
  );
});
