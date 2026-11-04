import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(' ')}\n${result.stderr || result.stdout}`,
    );
  }
}

const manifest = readJson('package.json');
const lock = readJson('package-lock.json');
assert(manifest.name === lock.name, 'package-lock.json name does not match package.json');
assert(manifest.version === lock.version, 'package-lock.json version does not match package.json');
assert(lock.lockfileVersion === 3, 'package-lock.json must use lockfile version 3');
assert(lock.packages?.['']?.name === manifest.name, 'lock root package name is inconsistent');
assert(lock.packages?.['']?.version === manifest.version, 'lock root package version is inconsistent');
assert(manifest.scripts?.check === 'node scripts/check-bootstrap.mjs', 'npm run check must call the bootstrap check');

const config = readFileSync('openspec/config.yaml', 'utf8');
assert(/^schema:\s*spec-driven\s*$/m.test(config), 'OpenSpec config must select spec-driven');
assert(/^context:\s*\|\s*$/m.test(config), 'OpenSpec config must define project context');
assert(readFileSync('backlog/tasks/AB-001.md', 'utf8').includes('# AB-001'), 'AB-001 task file is missing');

const profileLocks = ['.asf/agentkit.lock.json', '.asf/agentkit/locks/opencode-direct.json'].map(readJson);
assert(new Set(profileLocks.map(lock => lock.kitId)).size === profileLocks.length, 'Duplicate profile locks');
for (const agentkitLock of profileLocks) {
  assert(agentkitLock.targetRepository === 'cedricmenec/alpha-binary', 'Unexpected kit repository');
  for (const [path, expected] of Object.entries(agentkitLock.managedFiles)) {
    const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
    assert(actual === expected, `ASF managed file drift: ${path}`);
  }
}
for (const file of readdirSync('.asf/agentkit/direct').filter(name => name.endsWith('.mjs'))) {
  run(process.execPath, ['--check', '.asf/agentkit/direct/' + file]);
}
run('bash', ['-n', '.asf/agentkit/direct/phase.sh']);
for (const file of readdirSync('.asf/agentkit/runtime')
  .filter((name) => name.endsWith('.mjs'))
  .map((name) => `.asf/agentkit/runtime/${name}`)) {
  run(process.execPath, ['--check', file]);
}
run(process.execPath, ['--check', 'scripts/check-bootstrap.mjs']);
run('bash', ['-n', '.asf/agentkit/runtime/phase.sh']);

console.log('Bootstrap config, package lock, ASF integrity, and runtime syntax checks passed.');
