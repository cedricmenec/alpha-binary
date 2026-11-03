# Proposal

## Why

AB-002 through AB-007 delivered a working CLI and Core, but the prototype has no documented end-to-end acceptance corpus and no short procedure for running it from a GitHub checkout. AB-008 closes that gap with small reference PNGs, read-only acceptance tests, and honest usage documentation.

## What Changes

- Establish a reference acceptance corpus containing the A-001 trial and two small PNG fixtures: one uniform-background fixture and one partial-alpha fixture.
- Add deterministic end-to-end acceptance tests that run `convert` and `inspect` against the reference fixtures and check conversion, binary transparency, determinism across separate processes, metrics, and source immutability.
- Keep the acceptance tests inside the existing `npm run check` path so local validation needs no paid service.
- Document how to run the CLI from a GitHub source checkout, including prerequisites, direct and script invocation, the `convert` and `inspect` commands, text and JSON output formats, exit-code categories, and prototype limits.
- State the limits honestly: metrics are potential-fragility indicators, output is not claimed to be print-ready, and no resize, crop, AI cutout, remote service, or package publication is part of the prototype.
- Record the unavailable A-001 reference definition as an unresolved requirement instead of inventing its pixels, expected values, or acceptance criteria.

## Capabilities

### New Capabilities

- `prototype-validation`: Defines the reference acceptance corpus and the repeatable end-to-end checks that validate conversion, binary transparency, determinism, metrics, and source immutability.
- `usage-documentation`: Defines the user-facing GitHub source-execution procedure, command documentation, output-format documentation, and explicit prototype limits.

### Modified Capabilities

- None.

## Impact

- New reference fixtures and deterministic `node:test` acceptance coverage under `test/`.
- `README.md` becomes the short usage entry point for running and evaluating the prototype from source.
- No change to Core algorithms, CLI behavior, package visibility, dependencies, workflows, configuration, backlog, publication, or archive state.
- No paid service or network access is required for any planned check.

## Unresolved Requirements

- The repository and AB-008 task do not define the A-001 trial: its source image, dimensions, pixels, or expected results are absent. This plan does not invent them. Apply must stop and report this unresolved requirement unless the A-001 fixture and its expected outcomes are supplied; no substitute image or self-invented expectation may be used.
- AB-008 does not prescribe exact filenames, colors, or dimensions for the two small fixtures. The plan treats their exact content as implementation choices recorded in `design.md`, as long as one fixture has a uniform background and the other has partial alpha and both remain small and deterministic.
- AB-008 does not prescribe a documentation file layout. The plan uses `README.md` as the canonical entry point rather than adding a documentation framework or a new site.
- These are planning assumptions, not product decisions. If an unresolved requirement or forbidden file blocks progress during apply, stop and report instead of inventing behavior or marking the task complete.
