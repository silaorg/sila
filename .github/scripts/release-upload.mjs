#!/usr/bin/env node
// Build, package and upload artifacts for a given platform.
// Env:
//  - PLATFORM: linux | windows | macos
//  - TAG: vX.Y.Z
//  - GITHUB_TOKEN: token with contents:write
//  - ELECTRON_BUILDER_DISABLE_PUBLISH=true (ensures no auto-publish)
//  - mac only: APPLE_ID, APPLE_TEAM_ID, APPLE_APP_SPECIFIC_PASSWORD, CSC_IDENTITY_AUTO_DISCOVERY=true

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';

function sh(cmd, opts = {}) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function capture(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...opts }).trim();
}

function main() {
  const platform = (process.env.PLATFORM || '').toLowerCase();
  const tag = process.env.TAG;
  if (!platform || !tag) {
    console.error('Missing PLATFORM or TAG');
    process.exit(1);
  }
  if (platform === 'linux') {
    try {
      sh(`gh release view ${tag}`);
      sh(`gh release edit ${tag} --draft=true --prerelease=false --verify-tag`);
    } catch {
      sh(`gh release create ${tag} --draft --verify-tag --generate-notes`);
    }
  }

  process.chdir('packages/desktop');
  const env = { ...process.env, ELECTRON_BUILDER_DISABLE_PUBLISH: 'true' };
  if (platform === 'linux') {
    sh('npx electron-builder --linux --publish=never', { env });
  } else if (platform === 'windows') {
    sh('npx electron-builder --win --publish=never', { env });
  } else if (platform === 'macos') {
    sh('npx electron-builder --mac --publish=never', { env });
  } else {
    console.error(`Unknown PLATFORM: ${platform}`);
    process.exit(1);
  }

  process.chdir('dist');
  const patterns = platform === 'linux'
    ? ['*.AppImage', '*.deb', '*.rpm', '*latest*.yml', '*-linux-*.yml']
    : platform === 'windows'
      ? ['*.exe', '*.msi', '*latest*.yml', '*-windows-*.yml']
      : ['*.dmg', '*latest*.yml', '*-mac*.yml'];

  const isWin = process.platform === 'win32';
  const listCmd = isWin
    ? `powershell -NoProfile -Command "Get-ChildItem -Path ${patterns.map(p => `'${p}'`).join(',')} -ErrorAction SilentlyContinue | Select-Object -Expand FullName"`
    : `bash -lc "shopt -s nullglob; for g in ${patterns.join(' ')}; do for f in $g; do echo \"$f\"; done; done | sort -u"`;

  const out = capture(listCmd);
  const files = out ? out.split(/\r?\n/).filter(p => existsSync(p)) : [];
  if (files.length === 0) {
    console.log(`No ${platform} artifacts to upload`);
    return;
  }
  console.log(`Uploading ${files.length} ${platform} artifacts to ${tag}`);
  const args = files.map(f => `'${f.replace(/'/g, `'\'"\"\"\"`)}'`); // keep simple quotes safe
  sh(`gh release upload ${tag} ${args.join(' ')} --clobber`);
}

main();


