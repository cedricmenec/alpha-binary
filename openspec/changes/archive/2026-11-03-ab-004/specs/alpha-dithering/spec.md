# Spec Delta

## Purpose

Converts RGBA alpha coverage into deterministic binary transparency with ordered Bayer 8 × 8 thresholding inside the Core, preserving dimensions, colors, and existing physical resolution.

## ADDED Requirements

### Requirement: Core applies ordered Bayer 8 × 8 alpha dithering

The Core SHALL provide an in-memory operation that applies ordered Bayer 8 × 8 thresholding to an RGBA image. It SHALL use the standard 8 × 8 matrix anchored at pixel (0, 0) and SHALL NOT expose an alternative dithering algorithm or algorithm-selection parameter.

#### Scenario: Dither a semi-transparent image with the Bayer pattern

- **GIVEN** an RGBA image whose pixels include semi-transparent alpha values
- **WHEN** the Core applies alpha dithering
- **THEN** the result is a new image with the same width and height
- **AND** each pixel's threshold comes from the Bayer matrix at `(x % 8, y % 8)` tiled from pixel (0, 0)
- **AND** a uniform alpha of 128 produces the expected alternating 8 × 8 pattern

### Requirement: Output alpha is strictly binary

Every alpha byte in the dithered image SHALL be exactly 0 or 255. The operation MUST NOT return any alpha value between 1 and 254, regardless of the input coverage.

#### Scenario: Alpha counts contain no intermediate values

- **GIVEN** an image with alpha values spanning 0 through 255, including 1, 64, 127, 128, 200, and 254
- **WHEN** the Core applies alpha dithering
- **THEN** every output alpha is 0 or 255
- **AND** the count of alpha 0 plus the count of alpha 255 equals width × height
- **AND** the count of alpha values from 1 to 254 is zero

### Requirement: Dithering is deterministic

For the same input pixels, dimensions, and options, the Core SHALL return byte-identical output on every call. The result MUST NOT depend on call order, randomness, wall-clock time, process state, or the environment.

#### Scenario: Repeated calls and separate processes agree

- **GIVEN** two identical RGBA images and no options
- **WHEN** alpha dithering is called repeatedly and in a separate Node.js process
- **THEN** every result has identical dimensions and pixel bytes
- **AND** the input image bytes remain unchanged

### Requirement: Endpoint alpha values and opaque colors are preserved

The Core SHALL preserve endpoint alpha values: input alpha 0 SHALL remain 0 and input alpha 255 SHALL remain 255. For pixels that remain opaque, the red, green, and blue bytes MUST be preserved exactly.

#### Scenario: Opaque pixels keep their colors

- **GIVEN** an image containing opaque pixels with distinct RGB values
- **WHEN** the Core applies alpha dithering
- **THEN** each opaque pixel has output alpha 255
- **AND** each opaque pixel's RGB bytes equal the input RGB bytes

#### Scenario: Fully transparent pixels stay transparent

- **GIVEN** an image containing pixels with alpha 0
- **WHEN** the Core applies alpha dithering
- **THEN** each corresponding output alpha is 0
- **AND** no fully transparent pixel becomes 255

### Requirement: Dimensions and existing physical resolution are preserved

The dithered image SHALL keep the input width and height and SHALL preserve an existing physical-resolution declaration unchanged. The operation MUST NOT infer, convert, or add physical-resolution metadata.

#### Scenario: Dimensions and existing physical resolution survive

- **GIVEN** a decoded image with known dimensions and an existing `physicalResolution` value
- **WHEN** the Core applies alpha dithering
- **THEN** the result has the same width and height
- **AND** the result's `physicalResolution` equals the input value

#### Scenario: No physical resolution is invented

- **GIVEN** a decoded image without a `physicalResolution` value
- **WHEN** the Core applies alpha dithering
- **THEN** the result has no `physicalResolution` value
- **AND** no resolution metadata is added

### Requirement: Dithering is an in-memory Core operation

The alpha-dithering operation SHALL accept only an in-memory image and return a new image. It MUST NOT import or call CLI modules, read or write files, access a network or remote service, read process arguments, or write to standard output or standard error.

#### Scenario: Dithering has no CLI, file, or service side effects

- **GIVEN** the Core dithering operation imported in a Node.js process
- **WHEN** it is called with an in-memory image
- **THEN** the call succeeds without a file path, network endpoint, or command-line argument
- **AND** standard output and standard error remain empty
- **AND** no CLI argument parser is initialized
