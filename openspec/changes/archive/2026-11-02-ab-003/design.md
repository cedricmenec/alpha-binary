# Design

## Context

See `proposal.md` for motivation. The repository is a private Node.js 22 ESM package with no runtime dependencies. AB-002 provides an importable Core (`src/core/index.js`), a source-runnable CLI (`src/cli/index.js`, `bin/alpha-binary.js`) that currently exposes only honest help, and `node:test` suites run by `npm run check`. AB-003 adds PNG primitives without implementing dithering, background removal, `convert`, or `inspect`.

## Goals / Non-Goals

**Goals:**

- Decode PNG bytes into RGBA pixels, width, height, and an optional existing physical-resolution declaration.
- Encode RGBA pixels into a valid PNG without cropping, resizing, or implicit color conversion.
- Keep all filesystem access in the CLI layer and all pixel/chunk work in the Core.
- Make the safe-output rules (new path only, source never overwritten, existing output refused by default) deterministic and testable.
- Return stable error codes and clear messages; never return a successful result after a failure.

**Non-Goals:**

- Bayer dithering, background removal, image diagnostics, or the final `convert`/`inspect` command surfaces.
- A new help-visible command, option flags, or changes to existing help text.
- Supporting every PNG variant before AB-003 resolves which variants are required.
- Preserving ancillary metadata other than `pHYs`, color-profile conversion, or DPI inference.

## Decisions

### Pure Core PNG codec over byte arrays

Add the codec in Core and expose `decodePng(bytes)` and `encodePng(image)` from the Core entry point while keeping `describeCore()`. The decoder accepts a `Uint8Array` and returns `{ width, height, pixels, physicalResolution? }`, where `pixels` is a row-major 8-bit RGBA `Uint8Array`. The encoder accepts the same shape and returns PNG bytes. Neither function imports filesystem, path, CLI, or stream modules, reads `process.argv`, or writes output.

Alternative considered: decode by accepting a file path in Core. Rejected because it violates the AB-003 constraint that file access details stay in the CLI and makes the Core less reusable.

### Built-in `node:zlib` with a small chunk parser instead of a dependency

Use built-in zlib for IDAT compression/decompression and implement PNG signature, chunk length/type/CRC, IHDR validation, scanline unfiltering, and RGBA expansion directly. This keeps the package dependency-free and the behavior inspectable. The encoder emits 8-bit RGBA (color type 6), filter type 0, one IDAT stream, and IEND, with `pHYs` only when the input image carries one.

The planned accepted input set is non-interlaced 8-bit color types 0, 2, 3, 4, and 6, including `PLTE`/`tRNS` as needed to expand to RGBA. Truncated or malformed critical chunks, bad critical-chunk CRCs, invalid filter bytes, impossible dimensions, and inflated data whose length does not match the IHDR scanline layout are rejected. Other valid but unsupported variants, such as 16-bit samples or Adam7 interlacing, are rejected with an explicit unsupported-variant diagnostic rather than a false success.

Alternative considered: add a PNG library. Rejected for this change because Node's zlib plus the limited accepted set satisfies the accepted task without a new runtime dependency. Reconsider only if AB-003's unresolved variant requirements demand broader coverage.

### Preserve `pHYs` verbatim, never infer resolution

When an accepted `pHYs` chunk is present with its expected 9-byte payload and a valid unit value, expose its pixels-per-unit X/Y values and unit unchanged. The encoder writes the same values back only when present. It never converts units to DPI, derives a resolution from image size, or copies other ancillary chunks. A malformed or unsupported ancillary `pHYs` is not turned into invented metadata.

### CLI file adapter owns paths, existence checks, and writes

Add CLI-only functions for reading a source PNG and writing an encoded image to an explicit output path. They wrap Core results and filesystem errors into diagnostics carrying the affected path. The adapter does not print; AB-006 will format diagnostics and exit codes.

The write primitive always requires a source path and a distinct output path. It rejects an output that resolves to the same file as the source, including a symlink or hard link to the source, regardless of overwrite permission. It refuses an existing output by default. When overwrite is explicitly requested through the primitive's option, it replaces only the output through a temporary file in the output directory followed by rename. New outputs are created with an exclusive-create mode so a racing creator cannot be silently overwritten. The source is opened read-only and is never a write target.

Alternative considered: derive the output name from the source name. Rejected because AB-003 requires an explicit new path and no implicit overwrite.

### Stable error codes and no partial success

Core and CLI failures throw an error with a stable machine-readable code and a concise human-readable message. Core codes cover invalid signature, truncation, CRC mismatch, unsupported variant, invalid IHDR/scanline data, and invalid encoder input. CLI codes cover unreadable input, existing output, output equal to source, and write failure. A failed decode returns no image, and a failed write must not leave a new file reported as valid. Temporary files are removed on failure, and the source remains byte-for-byte unchanged.

## Risks / Trade-offs

- **Custom codec misses a valid PNG case** → Cover each accepted color type, `tRNS`, filters, CRC failures, and truncation with deterministic fixtures; reject unsupported variants explicitly; keep unresolved variant scope visible.
- **Decompression or allocation abuse from a crafted PNG** → Validate IHDR dimensions and expected inflated scanline size before allocating or accepting pixels; reject data whose inflated length is inconsistent.
- **Output race or symlink bypass** → Use exclusive create for new outputs, compare resolved paths and file identities for the source guard, and write overwrite replacements through a temporary file plus rename.
- **Partial output after a write error** → Create temporary outputs only in the destination directory and remove them on failure; never report success until the rename/create completes.
- **Metadata expectations beyond `pHYs`** → State the limitation in the capability spec and keep other metadata out of scope until a requirement exists.
- **Unresolved CLI surface blocks integration** → Keep primitives module-level and testable now; AB-006 owns command names, flags, and user-facing text.

## Migration Plan

Additive only. Introduce the Core codec, CLI file adapter, and tests; no existing data or command behavior migrates. Roll back by removing the added modules and tests.

## Open Questions

- Whether AB-003 must eventually accept 16-bit, Adam7-interlaced, or additional ancillary metadata remains a product decision recorded in the proposal. It does not change the safe file-I/O contract or the initial accepted subset.
- The final CLI command and flag names remain deferred to AB-006 and are not invented here.