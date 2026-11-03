# Tasks

Checkboxes below cover only changes and deterministic checks that can be completed during apply before semantic sync, archive, and publication. No box is marked complete until its stated verification actually passes.

## 1. Command surface and option parsing

- [x] 1.1 Add `convert` dispatch to the CLI with exactly two positional paths and the `--json`, `--overwrite`, `--background`, and `--tolerance` options; verify with `node --test test/convert-cli.test.js` that GIVEN a readable source and a distinct new output, WHEN `convert` runs, THEN it exits 0, creates the output, and leaves the source bytes unchanged.
- [x] 1.2 Implement strict option validation for unknown or duplicate options, missing option values, missing or extra positional paths, a background/tolerance pair with only one value, background values that are not six hexadecimal digits with an optional leading `#`, and tolerances outside the integer range 0 through 255; verify with `node --test test/convert-cli.test.js` that GIVEN each invalid invocation, WHEN arguments are parsed, THEN it reports an invocation error, exits 2, and creates no output.
- [x] 1.3 Keep Bayer 8 × 8 as the only algorithm by rejecting algorithm-selection options and by applying the fixed Core dithering operation without any selector; verify with `node --test test/convert-cli.test.js` that GIVEN a conversion without an algorithm option, WHEN it succeeds, THEN every output alpha is 0 or 255, and that GIVEN an algorithm option, WHEN parsed, THEN it exits 2 without writing.
- [x] 1.4 Update top-level help and add `convert --help`; verify with `node --test test/cli.test.js test/convert-cli.test.js` that GIVEN the CLI, WHEN the user runs `--help` or `convert --help`, THEN the output advertises `convert` and its usage, never advertises `inspect`, and exits 0.

## 2. Conversion pipeline and output safety

- [x] 2.1 Compose source reading, optional background removal, fixed Bayer dithering, and output writing in that order; verify with `node --test test/convert-cli.test.js` that GIVEN a semi-transparent source and no background options, WHEN `convert` succeeds, THEN the reread output contains only alpha 0 and 255 and intermediate-alpha count zero.
- [x] 2.2 Implement explicit background removal only when both background color and tolerance are supplied, using the existing per-channel rule before dithering; verify with `node --test test/convert-cli.test.js` that GIVEN matching background pixels and nonmatching semi-transparent pixels, WHEN both options are supplied, THEN matching pixels have final alpha 0 and nonmatching pixels follow Bayer, and that GIVEN no background options, THEN every pixel remains unchanged before dithering.
- [x] 2.3 Preserve the source and dimensions and carry through an existing physical-resolution declaration without inventing one; verify with `node --test test/convert-cli.test.js` that GIVEN source PNGs with and without `pHYs`, WHEN converted, THEN the source bytes are unchanged, dimensions match, the existing declaration is preserved, and no declaration is added.
- [x] 2.4 Enforce distinct source and output identity and refuse an existing output by default, with explicit overwrite replacing only the output; verify with `node --test test/convert-cli.test.js` that GIVEN same-path, symbolic-link, hard-link, and existing-output cases, WHEN converting without overwrite, THEN it exits 3 and changes neither source nor existing output, and that GIVEN explicit overwrite, WHEN the output exists, THEN only the output is replaced.
- [x] 2.5 Reread the written output and verify dimensions and binary alpha before reporting success, including a testable control seam for the failure path; verify with `node --test test/convert-cli.test.js` that GIVEN a controlled output with an intermediate alpha value or mismatched dimensions, WHEN control runs, THEN it reports a processing failure, exits 3, and prints no success diagnostic.

## 3. Diagnostics and exit codes

