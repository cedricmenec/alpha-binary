# Tasks

## 1. Core background-removal operation

- [x] 1.1 Add a Core `removeUniformBackground(image, options)` operation and export it from the Core entry point while keeping existing exports; verify with `node --test` that GIVEN an image with width, height, pixels, and physicalResolution, WHEN the operation is called with valid options, THEN it returns a new image with the same dimensions and physicalResolution and the input bytes and object are unchanged.
- [x] 1.2 Implement explicit activation and the no-options no-op; verify with `node --test` that GIVEN an image containing opaque pixels that equal a likely background color, WHEN the operation is called without options, THEN every output pixel equals the input pixel and no opaque pixel becomes transparent, and that GIVEN complete color and tolerance options, WHEN called, THEN the removal rule is applied.
- [x] 1.3 Implement the inclusive per-channel absolute-difference rule with an integer tolerance from 0 through 255 in 8-bit channel-level units; verify with `node --test` that GIVEN an exact RGB match at tolerance 0, a channel difference exactly equal to tolerance 10, a pixel with one channel difference above tolerance, and pixels with equal RGB but different alpha, WHEN the operation runs, THEN the expected pixels match regardless of alpha and the out-of-tolerance pixel does not match.
- [x] 1.4 Set only the alpha byte of matching pixels to 0 while preserving their RGB bytes; verify with `node --test` that GIVEN matching pixels with distinct RGB values, WHEN removal runs, THEN each matching pixel has alpha 0 and its RGB bytes equal the input bytes.
- [x] 1.5 Reject incomplete or out-of-range options with a stable background-options diagnostic and no image; verify with `node --test` that GIVEN a missing color, a missing tolerance, a color component below 0 or above 255, or a tolerance below 0 or above 255, WHEN the operation is called, THEN each request reports the stable diagnostic and returns no image.

## 2. Composition with Bayer dithering and determinism

- [x] 2.1 Add composition coverage with the AB-004 dithering operation; verify with `node --test` that GIVEN matching background pixels and nonmatching semi-transparent pixels, WHEN background removal runs before Bayer dithering, THEN every background pixel has final alpha 0, nonmatching semi-transparent pixels follow the Bayer rule, and every final alpha is 0 or 255.
- [x] 2.2 Add repeated-call and separate-process determinism assertions; verify with `node --test` that GIVEN identical images and valid options, WHEN background removal runs repeatedly and in a separate Node.js process, THEN the returned dimensions and pixel bytes are byte-identical each time and the input image remains unchanged.
- [x] 2.3 Add an in-memory side-effect check; verify with a spawned Node.js process that GIVEN an import of the Core entry point, WHEN background removal is called with an in-memory image and valid options, THEN it succeeds with empty standard output and standard error and without loading the CLI.

## 3. Integration checks

- [x] 3.1 Run `npm test` and then `npm run check`; verify all Core, PNG, dithering, background-removal, CLI, and bootstrap checks pass without paid services.
- [x] 3.2 Confirm no runtime dependency, CLI command, file access, workflow, configuration, backlog, or publication change was introduced and that only the uniform RGB comparison is exposed with no semantic-cutout behavior; verify `npm ls --depth=0`, `git diff --stat`, the Core export list, and the operation's accepted arguments and options.

## Unresolved requirements

- AB-005 leaves the tolerance metric open. The plan adopts an inclusive per-channel absolute-difference rule with an integer tolerance from 0 through 255 in 8-bit channel-level units; a different product decision would require revised spec scenarios and tests before apply.
- AB-005 does not specify incomplete or out-of-range option behavior. The plan rejects them with a stable background-options diagnostic rather than silently applying a partial or unbounded rule.
- AB-005 does not specify whether RGB bytes under matching pixels should be preserved or cleared. The plan preserves them and rewrites only matching alpha bytes.
- AB-005 does not define CLI option names or syntax. The plan exposes only a Core operation; AB-006 owns the user-facing option.
- AB-005 excludes semantic cutout and non-uniform background handling. The plan compares only uniform RGB values and adds no edge, connected-region, or flood-fill behavior.
- No implementation task is marked complete until its stated verification runs successfully during apply.

## Manual acceptance

The following are human or visual acceptance checks and are not evidence that they were performed. This section has no checkboxes and does not contribute to implementation progress.

- Run background removal followed by dithering on a representative PNG with a uniform background and inspect it at 1:1 zoom; confirm the intended background is fully transparent and the remaining content is visually intact.
- Compare the same image with and without the explicit color and tolerance options; confirm that no opaque region is removed when the options are absent.
- Inspect pixels near the chosen tolerance boundary with a local script or image tool and confirm that colors just inside the tolerance are removed while colors just outside remain.
- Confirm that nonmatching semi-transparent regions still show the Bayer pattern rather than being removed uniformly.
- Inspect the final alpha channel and confirm that only 0 and 255 are present.
- Confirm the Core operation can be exercised from a local Node.js script without a CLI command, file path, or remote service.

## Post-sync review

The following are post-sync and publication steps, not completed work and not evidence that human checks occurred. This section has no checkboxes.

- Compare the synced main `uniform-background-removal` spec with this delta and confirm every requirement and scenario is preserved.
- Archive the change only after the project's review requirements are satisfied.
- Verify independent GitHub PR CI at the exact head SHA of the pull request.
- Perform merge review without inferring approval from checked-in files, this task list, or the plan itself.
