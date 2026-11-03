# Design

## Context

See `proposal.md` - Why. AB-003 provides the in-memory image shape `{ width, height, pixels, physicalResolution? }`, where `pixels` is a row-major 8-bit RGBA `Uint8Array`. AB-004 provides `ditherAlphaBayer8(image)`, which preserves input alpha 0 and dithers other coverage. AB-005 adds the preceding background-removal step only in the Core; AB-006 remains the first change that exposes it through the CLI. If the AB-003 or AB-004 primitives are absent when implementation starts, this change is blocked rather than duplicating them.

## Goals / Non-Goals

**Goals:**

- Add one pure, deterministic Core operation that converts matching uniform-background pixels to alpha 0.
- Make activation explicit and make the matching rule, tolerance range, and tolerance unit unambiguous.
- Preserve nonmatching pixels, dimensions, RGB bytes, and existing physical resolution without mutating the input.
- Prove through direct tests and composition with Bayer dithering that matching pixels contribute zero alpha before thresholding.

**Non-Goals:**

- Adding a CLI command, option parser, file I/O, or PNG codec changes.
- Semantic cutout, edge detection, flood fill, connected-component analysis, anti-aliased edge handling, or multiple background samples.
- Changing the Bayer algorithm, adding another dithering algorithm, or changing AB-004 behavior.
- Defining the AB-006 CLI spelling, diagnostics format, or conversion command.

## Decisions

### Separate pure Core operation: `removeUniformBackground(image, options)`

Add a Core function that accepts the AB-003 image shape and returns a new object with the same `width`, `height`, a new RGBA `pixels` buffer, and the same `physicalResolution` when present. It does not mutate the input. AB-006 composes `removeUniformBackground` before `ditherAlphaBayer8`; AB-005 does not add background options to the AB-004 dithering function.

Alternative considered: extend `ditherAlphaBayer8` with a background option. Rejected because AB-004 deliberately exposes no options or algorithm selector, and a separate operation keeps the two behaviors independently testable and composable.

### Options shape and explicit activation

The operation accepts `options` shaped as `{ color: { red, green, blue }, tolerance }`.

- `color.red`, `color.green`, and `color.blue` are integers from 0 through 255.
- `tolerance` is an integer from 0 through 255 in 8-bit decoded channel-level units.
- Calling the operation without `options` returns an unchanged copy, so no opaque pixel is removed by default.
- Supplying an options object that is incomplete or out of range throws an error with the stable code `BACKGROUND_INVALID_OPTIONS` and returns no image.

Alternative considered: silently treat partial options as inactive. Rejected because it would hide a malformed caller request and make the CLI harder to diagnose.

### Matching rule: inclusive per-channel absolute difference

A pixel matches only when all three conditions hold:

```text
abs(pixelRed   - color.red)   <= tolerance
abs(pixelGreen - color.green) <= tolerance
abs(pixelBlue  - color.blue)  <= tolerance
```

The comparison uses decoded, non-premultiplied 8-bit RGB values. Alpha does not participate in matching. A tolerance of 0 therefore means an exact RGB match; a channel difference exactly equal to the tolerance matches.

Alternative considered: Euclidean RGB distance. Rejected for this prototype because it requires an additional squared-distance scale decision and is less directly explainable to an agentic CLI caller than three independent channel limits.

Alternative considered: a percentage tolerance. Rejected because the decoded image already uses 8-bit channel levels and a channel-level integer is the most direct unit.

### Matching pixels become alpha 0 and keep RGB bytes

For each matching pixel, write only its alpha byte as 0; leave its red, green, and blue bytes unchanged. Because AB-004 leaves alpha 0 at 0, a subsequent Bayer pass leaves these pixels fully transparent. The operation returns a new buffer, so the caller can still compare the source image.

Alternative considered: clear RGB for matching pixels. Rejected because the task does not require it and preserving source color keeps the transformation limited to alpha coverage.

### Preserve dimensions, metadata, and nonmatching bytes

Copy all pixels first, then modify only matching alpha bytes. Keep `physicalResolution` only when the input carries it. The operation never adds or infers metadata.

### Tests cover the rule directly and in composition with Bayer

Add `node:test` cases that construct RGBA images directly and check exact match, nonmatch, boundary tolerance, tolerance 0, alpha independence, option validation, determinism, input immutability, and metadata preservation. Compose the operation with `ditherAlphaBayer8` to confirm matching pixels are alpha 0 in the final binary result while nonmatching semi-transparent pixels still follow the Bayer pattern. A spawned Node.js process verifies import and call behavior without CLI or file side effects.

Alternative considered: testing only through AB-006. Rejected because AB-006 is outside this change and the Core rule must be verifiable now.

## Risks / Trade-offs

- **Tolerance metric is a product decision not fixed by AB-005** -> Record the per-channel assumption in proposal, design, and spec; a future decision to use another metric requires revised scenarios and tests.
- **Boundary mistakes at tolerance 0 and at an exact channel difference equal to the tolerance** -> Test inclusive boundaries explicitly.
- **Matching pixels with existing semi-transparent alpha** -> Define that alpha is ignored for matching and matching pixels become alpha 0; test that case.
- **Partial options silently doing nothing** -> Reject incomplete or invalid options with `BACKGROUND_INVALID_OPTIONS` and test it.
- **Accidental input mutation** -> Allocate a new buffer, copy all bytes, and assert the input remains unchanged.
- **Scope creep into semantic cutout or edge cleanup** -> Limit matching to the uniform RGB rule and add no neighborhood or connected-region logic.
- **AB-003 or AB-004 dependency missing in the checkout** -> Treat the dependency as a prerequisite and block rather than reimplementing unrelated primitives.

## Migration Plan

Additive only. Introduce the Core operation, its export, and tests. No stored data, command behavior, or existing API migrates. Roll back by removing the new module, export, and tests.

## Open Questions

None blocking. The tolerance metric, option validation behavior, and RGB preservation under transparent pixels are planning assumptions recorded in the proposal because AB-005 leaves them unspecified. The CLI option spelling remains deferred to AB-006 and does not change the Core behavior specified here.
