# Tasks

## 1. Core PNG decoding

- [x] 1.1 Add the Core PNG decoder with signature/chunk parsing, critical-chunk CRC checks, zlib inflation, all PNG filter types, and RGBA expansion for non-interlaced 8-bit color types 0, 2, 3, 4, and 6 including `tRNS`; add known small fixtures for each accepted color type and verify with `node --test test/png-core.test.js`.
- [x] 1.2 Return decoded width, height, and row-major 8-bit RGBA pixels without cropping, resizing, or color conversion; add dimension and exact-pixel assertions for opaque and semi-transparent samples and verify the same test file passes.
- [x] 1.3 Parse a valid `pHYs` chunk into physical-resolution X, Y, and unit fields and leave the field absent when no `pHYs` chunk exists; add present/absent assertions and verify the same test file passes.
- [x] 1.4 Reject bad signatures, truncated or malformed critical chunks, CRC mismatches, invalid filter bytes, inconsistent inflated scanline lengths, and unsupported bit-depth/interlace variants with stable diagnostic codes and no image; add failure fixtures and verify the same test file passes.

## 2. Core PNG encoding

- [x] 2.1 Add the Core PNG encoder producing a PNG signature, IHDR, at least one IDAT, and IEND for 8-bit RGBA; add structural and decode-back round-trip assertions and verify `node --test test/png-core.test.js` passes.
- [x] 2.2 Write `pHYs` only when the image carries a physical-resolution declaration and preserve its X, Y, and unit values unchanged; add round-trip assertions with and without `pHYs` and verify the same test file passes.
- [x] 2.3 Reject invalid encoder dimensions and RGBA buffer lengths with an invalid-image diagnostic and no PNG bytes; add assertions for both failure cases and verify the same test file passes.
- [x] 2.4 Export the decoder and encoder from the Core entry point while keeping the existing `describeCore()` export and no CLI imports or output side effects; verify with `node --test test/core.test.js test/png-core.test.js` and an import check that emits no standard output or error.

## 3. CLI file adapter

- [x] 3.1 Add a CLI-only read primitive that accepts only an explicit source path, decodes through the Core, and reports missing/unreadable/invalid sources with path-specific diagnostics and no image; add temporary-directory tests proving the source is unchanged and verify `node --test test/png-cli.test.js`.
- [x] 3.2 Add a CLI-only write primitive that requires an explicit distinct output path, creates new outputs exclusively, and rejects an output resolving to the source through the same path, a symbolic link, or a hard link before writing; add tests for each case proving the source bytes are unchanged and verify the same test file passes.
- [x] 3.3 Refuse an existing output by default without changing it or the source; add an explicit overwrite option implemented with a temporary file in the output directory plus rename, and verify tests cover refusal, replacement, and source preservation in the same test file.
- [x] 3.4 Report encode and filesystem write failures with path-specific diagnostics, remove temporary output on failure, and never report a completed output after failure; add missing-directory and invalid-image assertions and verify the same test file passes.

## 4. Integration checks

- [x] 4.1 Confirm the CLI help and command inventory remain honest by adding or retaining an assertion that no PNG file-primitive command is advertised; verify `node --test test/cli.test.js` passes and `node bin/alpha-binary.js --help` exits 0.
- [x] 4.2 Run `npm test` and then `npm run check`; verify all Core, PNG, CLI, and bootstrap checks pass without paid services.
- [x] 4.3 Confirm `npm ls --depth=0` reports no production dependencies, `package.json` remains private with no publish script, and `git diff --stat` lists only source and test files for this change.

## Unresolved requirements

- The full required PNG variant set is not specified by AB-003. The current plan accepts non-interlaced 8-bit color types 0, 2, 3, 4, and 6 and rejects 16-bit, Adam7-interlaced, and other unsupported variants with clear diagnostics until a product decision expands the scope.
- No public CLI command or flag names are defined for PNG I/O in AB-003. This change provides CLI module primitives only; the user-facing `convert` surface remains deferred to AB-006.
- Preservation of ancillary metadata other than `pHYs` is not specified, so no other metadata is copied or invented.
- No implementation task is marked complete until its verification runs successfully during apply.

## Manual acceptance

The following are human acceptance checks and are not evidence that they were performed.

- Use a small Node.js script to invoke the CLI file primitives, then open the source and written PNG in an image viewer and visually confirm matching dimensions, colors, transparency, and absence of cropping or resizing.
- Open a PNG with a known physical resolution and its re-encoded output in a metadata-aware viewer, and visually confirm the `pHYs` resolution and unit are unchanged; open an image without `pHYs` and confirm the output does not acquire a fabricated resolution.
- Attempt to write over the source path, through a symbolic link, and through a hard link; confirm the diagnostic is understandable and the source is visually and byte-for-byte unchanged.
- Attempt to write to an existing output without overwrite and confirm the refusal is clear and the existing file is untouched; then exercise the explicit overwrite primitive and confirm only the output changes.
- Review diagnostics for missing, invalid, and unwritable inputs, and confirm they identify the affected path without an unhandled stack trace.

## Post-sync review

The following are post-sync and publication steps, not completed work and not evidence that human checks occurred.

- Compare the synced main `png-io` spec with this delta and confirm every requirement and scenario is preserved.
- Archive the change only after the project's review requirements are satisfied.
- Verify independent GitHub PR CI at the exact head SHA of the pull request.
- Perform merge review without inferring approval from checked-in files, this task list, or the plan itself.