# prototype-validation Specification

## Purpose

Defines a stable reference corpus and repeatable end-to-end acceptance checks so the prototype's conversion, binary transparency, determinism, metrics, and source-safety claims can be verified without paid services.

## Requirements

### Requirement: Reference corpus includes the A-001 trial and two small PNGs

The repository SHALL provide a reference acceptance corpus containing the A-001 trial plus two small PNG fixtures: one uniform-background fixture and one partial-alpha fixture. The A-001 fixture and its expected outcomes MUST come from the product framing; the project MUST NOT invent substitute pixels, expected values, or acceptance criteria.

#### Scenario: Reference corpus has the required entries

- **GIVEN** a completed reference corpus
- **WHEN** the fixtures are enumerated
- **THEN** the corpus contains the A-001 trial, a uniform-background PNG, and a partial-alpha PNG
- **AND** each entry is a decodable PNG

#### Scenario: Missing A-001 reference blocks the corpus

- **GIVEN** the product framing does not supply the A-001 fixture or its expected outcomes
- **WHEN** the reference corpus is assembled
- **THEN** apply stops and reports the A-001 requirement as unresolved
- **AND** no substitute image or self-invented expectation is added

### Requirement: Two small fixtures are deterministic and distinct

The uniform-background fixture SHALL contain one uniform opaque background color. The partial-alpha fixture SHALL contain alpha 0, alpha values from 1 through 254, and alpha 255. Both fixtures SHALL be small, byte-stable PNG files that can be decoded by the existing Core.

#### Scenario: Uniform-background fixture has one background color

- **GIVEN** the uniform-background fixture
- **WHEN** it is decoded
- **THEN** its pixels share one uniform opaque background color
- **AND** its width and height are small enough for a fast acceptance run

#### Scenario: Partial-alpha fixture spans alpha categories

- **GIVEN** the partial-alpha fixture
- **WHEN** it is decoded
- **THEN** at least one pixel has alpha 0
- **AND** at least one pixel has alpha 255
- **AND** at least one pixel has alpha from 1 through 254

### Requirement: Reference conversions are deterministic and preserve the source

For each available reference fixture, the acceptance suite SHALL run `convert` end to end, verify that the output keeps the fixture dimensions and contains only alpha 0 and 255, verify that two separate process runs produce byte-identical output, and verify that the fixture bytes remain unchanged.

#### Scenario: Converting a reference fixture produces binary alpha

- **GIVEN** a readable reference fixture with known bytes and dimensions
- **WHEN** the acceptance suite runs `convert` to a temporary output
- **THEN** the command succeeds
- **AND** the output has the same width and height as the fixture
- **AND** every output alpha is exactly 0 or 255
- **AND** the fixture bytes equal their original value

#### Scenario: Repeated reference conversion is byte-identical

- **GIVEN** the same reference fixture converted in two separate process runs
- **WHEN** the acceptance suite compares the produced PNG bytes
- **THEN** both outputs are byte-identical
- **AND** neither run modifies the fixture

### Requirement: Reference inspections are read-only and coherent

For each available reference fixture, the acceptance suite SHALL run `inspect` in text and JSON modes, verify that both forms report the same dimensions, alpha buckets, isolated opaque count, ratios, physical-size state, and source path, verify that the alpha buckets sum to the total, and verify that no file is created or modified.

#### Scenario: Reference inspection reports coherent metrics

- **GIVEN** a readable reference fixture
- **WHEN** the acceptance suite runs `inspect` once as text and once with `--json`
- **THEN** both runs succeed
- **AND** their dimensions, total, alpha buckets, isolated opaque count, ratios, and physical-size state agree
- **AND** the three alpha-bucket counts sum to the total

#### Scenario: Reference inspection leaves the fixture untouched

- **GIVEN** a readable reference fixture with known bytes
- **WHEN** the acceptance suite runs `inspect`
- **THEN** the fixture bytes equal their original value
- **AND** no analysis output file is created

### Requirement: Reference acceptance runs under the existing local check

The repository's existing `npm run check` command SHALL execute the reference acceptance tests together with the existing Core and CLI test suites. The reference acceptance checks MUST use only local files, temporary directories, and built-in Node.js capabilities, with no paid service or network access.

#### Scenario: Local check includes reference acceptance

- **GIVEN** a prepared checkout with the locked Node.js version and installed dependencies
- **WHEN** the contributor runs `npm run check`
- **THEN** the reference acceptance tests run
- **AND** the existing Core, CLI, and bootstrap checks still run
- **AND** the command exits with code 0 when all checks pass

#### Scenario: Reference acceptance failure stops the check

- **GIVEN** a reference acceptance check fails
- **WHEN** the contributor runs `npm run check`
- **THEN** the command exits with a non-zero code
- **AND** the bootstrap checks are not reported as successful
