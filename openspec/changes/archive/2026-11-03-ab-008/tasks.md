# Tasks

Checkboxes below cover only changes and deterministic checks that can be completed during apply before semantic sync, archive, and publication. No box is marked complete until its stated verification actually passes.

## 1. Reference corpus

- [x] 1.1 Add two small checked-in PNG fixtures under `test/fixtures/reference/`: a uniform-background fixture and a partial-alpha fixture; verify with a decode check that GIVEN each fixture, WHEN it is decoded by the existing Core, THEN it is a small valid PNG, the uniform fixture shares one opaque background color, and the partial-alpha fixture contains alpha 0, alpha 1 through 254, and alpha 255.
- [x] 1.2 Add a readable fixture manifest recording each available fixture's dimensions, alpha-category expectations, and the A-001 corpus slot; verify with `node --test test/reference-acceptance.test.js` that GIVEN the manifest and fixtures, WHEN the corpus is enumerated, THEN the two small fixtures are present with matching decoded properties and the A-001 slot is reported as unresolved rather than replaced by a substitute.

## 2. Reference acceptance tests

- [x] 2.1 Add end-to-end conversion acceptance coverage for each available reference fixture; verify with `node --test test/reference-acceptance.test.js` that GIVEN a reference fixture with known bytes, WHEN `convert` writes a temporary output, THEN the command succeeds, the output keeps the source dimensions, every output alpha is 0 or 255, and the fixture bytes are unchanged.
- [x] 2.2 Add cross-process determinism coverage for the reference fixtures; verify with `node --test test/reference-acceptance.test.js` that GIVEN the same reference fixture converted in two separate process runs, WHEN the produced PNG bytes are compared, THEN both outputs are byte-identical and neither run modifies the fixture.
- [x] 2.3 Add read-only inspection coverage for the reference fixtures; verify with `node --test test/reference-acceptance.test.js` that GIVEN a reference fixture, WHEN `inspect` runs as text and with `--json`, THEN both forms agree on dimensions, total, alpha buckets, isolated opaque count, ratios, physical-size state, and source path, the buckets sum to total, and no file is created or modified.
- [x] 2.4 Ensure the reference acceptance suite reports the missing A-001 reference as an unresolved blocker without skipping silently or inventing expectations; verify with `node --test test/reference-acceptance.test.js` that GIVEN no supplied A-001 fixture and expected outcomes, WHEN the corpus status is reported, THEN the suite identifies A-001 as unresolved and does not claim full AB-008 acceptance.

## 3. Usage documentation

- [x] 3.1 Extend `README.md` with the GitHub source-checkout procedure, required Node.js range, checkout preparation, and both direct `node bin/alpha-binary.js` and `npm run cli --` execution examples; verify by running the documented help command from the source checkout and confirming it succeeds without publishing or globally installing the package.
- [x] 3.2 Document `convert` and `inspect` usage, required and optional arguments, text and JSON success formats, error shape, and exit-code categories in `README.md`; verify by running documented text and JSON examples and confirming the observed fields and exit codes match the documentation.
- [x] 3.3 Document the accepted PNG input constraints and prototype limits, including no resize, crop, AI cutout, remote service, or package publication, and describe inspection metrics as potential-fragility indicators; verify with a documentation test that GIVEN `README.md`, WHEN it is checked, THEN the required limit topics are present and no statement presents a result as ready to print or certified for printing.
- [x] 3.4 Add a deterministic documentation check under `test/` for the required README surface and honesty statements; verify with `node --test test/readme.test.js` that GIVEN the README, WHEN the check runs, THEN the documented `convert` and `inspect` commands and options exist in the CLI surface and no print-readiness claim is present.

## 4. Integration checks

- [x] 4.1 Run `npm test` and then `npm run check`; verify that the existing Core, PNG, dithering, background-removal, convert, inspect, reference acceptance, documentation, and bootstrap checks pass without paid services or network access.
- [x] 4.2 Run `openspec validate --all --strict --no-interactive`; verify the change and every main spec pass strict validation with all requirements and scenarios preserved.
- [x] 4.3 Confirm the implementation adds no runtime dependency and leaves product code, CLI behavior, workflows, configuration, backlog, `AGENTS.md`, package metadata, and archive state unchanged; verify with `npm ls --depth=0`, `git diff --stat`, `git status --short`, and `openspec status --change ab-008`.

## Unresolved requirements

- The A-001 trial is not defined in the repository or AB-008 task: its fixture, dimensions, pixels, and expected outcomes are absent. Do not invent them. Apply must stop and report this unresolved requirement unless the product framing supplies the A-001 fixture and expectations; the two small fixtures and all other checks can still be implemented, but full AB-008 acceptance must not be claimed.
- AB-008 does not prescribe the exact colors or dimensions of the two small fixtures. The plan treats them as implementation choices, provided one has a uniform background and the other has partial alpha and both stay small and deterministic.
- These are recorded planning assumptions, not product decisions. If an unresolved requirement or forbidden file blocks progress during apply, stop and report instead of inventing behavior or marking a task complete.
- No implementation task is marked complete until its stated verification runs successfully during apply. Test failures should be fixed in the same authorized invocation when possible, target checks rerun, and no paid invocation or automatic retry launched.

## Manual acceptance

The following are human, visual, or real-environment acceptance checks and are not evidence that they were performed. This section has no checkboxes and does not contribute to implementation progress.

- Follow the README from a fresh GitHub source checkout, using only the documented prerequisites, and confirm the setup and help procedure is understandable and complete for a new user.
- Open each reference fixture and its converted output in an image viewer at 1:1 zoom and visually confirm the expected uniform background or partial-alpha content, preserved dimensions, and intended binary transparency.
- Compare the visual result of converting the uniform-background fixture with and without explicit background options and confirm the documented behavior matches what is seen.
- Run `inspect` on each reference fixture, read the text output and the `--json` output, and confirm the reported counts, ratios, fragility wording, and physical-size state are understandable and agree.
- Review the README commands, option descriptions, output-format descriptions, and limits with a human reader and confirm no result is presented as a print-readiness guarantee.
- Confirm the documented exit-code and diagnostic examples are legible and useful when deliberately causing an invalid invocation and a missing or invalid source.

## Post-sync review

The following are post-sync and publication steps, not completed work and not evidence that human checks occurred. This section has no checkboxes.

- Compare the synced main `prototype-validation` and `usage-documentation` specs with these deltas and confirm every added requirement and scenario is preserved without weakening.
- Archive the change only after the project's review requirements, including the unresolved A-001 requirement, are satisfied.
- Verify independent GitHub PR CI succeeds on the exact head SHA of the pull request.
- Perform merge review without inferring approval from checked-in files, this task list, or the plan itself.
