# uniform-background-removal Specification

## Purpose

Defines explicit, deterministic conversion of a uniform background color to transparent alpha coverage before Bayer dithering, without semantic cutout or implicit removal guesses.

## Requirements

### Requirement: Background removal requires explicit complete options

The background-removal operation SHALL apply only when both an RGB background color and a tolerance are supplied in the same explicit options value. It SHALL return an unchanged copy when no options are supplied. It MUST reject incomplete or out-of-range options with a stable diagnostic and return no image.

#### Scenario: No options leave opaque pixels untouched

- **GIVEN** an image containing opaque pixels whose RGB equals a likely background color
- **WHEN** the operation is called without background options
- **THEN** every output pixel equals the input pixel
- **AND** no opaque pixel becomes transparent

#### Scenario: Complete valid options activate removal

- **GIVEN** an image and an explicit background color with an explicit tolerance
- **WHEN** the operation is called with both values
- **THEN** the removal rule is applied to the image

#### Scenario: Incomplete options are rejected

- **GIVEN** an options value that supplies a color but no tolerance, or a tolerance but no color
- **WHEN** the operation is called
- **THEN** it reports a stable background-options diagnostic
- **AND** it returns no image

#### Scenario: Out-of-range values are rejected

- **GIVEN** a color component or a tolerance outside the accepted range
- **WHEN** the operation is called
- **THEN** it reports a stable background-options diagnostic
- **AND** it returns no image

### Requirement: Matching uses an inclusive per-channel rule

The operation SHALL match a pixel only when the absolute difference for each of red, green, and blue between the decoded 8-bit pixel value and the supplied color is less than or equal to the tolerance. Tolerance MUST be an integer from 0 through 255 in 8-bit channel-level units. A tolerance of 0 MUST require an exact RGB match. Alpha MUST NOT affect matching.

#### Scenario: Exact color matches at tolerance zero

- **GIVEN** a pixel whose red, green, and blue values equal the supplied background color
- **WHEN** the operation runs with tolerance 0
- **THEN** the pixel is treated as matching

#### Scenario: Channel difference equal to tolerance matches

- **GIVEN** a pixel whose channel differences from the background color are all less than or equal to a tolerance of 10, including at least one difference of exactly 10
- **WHEN** the operation runs with that tolerance
- **THEN** the pixel is treated as matching

#### Scenario: One channel outside tolerance does not match

- **GIVEN** a pixel whose red and green differences are within the tolerance but whose blue difference is greater than the tolerance
- **WHEN** the operation runs
- **THEN** the pixel is treated as nonmatching
- **AND** none of its bytes are changed

#### Scenario: Alpha does not affect matching

- **GIVEN** two pixels with the same RGB background color but different alpha values, including one already transparent pixel
- **WHEN** the operation runs with valid options
- **THEN** both pixels are treated as matching on RGB
- **AND** both output alpha values are 0

### Requirement: Matching pixels become transparent before Bayer dithering

When removal applies, every matching pixel SHALL have its output alpha set to 0 while its red, green, and blue bytes remain unchanged. The removal MUST occur before Bayer dithering so matching pixels contribute zero alpha coverage to the dithered result.

#### Scenario: Matching pixels become alpha zero and keep RGB

- **GIVEN** an image with matching background pixels carrying distinct RGB values
- **WHEN** the operation runs with valid options
- **THEN** each matching pixel has output alpha 0
- **AND** each matching pixel's RGB bytes equal its input RGB bytes

#### Scenario: Matching pixels stay transparent after dithering

- **GIVEN** an image with matching background pixels and nonmatching semi-transparent pixels
- **WHEN** background removal is followed by Bayer dithering
- **THEN** every background pixel has final alpha 0
- **AND** nonmatching semi-transparent pixels are thresholded by the Bayer rule
- **AND** all final alpha values are 0 or 255

### Requirement: Nonmatching pixels and image metadata are preserved

The operation SHALL leave every byte of every nonmatching pixel unchanged. It SHALL preserve the input width, height, and any existing physical-resolution declaration, SHALL return a new image without mutating the input, and SHALL be deterministic for the same image and options.

#### Scenario: Nonmatching pixels remain byte-identical

- **GIVEN** an image containing pixels outside the background match
- **WHEN** the operation runs with valid options
- **THEN** each nonmatching pixel's red, green, blue, and alpha bytes equal the input bytes

#### Scenario: Dimensions and physical resolution survive

- **GIVEN** an image with known dimensions and an existing physical-resolution declaration
- **WHEN** the operation runs with valid options
- **THEN** the result has the same width and height
- **AND** the result's physical resolution equals the input value
- **AND** no resolution metadata is invented when the input has none

#### Scenario: Input is not mutated and results are deterministic

- **GIVEN** an image and valid options
- **WHEN** the operation runs repeatedly and in a separate Node.js process
- **THEN** every result has byte-identical pixels
- **AND** the input image bytes remain unchanged

### Requirement: Background removal is an in-memory Core operation

The background-removal operation SHALL accept only an in-memory image and options and SHALL return a new image. It MUST NOT import or call CLI modules, read or write files, access a network or remote service, read process arguments, or write to standard output or standard error.

#### Scenario: Removal has no CLI, file, or service side effects

- **GIVEN** the Core background-removal operation imported in a Node.js process
- **WHEN** it is called with an in-memory image and valid options
- **THEN** the call succeeds without a file path, network endpoint, or command-line argument
- **AND** standard output and standard error remain empty
- **AND** no CLI argument parser is initialized
