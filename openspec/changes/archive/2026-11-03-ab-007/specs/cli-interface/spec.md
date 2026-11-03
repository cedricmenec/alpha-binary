# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
