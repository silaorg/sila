import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../vendor/neorest/', import.meta.url));
if (!existsSync(`${root}packages/neorest/package.json`)) {
  throw new Error(
    'Initialize pinned dependencies first: git submodule update --init --recursive',
  );
}
function run(args) {
  const result = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args,
    {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'development',
        npm_config_omit: '',
        npm_config_include: 'dev',
      },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const hash = createHash('sha256')
  .update(readFileSync(`${root}package-lock.json`))
  .digest('hex');
const stamp = `${root}node_modules/.heswe-lock-hash`;
if (
  !existsSync(stamp) ||
  readFileSync(stamp, 'utf8') !== hash ||
  !existsSync(`${root}node_modules/typescript/bin/tsc`)
) {
  // HTTP and WebSocket need no native HTTP/3 or WebRTC installation.
  run(['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  writeFileSync(stamp, hash);
}
run(['run', 'build']);
