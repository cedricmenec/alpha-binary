# cli-interface Specification

## Purpose

Defines the command-line entry point that runs from a source checkout and gives users concise, honest help without requiring npm publication.

## Requirements

### Requirement: CLI is runnable from the source checkout

The repository SHALL provide a CLI entry point that can be executed from a source checkout without installing or publishing the npm package.

#### Scenario: Run the CLI directly with Node.js

- **GIVEN** a source checkout with Node.js available
- **WHEN** the user runs `node bin/alpha-binary.js --help`
- **THEN** the process exits with code 0
- **AND** prints help text containing the command name `alpha-binary`

#### Scenario: Run the CLI through the repository script

- **GIVEN** a source checkout with the repository scripts available
- **WHEN** the user runs `npm run cli -- --help`
- **THEN** the process exits with code 0
- **AND** prints the same help text as the direct entry point

#### Scenario: Run the executable wrapper directly

- **GIVEN** a POSIX source checkout where the wrapper is executable
- **WHEN** the user runs `./bin/alpha-binary.js --help`
- **THEN** the process exits with code 0
- **AND** prints the same help text as the direct entry point

### Requirement: CLI help is concise and lists only available commands

The CLI SHALL respond to `-h` and `--help` with a concise usage message. The help MUST list only commands that are available in the current build.

#### Scenario: Help with a short flag

- **GIVEN** the CLI entry point
- **WHEN** the user runs it with `-h`
- **THEN** it prints usage information and exits with code 0
- **AND** the output contains no stack trace
- **AND** the output does not claim that unimplemented commands are available

#### Scenario: Help without arguments

- **GIVEN** the CLI entry point
- **WHEN** the user runs it without arguments
- **THEN** it prints the same concise help and exits with code 0

### Requirement: Invalid CLI usage fails clearly

The CLI SHALL reject an unknown command with a non-zero exit code and a concise diagnostic on standard error.

#### Scenario: Unknown command

- **GIVEN** the CLI entry point
- **WHEN** the user runs it with an unknown command
- **THEN** the process exits with a non-zero code
- **AND** standard error contains a concise diagnostic with usage guidance
- **AND** the output contains no stack trace

### Requirement: Convert command accepts explicit source and output paths

The CLI SHALL provide `alpha-binary convert <source.png> <output.png>` with both paths supplied explicitly. It MUST reject missing or extra positional paths, an output that identifies the source, and an existing output unless overwrite is explicitly requested.

#### Scenario: Convert a source to a distinct new output

- **GIVEN** a readable source PNG and a distinct output path that does not exist
- **WHEN** the user runs `alpha-binary convert <source> <output>`
- **THEN** the command exits successfully
- **AND** the output file exists at the supplied path
- **AND** the source file remains byte-for-byte unchanged

#### Scenario: Reject missing positional paths

- **GIVEN** a `convert` invocation that omits the source or the output path
- **WHEN** the command parses its arguments
- **THEN** it reports an invocation error
- **AND** it exits with the invocation-error code
- **AND** no output file is created

#### Scenario: Reject an output that identifies the source

- **GIVEN** a source path and an output path that resolve to the same file, including through a symbolic link or hard link
- **WHEN** the user runs `convert`
- **THEN** the command reports an output-identifies-source error
- **AND** the source file remains byte-for-byte unchanged

#### Scenario: Refuse an existing output by default

- **GIVEN** a source PNG and an output path whose file already exists
- **WHEN** the user runs `convert` without an explicit overwrite request
- **THEN** the command reports an existing-output error
- **AND** the existing output bytes remain unchanged
- **AND** the source bytes remain unchanged

#### Scenario: Explicit overwrite replaces only the output

- **GIVEN** a source PNG and a distinct existing output path
- **WHEN** the user runs `convert` with the explicit overwrite option
- **THEN** the output is replaced with the converted PNG
- **AND** the source file remains byte-for-byte unchanged

### Requirement: Convert always applies fixed Bayer 8 × 8 dithering

The `convert` command SHALL always apply the Core Bayer 8 × 8 dithering rule. It MUST NOT expose an algorithm-selection option or provide any alternative dithering algorithm.

#### Scenario: Default conversion produces binary alpha

- **GIVEN** a readable source PNG containing semi-transparent pixels
- **WHEN** the user runs `convert` without an algorithm option
- **THEN** the produced PNG contains only alpha values 0 and 255
- **AND** the result follows the Bayer 8 × 8 rule anchored at pixel (0, 0)

#### Scenario: Algorithm selection is rejected

- **GIVEN** a `convert` invocation that supplies an algorithm-selection option
- **WHEN** the command parses its arguments
- **THEN** it reports an unknown-option invocation error
- **AND** it does not create or replace an output

