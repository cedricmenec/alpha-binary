# alpha-binary

Node.js CLI and reusable core to convert PNG images to binary alpha transparency with dithering, optional background removal, and pixel-level diagnostics.

AlphaBinary is a local prototype. It uses only built-in Node.js capabilities, performs no network access during conversion or inspection, and has no runtime dependencies.

## Requirements

- Node.js `>=22.23.3 <23` (the exact version pinned in `package.json` and CI is `22.23.3`).
- Git to obtain the source from GitHub.

There is no published package to install. Do not run `npm publish`, a registry login, or a global `alpha-binary` installation. Run the CLI directly from a source checkout.

## Run from a GitHub source checkout

```sh
git clone <repository-url> alpha-binary
cd alpha-binary
npm ci --ignore-scripts
node bin/alpha-binary.js --help
```

The same help command can be run through the repository script:

```sh
npm run cli -- --help
```

Both forms use the source entry point in `bin/alpha-binary.js`. Replace `<repository-url>` with the project's GitHub clone URL.

## Commands

The top-level help lists both commands:

```text
Usage: alpha-binary <command> [options]
       alpha-binary convert <source.png> <output.png> [options]
       alpha-binary inspect <source.png> [options]
```

### convert

Convert a PNG to binary alpha using fixed Bayer 8 x 8 dithering. The source is read-only and its dimensions are preserved.

```sh
node bin/alpha-binary.js convert <source.png> <output.png> [options]
npm run cli -- convert <source.png> <output.png> [options]
```

Required arguments:

- `<source.png>`: readable PNG source.
- `<output.png>`: output path. The command refuses to overwrite an existing path unless `--overwrite` is supplied.

Optional arguments:

- `--background <hex>`: background color as six hexadecimal digits, optionally prefixed by `#`. Requires `--tolerance`.
- `--tolerance <0-255>`: inclusive per-channel tolerance for background removal. Requires `--background`.
- `--overwrite`: replace an existing output after source-identity checks.
- `--json`: emit one machine-readable JSON object on standard output.
- `-h`, `--help`: show convert help.

Text success output has this shape:

```text
Converted PNG
Source: <source path>
Output: <output path>
Dimensions: <width>x<height>
Algorithm: bayer-8x8
Background removal: none
Alpha 0: <count>
Alpha 255: <count>
Alpha intermediate: 0
```

With `--background` and `--tolerance`, the `Background removal` line shows the color and tolerance instead of `none`.

JSON success output has these fields:

```json
{
  "source": "source.png",
  "output": "output.png",
  "width": 8,
  "height": 8,
  "algorithm": "bayer-8x8",
  "backgroundRemoval": null,
  "alpha": { "zero": 32, "full": 32, "intermediate": 0 }
}
```

`backgroundRemoval` is `null` when the two background options are absent. Otherwise it contains `{ "color": { "red": 0, "green": 0, "blue": 0 }, "tolerance": 0 }`.

### inspect

Analyse a PNG alpha distribution and isolated opaque pixels without writing the source.

```sh
node bin/alpha-binary.js inspect <source.png> [options]
npm run cli -- inspect <source.png> [options]
```

Required argument:

- `<source.png>`: readable PNG source.

Optional arguments:

- `--printed-width <mm>`: positive printed width in millimetres; enables the physical pixel size. This is a reporting input only and does not resize the image.
- `--json`: emit one machine-readable JSON object on standard output.
- `-h`, `--help`: show inspect help.

Text success output has this shape:

```text
Inspected PNG
Source: <source path>
Dimensions: <width>x<height>
Total pixels: <total>
Alpha 0: <count>
Alpha 255: <count>
Alpha intermediate: <count>
Isolated opaque: <count>
Isolated/opaque: <ratio or N/A>
Isolated/total: <ratio>
Physical pixel size: not computed

These metrics are indicators of potential fragility, not a print certification.
```

When `--printed-width` is supplied, the last metric line reads `<millimetres> mm/pixel (printed width <mm> mm)`.

JSON success output has these fields:

