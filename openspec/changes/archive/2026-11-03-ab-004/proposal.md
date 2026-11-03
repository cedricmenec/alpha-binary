# Proposal

## Why

AB-004 must turn continuous alpha coverage from AB-003 into deterministic binary transparency in the reusable Core. Without this step, the later `convert` command cannot produce PNG output whose alpha is limited to 0 or 255, and conversion logic would risk leaking into the CLI or filesystem layers.

## What Changes

- Add a Core operation that applies ordered Bayer 8 × 8 dithering to an in-memory RGBA image and returns a new image whose alpha values are only 0 or 255.
- Preserve dimensions, RGB channel values, and any existing physical-resolution declaration; only the alpha channel is thresholded.
- Make the result deterministic for the same pixels, dimensions, and options, and keep Bayer 8 × 8 as the only prototype algorithm.
- Add deterministic `node:test` coverage for the threshold pattern, binary alpha counts, determinism, opaque-color preservation, fully transparent pixels, dimensions, physical resolution, and Core independence from the CLI, files, and remote services.
- Keep file access and the user-facing command surface out of this change; `convert` remains AB-006.

## Capabilities

### New Capabilities

- `alpha-dithering`: Deterministic ordered Bayer 8 × 8 conversion of RGBA alpha coverage into binary transparency inside the Core.

### Modified Capabilities

- None.

## Impact

- New Core dithering code and tests under `src/core/` and `test/`.
- Depends on the RGBA image shape and PNG primitives delivered by AB-003; no new runtime dependency, CLI command, workflow, configuration, backlog, or publication change.
- Existing Core exports, PNG decoding/encoding, CLI help, and `npm run check` remain unchanged except for the added tests.

## Unresolved Requirements

- AB-004 does not specify the Bayer matrix orientation or phase. The plan adopts the standard 8 × 8 Bayer matrix anchored at pixel (0, 0) with midpoint thresholds; this is a recorded planning assumption, not a product decision.
- AB-004 does not specify whether RGB bytes under pixels made transparent should be preserved or cleared. The plan preserves all RGB bytes and changes only the alpha channel.
- The public Core function name and whether dithering accepts options are not defined by the task. The plan proposes one fixed operation with no algorithm selector; the final command surface remains deferred to AB-006.
- AB-004 does not define diagnostics for malformed image objects. The plan assumes inputs follow the AB-003 decoded-image shape and does not invent a new error contract; AB-003's encoder still validates before PNG output.