### Requirement: Optional background removal requires explicit color and tolerance

The `convert` command SHALL remove a uniform background only when both a background color and a tolerance are explicitly supplied. Supplying neither MUST leave the image unchanged before dithering; supplying only one or an invalid value MUST fail as an invocation error without writing output.

#### Scenario: No background options leave likely background opaque

- **GIVEN** a source PNG with an opaque uniform background whose color resembles a likely background
- **WHEN** the user runs `convert` without background options
- **THEN** no background pixel is made transparent before dithering
- **AND** opaque pixels remain opaque in the produced PNG

#### Scenario: Complete background options activate removal before dithering

- **GIVEN** a source PNG and an explicit background color with an explicit tolerance
- **WHEN** the user runs `convert` with both background options
- **THEN** matching pixels become transparent before Bayer dithering
- **AND** every final alpha value is 0 or 255

#### Scenario: Incomplete background options are rejected

- **GIVEN** a `convert` invocation that supplies a background color without a tolerance, or a tolerance without a background color
- **WHEN** the command parses its arguments
- **THEN** it reports an invocation error
- **AND** no output file is created or replaced

#### Scenario: Malformed or out-of-range background values are rejected

- **GIVEN** a `convert` invocation whose background value is not six hexadecimal digits or whose tolerance is not an integer from 0 through 255
- **WHEN** the command parses its arguments
- **THEN** it reports an invocation error
- **AND** no output file is created or replaced

### Requirement: Convert preserves source, dimensions, and physical resolution

The `convert` command SHALL leave the source file byte-for-byte unchanged, keep the source width and height, preserve an existing physical-resolution declaration unchanged, and MUST NOT add resolution when the source has none or resize or crop the image.

#### Scenario: Source and dimensions survive conversion

- **GIVEN** a source PNG with known bytes, width, and height
- **WHEN** `convert` succeeds
- **THEN** the source bytes equal their original value
- **AND** the output width and height equal the source width and height

#### Scenario: Existing physical resolution is preserved

- **GIVEN** a source PNG containing a valid physical-resolution declaration
- **WHEN** `convert` succeeds
- **THEN** the output carries the same X, Y, and unit values
- **AND** no unit conversion or DPI inference occurs

#### Scenario: Physical resolution is not invented

- **GIVEN** a source PNG without a physical-resolution declaration
- **WHEN** `convert` succeeds
- **THEN** the output carries no physical-resolution declaration

### Requirement: Produced PNG is reread and verified as binary alpha

After writing, the `convert` command SHALL reread the output and verify that its width and height match the source and every alpha byte is exactly 0 or 255. It SHALL report success only when verification passes and MUST report a processing failure otherwise.

#### Scenario: Successful output is reread with binary alpha counts

- **GIVEN** a conversion that has just written its output
- **WHEN** the command rereads the produced PNG for control
- **THEN** the reread dimensions equal the source dimensions
- **AND** the count of alpha 0 plus the count of alpha 255 equals width × height
- **AND** the count of intermediate alpha values is zero

#### Scenario: Failed output control reports a processing failure

- **GIVEN** a written output that cannot be reread with the source dimensions or with only alpha 0 and 255
- **WHEN** the command performs its control step
- **THEN** it reports a processing failure
- **AND** it does not print a success diagnostic
- **AND** it exits non-zero

### Requirement: Diagnostics are readable in text or JSON

The `convert` command SHALL print a readable text success diagnostic by default and SHALL print a machine-readable JSON diagnostic when `--json` is supplied. Failures MUST print a concise diagnostic with a stable code and no stack trace, using the same text or JSON selection.

#### Scenario: Text success diagnostic is readable

- **GIVEN** a successful conversion
- **WHEN** the user runs `convert` without `--json`
- **THEN** standard output includes the source path, output path, dimensions, algorithm, and alpha counts
- **AND** standard error is empty
- **AND** the output contains no stack trace

#### Scenario: JSON success diagnostic is machine-readable

- **GIVEN** a successful conversion
- **WHEN** the user runs `convert` with `--json`
- **THEN** standard output is a single JSON object
- **AND** the object includes source, output, width, height, algorithm, optional background-removal data, and alpha zero/full/intermediate counts
- **AND** standard error is empty

#### Scenario: Text failure diagnostic names a stable code

- **GIVEN** a conversion failure
- **WHEN** the user runs `convert` without `--json`
- **THEN** standard error includes the stable diagnostic code and a concise message
- **AND** standard output contains no success diagnostic
- **AND** the diagnostic contains no stack trace

#### Scenario: JSON failure diagnostic is machine-readable

- **GIVEN** a conversion failure
- **WHEN** the user runs `convert` with `--json`
- **THEN** standard error is a single JSON object containing an error code, message, and optional affected path
- **AND** standard output contains no success diagnostic

