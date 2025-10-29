# Build icons from per-platform sources

Goal: Provide a simple, deterministic way to generate desktop app icons for macOS, Windows, and Linux from separate source images. The script should run locally and in CI, and produce outputs that our Electron Builder setup already consumes.

## Why
- Different platforms often need slightly different compositions (padding, corner radius, contrast) even if the mark is the same.
- We currently hand-produce `.icns` and `.ico`. Automating this removes manual steps and mistakes.

## Scope
- Single Node CLI that:
  - Builds macOS `.icns` from a mac-specific source.
  - Builds Windows `.ico` from a win-specific source.
  - Emits Linux `icon.png` (512×512) from a linux-specific source.
  - Allows overriding output directory.
- Does not change Electron Builder config (we continue to rely on existing defaults/paths).

## CLI
```bash
node scripts/build-icons.js \
  --mac /path/to/macos.png \
  --win /path/to/windows.png \
  --linux /path/to/linux.png \
  --out packages/desktop/static-desktop

# Optional flags
  [--skip-mac] [--skip-win] [--skip-linux]
  [--mac-name Sila.iconset]   # override iconset folder name
  [--linux-size 512]          # emit linux PNG at specific size
```

Defaults if no flags are provided (so "node scripts/build-icons.js" just works):
- Inputs:
  - macOS: `packages/desktop/static-desktop/macos-icon-master.png`
  - Windows: `packages/desktop/static-desktop/windows-icon-master.png`
  - Linux: `packages/desktop/static-desktop/linux-icon-master.png`
- Output directory: `packages/desktop/static-desktop`
- The script throws if a required input is missing (unless the corresponding `--skip-*` flag is set).

## Inputs (recommended)
- macOS: 1024×1024 PNG with safe padding (transparent background). File may be different from Windows/Linux to account for rounded squircle appearance.
- Windows: 1024×1024 PNG (transparent). Script will generate multi-size ICO entries.
- Linux: 1024×1024 PNG (transparent). Script will downscale to 512×512 by default.

## Outputs (defaults)
Written to `packages/desktop/static-desktop/` unless `--out` is provided.
- macOS: `icon.icns`
- Windows: `icon.ico`
- Linux: `icon.png` (512×512 by default)

These match what our build expects:
- macOS uses `build/icon.icns` by Electron Builder default (we copy static assets into `build/`).
- Windows explicitly references `build/icon.ico`.
- Linux uses `build/icon.png`.

## Implementation notes
- macOS
  - Use `sips` to create an `.iconset` with sizes: 16, 32, 128, 256, 512 and `@2x` variants (up to 1024).
  - Use `iconutil -c icns` to build `icon.icns`.
- Windows
  - Prefer ImageMagick `convert` (if present) to compose a multi-entry `.ico` with sizes: 16, 24, 32, 48, 64, 128, 256.
  - If `convert` is not available, skip `.ico` with a warning (document how to install ImageMagick locally/CI).
- Linux
  - Downscale to a single `icon.png` at 512×512 by default (configurable).

## Script outline (Node)
```javascript
// scripts/build-icons.js (outline)
// - Parse args (minimist/yargs or manual)
// - Validate inputs
// - mac: generate .iconset with sips; run iconutil -> icon.icns
// - win: generate size PNGs; run `convert` -> icon.ico (optional)
// - linux: resize to icon.png (512)
// - Log produced files and sizes
```

