# Tasks

## 1. Core alpha dithering

- [x] 1.1 Add a Core `ditherAlphaBayer8(image)` operation that accepts the AB-003 image shape and returns a new image without mutating the input; verify with `node --test` that GIVEN an input image with width, height, pixels, and physicalResolution, WHEN the operation is called, THEN the result has the same dimensions and physicalResolution and the input bytes are unchanged.
- [x] 1.2 Implement the standard Bayer 8 × 8 matrix anchored at pixel (0, 0) and set each output alpha to 0 or 255 using the midpoint threshold; verify with `node --test` that GIVEN a uniform alpha-128 8 × 8 image, WHEN it is dithered, THEN the output matches the expected alternating pattern derived from matrix values 0–31 and 32–63.
- [x] 1.3 Preserve RGB bytes for every pixel and keep input alpha 0 at 0 and input alpha 255 at 255; verify with `node --test` that GIVEN distinct opaque RGB values and fully transparent pixels, WHEN dithered, THEN opaque RGB and alpha 255 are unchanged and transparent alpha remains 0.
- [x] 1.4 Export the operation from the Core entry point while keeping existing exports; verify with a spawned Node.js process that GIVEN an import of the Core entry point, WHEN the dithering operation is called with an in-memory image, THEN it succeeds with empty standard output and standard error and without loading the CLI.

## 2. Binary counts, determinism, and metadata

- [x] 2.1 Add alpha-count assertions across the full input range; verify with `node --test` that GIVEN an image containing alpha values 0 through 255 including intermediate values, WHEN dithered, THEN every output alpha is 0 or 255, the counts of 0 and 255 sum to width × height, and the intermediate count is zero.
- [x] 2.2 Add repeated-call and separate-process determinism assertions; verify with `node --test` that GIVEN identical images, WHEN dithering runs repeatedly and in separate Node.js processes, THEN the returned dimensions and pixel bytes are byte-identical each time.
- [x] 2.3 Add metadata-preservation assertions for present and absent physical resolution; verify with `node --test` that GIVEN an image with physicalResolution and an image without it, WHEN each is dithered, THEN the first keeps the same declaration and the second gains none.

## 3. Integration checks

- [x] 3.1 Run `npm test` and then `npm run check`; verify all Core, PNG, dithering, CLI, and bootstrap checks pass without paid services.
- [x] 3.2 Confirm no runtime dependency, CLI command, file access, workflow, configuration, backlog, or publication change was introduced and that only the fixed Bayer operation is exposed with no algorithm selector; verify `npm ls --depth=0`, `git diff --stat`, the Core export list, and the function's accepted arguments.

## Unresolved requirements

- AB-004 does not specify the Bayer matrix orientation or phase. The plan adopts the standard matrix anchored at pixel (0, 0); a different product decision would require revised spec scenarios and tests before apply.
- AB-004 does not specify whether RGB bytes under pixels made transparent should be preserved or cleared. The plan preserves them and rewrites only alpha.
- The public Core function name and options surface are not defined by AB-004. The plan uses one fixed operation with no algorithm selector; the user-facing command remains deferred to AB-006.
- Diagnostics for malformed image objects are not defined by AB-004. The plan assumes the AB-003 decoded-image shape and does not invent a new error contract.
- No implementation task is marked complete until its stated verification runs successfully during apply.

## Manual acceptance

The following are human or visual acceptance checks and are not evidence that they were performed. This section has no checkboxes and does not contribute to implementation progress.

- Open a dithered semi-transparent PNG at 1:1 zoom in an image viewer and visually confirm the ordered 8 × 8 pattern, with only fully transparent or fully opaque pixels.
- Compare opaque regions before and after dithering with a color picker or visual inspection and confirm the colors are unchanged.
- Confirm the dither pattern is stable and anchored at the top-left tile rather than looking random or offset.
- Inspect the output alpha values with a viewer or local diagnostic tool and confirm that no intermediate alpha values are visible.
- Confirm the Core operation can be exercised from a local Node.js script without a CLI command, file path, or remote service.

## Post-sync review

The following are post-sync and publication steps, not completed work and not evidence that human checks occurred. This section has no checkboxes.

- Compare the synced main `alpha-dithering` spec with this delta and confirm every requirement and scenario is preserved.
- Archive the change only after the project's review requirements are satisfied.
- Verify independent GitHub PR CI at the exact head SHA of the pull request.
- Perform merge review without inferring approval from checked-in files, this task list, or the plan itself.
