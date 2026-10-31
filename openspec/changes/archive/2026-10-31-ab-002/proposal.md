# Proposal

## Why

AB-002 must establish a reusable Core/CLI boundary before PNG conversion behavior is added. Without that boundary, later image-processing work would become coupled to terminal input and file access, making it harder to test and requiring an npm release just to exercise the tool.

## What Changes

- Add a dependency-free JavaScript ESM Core entry point that can be imported and called by a Node.js program without loading the CLI.
- Add a source-runnable CLI entry point with a thin executable wrapper and concise help.
- Add `node:test` coverage for the Core boundary and the CLI help/entry behavior.
- Make the existing `npm run check` command run the new tests before the existing bootstrap checks, without changing the bootstrap check script.
- Keep the package private: no publish step, runtime dependency, API, SDK, server, or plugin layer is introduced.

## Capabilities

### New Capabilities

- `core-runtime`: The reusable Core module boundary and its independence from the CLI.
- `cli-interface`: The source-runnable CLI entry point, concise help, and invalid-usage behavior.
- `local-development`: The repository check command that validates Core and CLI, plus local execution without npm publication.

### Modified Capabilities

- None.

## Impact

- New source files under `src/core/`, `src/cli/`, and `bin/`, plus tests under `test/`.
- `package.json` gains local `bin`, `cli`, `test`, and `precheck` entries; the existing `check` script remains `node scripts/check-bootstrap.mjs`.
- No changes to PNG conversion behavior, workflows, OpenSpec configuration, backlog files, or the existing bootstrap script.
