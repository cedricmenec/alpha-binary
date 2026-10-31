# core-runtime Specification

## Purpose

Defines the reusable Core boundary so image-processing logic can be imported, called, and tested independently of the command-line interface.

## Requirements

### Requirement: Core can be imported and called independently of the CLI

The Core entry point SHALL be importable by a Node.js program and SHALL expose at least one callable skeleton export. Importing or calling it MUST NOT load the CLI entry point or require command-line arguments.

#### Scenario: Import the Core without the CLI

- **GIVEN** a Node.js program running in the repository
- **WHEN** the program imports the Core entry point
- **THEN** the import succeeds
- **AND** the module exposes a callable export
- **AND** no CLI help, usage text, or error output is written

#### Scenario: Call the Core without CLI arguments

- **GIVEN** the Core entry point has been imported
- **WHEN** the exported skeleton function is called without process arguments
- **THEN** it returns a value
- **AND** the call does not fail because CLI arguments are missing

### Requirement: Core module graph is independent of the CLI

The Core module graph MUST NOT import CLI modules, parse command-line arguments, or write to standard output or standard error during import.

#### Scenario: Core import has no CLI side effects

- **GIVEN** the Core entry point
- **WHEN** a Node.js process imports it
- **THEN** the process exits successfully
- **AND** standard output and standard error remain empty
- **AND** no command-line parser is initialized