## Minimal implementation (copy-paste)
```javascript
// packages/desktop/scripts/build-icons.js
// Usage:
//   node packages/desktop/scripts/build-icons.js
//   # optionally override with flags: --mac/--win/--linux/--out

import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

function arg(key, def) {
  const i = process.argv.indexOf(key);
  return i > -1 ? process.argv[i + 1] : def;
}
function flag(key) {
  return process.argv.includes(key);
}
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function exists(p) { return !!p && fs.existsSync(p); }
function have(cmd) {
  try { execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' }); return true; } catch { return false; }
}
function sipsResize(src, size, out) {
  const res = spawnSync('sips', ['-s', 'format', 'png', src, '--resampleHeightWidth', String(size), String(size), '--out', out], { stdio: 'inherit' });
  if (res.status !== 0) throw new Error(`sips failed for ${size}px`);
}

// Defaults so the script can run without flags
const defaultInputs = {
  mac: 'packages/desktop/static-desktop/macos-icon-master.png',
  win: 'packages/desktop/static-desktop/windows-icon-master.png',
  linux: 'packages/desktop/static-desktop/linux-icon-master.png'
};
const outDir = path.resolve(arg('--out', 'packages/desktop/static-desktop'));
ensureDir(outDir);

// macOS .icns
if (!flag('--skip-mac')) {
  const macSrc = path.resolve(arg('--mac', defaultInputs.mac));
  if (!exists(macSrc)) throw new Error(`mac: source not found: ${macSrc}`);
  {
    const iconsetDir = path.join(outDir, arg('--mac-name', 'App.iconset'));
    ensureDir(iconsetDir);
    for (const size of [16, 32, 128, 256, 512]) {
      sipsResize(macSrc, size, path.join(iconsetDir, `icon_${size}x${size}.png`));
      sipsResize(macSrc, size * 2, path.join(iconsetDir, `icon_${size}x${size}@2x.png`));
    }
    execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', path.join(outDir, 'icon.icns')], { stdio: 'inherit' });
  }
}

// Linux icon.png
if (!flag('--skip-linux')) {
  const linuxSrc = path.resolve(arg('--linux', defaultInputs.linux));
  const size = Number(arg('--linux-size', '512'));
  if (!exists(linuxSrc)) throw new Error(`linux: source not found: ${linuxSrc}`);
  sipsResize(linuxSrc, size, path.join(outDir, 'icon.png'));
}

// Windows .ico (optional ImageMagick)
if (!flag('--skip-win')) {
  const winSrc = path.resolve(arg('--win', defaultInputs.win));
  if (!exists(winSrc)) throw new Error(`win: source not found: ${winSrc}`);
  if (have('convert')) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ico-'));
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const pngs = [];
    for (const s of sizes) {
      const p = path.join(tmp, `icon-${s}.png`);
      sipsResize(winSrc, s, p);
      pngs.push(p);
    }
    execFileSync('convert', [...pngs, path.join(outDir, 'icon.ico')], { stdio: 'inherit' });
  } else {
    console.warn('win: ImageMagick `convert` not found; skipping .ico generation');
  }
}

console.log('Icons written to', outDir);
```

## Integration
- Add NPM script in `packages/desktop/package.json`:
```json
{
  "scripts": {
    "icons": "node scripts/build-icons.js --mac packages/desktop/static-desktop/macos-icon-master.png --win packages/desktop/static-desktop/windows-icon-master.png --linux packages/desktop/static-desktop/linux-icon-master.png --out packages/desktop/static-desktop"
  }
}
```
- Optionally call `npm run icons` from `prepare-static-files` or before packaging commands.

## CI
We will not wire this into CI initially. To make it reliable across different GitHub runners later:
- macOS: `sips` and `iconutil` are available by default. Install ImageMagick for `.ico` if desired (`brew install imagemagick`).
- Ubuntu: use `apt-get install -y imagemagick icnsutils` to get `convert` and `png2icns` (alternative to `iconutil`). Adjust the script to use `png2icns` when `iconutil` is unavailable.
- Windows: use Chocolatey to install ImageMagick (`choco install imagemagick`). `.icns` generation is best done on macOS or Ubuntu with `icnsutils`.

Recommended durable approach:
- Build icons in a macOS job (authoritative outputs), upload as artifacts, and reuse in other matrix jobs; or
- Use an Ubuntu job with `icnsutils` + ImageMagick to produce all formats; verify produced sizes with a small check step.

Verification in CI:
- Expand `.icns` back to an `.iconset` (`iconutil -c iconset` or `icns2png`) and assert expected files exist.
- Validate dimensions with ImageMagick `identify -format "%w x %h %f\n" *.png`.

## Validation checklist
- `icon.icns` contains: 16/32/128/256/512 and `@2x` variants up to 1024.
- `icon.ico` contains at least: 16, 24, 32, 48, 64, 128, 256.
- `icon.png` is 512×512 (or chosen size).
- App renders new icon on each platform after build/package.

## Migration plan
1) Export three masters from Figma: macOS, Windows, Linux (1024×1024 PNG, transparent).
2) Place them in `packages/desktop/static-desktop/` as `macos-icon-master.png`, `windows-icon-master.png`, `linux-icon-master.png`.
3) Run `npm run icons`.
4) Build platform packages and visually verify.

## Risks and mitigations
- Rounded-corner appearance differences across platforms: keep liberal padding in masters.
- Missing ImageMagick in local or CI: script logs a clear warning and proceeds; document install step.
- Visual regressions at small sizes: consider hand-tuned variants for 16–32 px if needed.

## Done criteria
- Script lands under `packages/desktop/scripts/build-icons.js`.
- Running the script with platform-specific masters produces `.icns`, `.ico`, and `icon.png` in the expected directory.
- No changes required to Electron Builder config.

