# Desktop icons

Here's how we generate app icons for macOS, Windows, and Linux.

## Inputs
- macOS: `packages/desktop/static-desktop/macos-icon-main.png` (1024×1024 PNG)
- Windows: `packages/desktop/static-desktop/windows-icon-main.png` (1024×1024 PNG)
- Linux: `packages/desktop/static-desktop/linux-icon-main.png` (1024×1024 PNG)

Keep transparent background and some padding. Platform-specific art is allowed.

## Generate icons
From repo root (or anywhere):
```bash
node packages/desktop/scripts/build-icons.js
```
Outputs written to `packages/desktop/static-desktop/`:
- `icon.icns` (macOS)
- `icon.ico` (Windows)
- `icon.png` (Linux, 512×512)

Notes:
- The script creates a temporary `.iconset` and cleans it up.
- It prefers ImageMagick v7 ("magick convert") but falls back to `convert`.
- Optional flags: `--skip-mac`, `--skip-win`, `--skip-linux`, `--linux-size 512`, `--out <dir>`.

## How the app uses them
- macOS: Electron Builder default picks up `build/icon.icns`.
- Windows: Electron Builder is configured to use `build/icon.ico`.
- Linux: `build/icon.png` is used and resized by packager.

## Verify
- Open the outputs and visually check small sizes.
- (Optional) Expand `.icns` to an iconset on macOS:
```bash
iconutil -c iconset packages/desktop/static-desktop/icon.icns -o /tmp/verify.iconset
```
