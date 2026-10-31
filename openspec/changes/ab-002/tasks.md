# Tasks

## 1. Core boundary

- [x] 1.1 Add `src/core/index.js` with a callable `describeCore()` skeleton export that does not import CLI modules or read `process.argv`; verify with `node --input-type=module -e "import { describeCore } from './src/core/index.js'; console.log(describeCore())"` and confirm no CLI output.
- [x] 1.2 Add `test/core.test.js` using `node:test` to cover import, callable export, return value, and empty stdout/stderr during import; verify `node --test test/core.test.js` passes.

## 2. CLI entry point and help

- [x] 2.1 Add `src/cli/index.js` with `main(argv, io)` implementing `-h`/`--help`, no-argument help, and clear unknown-command failure; add `test/cli.test.js` covering those cases and verify `node --test test/cli.test.js` passes.
- [x] 2.2 Add an executable `bin/alpha-binary.js` wrapper with a shebang, `process.exitCode` wiring, and no business logic; verify `node bin/alpha-binary.js --help` and `./bin/alpha-binary.js --help` both exit 0.
- [x] 2.3 Add a spawned-process test for `bin/alpha-binary.js` that checks help output and exit code; verify `node --test test/cli.test.js` passes.
- [x] 2.4 Add `bin`, `cli`, `test`, and `precheck` entries to `package.json` while leaving `check` as `node scripts/check-bootstrap.mjs`; verify `npm run cli -- --help` prints help and `npm test` passes.

## 3. Integration checks

- [x] 3.1 Run `npm ci --ignore-scripts` and then `npm run check`; verify the Core and CLI tests run before the existing bootstrap assertions and the command exits 0.
- [x] 3.2 Confirm no dependency or publication requirement was introduced; verify `npm ls --depth=0` reports no production dependencies and `package.json` still has `"private": true` with no publish script.
- [x] 3.3 Confirm the change remains within the AB-002 skeleton; verify `git diff --stat` lists only the allowed source, test, and `package.json` files and does not touch workflows, OpenSpec configuration, backlog files, or `scripts/check-bootstrap.mjs`.

## Unresolved requirements

- No blocking unresolved requirement exists for AB-002. The concrete conversion API and final CLI command inventory remain deferred to AB-003, AB-006, and AB-007; this change does not implement or claim them.

## Manual acceptance

The following are human acceptance checks and are not evidence that they were performed.

- In a terminal on a fresh checkout, run `node bin/alpha-binary.js --help` and confirm the help is concise, readable, and does not claim unimplemented conversion commands.
- Run `npm run cli -- --help` and confirm it shows the same help as the direct entry point.
- Run `./bin/alpha-binary.js --help` on Linux or macOS and confirm the executable bit and shebang work.
- Import the Core from a small Node.js script and call its skeleton function, confirming that no CLI output appears.
- Confirm that no npm registry login, publish step, or global installation is required.

## Post-sync review

The following are post-sync and publication steps, not completed work and not evidence that human checks occurred.

- Compare the synced main specs with the delta semantics for `core-runtime`, `cli-interface`, and `local-development`; confirm every requirement and scenario is preserved.
- Archive the change only after the project's review requirements are satisfied.
- Verify independent GitHub PR CI at the exact head SHA of the pull request.
- Perform merge review without inferring approval from checked-in files, this task list, or the plan itself.
