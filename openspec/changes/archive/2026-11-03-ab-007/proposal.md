# Proposal

## Why

AB-006 makes it possible to produce a binary-alpha PNG, but an agent cannot yet measure what it produced. AB-007 adds a read-only `inspect` command and a reusable metrics computation so alpha distribution, fragile isolated opaque pixels, and optional physical pixel size can be observed without writing or transforming the source.

## What Changes

- Add `alpha-binary inspect <source.png> [options]` as a read-only diagnostic command that never writes, rewrites, or transforms the source.
- Report total pixel count, alpha-0 count, alpha-255 count, and alpha-1-to-254 count; the three alpha buckets MUST sum to the total.
- Report the number of isolated opaque pixels, defined as an opaque (alpha 255) connected component of size exactly one under an 8-direction neighborhood.
- Report the exact ratios isolated/opaque and isolated/total, with isolated/opaque reported as N/A when there is no opaque pixel.
- Compute a physical pixel size only when the user explicitly supplies a printed width; otherwise report the physical size as not computed.
- Support readable text output and a coherent `--json` output for the same analysis.
- Present these metrics as indicators of potential fragility, never as a print-certification or print-readiness claim.
- Advertise `inspect` in CLI help and add `inspect --help`; keep the existing `convert` contract unchanged.
- Do not extend the prototype to component-size counting other than size one.

## Capabilities

### New Capabilities

- `alpha-metrics`: Reusable, deterministic, in-memory measurement of alpha buckets, isolated opaque pixels, their ratios, and an optional physical pixel size from an explicit printed width.

### Modified Capabilities

- `cli-interface`: Adds the `inspect` command surface, its read-only guarantee, its text/JSON diagnostics, its exit-code behavior, and its help advertising.

## Impact

- New Core metrics module and exports under `src/core/`, consumed by a new CLI command module under `src/cli/`.
- CLI dispatch and help in `src/cli/index.js`; existing help tests that assert `inspect` is absent must be updated.
- New deterministic `node:test` coverage under `test/`, reusing the existing in-memory PNG fixtures and temporary directories; no new runtime dependency.
- Reads through the existing `readPngFile` primitive only; no write primitive is called by `inspect`.
- No change to `convert`, the Core dithering/background/PNG codec contracts, package visibility, workflows, configuration, backlog, publication, or archive state.

## Unresolved Requirements

- AB-007 does not define the CLI spelling or units for the printed width. The plan uses `--printed-width <millimetres>` as a positive finite decimal number; the physical pixel size is printed width divided by image width in millimetres per pixel. A different decision requires revised spec scenarios and tests.
- AB-007 does not define rounding or precision for the physical pixel size or the ratios. The plan reports the computed values at full JavaScript number precision and leaves formatting to the text renderer.
- AB-007 does not define the JSON schema. The plan uses a stable object with `source`, `width`, `height`, `total`, `alpha` (`zero`, `full`, `intermediate`), `isolatedOpaque`, `ratios` (`isolatedToOpaque`, `isolatedToTotal`), and `physical` (`printedWidth`, `millimetresPerPixel`) where non-computable values are `null`.
- AB-007 does not define exit codes for `inspect`. The plan uses 0 for a completed analysis, 2 for invocation or option errors, and 3 for source read or decode failures, matching the existing `convert` categories.
- AB-007 does not define whether a printed width alone is sufficient without a printed height. The plan computes a single square-pixel size from the printed width and image width only, as required by the task, and does not infer aspect or vertical size.
- AB-007 does not define how N/A appears in text. The plan prints `N/A` for the isolated/opaque ratio when no opaque pixel exists and `not computed` for physical size when no printed width is supplied.
- These are recorded planning assumptions, not product decisions. The implementation must not silently expand scope beyond one backlog task.
