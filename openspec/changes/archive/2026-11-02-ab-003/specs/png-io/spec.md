# Spec Delta

## Purpose

Provides safe PNG decoding, encoding, and CLI-facing file primitives so image processing can work from RGBA pixels while preserving dimensions, colors, and existing physical resolution without risking the source file.

## ADDED Requirements

### Requirement: Accepted PNG input is decoded to RGBA

The Core SHALL decode non-interlaced 8-bit PNG inputs with color types 0 (grayscale), 2 (RGB), 3 (palette), 4 (grayscale with alpha), and 6 (RGBA), including applicable `tRNS` transparency, into an image carrying width, height, and row-major 8-bit RGBA pixels.

#### Scenario: Decode an RGBA PNG

- **GIVEN** a valid non-interlaced 8-bit RGBA PNG with known pixel values
- **WHEN** the Core decodes its bytes
- **THEN** the returned width and height match the PNG header
- **AND** the returned RGBA buffer contains the expected pixel values in row-major order

#### Scenario: Decode a palette PNG with transparency

- **GIVEN** a valid non-interlaced 8-bit palette PNG with a `PLTE` chunk and a `tRNS` chunk
- **WHEN** the Core decodes its bytes
- **THEN** each palette index is expanded to the corresponding RGBA color
- **AND** transparent palette entries produce the declared alpha value

#### Scenario: Decode a grayscale PNG

- **GIVEN** a valid non-interlaced 8-bit grayscale PNG
- **WHEN** the Core decodes its bytes
- **THEN** each grayscale sample appears in the red, green, and blue channels
- **AND** the alpha channel is fully opaque

### Requirement: Decoded pixels and dimensions are preserved

The Core decoder SHALL report the dimensions declared by the PNG header and SHALL preserve every decoded color and alpha value in the RGBA buffer without cropping, resizing, or implicit color conversion.

#### Scenario: Preserve dimensions and semi-transparent alpha

- **GIVEN** a valid PNG whose width, height, and pixels include semi-transparent alpha values
- **WHEN** the Core decodes it
- **THEN** the reported dimensions equal the source dimensions
- **AND** every RGBA byte equals the source pixel value
- **AND** no row or column is added or removed

### Requirement: Encoder produces a valid PNG

The Core SHALL encode an RGBA image into bytes containing a valid PNG signature, IHDR, at least one IDAT chunk, and IEND. The encoded bytes SHALL decode back to the same dimensions and RGBA pixel values without implicit resizing or cropping.

#### Scenario: Round-trip encoded pixels

- **GIVEN** an RGBA image with known dimensions and pixel values
- **WHEN** the Core encodes it and then decodes the encoded bytes
- **THEN** the decoded dimensions equal the original dimensions
- **AND** the decoded RGBA buffer equals the original RGBA buffer

#### Scenario: Encoded output has PNG structure

- **GIVEN** an RGBA image
- **WHEN** the Core encodes it
- **THEN** the result begins with the PNG signature
- **AND** the result contains IHDR, at least one IDAT, and IEND chunks

### Requirement: Physical resolution is preserved only when present

The Core SHALL expose a valid existing `pHYs` declaration and SHALL write that declaration back unchanged when re-encoding. It MUST NOT infer resolution or add a `pHYs` chunk to an image that does not carry one.

#### Scenario: Preserve an existing pHYs declaration

- **GIVEN** a valid PNG containing a `pHYs` chunk with known X, Y, and unit values
- **WHEN** the Core decodes and re-encodes the image
- **THEN** the encoded PNG contains the same X, Y, and unit values
- **AND** no unit conversion or DPI inference occurs

#### Scenario: Do not invent physical resolution

- **GIVEN** a valid PNG without a `pHYs` chunk
- **WHEN** the Core decodes and re-encodes the image
- **THEN** the encoded PNG contains no `pHYs` chunk
- **AND** the image has no physical-resolution declaration

### Requirement: Invalid PNG input yields a diagnostic and no image

The Core SHALL reject bytes that are not valid accepted PNG input, including bad signatures, truncated or malformed critical chunks, CRC failures, invalid scanline data, and unsupported variants. A rejection MUST include a stable diagnostic code and MUST NOT return an image.

#### Scenario: Reject a bad signature