### Requirement: Exit codes distinguish usage and processing failures

The `convert` command SHALL return 0 on verified success, 2 for invocation or option errors, and 3 for source read, decode, background-removal, encode, write, output-collision, or verification failures. It MUST NOT return 0 after any failure.

#### Scenario: Verified success returns zero

- **GIVEN** a conversion whose output passes the reread control step
- **WHEN** the command completes
- **THEN** the process exit code is 0

#### Scenario: Invocation or option errors return two

- **GIVEN** a `convert` invocation with a missing positional path, unknown option, missing option value, or invalid background/tolerance value
- **WHEN** the command parses its arguments
- **THEN** the process exit code is 2
- **AND** no output file is created or replaced

#### Scenario: Processing failures return three

- **GIVEN** a `convert` invocation whose source is missing or invalid, whose output already exists without overwrite, whose output identifies the source, or whose output fails control verification
- **WHEN** the command processes the request
- **THEN** the process exit code is 3
- **AND** no success diagnostic is printed

### Requirement: Convert help is discoverable and honest

The CLI help SHALL advertise each command that is available in the current build and SHALL NOT advertise unimplemented commands. Top-level help SHALL list `convert` and `inspect` with their usages. `convert --help` SHALL show only the convert usage and options, and `inspect --help` SHALL show only the inspect usage and options; both SHALL exit successfully.

#### Scenario: Top-level help lists the available convert command

- **GIVEN** the CLI entry point
- **WHEN** the user runs `alpha-binary --help`
- **THEN** the output includes `convert` and its source/output usage
- **AND** the output includes `inspect` and its source usage
- **AND** the output does not advertise a command that is unavailable

#### Scenario: Convert help exits successfully

- **GIVEN** the CLI entry point
- **WHEN** the user runs `alpha-binary convert --help`
- **THEN** the output includes the convert usage and options
- **AND** the output does not present inspect options as convert options
- **AND** the process exits with code 0

#### Scenario: Inspect help exits successfully

- **GIVEN** the CLI entry point
- **WHEN** the user runs `alpha-binary inspect --help`
- **THEN** the output includes the inspect usage and options
- **AND** the process exits with code 0

### Requirement: Inspect analyses one local PNG without writing

The CLI SHALL provide `alpha-binary inspect <source.png>` with exactly one explicit source path. It MUST read only that source, MUST NOT write, replace, transform, resize, crop, or re-encode it, and MUST NOT accept an output path.

#### Scenario: Inspect a readable source without modifying it

- **GIVEN** a readable source PNG with known bytes
- **WHEN** the user runs `alpha-binary inspect <source>`
- **THEN** the command completes and prints its metrics
- **AND** the source file remains byte-for-byte unchanged
- **AND** no new file is created for the analysis

#### Scenario: Reject missing or extra positional paths

- **GIVEN** an `inspect` invocation that omits the source or supplies more than one positional path
- **WHEN** the command parses its arguments
- **THEN** it reports an invocation error
- **AND** it exits with the invocation-error code
- **AND** it performs no analysis and writes no file

#### Scenario: Output and transformation options are not exposed

- **GIVEN** an `inspect` invocation that supplies an output, resize, crop, or algorithm option
- **WHEN** the command parses its arguments
- **THEN** it reports an unknown-option invocation error
- **AND** it performs no file write

### Requirement: Inspect reports alpha distribution and isolated opaque metrics

The `inspect` command SHALL report the total pixel count, alpha-0 count, alpha-255 count, alpha-1-to-254 count, isolated opaque count, isolated-to-opaque ratio, and isolated-to-total ratio for the analysed source. The three alpha-bucket counts MUST sum to the total.

#### Scenario: Text output includes every metric

- **GIVEN** a readable PNG containing transparent, opaque, and intermediate alpha pixels
- **WHEN** the user runs `inspect` without `--json`
- **THEN** standard output includes the source path, dimensions, total, alpha 0, alpha 255, alpha intermediate, isolated opaque, isolated/opaque, and isolated/total values
- **AND** the three alpha-bucket counts sum to the reported total
- **AND** standard error is empty

#### Scenario: Isolated-over-opaque is N/A without opaque pixels

- **GIVEN** a readable PNG containing no pixel with alpha 255
- **WHEN** the user runs `inspect` without `--json`
- **THEN** the text output reports the isolated-to-opaque ratio as `N/A`
- **AND** the reported opaque count is zero

### Requirement: Inspect computes physical pixel size only with a printed width

The `inspect` command SHALL accept an explicit printed width in millimetres and SHALL compute a physical pixel size only when that value is supplied. Without it, the command MUST report the physical pixel size as not computed and MUST NOT derive one from metadata.

#### Scenario: Printed width yields a physical pixel size

