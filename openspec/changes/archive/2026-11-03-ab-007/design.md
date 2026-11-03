# Design

## Context

See `proposal.md` - Why. The repository already provides everything `inspect` needs for input:

- `readPngFile(sourcePath)` reads and decodes a local PNG into `{ width, height, pixels, physicalResolution? }` with row-major 8-bit RGBA pixels, and reports path-specific `CliPngError` diagnostics (`src/cli/png-files.js`).
- `ditherAlphaBayer8`, alpha counting, and the existing CLI conventions show how diagnostics and exit codes are structured (`src/cli/convert.js`, `src/cli/index.js`).
- `main(argv, io, dependencies)` dispatches commands, prints help for no arguments or `-h`/`--help`, and returns exit codes.
- `npm run check` runs `npm test` and the bootstrap checks. No runtime dependency is needed.

The current top-level help advertises only `convert`, and `test/cli.test.js` asserts that `inspect` is absent. That assertion must change in this task. The existing `cli-interface` requirement "Convert help is discoverable and honest" also forbids advertising `inspect`; it must be modified to reflect the second available command.

## Goals / Non-Goals

**Goals:**

- Add a read-only `inspect` command that never calls a write primitive and never changes the source bytes.
- Put all measurement logic in a deterministic, in-memory Core operation so it can be tested and reused independently of the CLI.
- Produce one metrics object rendered identically in meaning by text and JSON output.
- Compute a physical pixel size only from an explicitly supplied printed width.
- Keep the definition of isolated opaque pixels narrow: size-one opaque components under an 8-direction neighborhood.

**Non-Goals:**

- Implementing, changing, or re-specifying `convert`, dithering, background removal, or the PNG codec.
- Counting connected components of any size other than exactly one.
- Writing, transforming, resizing, cropping, or re-encoding the inspected PNG.
- Inferring printed width from `pHYs`, DPI, metadata, or image dimensions.
- Claiming print readiness or certifying print quality.
- Adding a runtime dependency, publishing the package, or changing workflows/configuration/backlog/archive.

## Decisions

### Separate in-memory metrics Core operation

Add a Core export such as `inspectAlpha(image, options)` in `src/core/` that accepts only an in-memory image and an optional explicit printed width, and returns a metrics object. It MUST NOT read files, write files, parse process arguments, access a network, or write to standard output or standard error. The CLI command module reads the source once and delegates counting to this operation.

Alternative considered: compute metrics directly in the CLI module. Rejected because AB-007 describes reusable measurements and the project already separates Core behavior from CLI behavior.

### Alpha buckets and exact total invariant

Iterate the RGBA buffer once, reading the alpha byte of each pixel. Count `zero` for alpha 0, `full` for alpha 255, and `intermediate` for alpha 1 through 254. Set `total = width * height`. The implementation returns these three counts plus total; tests assert `zero + full + intermediate === total`. No alpha value is reclassified and no color byte is read for this partition.

Alternative considered: infer `intermediate` as `total - zero - full`. Rejected as the only mechanism because a single-pass explicit count makes the invariant testable and avoids hiding a miscount.

### Isolated opaque pixels are size-one 8-connected components

An opaque pixel is a pixel whose alpha is exactly 255. It is isolated when none of its eight neighbors (up-left, up, up-right, left, right, down-left, down, down-right) is also opaque. Out-of-bounds neighbors are not opaque. This is exactly the definition of an opaque connected component of size one under an 8-direction neighborhood, and it excludes both fully transparent and intermediate-alpha pixels from opaque connectivity.

The implementation checks the eight neighbors for each opaque pixel and counts matches. It deliberately does not build a general connected-component table or count any other component size, per the task constraint.

Alternative considered: flood-fill all opaque components and count those of size one. Rejected for the prototype because it adds machinery and tempts scope creep into other component sizes; the neighbor test is equivalent for the size-one case and is O(pixels × 8).

### Exact ratios with an explicit N/A case

Compute `isolatedToOpaque = isolatedOpaque / full` when `full > 0`, otherwise `null` (rendered as `N/A`). Compute `isolatedToTotal = isolatedOpaque / total`, which is always defined because a decoded PNG has positive dimensions. Return full-precision JavaScript numbers; do not round in the Core so the values remain exact and the renderer owns presentation.

Alternative considered: clamp or round ratios to a fixed number of decimals. Rejected because the task requires exact ratios and rounding would lose information; text formatting can still be readable without changing the JSON value.

### Physical pixel size only from an explicit printed width

