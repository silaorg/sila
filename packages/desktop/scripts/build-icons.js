// Desktop icon builder
// - Generates: macOS .icns, Windows .ico, Linux icon.png
// - Defaults to sources in static-desktop and writes outputs there
//
// Usage:
//   node packages/desktop/scripts/build-icons.js
//   # optional overrides: --mac/--win/--linux/--out --linux-size --mac-name --skip-*
//
// Requirements:
//   - macOS: sips, iconutil (built-in); ImageMagick optional for .ico (magick/convert)
//   - Linux/Windows: ImageMagick for .ico; icns generation recommended on macOS

import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

function arg(key, def) {
  const i = process.argv.indexOf(key);
  return i > -1 ? process.argv[i + 1] : def;
}

function flag(key) {
  return process.argv.includes(key);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function exists(p) {
  return !!p && fs.existsSync(p);
}

function have(cmd) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getImageMagickConvert() {
  // Prefer IM v7: `magick convert`, else fallback to legacy `convert`
  if (have('magick')) return { bin: 'magick', argsPrefix: ['convert'] };
  if (have('convert')) return { bin: 'convert', argsPrefix: [] };
  return null;
}

function sipsResize(src, size, out) {
  const res = spawnSync('sips', ['-s', 'format', 'png', src, '--resampleHeightWidth', String(size), String(size), '--out', out], { stdio: 'inherit' });
  if (res.status !== 0) throw new Error(`sips failed for ${size}px`);
}

// Resolve defaults relative to the script directory so CWD doesn't matter
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDir, '..');

// Defaults so the script can run without flags
const defaultInputs = {
  mac: path.join(desktopRoot, 'static-desktop/macos-icon-main.png'),
  win: path.join(desktopRoot, 'static-desktop/windows-icon-main.png'),
  linux: path.join(desktopRoot, 'static-desktop/linux-icon-main.png')
};

const outDir = path.resolve(arg('--out', path.join(desktopRoot, 'static-desktop')));
ensureDir(outDir);

// macOS .icns
if (!flag('--skip-mac')) {
  const macSrc = path.resolve(arg('--mac', defaultInputs.mac));
  if (!exists(macSrc)) throw new Error(`mac: source not found: ${macSrc}`);
  // Create iconset in a temporary directory to avoid committing it by accident
  const tmpIconsetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sila-iconset-'));
  const iconsetDir = path.join(tmpIconsetRoot, arg('--mac-name', 'App.iconset'));
  ensureDir(iconsetDir);
  for (const size of [16, 32, 128, 256, 512]) {
    sipsResize(macSrc, size, path.join(iconsetDir, `icon_${size}x${size}.png`));
    sipsResize(macSrc, size * 2, path.join(iconsetDir, `icon_${size}x${size}@2x.png`));
  }
  execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', path.join(outDir, 'icon.icns')], { stdio: 'inherit' });
  if (!flag('--keep-iconset')) {
    fs.rmSync(tmpIconsetRoot, { recursive: true, force: true });
  } else {
    console.warn(`Keeping temporary iconset at ${iconsetDir}`);
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
  const im = getImageMagickConvert();
  if (im) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ico-'));
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const pngs = [];
    for (const s of sizes) {
      const p = path.join(tmp, `icon-${s}.png`);
      sipsResize(winSrc, s, p);
      pngs.push(p);
    }
    execFileSync(im.bin, [...im.argsPrefix, ...pngs, path.join(outDir, 'icon.ico')], { stdio: 'inherit' });
  } else {
    console.warn('win: ImageMagick not found (`magick` or `convert`); skipping .ico generation');
  }
}

console.log('Icons written to', outDir);

// Cleanup any legacy iconset accidentally left in the output directory
const legacyIconset = path.join(outDir, 'App.iconset');
try {
  if (fs.existsSync(legacyIconset)) {
    fs.rmSync(legacyIconset, { recursive: true, force: true });
  }
} catch {}