- **GIVEN** a readable PNG of known width and an explicit positive printed width
- **WHEN** the user runs `inspect --printed-width <mm>`
- **THEN** the output includes a physical pixel size equal to the printed width divided by the image width

#### Scenario: No printed width leaves physical size not computed

- **GIVEN** a readable PNG, including one with a physical-resolution declaration
- **WHEN** the user runs `inspect` without `--printed-width`
- **THEN** the output reports the physical pixel size as not computed
- **AND** no physical size is inferred from the declaration or dimensions

#### Scenario: Invalid printed width is an invocation error

- **GIVEN** a printed width that is zero, negative, non-numeric, or not finite
- **WHEN** the command parses its arguments
- **THEN** it reports an invocation error
- **AND** it exits with the invocation-error code
- **AND** it performs no analysis

### Requirement: Inspect text and JSON output are coherent

The `inspect` command SHALL print readable text by default and a single machine-readable JSON object when `--json` is supplied. Both forms MUST report the same dimensions, counts, ratios, physical-size state, and source path.

#### Scenario: JSON output is machine-readable and coherent

- **GIVEN** a readable source PNG
- **WHEN** the user runs `inspect --json`
- **THEN** standard output is a single JSON object
- **AND** the object includes `source`, `width`, `height`, `total`, `alpha` with zero/full/intermediate, `isolatedOpaque`, `ratios` with isolatedToOpaque and isolatedToTotal, and `physical`
- **AND** `physical` is `null` when no printed width was supplied and an object with the printed width and millimetres per pixel otherwise
- **AND** `ratios.isolatedToOpaque` is `null` when no opaque pixel exists
- **AND** the values match the text output for the same source and options

#### Scenario: Text and JSON agree on counts

- **GIVEN** the same readable source analysed once as text and once with `--json`
- **WHEN** the user compares the reported metrics
- **THEN** dimensions, total, alpha buckets, isolated opaque count, ratios, and physical-size state are equal

### Requirement: Inspect failures use stable diagnostics and explicit exit codes

The `inspect` command SHALL return 0 for a completed analysis, 2 for invocation or option errors, and 3 for source read or decode failures. Failures MUST print a concise diagnostic with a stable code and no stack trace, using text by default and a single JSON error object when `--json` is supplied.

#### Scenario: Completed analysis returns zero

- **GIVEN** a readable PNG
- **WHEN** `inspect` completes
- **THEN** the process exit code is 0

#### Scenario: Invocation errors return two

- **GIVEN** an `inspect` invocation with a missing source, extra positional, unknown option, missing option value, or invalid printed width
- **WHEN** the command parses its arguments
- **THEN** the process exit code is 2
- **AND** no success metrics are printed

#### Scenario: Source failures return three

- **GIVEN** an `inspect` invocation whose source is missing, unreadable, or not a valid accepted PNG
- **WHEN** the command processes the request
- **THEN** the process exit code is 3
- **AND** the diagnostic names the stable code and the affected path
- **AND** the diagnostic contains no stack trace

#### Scenario: JSON failure is machine-readable

- **GIVEN** a failing `inspect` invocation with `--json`
- **WHEN** the command reports the failure
- **THEN** standard error is a single JSON object under `error` with a code, a message, and an optional path
- **AND** standard output contains no success metrics

### Requirement: Inspect metrics are fragility indicators, not print certification

The `inspect` command SHALL present its metrics as indicators of potential fragility. Its text and JSON success output MUST NOT claim that the image is ready to print or that its printability is certified.

#### Scenario: Success output makes no print-readiness claim

- **GIVEN** a successful inspection
- **WHEN** the user reads the default text output
- **THEN** the output describes the metrics as potential fragility indicators
- **AND** the output does not state that the image is ready to print or certified for printing

#### Scenario: JSON output carries no certification field

- **GIVEN** a successful inspection with `--json`
- **WHEN** the JSON object is parsed
- **THEN** it contains no field asserting print readiness or print certification

### Requirement: Convert is local and makes no print-readiness claim

The `convert` command SHALL operate only on local input and output paths and MUST NOT resize, crop, perform AI cutout, or call a remote service. Its success diagnostic MUST NOT claim that the output is print-ready.

#### Scenario: Conversion keeps the source dimensions and avoids print-readiness claims

- **GIVEN** a local source PNG
- **WHEN** `convert` succeeds
- **THEN** the output dimensions equal the source dimensions
- **AND** the success diagnostic does not state that the output is ready to print

#### Scenario: Resize, crop, or AI options are not exposed

- **GIVEN** a `convert` invocation that supplies a resize, crop, or AI-cutout option
- **WHEN** the command parses its arguments
- **THEN** it reports an unknown-option invocation error
- **AND** it does not create or replace an output
