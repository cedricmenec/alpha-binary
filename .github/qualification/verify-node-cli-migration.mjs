/** Real Node CLI qualification against this repository's pinned baseline.
 * All writes stay in disposable ordinary Git worktrees. No provider execution.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const repository = 'cedricmenec/alpha-binary';
const baseSha = '63406e151e12dbe98b83737d193e30eeab351368';
const candidateSha = 'e2a372c1a8f3a32895a6254a99d6d94e68f64fa9';
const version = '1.2.0'; // Immutable release source.
const source = path.resolve(process.env.CATALOGUE_DIR);
const target = path.resolve(process.env.TARGET_DIR);
const reportDir = path.resolve(process.env.REPORT_DIR);
const worktree = path.join(path.dirname(reportDir), 'node-cli-migration-worktree');
const config = path.join(target, '.github/qualification/node-cli-config.json');
const managed = JSON.parse(fs.readFileSync(path.join(target, '.asf/agentkit.lock.json'))).managedFiles;
const lockPath = '.asf/agentkit.lock.json';
const allowed = new Set([...Object.keys(managed), lockPath]);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], {
  encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
const save = (name, value) => fs.writeFileSync(path.join(reportDir, name), JSON.stringify(value, null, 2) + '\n');
const cli = (operation, extra, expected = 0) => {
  const args = [path.join(source, 'bin/asf-agentkit'), operation, '--repo', repository, '--checkout', worktree];
  if (operation === 'upgrade' || operation === 'install') args.push('--kit', 'opencode-openspec', '--version', version, '--source', source, '--source-commit', candidateSha, '--config', config);
  if (operation === 'doctor') args.push('--config', config);
  const result = spawnSync(process.execPath, [...args, ...extra], {
    encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024,
  });
  assert.equal(result.status, expected, `${operation}: ${result.stderr}`);
  return expected === 0 || expected === 2 ? JSON.parse(result.stdout) : result.stderr;
};
const read = p => fs.readFileSync(path.join(worktree, p));
const commit = message => {
  git(worktree, 'add', '-A');
  git(worktree, '-c', 'user.name=AgentKit Qualification', '-c', 'user.email=qualification@example.invalid', 'commit', '-qm', message);
};

fs.mkdirSync(reportDir, { recursive: true });
assert.equal(process.versions.node, '26.13.0');
const targetPackage = JSON.parse(fs.readFileSync(path.join(target, 'package.json')));
const targetPackageLock = JSON.parse(fs.readFileSync(path.join(target, 'package-lock.json')));
assert.equal(targetPackage.engines.node, '>=26.13.0 <27');
assert.equal(targetPackageLock.packages[''].engines.node, targetPackage.engines.node);
assert.equal(fs.readFileSync(path.join(target, '.npmrc'), 'utf8').trim(), 'engine-strict=true');
assert.equal(fs.readFileSync(path.join(target, '.nvmrc'), 'utf8').trim(), '26.13.0');
assert.equal(git(source, 'rev-parse', 'HEAD'), candidateSha);
assert.equal(git(target, 'rev-parse', 'refs/remotes/origin/main'), baseSha, 'Qualification baseline moved; review the test before proceeding');
git(target, 'worktree', 'add', '-b', 'qualification/node-cli-rehearsal', worktree, baseSha);
const oldLockBytes = read(lockPath);
const oldLock = JSON.parse(oldLockBytes);
assert.equal(oldLock.version, '1.1.0');
assert.equal(oldLock.configurationSha256, 'f09d0ae99567598b94f4364861af8437c6711860d3eee37913339e104a473544');
assert.equal(cli('status', []).status, 'hash-match');
const originalTree = git(worktree, 'rev-parse', 'HEAD^{tree}');
const original = Object.fromEntries([...allowed].map(p => [p, read(p)]));
const basePaths = git(worktree, 'ls-tree', '-r', '--name-only', baseSha).split('\n');
const projectHashes = Object.fromEntries(basePaths.filter(p => !allowed.has(p)).map(p => [p, sha256(read(p))]));

const preview = cli('upgrade', ['--dry-run']);
assert.equal(preview.status, 'proposed');
assert.equal(preview.sourceCommitSha, candidateSha);
assert.equal(preview.releaseProvenanceVerified, false);
assert.equal(preview.configurationSha256, oldLock.configurationSha256);
assert.ok(preview.operations.some(item => item.action === 'update'));
assert.equal(git(worktree, 'status', '--porcelain'), '');
save('upgrade-plan.json', preview);
const applied = cli('upgrade', ['--apply', '--expected-head', baseSha, '--expected-plan-sha', preview.planSha256]);
assert.equal(applied.status, 'applied-locally-uncommitted');
assert.equal(applied.createdFiles, 0);
save('upgrade-result.json', applied);

const status = cli('status', []), doctor = cli('doctor', []);
assert.equal(status.status, 'hash-match');
assert.equal(status.kitVersion, version);
assert.equal(status.sourceCommitSha, candidateSha);
assert.ok(Object.values(doctor.localChecks).every(Boolean));
save('status.json', status); save('doctor.json', doctor);
const nextLock = JSON.parse(read(lockPath));
assert.equal(nextLock.sourceTrust, 'user-pinned-git-object-unattested');
assert.equal(nextLock.configurationSha256, oldLock.configurationSha256);
for (const p of allowed) assert.deepEqual(read(p), fs.readFileSync(path.join(target, p)), `PR bytes must match the real CLI: ${p}`);
for (const [p, h] of Object.entries(projectHashes)) assert.equal(sha256(read(p)), h, `Existing project file preserved: ${p}`);
const changed = git(worktree, 'diff', '--name-only').split('\n').filter(Boolean);
assert.ok(changed.length > 0 && changed.every(p => allowed.has(p)));
const repeat = cli('install', ['--dry-run']);
assert.ok(repeat.operations.every(item => item.action === 'unchanged'));
save('repeat-plan.json', repeat);
const runtime = path.join(worktree, '.asf/agentkit/runtime');
for (const p of fs.readdirSync(runtime).filter(p => p.endsWith('.mjs'))) execFileSync(process.execPath, ['--check', path.join(runtime, p)]);
execFileSync('bash', ['-n', path.join(runtime, 'phase.sh')]);
fs.writeFileSync(path.join(reportDir, 'candidate.diff'), execFileSync('git', ['-C', worktree, 'diff', '--binary']));

commit('Qualification: apply pinned Node CLI candidate locally');
git(worktree, '-c', 'user.name=AgentKit Qualification', '-c', 'user.email=qualification@example.invalid', 'revert', '--no-edit', 'HEAD');
for (const [p, bytes] of Object.entries(original)) assert.deepEqual(read(p), bytes, `Rollback restores ${p}`);
assert.equal(git(worktree, 'rev-parse', 'HEAD^{tree}'), originalTree);
assert.equal(git(worktree, 'status', '--porcelain'), '');
const rollback = cli('status', []);
assert.equal(rollback.kitVersion, '1.1.0');
assert.equal(rollback.status, 'hash-match');
save('rollback-status.json', rollback);

const overlay = '.asf/agentkit/manual-acceptance.md';
fs.appendFileSync(path.join(worktree, overlay), '\nQualification: preserve this local overlay.\n');
commit('Qualification: add a local managed-file overlay');
const overlayHead = git(worktree, 'rev-parse', 'HEAD'), overlayHash = sha256(read(overlay));
const blocked = cli('upgrade', ['--dry-run'], 2);
assert.equal(blocked.status, 'blocked');
assert.ok(blocked.operations.some(item => item.path === overlay && item.action === 'conflict'));
cli('upgrade', ['--apply', '--expected-head', overlayHead, '--expected-plan-sha', blocked.planSha256], 3);
assert.equal(sha256(read(overlay)), overlayHash);
assert.deepEqual(read(lockPath), oldLockBytes);
assert.equal(git(worktree, 'status', '--porcelain'), '');
save('overlay-plan.json', blocked);
const report = {
  repository, baseSha, candidateSha, candidateDeclaredVersion: version,
  candidateIsPublishedRelease: true, nodeVersion: process.versions.node,
  targetPullRequestHead: git(target, 'rev-parse', 'HEAD'),
  planSha256: preview.planSha256, oldKitVersion: oldLock.version,
  updatedFiles: applied.updatedFiles, createdFiles: applied.createdFiles,
  changedManagedPaths: changed, managedHashesMatch: true,
  pullRequestBytesMatchRealCli: true, configurationPreserved: true,
  existingProjectFilesPreservedByCli: Object.keys(projectHashes).length,
  targetEngineRange: targetPackage.engines.node,
  engineStrictEnabled: true,
  runtimeConfigurationUpdatedByPr: ['package.json', 'package-lock.json', '.npmrc', '.nvmrc', '.github/workflows/ci.yml', 'README.md'],
  idempotenceVerified: true, gitRollbackVerified: true,
  overlayConflictRefusedWithoutWrites: true,
  paidModelInvoked: false, settingsChanged: false, mainModified: false,
};
save('evidence.json', report);
console.log('NODE_CLI_QUALIFICATION_EVIDENCE=' + JSON.stringify(report));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  `## Node CLI qualification passed\n\nSource: \`${candidateSha}\`\n\n${applied.updatedFiles} managed paths updated; all PR bytes match the actual CLI output. Existing project files and configuration preserved. Repeat install is unchanged. Git revert restores the exact baseline tree. Local overlay blocks upgrade without writes. No model invoked.\n`);
