import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import test from 'node:test';

import { decodePng } from '../src/core/index.js';

const REFERENCE_DIRECTORY = join('test', 'fixtures', 'reference');
const MANIFEST_PATH = join(REFERENCE_DIRECTORY, 'manifest.json');
const CLI_PATH = join('bin', 'alpha-binary.js');

function readManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
}

function fixturePath(fixture) {
  return join(REFERENCE_DIRECTORY, fixture.file);
}

function availableFixtures() {
  return readManifest().fixtures.filter((fixture) => fixture.status === 'available');
}

function readDecodedFixture(fixture) {
  return decodePng(readFileSync(fixturePath(fixture)));
}

function createDirectory(t, prefix) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

function alphaBuckets(decoded) {
  const buckets = { zero: 0, full: 0, intermediate: 0 };
  for (let offset = 3; offset < decoded.pixels.length; offset += 4) {
    const alpha = decoded.pixels[offset];
    if (alpha === 0) buckets.zero += 1;
    else if (alpha === 255) buckets.full += 1;
    else buckets.intermediate += 1;
  }
  return buckets;
}

function assertOnlyBinaryAlpha(decoded) {
  const buckets = alphaBuckets(decoded);
  assert.equal(buckets.intermediate, 0);
  assert.equal(buckets.zero + buckets.full, decoded.width * decoded.height);
  return buckets;
}

function assertRgbUnchanged(source, output) {
  assert.equal(output.width, source.width);
  assert.equal(output.height, source.height);
  for (let offset = 0; offset < source.pixels.length; offset += 4) {
    const pixel = offset / 4;
    assert.equal(output.pixels[offset], source.pixels[offset], `red at pixel ${pixel}`);
    assert.equal(output.pixels[offset + 1], source.pixels[offset + 1], `green at pixel ${pixel}`);
    assert.equal(output.pixels[offset + 2], source.pixels[offset + 2], `blue at pixel ${pixel}`);
  }
}

function requireMatch(output, pattern, label) {
  const match = pattern.exec(output);
  assert.ok(match, `Missing ${label} in inspect output:\n${output}`);
  return match;
}

function parseInspectText(output) {
  const [width, height] = requireMatch(output, /^Dimensions: (\d+)x(\d+)$/m, 'dimensions')
    .slice(1)
    .map(Number);
  const isolatedToOpaqueText = requireMatch(
    output,
    /^Isolated\/opaque: (N\/A|[-+0-9.eE]+)$/m,
    'isolated/opaque ratio',
  )[1];
  const physicalText = requireMatch(
    output,
    /^Physical pixel size: (.+)$/m,
    'physical pixel size',
  )[1];

  let physical = null;
  if (physicalText !== 'not computed') {
    const match = requireMatch(
      physicalText,
      /^([-+0-9.eE]+) mm\/pixel \(printed width ([-+0-9.eE]+) mm\)$/,
      'physical pixel size value',
    );
    physical = {
      printedWidth: Number(match[2]),
      millimetresPerPixel: Number(match[1]),
    };
  }

  return {
    source: requireMatch(output, /^Source: (.*)$/m, 'source')[1],
    width,
    height,
    total: Number(requireMatch(output, /^Total pixels: (\d+)$/m, 'total')[1]),
    alpha: {
      zero: Number(requireMatch(output, /^Alpha 0: (\d+)$/m, 'alpha zero')[1]),
      full: Number(requireMatch(output, /^Alpha 255: (\d+)$/m, 'alpha full')[1]),
      intermediate: Number(
        requireMatch(output, /^Alpha intermediate: (\d+)$/m, 'alpha intermediate')[1],
      ),
    },
    isolatedOpaque: Number(
      requireMatch(output, /^Isolated opaque: (\d+)$/m, 'isolated opaque')[1],
    ),
    ratios: {
      isolatedToOpaque:
        isolatedToOpaqueText === 'N/A' ? null : Number(isolatedToOpaqueText),
      isolatedToTotal: Number(
        requireMatch(output, /^Isolated\/total: ([-+0-9.eE]+)$/m, 'isolated/total ratio')[1],
      ),
    },
    physical,
  };
}

test('reference manifest and fixtures describe the two available PNGs', () => {
  const manifest = readManifest();
  const fixtures = availableFixtures();

  assert.equal(fixtures.length, 2);
  assert.deepEqual(
    fixtures.map((fixture) => fixture.id).sort(),
    ['partial-alpha', 'uniform-background'],
  );

  for (const fixture of fixtures) {
    assert.equal(fixture.status, 'available');
    assert.equal(existsSync(fixturePath(fixture)), true, `${fixture.file} is missing`);
    const decoded = readDecodedFixture(fixture);
    assert.equal(decoded.width, fixture.width, fixture.id);
    assert.equal(decoded.height, fixture.height, fixture.id);
    assert.deepEqual(alphaBuckets(decoded), fixture.alphaExpectation, fixture.id);
  }

  const uniform = fixtures.find((fixture) => fixture.id === 'uniform-background');
  const uniformImage = readDecodedFixture(uniform);
  const expectedColor = [
    uniform.uniformBackground.red,
    uniform.uniformBackground.green,
    uniform.uniformBackground.blue,
    uniform.uniformBackground.alpha,
  ];
  for (let offset = 0; offset < uniformImage.pixels.length; offset += 4) {
    assert.deepEqual(Array.from(uniformImage.pixels.subarray(offset, offset + 4)), expectedColor);
  }

  const partial = fixtures.find((fixture) => fixture.id === 'partial-alpha');
  const partialBuckets = alphaBuckets(readDecodedFixture(partial));
  assert.ok(partialBuckets.zero >= 1);
  assert.ok(partialBuckets.intermediate >= 1);
  assert.ok(partialBuckets.full >= 1);
});

