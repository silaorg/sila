import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../vendor/aiwrapper/', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(args) {
  const result = spawnSync(npm, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development', npm_config_omit: '', npm_config_include: 'dev' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(`${root}aimodels/js/package.json`)) {
  throw new Error('Initialize pinned dependencies first: git submodule update --init --recursive');
}

// Install AIWrapper separately so its compiler and Zod version stay independent.
const lockHash = createHash('sha256')
  .update(readFileSync(`${root}package-lock.json`))
  .digest('hex');
const installedHash = `${root}node_modules/.sila-lock-hash`;
if (!existsSync(installedHash)
  || readFileSync(installedHash, 'utf8') !== lockHash
  || !existsSync(`${root}node_modules/typescript/bin/tsc`)) {
  run(['ci', '--include=dev', '--no-audit', '--no-fund']);
  writeFileSync(installedHash, lockHash);
}

// The upstream build validates and bundles its pinned AIModels catalog too.
run(['run', 'build']);
