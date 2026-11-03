# Tasks

Checkboxes below cover only changes and deterministic checks that can be completed during apply before semantic sync, archive, and publication. No box is marked complete until its stated verification actually passes.

## 1. Core alpha metrics

- [x] 1.1 Add a new in-memory Core operation, exported from the Core entry point, that computes total, alpha-0, alpha-255, and alpha-1-to-254 counts from an image; verify with `node --test test/alpha-metrics.test.js` that GIVEN an image mixing alpha 0, alpha 255, and intermediate values, WHEN the operation runs, THEN total equals width × height and the three bucket counts sum exactly to total.
- [x] 1.2 Implement isolated opaque detection as an opaque pixel with no opaque pixel among its eight neighbors, excluding out-of-bounds positions; verify with `node --test test/alpha-metrics.test.js` that GIVEN a lone opaque pixel, WHEN compared with a pixel having a diagonal opaque neighbor and one having only intermediate-alpha neighbors, THEN only the lone pixel is counted as isolated.
- [x] 1.3 Compute the exact isolated-to-opaque and isolated-to-total ratios and represent isolated-to-opaque as N/A when the opaque count is zero; verify with `node --test test/alpha-metrics.test.js` that GIVEN known counts, WHEN the operation runs, THEN each ratio equals its exact quotient, and that GIVEN an image with no alpha-255 pixel, THEN isolated-to-opaque is N/A and isolated-to-total is zero.
- [x] 1.4 Compute physical pixel size only from an explicit positive finite printed width, using printed width divided by image width, and leave it not computed otherwise even when the image carries physical resolution; verify with `node --test test/alpha-metrics.test.js` that GIVEN a supplied printed width, WHEN the operation runs, THEN the physical size equals the quotient, and that GIVEN no printed width or a zero, negative, non-numeric, or non-finite value, THEN no size is inferred and an invalid value yields a stable diagnostic with no metrics.
- [x] 1.5 Keep the metrics operation deterministic, side-effect free, and non-mutating; verify with `node --test test/alpha-metrics.test.js` that GIVEN the same in-memory image, WHEN the operation runs repeatedly and in a separate Node.js process, THEN every result is identical, the input pixels are unchanged, and importing or calling the operation writes no standard output or standard error and reads no file or process argument.

## 2. Inspect command surface

- [x] 2.1 Add `inspect` dispatch to the CLI with exactly one positional source path and the `--printed-width <mm>`, `--json`, and `-h`/`--help` options, rejecting missing or extra positionals, unknown or duplicate options, missing option values, and invalid printed widths; verify with `node --test test/inspect-cli.test.js` that GIVEN each invalid invocation, WHEN arguments are parsed, THEN it reports an invocation error, exits 2, and performs no analysis.
- [x] 2.2 Read the source only through the existing read primitive and never call a write primitive or accept an output path; verify with `node --test test/inspect-cli.test.js` that GIVEN a readable source with known bytes, WHEN `inspect` succeeds, THEN the source bytes are unchanged and no analysis file is created, and that GIVEN an output, resize, crop, or algorithm option, WHEN parsed, THEN it exits 2 without writing.
- [x] 2.3 Render readable text metrics including source, dimensions, total, alpha 0, alpha 255, alpha intermediate, isolated opaque, isolated/opaque, isolated/total, and physical size, using `N/A` for a missing opaque ratio and `not computed` when no printed width was supplied; verify with `node --test test/inspect-cli.test.js` that GIVEN a mixed-alpha source, WHEN run without `--json`, THEN every metric appears, the alpha buckets sum to total, and standard error is empty.
- [x] 2.4 Render a single JSON object with `source`, `width`, `height`, `total`, `alpha` (`zero`, `full`, `intermediate`), `isolatedOpaque`, `ratios` (`isolatedToOpaque`, `isolatedToTotal`), and `physical`, using `null` for a non-computable ratio or physical size; verify with `node --test test/inspect-cli.test.js` that GIVEN the same source analysed as text and with `--json`, WHEN the results are compared, THEN every metric is semantically equal and the JSON parses as one object.
- [x] 2.5 Present metrics as potential fragility indicators and avoid any print-readiness or print-certification claim in text and JSON, and verify with `node --test test/inspect-cli.test.js` that GIVEN a successful inspection, WHEN the text and JSON outputs are inspected, THEN no output states that the image is ready to print or certified for printing and the JSON has no certification field.
- [x] 2.6 Return 0 for a completed analysis, 2 for invocation or option errors, and 3 for missing, unreadable, or invalid sources; emit text or JSON error diagnostics with a stable code, an optional path, and no stack trace; verify with spawned `node bin/alpha-binary.js inspect` tests that GIVEN each category, WHEN the process completes, THEN the exit code matches, the JSON error parses under `error` when `--json` is supplied, and no failure returns 0.
- [x] 2.7 Update top-level help to advertise `convert` and `inspect` and add `inspect --help` that shows only inspect usage and options; update existing help tests that assert `inspect` is absent; verify with `node --test test/cli.test.js test/inspect-cli.test.js` that GIVEN `--help`, WHEN read, THEN it lists both commands and no unavailable command, and that GIVEN `inspect --help`, THEN it exits 0 with only the inspect surface.

