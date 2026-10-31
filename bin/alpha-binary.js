#!/usr/bin/env node
import { main } from '../src/cli/index.js';

process.exitCode = main(process.argv.slice(2), {
  stdout: process.stdout,
  stderr: process.stderr,
});
