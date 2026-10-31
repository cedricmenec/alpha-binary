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
