# Design

## Context

See `proposal.md` for motivation. AB-002 provides an importable Core and a source-runnable CLI. AB-003 is the prerequisite that adds PNG decoding/encoding and the in-memory image shape `{ width, height, pixels, physicalResolution? }`, where `pixels` is a row-major 8-bit RGBA `Uint8Array`. AB-004 adds only the alpha-dithering step between decoding and encoding. If the AB-003 primitives are absent when implementation starts, this change is blocked rather than duplicating PNG work.

## Goals / Non-Goals

**Goals:**

- Convert RGBA alpha coverage to binary transparency with one deterministic Bayer 8 × 8 operation in the Core.
- Return a new image that preserves dimensions, RGB bytes, and an existing physical-resolution declaration.
- Keep the operation pure and in-memory so it can be imported and tested without the CLI, files, or a remote service.
- Cover the behavior with small deterministic `node:test` cases.

**Non-Goals:**

- Adding a CLI command, flag parsing, file I/O, or PNG codec changes.
- Background removal, `inspect` metrics, print-readiness claims, or a second dithering algorithm.
- Changing the existing Core/CLI boundaries, package scripts, workflows, or OpenSpec configuration.
- Defining diagnostics for malformed image objects beyond the AB-003 image contract.

## Decisions

### One pure Core operation: `ditherAlphaBayer8(image)`

Add a Core function that accepts the AB-003 image shape and returns a new object with the same `width` and `height`, a new RGBA `pixels` buffer, and the same `physicalResolution` value when the input has one. It does not mutate the input buffer or object. It accepts no options, algorithm selector, seed, or threshold parameter.

Alternative considered: an options object with an algorithm name. Rejected because AB-004 requires Bayer 8 × 8 as the only prototype algorithm and an options surface would invite a second path before a product decision exists.

### Standard Bayer 8 × 8 matrix anchored at the top-left

Use the standard ordered Bayer matrix, tiled from pixel (0, 0):

```text
 0 32  8 40  2 34 10 42
48 16 56 24 50 18 58 26
12 44  4 36 14 46  6 38
60 28 52 20 62 30 54 22
 3 35 11 43  1 33  9 41
51 19 59 27 49 17 57 25
15 47  7 39 13 45  5 37
63 31 55 23 61 29 53 21
```

For pixel `(x, y)`, let `B = matrix[y % 8][x % 8]`. The midpoint threshold is `(B + 0.5) / 64`. Because 8-bit alpha cannot equal that threshold exactly, the comparison is implemented without floating-point ambiguity as:

```text
outputAlpha = inputAlpha * 64 >= B * 255 + 128 ? 255 : 0
```

This keeps alpha 0 transparent and alpha 255 opaque. For a uniform input alpha of 128, matrix values 0–31 produce 255 and values 32–63 produce 0, yielding the expected alternating 8 × 8 pattern.

Alternative considered: a transposed, rotated, or randomly offset matrix. Rejected because AB-004 does not define a phase, and the standard top-left-anchored matrix gives one stable, explainable output for the same image.

### Only alpha is rewritten

Copy every red, green, and blue byte unchanged and write only the alpha byte. This directly preserves opaque pixel colors. RGB bytes under pixels that become transparent are also left unchanged because AB-004 does not require clearing them; preserving them avoids an extra product decision and keeps the operation reversible in shape.

Alternative considered: zeroing RGB for transparent output pixels. Rejected because it is not required and would discard source color information.

### Preserve dimensions and existing physical resolution

The result keeps the input dimensions and copies `physicalResolution` only when it is present. The operation never infers or adds resolution metadata. This lets the AB-003 encoder write the same declaration later without AB-004 inventing metadata.

Alternative considered: dropping metadata in the dither step and reattaching it in the CLI. Rejected because the Core image is the natural carrier and dropping it would make the later command easier to get wrong.

### Tests use direct image objects and PNG round-trips

Add `node:test` coverage that constructs RGBA images directly, checks the exact 8 × 8 threshold pattern and alpha counts, and optionally encodes/decodes a dithered image through the AB-003 codec to confirm binary alpha survives PNG output. A spawned Node.js process verifies that importing and calling the Core dithering function produces no standard output or error and does not load the CLI.

Alternative considered: testing only through the future `convert` command. Rejected because AB-006 is not part of this change and Core behavior must be testable now.

## Risks / Trade-offs

- **Matrix orientation ambiguity** → Fix the standard top-left-anchored matrix in this design and test an exact 8 × 8 pattern; record the assumption in the proposal.
- **Threshold boundary mistakes at alpha 0, 1, 254, and 255** → Use the integer comparison above and test the endpoints plus intermediate values.
- **Accidental input mutation** → Allocate a new pixel buffer and assert the input bytes are unchanged after the call.
- **Metadata loss** → Preserve `physicalResolution` only when present and test both present and absent cases.
- **Scope creep into CLI or background removal** → Keep the function in the Core, expose no command or file parameter, and leave AB-005/AB-006 work untouched.
- **AB-003 dependency is not available in the current checkout** → Treat the dependency as a prerequisite; do not reimplement PNG code in AB-004.
- **Large images** → Use a single pass over the RGBA buffer and one output allocation; no additional optimization is required by this task.

## Migration Plan

Additive only. Introduce the Core function, its export, and tests. No data or command behavior migrates. Roll back by removing the function, export, and tests.

## Open Questions

None blocking. The matrix phase, RGB handling under transparent pixels, and function name are planning assumptions recorded in the proposal because AB-004 does not specify them. A product decision to change any of them would require revising this design and the corresponding spec scenarios before implementation.