Accept an optional `printedWidth` in millimetres. When absent, return `physical: null` and never infer from `pHYs`, DPI, or dimensions. When present, validate that it is a positive finite number, then compute `millimetresPerPixel = printedWidth / width` and return `{ printedWidth, millimetresPerPixel }`. The value describes a square pixel derived from the horizontal printed width; the design does not infer a separate vertical size.

Alternative considered: read `pHYs` and convert DPI. Rejected because the task requires an explicit printed width and the PNG codec deliberately does not infer physical resolution.

### CLI surface and strict parsing

Define the command surface as:

```text
alpha-binary inspect <source.png> [options]

Options:
  --printed-width <mm>  Printed width in millimetres; enables physical pixel size
  --json                Emit a machine-readable diagnostic
  -h, --help            Show inspect help
```

Parse exactly one positional path, reject unknown options, missing option values, duplicate options, extra positionals, and a printed width that is not a positive finite decimal number. There is no option to transform, resize, crop, or write output.

Alternative considered: a general argument-parsing dependency. Rejected because the existing CLI uses a small strict dependency-free parser and the surface is smaller than `convert`.

### Read-only analysis and coherent diagnostics

`inspect` calls only `readPngFile`. It computes metrics, renders them, and returns. It never calls `writePngFile` or any other write API. The source bytes are read-only for the whole command.

Text output goes to standard output and lists the source path, dimensions, total, alpha 0, alpha 255, alpha intermediate, isolated opaque count, isolated/opaque ratio (`N/A` when none), isolated/total ratio, and physical size (`not computed` when no printed width). It describes the metrics as fragility indicators and makes no print-readiness claim.

JSON success output is a single object:

```json
{
  "source": "input.png",
  "width": 8,
  "height": 8,
  "total": 64,
  "alpha": { "zero": 40, "full": 20, "intermediate": 4 },
  "isolatedOpaque": 3,
  "ratios": { "isolatedToOpaque": 0.15, "isolatedToTotal": 0.046875 },
  "physical": null
}
```

With `--printed-width 80`, `physical` becomes `{ "printedWidth": 80, "millimetresPerPixel": 10 }`. When there is no opaque pixel, `ratios.isolatedToOpaque` is `null`; the text renderer prints `N/A` for the same value.

Errors go to standard error as a concise text diagnostic with a stable code and optional path, or as a single JSON object under `error` with `code`, `message`, and optional `path`, using the existing `--json` selection. No diagnostic prints a stack trace.

Alternative considered: always emit JSON. Rejected because the task requires readable text output and JSON as an opt-in, matching `convert`.

### Exit codes

- `0`: completed analysis, including `inspect --help`.
- `2`: invocation or option error, including missing/extra positionals, unknown or duplicate options, a missing option value, and an invalid printed width.
- `3`: source read or decode processing failure.

These match the existing `convert` categories. The specific stable code remains in the diagnostic.

Alternative considered: distinct codes per metric failure. Rejected because measurement itself cannot fail after a successful decode.

### Help inventory

Top-level help advertises both `convert` and `inspect` with their usages and states that `inspect` only analyses. `inspect --help` shows only inspect usage and options. Tests that currently assert `inspect` is absent must be updated to assert it is present alongside `convert`.

## Risks / Trade-offs

- **Printed-width spelling, units, and precision are planning assumptions not fixed by AB-007** → Record them in the proposal and spec; a different product decision requires revised scenarios and tests.
- **Isolation definition could be interpreted with 4-connectivity** → The spec states 8-direction neighborhood explicitly and tests the diagonal case.
- **A rapid metric pass could accidentally read or write the source** → The command uses only `readPngFile`; tests assert the source bytes are unchanged and no output exists.
- **Text and JSON can drift** → Render both from the same metrics object and add a test that parses both and compares semantically.
- **Physical size could be mistaken for print certification** → Text always labels measurements as indicators and never claims print readiness; the spec forbids the claim.
- **General component counting could creep in** → The design counts only opaque pixels with zero opaque neighbors and explicitly excludes other component sizes.
- **Help tests currently require `inspect` to be absent** → Update those assertions in the same task that adds the command.

## Migration Plan

Additive behavior. `convert` and all Core exports remain unchanged. Existing help assertions that `inspect` is absent are updated. Roll back by removing the inspect dispatch, command module, Core metrics export, help entry, and related tests, restoring a help-only `inspect` absence.

## Open Questions

None blocking. The printed-width option spelling and units, JSON field names, N/A representation, and exit-code mapping are planning assumptions recorded in the proposal because AB-007 leaves them unspecified. Any change to those choices changes the spec scenarios and tests rather than an internal implementation detail.
