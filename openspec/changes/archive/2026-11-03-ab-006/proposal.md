# Proposal

## Why

AB-006 must expose the already delivered PNG, background-removal, and Bayer-dithering primitives through one local `convert` command. Without that assembly, users can only call isolated Core functions and cannot reliably produce a binary-alpha PNG while keeping the source intact.

## What Changes

- Add `alpha-binary convert <source.png> <output.png>` as the only conversion command in the prototype.
- Require explicit, distinct source and output paths; refuse an output that identifies the source and refuse an existing output unless an explicit overwrite request is supplied.
- Always apply the fixed Core Bayer 8 × 8 dithering rule; expose no algorithm selector and no alternative dithering algorithm.
- Add optional explicit background removal through a background color and a tolerance that must be supplied together; without both, no background removal occurs.
- Compose the existing Core read, optional background-removal, Bayer-dithering, and PNG-write primitives without resizing, cropping, AI cutout, or any remote call.
- Preserve the source file, dimensions, and any existing physical-resolution declaration, and never invent resolution metadata.
- Reread the produced PNG for control and report only after its dimensions match the source and every alpha value is 0 or 255.
- Report success and failure in readable text by default or as JSON with `--json`, using stable diagnostic codes.
- Update CLI help so `convert` is advertised as available while `inspect` and other unfinished commands remain unadvertised.
- Do not claim that output is print-ready.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `cli-interface`: Adds the `convert` command contract, option validation, diagnostics, exit codes, and help inventory for the first conversion command.

## Impact

- CLI dispatch, option parsing, help text, and conversion orchestration under `src/cli/`.
- New or extended deterministic `node:test` coverage under `test/` using temporary directories and existing PNG fixtures.
- Reuses `readPngFile`, `writePngFile`, `removeUniformBackground`, `ditherAlphaBayer8`, `encodePng`, and `decodePng`; no new runtime dependency.
- No change to the Core algorithms, PNG codec behavior, package visibility, workflows, configuration, backlog, publication, or archive state.

## Unresolved Requirements

- AB-006 does not define command option spelling. The plan uses `--json`, `--overwrite`, `--background <hex>`, and `--tolerance <0-255>`, with a six-digit hexadecimal background value that may carry a leading `#`; a different spelling requires revised spec scenarios and tests.
- AB-006 does not define whether overwrite is exposed. The plan exposes an explicit `--overwrite` opt-in while keeping refusal as the default.
- AB-006 does not define numeric exit codes beyond requiring explicit codes. The plan uses 0 for success, 2 for invocation or option errors, and 3 for source, output, encoding, verification, or other processing failures.
- AB-006 does not define the text or JSON diagnostic schema. The plan records a minimal success schema with source, output, dimensions, algorithm, optional background removal, and alpha counts, and an error schema with a stable code, message, and optional path.
- AB-006 does not define how the produced file is controlled beyond being readable. The plan rereads the written output after writing and reports a processing failure if dimensions differ or any intermediate alpha value is present.
- These are recorded planning assumptions, not product decisions. The implementation must not silently expand scope beyond one backlog task.