test('A-001 remains unresolved and is not replaced by a substitute', () => {
  const manifest = readManifest();
  const a001 = manifest.a001;

  assert.equal(a001.id, 'A-001');
  assert.equal(a001.status, 'unresolved');
  assert.equal(a001.fixture, null);
  assert.equal(a001.expectedOutcomes, null);
  assert.match(a001.reason, /not define the A-001 trial/i);
  assert.equal(
    manifest.fixtures.some((fixture) => /a-?001/i.test(`${fixture.id} ${fixture.file}`)),
    false,
  );
  assert.equal(
    readdirSync(REFERENCE_DIRECTORY).some((name) => /a-?001/i.test(name)),
    false,
  );
});

for (const fixture of availableFixtures()) {
  test(`convert writes a binary-alpha output for ${fixture.id}`, (t) => {
    const directory = createDirectory(t, `alpha-binary-reference-convert-${fixture.id}-`);
    const source = fixturePath(fixture);
    const output = join(directory, 'output.png');
    const sourceBytes = readFileSync(source);

    const result = runCli(['convert', source, output]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.deepEqual(readFileSync(source), sourceBytes);

    const decodedSource = readDecodedFixture(fixture);
    const decodedOutput = decodePng(readFileSync(output));
    assertRgbUnchanged(decodedSource, decodedOutput);
    assertOnlyBinaryAlpha(decodedOutput);
  });

  test(`convert is byte-identical across separate processes for ${fixture.id}`, (t) => {
    const firstDirectory = createDirectory(t, `alpha-binary-reference-first-${fixture.id}-`);
    const secondDirectory = createDirectory(t, `alpha-binary-reference-second-${fixture.id}-`);
    const source = fixturePath(fixture);
    const sourceBytes = readFileSync(source);
    const firstOutput = join(firstDirectory, 'output.png');
    const secondOutput = join(secondDirectory, 'output.png');

    const first = runCli(['convert', source, firstOutput]);
    const second = runCli(['convert', source, secondOutput]);

    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(readFileSync(firstOutput), readFileSync(secondOutput));
    assert.deepEqual(readFileSync(source), sourceBytes);
  });

  test(`inspect reports coherent read-only metrics for ${fixture.id}`, (t) => {
    const directory = createDirectory(t, `alpha-binary-reference-inspect-${fixture.id}-`);
    const source = fixturePath(fixture);
    const sourceBytes = readFileSync(source);
    const beforeDirectory = readdirSync(REFERENCE_DIRECTORY).sort();
    const beforeTemporary = readdirSync(directory).sort();

    const text = runCli(['inspect', source]);
    const json = runCli(['inspect', source, '--json']);

    assert.equal(text.status, 0, text.stderr);
    assert.equal(text.stderr, '');
    assert.equal(json.status, 0, json.stderr);
    assert.equal(json.stderr, '');

    const parsedText = parseInspectText(text.stdout);
    const parsedJson = JSON.parse(json.stdout);

    assert.deepEqual(
      {
        source: parsedText.source,
        width: parsedText.width,
        height: parsedText.height,
        total: parsedText.total,
        alpha: parsedText.alpha,
        isolatedOpaque: parsedText.isolatedOpaque,
        ratios: parsedText.ratios,
        physical: parsedText.physical,
      },
      parsedJson,
    );
    assert.equal(parsedJson.source, source);
    assert.equal(
      parsedJson.alpha.zero + parsedJson.alpha.full + parsedJson.alpha.intermediate,
      parsedJson.total,
    );
    assert.equal(
      parsedJson.alpha.zero + parsedJson.alpha.full + parsedJson.alpha.intermediate,
      parsedJson.width * parsedJson.height,
    );
    assert.equal(parsedJson.isolatedOpaque, fixture.inspectionExpectation.isolatedOpaque);
    assert.deepEqual(parsedJson.ratios, fixture.inspectionExpectation.ratios);

    assert.deepEqual(readFileSync(source), sourceBytes);
    assert.deepEqual(readdirSync(REFERENCE_DIRECTORY).sort(), beforeDirectory);
    assert.deepEqual(readdirSync(directory).sort(), beforeTemporary);
    assert.equal(existsSync(join(directory, basename(source))), false);
  });
}
