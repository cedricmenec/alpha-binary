# Design

## Context

See `proposal.md` - Why. The repository already exposes the required building blocks:

- `readPngFile(sourcePath)` and `writePngFile(image, sourcePath, outputPath, { overwrite })` own all file access, validate distinct source/output identity, refuse existing outputs by default, and preserve the source (`src/cli/png-files.js`).
- `removeUniformBackground(image, options)` performs explicit per-channel background removal or returns an unchanged copy when no options are supplied (`src/core/background.js`).
- `ditherAlphaBayer8(image)` applies the fixed Bayer 8 × 8 rule and preserves dimensions and `physicalResolution` (`src/core/dither.js`).
- `decodePng`, `encodePng`, `PngError`, `BackgroundError`, and `CliPngError` provide stable diagnostic codes.

The current CLI (`src/cli/index.js`) only prints help or rejects unknown commands. Its tests explicitly assert that `convert` is absent; that assertion must change as part of this task. `npm run check` runs `npm test` and the bootstrap checks. No runtime dependency is needed.

## Goals / Non-Goals

**Goals:**

- Add one `convert` subcommand that composes the existing primitives in a fixed order and writes only a distinct explicit output path.
- Make background removal opt-in, explicit, and all-or-nothing for its color and tolerance inputs.
- Produce a reusable text or JSON diagnostic whose success report is based on a reread of the written PNG.
- Give invocation errors and processing errors distinct, stable exit codes.
- Keep help honest by advertising `convert` and not `inspect` or other unfinished commands.

**Non-Goals:**

- Adding a dithering algorithm, algorithm selector, resize, crop, AI cutout, or remote call.
- Changing the Core dithering, background-removal, or PNG codec contracts.
- Implementing `inspect`, the AB-007 metrics, or AB-008 documentation.
- Claiming print readiness or adding print-specific behavior.
- Adding a runtime dependency, publishing the package, or changing workflows/configuration.

## Decisions

### Dispatch `convert` inside the existing CLI entry point

Extend `main(argv, io)` to recognize `convert` before the existing unknown-command fallback. Keep help for no arguments and `-h`/`--help`, and add `convert --help`. Put option parsing and orchestration in a focused CLI module rather than in the Core so Core modules remain free of process arguments, file paths, and output streams.

Alternative considered: add the command to Core. Rejected because Core is deliberately file- and CLI-independent.

### Manual dependency-free option parser

Define the command surface as:

```text
alpha-binary convert <source.png> <output.png> [options]

Options:
  --background <hex>   Background color as six hex digits, optionally prefixed by #
  --tolerance <0-255>  Inclusive channel tolerance; required with --background
  --overwrite          Replace an existing output after source-identity checks
  --json               Emit a machine-readable diagnostic
  -h, --help           Show convert help
```

Parse exactly two positional paths, reject unknown options, reject missing option values, reject duplicate options, and reject extra positionals. There is deliberately no `--algorithm`; an attempt to select one is an unknown-option usage error, which keeps Bayer 8 × 8 the only prototype algorithm.

Alternatives considered: use a general argument-parsing dependency or a permissive parser. Rejected because the surface is small, the package is dependency-free, and a strict parser makes errors deterministic and testable.

### Require background color and tolerance together

When neither background option is present, call no background-removal step. When both are present, parse the hex color into `{ red, green, blue }`, parse the tolerance as an integer, and call `removeUniformBackground` before dithering. When only one is present, or either value is malformed/out of range, stop before reading or writing any output and return an invocation error.

The parser accepts exactly six hexadecimal digits with an optional leading `#`, case-insensitive. It does not accept shortened hex, named colors, decimal channel lists, fractional tolerances, or values outside 0 through 255.

Alternatives considered: defaulting the tolerance, reading a background color from the image, or silently ignoring a partial pair. Rejected because the task requires explicit background values and AB-005 already rejects incomplete options.

### Fixed conversion pipeline and output control

The command performs:

```text
readPngFile(source)
  -> removeUniformBackground(image, options?)   (only when both background options are present)
  -> ditherAlphaBayer8(image)
  -> writePngFile(processed, source, output, { overwrite })
  -> readPngFile(output)                        (verification)
```