- [x] 3.1 Add readable text success and failure diagnostics, with failure diagnostics naming the stable code and affected path when available and containing no stack trace; verify with `node --test test/convert-cli.test.js` that GIVEN success, WHEN run without `--json`, THEN standard output lists source, output, dimensions, algorithm, and alpha counts with empty standard error, and that GIVEN failure, THEN standard error carries the code and message with no success output.
- [x] 3.2 Add the JSON success and error shapes and emit a single JSON object only when `--json` is supplied; verify with `node --test test/convert-cli.test.js` that GIVEN success, WHEN run with `--json`, THEN standard output parses to the documented success object with `backgroundRemoval: null` or the applied color/tolerance and alpha zero/full/intermediate counts, and that GIVEN failure, THEN standard error parses to an error object with code, message, and optional path.
- [x] 3.3 Map verified success to exit code 0, invocation/option errors to 2, and source, decode, background, encode, write, output-collision, or verification failures to 3; verify with spawned `node bin/alpha-binary.js convert` tests that GIVEN each category, WHEN the process completes, THEN the exit code matches and no failure returns 0.
- [x] 3.4 Ensure diagnostics do not claim print readiness and that resize, crop, AI-cutout, algorithm, and remote-service options are not exposed; verify with `node --test test/convert-cli.test.js` that GIVEN success output, WHEN inspected, THEN it contains no print-ready claim and dimensions equal the source, and that GIVEN each excluded option, WHEN parsed, THEN it exits 2 without writing.

## 4. Integration checks

- [x] 4.1 Run `npm test` and then `npm run check`; verify all existing Core, PNG, dithering, background-removal, CLI, new convert, and bootstrap checks pass without paid services.
- [x] 4.2 Confirm the change adds no runtime dependency, keeps `package.json` private with no publish script, leaves workflows/configuration/backlog/archive untouched, and limits product behavior to the `convert` command; verify `npm ls --depth=0`, `git diff --stat`, `openspec status --change ab-006`, and the CLI help output.

## Unresolved requirements

- AB-006 does not define command option spelling. The plan uses `--json`, `--overwrite`, `--background <hex>`, and `--tolerance <0-255>`, with a six-digit hexadecimal background value that may carry a leading `#`; a different product decision requires revised spec scenarios and tests before apply.
- AB-006 does not define whether overwrite is exposed. The plan exposes an explicit `--overwrite` opt-in while keeping refusal as the default.
- AB-006 does not define numeric exit codes beyond requiring explicit codes. The plan uses 0 for success, 2 for invocation or option errors, and 3 for source, output, encoding, verification, or other processing failures.
- AB-006 does not define the text or JSON diagnostic schema. The plan uses a minimal success schema with source, output, dimensions, algorithm, optional background removal, and alpha counts, and an error schema with a stable code, message, and optional path.
- AB-006 does not define how the produced file is controlled beyond being readable. The plan rereads the written output and reports a processing failure if dimensions differ or any intermediate alpha value is present.
- These are recorded planning assumptions, not product decisions. If a forbidden file or an unresolved requirement blocks progress, stop and report instead of inventing behavior.
- No implementation task is marked complete until its stated verification runs successfully during apply. Test failures should be fixed in the same authorized invocation when possible, target checks rerun, and no paid invocation or automatic retry launched.

## Manual acceptance

The following are human or visual acceptance checks and are not evidence that they were performed. This section has no checkboxes and does not contribute to implementation progress.

- Run `convert` on a representative PNG with a uniform background, open the output in an image viewer at 1:1 zoom, and visually confirm the intended binary transparency, preserved dimensions, and visually intact remaining content.
- Run the same conversion with explicit background color and tolerance, then compare it with the no-background-removal result and visually confirm the selected background is removed and nonmatching regions are not.
- Open the source and output side by side and confirm the source has not been modified, resized, cropped, or recolored outside the intended alpha change.
- Read the default text output and the `--json` output for the same conversion and confirm the paths, dimensions, algorithm, and alpha counts agree and are understandable.
- Trigger a missing-source error, an existing-output refusal, a same-path refusal, and an invalid option, and confirm the text and JSON diagnostics are readable, include stable codes, and report the expected exit codes.
- Confirm no diagnostic or help text presents the result as ready to print.

## Post-sync review

The following are post-sync and publication steps, not completed work and not evidence that human checks occurred. This section has no checkboxes.

- Compare the synced main `cli-interface` spec with this delta and confirm every added requirement and scenario is preserved.
- Archive the change only after the project's review requirements are satisfied.
- Verify independent GitHub PR CI at the exact head SHA of the pull request.
- Perform merge review without inferring approval from checked-in files, this task list, or the plan itself.
