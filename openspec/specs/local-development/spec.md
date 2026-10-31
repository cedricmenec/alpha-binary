# local-development Specification

## Purpose

Defines how contributors and agents verify the Core and CLI locally, and confirms that source execution never requires publishing the package to npm.

## Requirements

### Requirement: Existing check command runs Core and CLI tests

The repository's existing `npm run check` command SHALL execute the Core and CLI test suites before the existing bootstrap checks.

#### Scenario: Check passes on a prepared checkout

- **GIVEN** a checkout with the locked Node.js version and installed dependencies
- **WHEN** the contributor runs `npm run check`
- **THEN** the Core and CLI tests run
- **AND** the existing bootstrap checks still run
- **AND** the command exits with code 0

#### Scenario: A failing test stops the check

- **GIVEN** a Core or CLI test fails
- **WHEN** the contributor runs `npm run check`
- **THEN** the command exits with a non-zero code
- **AND** the bootstrap checks are not reported as successful

### Requirement: Local source execution requires no npm publication

The project SHALL remain private and SHALL be runnable from a source checkout without publishing the package or installing a package named `alpha-binary` from a registry.

#### Scenario: Package metadata remains private

- **GIVEN** the repository package manifest
- **WHEN** it is inspected
- **THEN** `private` is `true`
- **AND** the `check` script is still `node scripts/check-bootstrap.mjs`
- **AND** no publish script or publish lifecycle hook is present

#### Scenario: Execute from source without publishing

- **GIVEN** a source checkout with Node.js available
- **WHEN** the user runs the CLI from source
- **THEN** execution does not require `npm publish`, a registry login, or a global `alpha-binary` installation
