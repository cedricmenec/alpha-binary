# Spec Delta

## Purpose

Provides deterministic, in-memory measurement of a PNG's alpha distribution, isolated opaque pixels, their ratios, and an optional physical pixel size derived from an explicit printed width.

## ADDED Requirements

### Requirement: Alpha distribution covers every pixel exactly once

The metrics computation SHALL report the total pixel count, the count of alpha 0, the count of alpha 255, and the count of alpha values from 1 through 254. The three alpha-bucket counts MUST sum exactly to the total pixel count.

#### Scenario: Mixed alpha values partition the total

- **GIVEN** an image whose pixels include alpha 0, alpha 255, and intermediate values from 1 through 254
- **WHEN** the metrics computation runs
- **THEN** the total equals width × height
- **AND** the zero count, full count, and intermediate count sum exactly to the total
- **AND** every intermediate alpha value is counted in the 1-through-254 bucket

#### Scenario: Fully transparent image has no full bucket

- **GIVEN** an image whose every pixel has alpha 0
- **WHEN** the metrics computation runs
- **THEN** the zero count equals the total
- **AND** the full count and intermediate count are both zero

### Requirement: Isolated opaque pixels are size-one 8-connected components

The metrics computation SHALL count an opaque pixel as isolated only when it is a connected component of size exactly one under an 8-direction neighborhood. An opaque pixel is a pixel whose alpha is exactly 255; a neighbor is opaque only when its alpha is exactly 255, and out-of-bounds positions are not opaque.

#### Scenario: Opaque pixel without opaque neighbors is isolated

- **GIVEN** an opaque pixel whose eight neighbors, including diagonal positions, are not opaque
- **WHEN** the metrics computation runs
- **THEN** that pixel is counted as isolated opaque

#### Scenario: Diagonal opaque neighbor prevents isolation

- **GIVEN** an opaque pixel whose only opaque neighbor is diagonal
- **WHEN** the metrics computation runs
- **THEN** that pixel is not counted as isolated opaque

#### Scenario: Intermediate alpha does not create an opaque neighbor

- **GIVEN** an opaque pixel whose neighbors all have alpha values from 1 through 254
- **WHEN** the metrics computation runs
- **THEN** that pixel is counted as isolated opaque
- **AND** none of those intermediate pixels is counted as opaque

### Requirement: Isolated ratios are exact and opaque ratio can be N/A

The metrics computation SHALL report isolated opaque divided by opaque total and isolated opaque divided by pixel total as exact numeric ratios. It MUST report the isolated-to-opaque ratio as N/A when no pixel is opaque.

#### Scenario: Ratios follow their counts

- **GIVEN** an analysis whose isolated opaque count, opaque count, and total are known and the opaque count is greater than zero
- **WHEN** the metrics computation runs
- **THEN** the isolated-to-opaque ratio equals isolated opaque divided by opaque total
- **AND** the isolated-to-total ratio equals isolated opaque divided by pixel total

#### Scenario: No opaque pixels yields N/A

- **GIVEN** an image containing no pixel with alpha 255
- **WHEN** the metrics computation runs
- **THEN** the opaque count is zero
- **AND** the isolated-to-opaque ratio is reported as N/A
- **AND** the isolated-to-total ratio is reported as zero

### Requirement: Physical pixel size requires an explicit printed width

The metrics computation SHALL report a physical pixel size only when an explicit positive printed width is supplied. Without that value it MUST report the physical pixel size as not computed and MUST NOT infer it from image metadata, resolution, or dimensions. A supplied printed width MUST be a positive finite number.

#### Scenario: Printed width enables physical pixel size

- **GIVEN** an image of known width and an explicit printed width in millimetres
- **WHEN** the metrics computation runs
- **THEN** the physical pixel size equals the printed width divided by the image width
- **AND** the reported printed width equals the supplied value

#### Scenario: Missing printed width leaves physical size not computed

- **GIVEN** an image whose metadata contains a physical-resolution declaration
- **WHEN** the metrics computation runs without an explicit printed width
- **THEN** the physical pixel size is reported as not computed
- **AND** no value is derived from the physical-resolution declaration

#### Scenario: Invalid printed width is rejected

- **GIVEN** a printed width that is zero, negative, non-numeric, or not finite
- **WHEN** the metrics computation is asked to use it
- **THEN** it reports a stable diagnostic
- **AND** it returns no metrics

### Requirement: Metrics computation is deterministic and in-memory

The metrics computation SHALL accept only an in-memory image and optional options, and SHALL return a metrics value without mutating the input. It MUST NOT read or write files, access a network or remote service, read process arguments, or write to standard output or standard error.

#### Scenario: Repeated calls agree without mutation

- **GIVEN** an in-memory image and the same options
- **WHEN** the metrics computation is called repeatedly and in a separate Node.js process
- **THEN** every returned metrics value is identical
- **AND** the input image bytes remain unchanged

#### Scenario: Computation has no file or CLI side effects

- **GIVEN** the metrics operation imported in a Node.js process
- **WHEN** it is called with an in-memory image
- **THEN** the call succeeds without a file path, network endpoint, or command-line argument
- **AND** standard output and standard error remain empty
- **AND** no CLI argument parser is initialized
