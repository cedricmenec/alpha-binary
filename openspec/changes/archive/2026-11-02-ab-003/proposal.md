# Proposal

## Why

AB-003 must establish trustworthy PNG input and output primitives before dithering and the `convert` command are built. Without this boundary, later processing could silently crop, resize, recolor, or overwrite the source image, undermining both conversion results and diagnostics.

## What Changes

- Add a dependency-free Core PNG decoder that turns PNG bytes into RGBA pixels plus usable dimensions.
- Add a dependency-free Core PNG encoder that turns an RGBA image into a valid PNG.
- Preserve decoded color values, dimensions, and an existing `pHYs` physical-resolution declaration without inventing metadata.
- Add CLI-only file primitives that read a source PNG and write to a distinct output path without exposing file access in the Core.
- Refuse to overwrite the source unconditionally and refuse an existing output path by default.
- Report invalid input, read failures, and write failures with clear diagnostics and no successful result.
- Add deterministic `node:test` coverage for the Core codec and CLI file boundary.

No new public CLI command is added in this change. The final `convert` command surface belongs to AB-006, so the file primitives remain reusable CLI building blocks and the current help output stays honest.

## Capabilities

### New Capabilities

- `png-io`: Safe PNG decoding, encoding, and CLI-facing file I/O primitives that preserve pixels, dimensions, and existing physical resolution.

### Modified Capabilities

- None.

## Impact

- New Core codec code and CLI file-adapter code under the existing source layout, plus tests under `test/`.
- No runtime dependency, package publication, workflow, OpenSpec configuration, backlog, or CLI help change.
- Existing Core/CLI boundaries and `npm run check` remain unchanged; new tests run through the existing `npm test` hook.

## Unresolved Requirements

- AB-003 does not define the full set of PNG variants that must be accepted. Until a product decision confirms 16-bit, Adam7-interlaced, and ancillary-metadata requirements, the design targets non-interlaced 8-bit PNG color types 0, 2, 3, 4, and 6, and must reject other valid but unsupported variants with a clear diagnostic rather than claim success.
- AB-003 does not define command or flag names for PNG input/output. This change provides CLI module primitives only; exposing them through a user-facing command is deferred to AB-006.
- Preservation of metadata other than `pHYs` is not specified. The design preserves `pHYs` only when present and does not invent resolution or copy unrelated ancillary chunks.