- **GIVEN** bytes that do not begin with the PNG signature
- **WHEN** the Core attempts to decode them
- **THEN** it reports an invalid-signature diagnostic
- **AND** it returns no image

#### Scenario: Reject corrupt or truncated data

- **GIVEN** a PNG whose critical chunk CRC is wrong or whose data ends before the declared chunk boundary
- **WHEN** the Core attempts to decode it
- **THEN** it reports a CRC or truncation diagnostic
- **AND** it returns no image

#### Scenario: Reject an unsupported valid variant

- **GIVEN** a valid PNG that uses a bit depth or interlace mode outside the accepted input set
- **WHEN** the Core attempts to decode it
- **THEN** it reports an unsupported-variant diagnostic
- **AND** it returns no image

### Requirement: CLI read failures yield a diagnostic and no image

The CLI file adapter SHALL read only the explicit source path and SHALL report a missing or unreadable source with a clear path-specific diagnostic and no decoded image. Reading MUST NOT create or modify an output file.

#### Scenario: Missing source file

- **GIVEN** an input path that does not exist
- **WHEN** the CLI file adapter attempts to read it
- **THEN** it reports a path-specific read diagnostic
- **AND** no image is returned
- **AND** no output file is created

#### Scenario: Source exists but contains invalid PNG data

- **GIVEN** an existing source file whose content is not a valid accepted PNG
- **WHEN** the CLI file adapter attempts to read it
- **THEN** it reports the underlying PNG diagnostic with the source path
- **AND** no image is returned
- **AND** the source file remains unchanged

### Requirement: CLI writes only to an explicit distinct output

The CLI file adapter SHALL write encoded PNG bytes only to the caller-supplied output path. It SHALL reject any output that identifies the source file, including through path resolution, a symbolic link, or a hard link, before writing. The source SHALL remain unchanged.

#### Scenario: Write a new output path

- **GIVEN** a readable source PNG and a distinct output path that does not exist
- **WHEN** the CLI file adapter writes the image
- **THEN** the output file is created at the supplied path
- **AND** the output can be decoded to the expected dimensions and pixels
- **AND** the source bytes remain unchanged

#### Scenario: Reject writing to the source path

- **GIVEN** a source path and an output path that resolve to the same file
- **WHEN** the CLI file adapter attempts to write
- **THEN** it reports an output-is-source diagnostic
- **AND** the source file remains byte-for-byte unchanged

#### Scenario: Reject a linked output that identifies the source

- **GIVEN** an output path that is a symbolic link or hard link to the source file
- **WHEN** the CLI file adapter attempts to write
- **THEN** it reports an output-is-source diagnostic
- **AND** neither the source nor the link target is modified

### Requirement: Existing output is refused by default

The CLI file adapter SHALL refuse to replace an existing output unless the caller explicitly requests overwrite. A refusal MUST leave the existing output and the source unchanged.

#### Scenario: Existing output is refused by default

- **GIVEN** a source PNG and an output path that already exists
- **WHEN** the CLI file adapter writes without an explicit overwrite request
- **THEN** it reports an output-exists diagnostic
- **AND** the existing output bytes remain unchanged
- **AND** the source bytes remain unchanged

#### Scenario: Explicit overwrite replaces only the output

- **GIVEN** a source PNG and a distinct existing output path
- **WHEN** the CLI file adapter writes with an explicit overwrite request
- **THEN** the output is replaced with the encoded PNG
- **AND** the source bytes remain unchanged

### Requirement: CLI write failures yield a diagnostic and no valid result

The CLI file adapter SHALL report encoding and filesystem write failures with a clear path-specific diagnostic. It MUST NOT report a valid output or leave a completed output after failure, and it SHALL preserve the source.

#### Scenario: Output cannot be written

- **GIVEN** a valid source PNG and an output path whose directory is missing or not writable
- **WHEN** the CLI file adapter attempts to write
- **THEN** it reports a path-specific write diagnostic
- **AND** no completed output file is reported
- **AND** the source file remains unchanged

#### Scenario: Encoding rejects an invalid image

- **GIVEN** an image whose dimensions or RGBA buffer length are invalid
- **WHEN** the Core attempts to encode it
- **THEN** it reports an invalid-image diagnostic
- **AND** no PNG bytes are returned