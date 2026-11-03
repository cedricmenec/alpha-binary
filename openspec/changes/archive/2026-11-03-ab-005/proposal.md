# Proposal

## Why

AB-005 must let an explicit uniform background color become transparent alpha coverage before AB-004's Bayer dithering. Without this step, a uniform opaque background would remain opaque through conversion, and an implicit background-removal guess would risk deleting content the caller did not request.

## What Changes

- Add a Core in-memory operation that removes a uniform background only when both a background RGB color and a tolerance are supplied explicitly.
- Document a deterministic per-channel matching rule: a pixel matches when every red, green, and blue absolute difference from the supplied color is less than or equal to the tolerance.
- Define tolerance as an integer from 0 through 255 in 8-bit decoded channel-level units, where 0 requires an exact RGB match.
- Set the alpha byte of each matching pixel to 0 while preserving its RGB bytes and every byte of nonmatching pixels.
- Preserve dimensions, existing physical resolution, and the input image; return a new in-memory image.
- Leave every pixel unchanged when no background options are supplied, and reject incomplete or out-of-range options with a stable diagnostic instead of guessing.
- Add deterministic `node:test` coverage for a match, a nonmatch, the chosen tolerance boundary, the no-options case, and composition with Bayer dithering.
- Keep the CLI command surface, file access, and workflow changes out of scope; AB-006 will expose the option.

## Capabilities

### New Capabilities

- `uniform-background-removal`: Explicit, deterministic conversion of matching uniform-background pixels to transparent alpha coverage before dithering.

### Modified Capabilities

- None.

## Impact

- New Core background-removal code, export, and tests under `src/core/` and `test/`.
- Depends on the AB-003 RGBA image shape and AB-004 Bayer operation; no new runtime dependency, CLI command, file access, workflow, configuration, backlog, or publication change.
- AB-006 remains responsible for parsing CLI options and composing decoding, background removal, dithering, and encoding.

## Unresolved Requirements

- The AB-005 task leaves the tolerance metric open. The plan adopts an inclusive per-channel absolute-difference rule with an integer tolerance from 0 through 255 in 8-bit channel-level units; this is a recorded planning assumption, not a product decision.
- The task does not specify how incomplete or out-of-range options behave. The plan rejects them with a stable diagnostic rather than silently applying a partial or unbounded rule.
- The task does not specify whether RGB bytes under pixels made transparent should be preserved or cleared. The plan preserves all RGB bytes and changes only matching alpha bytes.
- The task does not define CLI option names or syntax. The plan exposes only a Core operation; AB-006 owns the user-facing option.
- The task does not define semantic or non-uniform cutout behavior. The plan compares only uniform RGB values and does not inspect edges, connected regions, or image semantics.