## 3. Integration checks

- [x] 3.1 Run `npm test` and then `npm run check`; verify that all existing Core, PNG, dithering, background-removal, convert, inspect, and bootstrap checks pass without paid services.
- [x] 3.2 Run `openspec validate --all --strict --no-interactive`; verify the change and every main spec pass strict validation with the full requirement and scenario set preserved.
- [x] 3.3 Confirm no runtime dependency was added, `package.json` stays private with no publish script, and `convert`, workflows, configuration, backlog, `AGENTS.md`, and archive state are unchanged; verify with `npm ls --depth=0`, `git diff --stat`, `git status --short`, `openspec status --change ab-007`, and the CLI help output.

## Unresolved requirements

- AB-007 does not define the CLI spelling or units for the printed width. The plan uses `--printed-width <millimetres>` as a positive finite decimal number; physical pixel size is printed width divided by image width. A different product decision requires revised spec scenarios and tests before apply.
- AB-007 does not define rounding or precision for physical size or ratios. The plan keeps full JavaScript number precision and formats only in the text renderer.
- AB-007 does not define the JSON schema. The plan uses the fields named in section 2.4, with `null` for non-computable values.
- AB-007 does not define `inspect` exit codes. The plan follows the existing `convert` categories: 0 success, 2 invocation/option error, 3 source read/decode failure.
- AB-007 does not define whether a printed height is needed. The plan derives a single square-pixel size from printed width and image width only.
- These are recorded planning assumptions, not product decisions. If a forbidden file or an unresolved requirement blocks progress, stop and report instead of inventing behavior.
- No implementation task is marked complete until its stated verification runs successfully during apply. Test failures should be fixed in the same authorized invocation when possible, target checks rerun, and no paid invocation or automatic retry launched.

## Manual acceptance

The following are human, visual, or real-environment acceptance checks and are not evidence that they were performed. This section has no checkboxes and does not contribute to implementation progress.

- Open a representative inspected PNG at 1:1 zoom in an image viewer and visually compare the reported isolated opaque pixels with visible isolated opaque specks near the image edges, corners, and thin details.
- Compare alpha-0, alpha-255, alpha-1-to-254, and total counts against an independent image tool for the same PNG and confirm the bucket sum and ratios.
- Inspect the same PNG produced from a `convert` run and confirm the reported intermediate count is zero and the total matches the dimensions.
- Supply a printed width in millimetres and confirm the resulting millimetres-per-pixel value is plausible for the intended physical output size.
- Read the default text output and the `--json` output for the same source and confirm the paths, dimensions, counts, ratios, N/A state, and physical-size state agree and are understandable.
- Trigger a missing source, an invalid PNG, an extra positional path, and an invalid printed width, and confirm the text and JSON diagnostics are readable, include stable codes, and report the expected exit codes.
- Confirm no help text, text output, or JSON output presents the metrics as print certification or print readiness.

## Post-sync review

The following are post-sync and publication steps, not completed work and not evidence that human checks occurred. This section has no checkboxes.

- Compare the synced main `alpha-metrics` and `cli-interface` specs with these deltas and confirm every added and modified requirement and scenario is preserved without weakening.
- Archive the change only after the project's review requirements are satisfied.
- Verify independent GitHub PR CI at the exact head SHA of the pull request.
- Perform merge review without inferring approval from checked-in files, this task list, or the plan itself.
