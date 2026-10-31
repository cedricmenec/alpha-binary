# Design

## Context

See `proposal.md` for motivation. The repository is a private Node.js ESM package (`"type": "module"`, Node `>=22.23.3 <23`) with no runtime dependencies. Its existing `npm run check` runs `scripts/check-bootstrap.mjs`, and that script asserts the check command is exactly `node scripts/check-bootstrap.mjs`. AB-001 is complete; PNG input/output and conversion behavior belong to later tasks.

## Goals / Non-Goals

**Goals:**

- Provide a small, dependency-free Core module that can be imported and called independently of the CLI.
- Provide a CLI that runs directly from a source checkout and responds to help requests concisely.
- Make Core and CLI checks run through the repository's existing workflow.
- Keep the change reversible and limited to the AB-002 skeleton.

**Non-Goals:**

- Implementing PNG decoding/encoding, Bayer dithering, background removal, image diagnostics, or the future `convert`/`inspect` commands.
- Adding TypeScript, a build pipeline, a test framework dependency, a server, an API, an SDK, or a plugin system.
- Publishing to npm or requiring a global install.

## Decisions

### JavaScript ESM without a build step

Use plain JavaScript with native ESM because the repository already uses this model and Node.js 22 supports it directly. TypeScript would add compilation or loader tooling before the project has a demonstrated need. Alternative considered: TypeScript plus `tsx` or a compiler; rejected as disproportionate for a skeleton.

### Core boundary in `src/core/index.js`

The Core entry point will export a small callable skeleton function, `describeCore()`, returning a frozen object containing the package name. It is a temporary import/callability probe for AB-002, not the final conversion API. It must not import CLI code, read `process.argv`, or write to standard output/error. Later tasks can add real Core operations alongside it or replace it without changing the CLI boundary.

Alternative considered: an empty Core module. Rejected because it would not give tests or future callers a callable boundary to verify.

### CLI split between `src/cli/index.js` and `bin/alpha-binary.js`

`src/cli/index.js` owns argument interpretation and help text through an injectable `main(argv, io)` function so it can be tested in-process. `bin/alpha-binary.js` is a thin executable wrapper with a shebang that passes `process.argv.slice(2)`, `process.stdout`, and `process.stderr` to `main`, then sets `process.exitCode`.

Help behavior is deliberately small: `-h`, `--help`, and no arguments print concise usage to stdout and exit 0. An unknown command prints a concise diagnostic on stderr, does not print a stack trace, and exits non-zero. The help must not present future `convert` or `inspect` commands as already available.

Alternative considered: putting argument parsing directly in the `bin` file. Rejected because the `bin` file would be harder to test and would mix process concerns with CLI behavior.

### Existing check command runs tests through a lifecycle hook

Add `"test": "node --test"` and `"precheck": "npm test"` while leaving `"check": "node scripts/check-bootstrap.mjs"` unchanged. npm runs `precheck` before `check`, so `npm run check` executes the Core/CLI tests and then the existing bootstrap assertions without modifying `scripts/check-bootstrap.mjs` (which is outside the apply scope and protected by the AB-001 assertion).

Alternative considered: rewriting the `check` script to call tests directly. Rejected because the existing bootstrap script asserts the exact command text and is not editable under the apply scope.

### Local execution without publication

Expose the CLI through the `bin` field and a `"cli": "node bin/alpha-binary.js"` script. Users and agents can run `node bin/alpha-binary.js --help`, `./bin/alpha-binary.js --help`, or `npm run cli -- --help` from the source checkout. The package remains `"private": true`; no export map, publish script, or dependency installation from a registry is required.

## Risks / Trade-offs

- **Lifecycle-hook surprise** → Document the `precheck` behavior in the task verification and test `npm run check`, not only `npm test`.
- **Placeholder Core export mistaken for final API** → Keep `describeCore()` minimal and state in the design that conversion APIs arrive in later backlog tasks.
- **Help text drifts when commands are added** → Tests assert stable requirements (usage, command name, exit code) rather than exact full wording.
- **Executable-bit differences across platforms** → Keep `node bin/alpha-binary.js` as the portable path; verify direct `./bin/alpha-binary.js` on the Linux CI environment only.
- **Scope creep into future commands** → Do not add `convert` or `inspect` implementations in this change; help lists only what exists.

## Migration Plan

No migration is required. Add the new files and scripts, verify `npm test` and `npm run check`, then remove the new files and package entries to roll back.

## Open Questions

- The concrete Core conversion API and the final help command inventory are intentionally deferred to AB-003, AB-006, and AB-007. They do not change this skeleton's boundary, help behavior, or task breakdown.
