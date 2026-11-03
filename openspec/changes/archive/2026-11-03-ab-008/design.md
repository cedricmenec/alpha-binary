# Design

## Context

See `proposal.md` - Why. AB-008 is an acceptance and documentation task, not a new image-processing feature. The repository already has:

- A dependency-free Core for PNG decode/encode, uniform-background removal, Bayer 8 × 8 dithering, and alpha metrics.
- A source-runnable CLI with `convert` and `inspect`, text/JSON diagnostics, and stable exit codes.
- A `node:test` suite that synthesizes images in memory or temporary directories.
- `npm run check`, which runs `npm test` through `precheck` and then the bootstrap checks in `scripts/check-bootstrap.mjs`.
- A minimal `README.md` that describes the project but not how to run it from GitHub.

The missing pieces are a stable reference corpus, cross-command acceptance tests, and an honest short usage procedure. The A-001 trial is referenced by AB-008 but is not defined anywhere in this repository or task text; that gap is recorded as unresolved and is not filled by invention.

## Goals / Non-Goals

**Goals:**

- Add the two small reference PNG fixtures required by AB-008 and, only when supplied, the A-001 fixture with its expected outcomes.
- Exercise the complete local journey through `convert` and `inspect`, including separate-process determinism and source immutability.
- Make the reference acceptance suite part of the ordinary local check without adding a paid or network-dependent step.
- Turn `README.md` into a short, accurate procedure for running the prototype from GitHub and interpreting its output.
- Keep all claims about printability honest.

**Non-Goals:**

- Adding or changing any conversion algorithm, CLI option, API, provider integration, dependency, workflow, or configuration.
- Publishing the package or documenting an npm-registry installation path.
- Creating a documentation site, generated reference, or large fixture library.
- Defining the A-001 image or expectations locally when the product framing does not supply them.
- Re-testing every existing unit-level edge case; this task adds reference acceptance coverage on top of the existing suites.

## Decisions

### Use checked-in reference PNG fixtures under a dedicated test directory

Place the two small fixtures under `test/fixtures/reference/`, for example `uniform-background.png` and `partial-alpha.png`, with a small manifest of expected dimensions and alpha-category facts. A checked-in PNG freezes the exact bytes used as the regression reference; a manifest keeps the expected properties readable without opening binary data.

The uniform-background fixture will be a small image filled with one opaque background color. The partial-alpha fixture will be a small image containing alpha 0, at least one intermediate alpha value from 1 through 254, and alpha 255. Both will be tiny enough for fast repeated process runs. These exact contents are implementation choices because AB-008 does not prescribe dimensions or colors.

Alternative considered: generate both fixtures from pixel arrays inside the test. Rejected as the primary reference because runtime synthesis does not freeze a reference PNG artifact and makes the "two small reference PNGs" acceptance less literal. A test helper may still help regenerate or inspect the checked-in fixtures.

Alternative considered: use large photographic fixtures. Rejected because AB-008 asks for small PNGs and because large binary inputs add review and runtime cost without adding prototype confidence.

### Handle the A-001 trial as an explicit unresolved dependency

The reference suite will reserve a location and manifest entry for A-001, but apply must not create pixels or expected values for it. When a supplied A-001 fixture and its expected outcomes are available, add them unchanged and run the same end-to-end checks. When they are not available, stop and report the unresolved requirement.

Alternative considered: treat an existing test image as "A-001". Rejected because it would silently invent a product reference and create false evidence.

### Add one cross-command acceptance test file

Add a `test/reference-acceptance.test.js` suite that uses the existing CLI entry point and PNG/Core helpers. For each available reference fixture it will:

1. Read the fixture bytes before the run.
2. Run `convert` into a fresh temporary directory.
3. Decode the output, assert source dimensions, and assert only alpha 0 and 255.
4. Run the conversion again in a separate Node.js process into another fresh output and compare the produced PNG bytes.
5. Assert the fixture bytes are unchanged.
6. Run `inspect` as text and with `--json`.
7. Parse the JSON, compare it semantically with the text diagnostics, assert the alpha buckets sum to total, and assert the source bytes and directory contents are unchanged.

The suite uses `spawnSync` for cross-process determinism and the existing `docs`-independent CLI surface. It does not add a test framework or dependency; `node:test` already runs under `npm test` and therefore under `npm run check`.

Alternative considered: extend each existing command-specific test file only. Rejected because AB-008 asks for a complete journey over reference PNGs; a cross-command acceptance file makes that journey visible and keeps reference fixtures together.

### Keep reference fixtures and expectations separate from A-001 status

The manifest will identify which entries are present and whether A-001 has been supplied. Tests must not skip silently in a way that reports full AC coverage. The reference suite may report the two-fixture checks as implemented, but the A-001 requirement remains an unresolved blocker until the source material arrives.

Alternative considered: mark A-001 as skipped with a test skip. Rejected because a skipped test can look like an accepted state; the task contract requires reporting unresolved requirements rather than implying completion.

### Use `README.md` as the single short usage document

Extend `README.md` with sections for:

- What the prototype does and does not do.
- Prerequisites and execution from a GitHub source checkout.
- Direct `node bin/alpha-binary.js` and `npm run cli --` invocation.
- `convert` usage, options, text output, JSON output, and exit codes.
- `inspect` usage, options, text output, JSON output, and exit codes.
- Accepted PNG inputs and prototype limits, including no resize, crop, AI cutout, remote service, or publication.
- A clear statement that metrics are fragility indicators and that no output is a print-readiness or print-certification guarantee.

The examples will use the actual command surface and documented output field names. A deterministic documentation check can read `README.md` and assert the required sections, command names, and absence of print-readiness claims; the apply run will also execute the documented commands to confirm they match behavior.

Alternative considered: add a separate `docs/` tree. Rejected for this prototype because the README is the natural GitHub landing point and AB-008 asks for a short procedure, not a documentation system.

### Preserve scope boundaries

No product code, workflow, configuration, backlog, `AGENTS.md`, package metadata, or archive state is changed by AB-008. The only planned edits are test fixtures/tests and user-facing documentation. `npm run check` continues to call the existing bootstrap script, whose `precheck` already runs `npm test`.

## Risks / Trade-offs

- **A-001 is undefined** → Keep it as an explicit unresolved requirement; apply must stop rather than substitute a fixture. The two-fixture corpus and all other checks can still be planned, but full AB-008 acceptance is not claimable without A-001.
- **Checked-in PNG fixtures can drift or be regenerated inconsistently** → Record their expected dimensions and alpha facts in a manifest and assert them in tests.
- **Reference tests might be mistaken for print certification** → Keep the existing fragility wording in outputs and add documentation checks that reject print-readiness claims.
- **Cross-process determinism tests can be slow** → Use only two tiny fixtures and two conversion runs per fixture.
- **README examples can drift from the CLI** → Execute the documented commands during apply and keep a deterministic documentation test focused on the stable surface.
- **Binary fixtures are harder to review than text** → Keep them deliberately tiny and describe their observable properties in the manifest and tests.

## Migration Plan

Additive test and documentation change. Existing Core, CLI, package metadata, and workflows remain unchanged. Roll back by removing the reference fixtures, the reference acceptance test file, and the README usage sections, restoring the previous minimal README.

## Open Questions

- The A-001 fixture and expected outcomes are not available in the repository or task. This is not deferrable: the task cannot be fully accepted without them, so apply must stop and report rather than treating a guessed image as A-001.