After the write, reread the output and verify that its width and height equal the source dimensions and that every alpha byte is 0 or 255. Compute alpha-zero and alpha-full counts; intermediate alpha must be zero. If verification fails, report a processing failure with a stable code and do not emit a success diagnostic. The source is never passed to a write operation.

Alternative considered: trust the encoder without rereading. Rejected because the acceptance criteria explicitly require that the produced PNG can be reread for control.

### Text and JSON diagnostics

Text success output goes to standard output and includes source path, output path, dimensions, algorithm `bayer-8x8`, whether background removal was applied (including color and tolerance when it was), alpha-zero count, alpha-full count, and alpha-intermediate count. It contains no print-readiness claim.

JSON success output has this stable shape:

```json
{
  "source": "input.png",
  "output": "output.png",
  "width": 8,
  "height": 8,
  "algorithm": "bayer-8x8",
  "backgroundRemoval": null,
  "alpha": { "zero": 0, "full": 64, "intermediate": 0 }
}
```

When background removal is applied, `backgroundRemoval` is `{ "color": { "red": 0, "green": 0, "blue": 0 }, "tolerance": 0 }` instead of `null`.

Errors go to standard error. Text errors include the stable code and a concise message, optionally with the affected path. With `--json`, an error is a single JSON object:

```json
{
  "error": {
    "code": "CLI_OUTPUT_EXISTS",
    "message": "Refusing to replace existing output \"out.png\"",
    "path": "out.png"
  }
}
```

No diagnostic path prints a stack trace. A JSON error still exits non-zero.

Alternative considered: always emit JSON. Rejected because the task requires a readable text diagnostic as the default and JSON as an opt-in.

### Stable exit-code categories

Use the process result returned by `main`:

- `0`: successful conversion and verification.
- `2`: invocation or option error, including missing/extra positionals, unknown options, malformed background/tolerance, incomplete background/tolerance pair, and `convert --help`.
- `3`: processing error, including unreadable or invalid source, background-removal failure, encode/write failure, existing-output refusal, output-identifies-source refusal, and post-write verification failure.

The existing unknown-command behavior remains non-zero and continues to return 2. Missing source/output and malformed options are detected before any file access.

Alternative considered: a distinct code per `CliPngError` code. Rejected for the prototype because two categories are sufficient and the JSON/text diagnostic already carries the specific stable code.

### Keep help inventory honest

Top-level help lists `convert` with its usage and states that it is the available conversion command. It must not list `inspect` or other commands that are not implemented. `convert --help` repeats only the convert usage and options. Existing help tests that assert `convert` is absent must be updated; assertions that `inspect` is absent remain.

## Risks / Trade-offs

- **Option spelling is a planning assumption not fixed by AB-006** -> Record it in the proposal and spec; changing it later requires revised scenarios and tests.
- **Post-write verification failure can leave an output file** -> Report a processing failure and never report success; rely on the existing safe-write behavior to protect the source and on tests to assert the failure path.
- **Strict parsing may reject an input the source Notion contract allows** -> Keep the accepted grammar narrow and explicit in the spec; record unresolved spelling assumptions rather than silently accepting variants.
- **Exit-code mapping may not match a future product decision** -> Freeze only two non-zero categories and keep the specific diagnostic code available for future refinement.
- **Help tests currently require `convert` to be absent** -> Update those assertions in the same task that adds the command, and keep `inspect` absent until AB-007.
- **Accidental scope creep into resizing, cropping, or AI removal** -> Compose only the existing primitives and assert dimensions and source bytes remain unchanged.

## Migration Plan

Additive CLI behavior. Existing Core exports and file primitives stay unchanged. Roll back by removing the `convert` dispatch, parser, orchestration, diagnostics, help entry, and related tests, restoring the help-only CLI.

## Open Questions

None blocking. The option spelling, overwrite exposure, diagnostic schemas, reread behavior, and numeric exit-code mapping are planning assumptions recorded in the proposal because AB-006 leaves them unspecified. Any change to those choices changes the spec scenarios and tests rather than an internal implementation detail.