```json
{
  "source": "source.png",
  "width": 8,
  "height": 8,
  "total": 64,
  "alpha": { "zero": 1, "full": 1, "intermediate": 62 },
  "isolatedOpaque": 1,
  "ratios": { "isolatedToOpaque": 1, "isolatedToTotal": 0.015625 },
  "physical": null
}
```

`physical` is `null` without `--printed-width`. Otherwise it contains `{ "printedWidth": <mm>, "millimetresPerPixel": <mm> }`. `ratios.isolatedToOpaque` is `null` when there are no opaque pixels.

## Errors and exit codes

Exit code `0` means success, including help output.

Exit code `2` means an invocation or usage error, such as a missing or extra path, an unknown or duplicated option, a missing option value, an invalid background or tolerance, or an invalid printed width. An unknown top-level command also returns `2`.

Exit code `3` means a source, output, or processing error, such as an unreadable or invalid PNG, an existing output without `--overwrite`, an output that is the source file, a failed write, or a failed output verification.

Text errors are written to standard error and name a stable diagnostic code:

```text
alpha-binary convert: CLI_READ_FAILED: Cannot read PNG source "missing.png": <details> (missing.png)
```

JSON errors use this shape, with `path` present only when a path applies:

```json
{ "error": { "code": "CLI_READ_FAILED", "message": "<details>", "path": "missing.png" } }
```

Stable diagnostic codes include `CLI_MISSING_PATHS`, `CLI_EXTRA_PATHS`, `CLI_UNKNOWN_OPTION`, `CLI_DUPLICATE_OPTION`, `CLI_MISSING_OPTION_VALUE`, `CLI_INCOMPLETE_BACKGROUND`, `CLI_INVALID_BACKGROUND`, `CLI_INVALID_TOLERANCE`, `CLI_INVALID_PRINTED_WIDTH`, `CLI_READ_FAILED`, `CLI_OUTPUT_EXISTS`, `CLI_OUTPUT_IS_SOURCE`, `CLI_WRITE_FAILED`, `CLI_VERIFY_FAILED`, `CLI_PROCESSING_FAILED`, and PNG decoding codes such as `PNG_INVALID_SIGNATURE`, `PNG_CRC_MISMATCH`, and `PNG_UNSUPPORTED_VARIANT`.

## Accepted inputs and prototype limits

The decoder accepts non-interlaced PNG files with bit depth 8, compression method 0, filter method 0, and color type 0, 2, 3, 4, or 6. Palette transparency and `tRNS` are supported. Input must pass chunk and CRC validation and must fit the decoded-size limit. Output is written as 8-bit RGBA PNG with binary alpha.

This prototype does not resize, crop, perform AI cutout, call a remote service, or publish the package. It does not change the source file. Conversion always preserves the source dimensions.

Inspection metrics are indicators of potential fragility: they help identify isolated opaque pixels and alpha distribution, but they do not model a specific printer, material, or production process. No result is claimed to be ready to print or certified for printing.

## Tests

Run the local checks with:

```sh
npm test
npm run check
```

The reference acceptance suite uses the checked-in PNGs under `test/fixtures/reference/`, converts them in temporary directories, verifies binary alpha, RGB and dimension preservation, cross-process determinism, expected inspection metrics, and source immutability. The A-001 trial remains unresolved in the reference manifest because its original artwork is not checked in and source-specific expected outcomes remain outside the repository; no substitute is used. All checks are local and non-paying.

## Environnement de développement

Node.js 26.13.0 LTS est épinglé dans .nvmrc et la CI. npm exige >=26.13.0 <27 via engine-strict. Utiliser npm ci puis npm run check.

Le kit ASF AgentKit OpenCode/OpenSpec 1.4.0 est installé à partir de la [release immuable](https://github.com/cedricmenec/asf-agent-kits/releases/tag/kits/opencode-openspec/v1.4.0), épinglée au commit `4f9a31f94888f20a2df7b4335ec7c0f5a70d869d`. Le profil OpenCode Direct reste co-installé séparément. La migration Node.js 1.2.0 a déjà été qualifiée : ses anciens scripts et workflows temporaires ne sont plus nécessaires. Les exécutions OpenCode restent manuelles et potentiellement payantes.
