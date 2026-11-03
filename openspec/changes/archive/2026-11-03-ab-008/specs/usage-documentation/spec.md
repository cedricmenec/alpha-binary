# Spec Delta

## Purpose

Defines the short user-facing procedure for running the prototype from GitHub sources and the documentation needed to use its commands, interpret its output, and understand its limits honestly.

## ADDED Requirements

### Requirement: Documentation explains execution from a GitHub source checkout

The repository SHALL document how to obtain the project from GitHub, the required Node.js range, how to prepare the checkout, and how to run the CLI from source without publishing the package or installing a global `alpha-binary` package.

#### Scenario: Fresh checkout follows the documented setup

- **GIVEN** a user with the documented Node.js version and a GitHub source checkout
- **WHEN** the user follows the setup and execution steps
- **THEN** the user can run the CLI help successfully
- **AND** no `npm publish`, registry login, or global package installation is required

#### Scenario: Documented run commands use the source entry point

- **GIVEN** the usage documentation
- **WHEN** the user reads the execution examples
- **THEN** the examples show running the CLI through the source entry point or the repository script
- **AND** the examples do not require an installed package named `alpha-binary`

### Requirement: Documentation covers convert and inspect usage and output formats

The documentation SHALL describe the available `convert` and `inspect` commands, their required and optional arguments, and both readable text output and `--json` output. It MUST describe the success fields and error shape closely enough that an agent or user can interpret the output.

#### Scenario: Documented commands match the available CLI

- **GIVEN** the usage documentation
- **WHEN** the user compares the documented commands and options with the CLI help
- **THEN** every documented command and option is available
- **AND** no unavailable command or option is presented as supported

#### Scenario: Documented output formats match observed output

- **GIVEN** the usage documentation
- **WHEN** the user runs a documented text or JSON example
- **THEN** the observed output follows the documented format
- **AND** the documented JSON success and error fields are present

### Requirement: Documentation explains exit codes and stable diagnostics

The documentation SHALL explain the CLI exit-code categories and the stable diagnostic codes used for invocation and processing failures. It MUST distinguish usage errors from source, output, or processing errors.

#### Scenario: Documented exit codes match CLI behavior

- **GIVEN** the usage documentation
- **WHEN** the user triggers a successful command, an invalid invocation, and a failing source
- **THEN** the observed exit codes match the documented categories
- **AND** the observed diagnostics include the documented stable code

### Requirement: Documentation states prototype limits and makes no print-readiness claim

The documentation SHALL list the accepted PNG input constraints and SHALL state that the prototype does not resize, crop, perform AI cutout, call a remote service, or publish the package. It SHALL describe `inspect` metrics as potential-fragility indicators and MUST NOT state that a converted or inspected result is ready to print or certified for printing.

#### Scenario: Documentation lists the prototype limits

- **GIVEN** the usage documentation
- **WHEN** the user reads the limits section
- **THEN** it states the accepted PNG constraints
- **AND** it states that resize, crop, AI cutout, remote services, and publication are out of scope

#### Scenario: Documentation makes no print-readiness claim

- **GIVEN** the usage documentation
- **WHEN** the user searches it for print-readiness or certification statements
- **THEN** no result is described as ready to print or certified for printing
- **AND** the metrics are described as indicators of potential fragility
