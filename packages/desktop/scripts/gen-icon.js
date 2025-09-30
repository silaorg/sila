/*
 Generates a valid 512x512 PNG icon using Jimp for maximum compatibility.
 Writes to ../build/icon.png by default.
*/
import fs from 'node:fs';
import path from 'node:path';
import * as JimpNS from 'jimp';

const outDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'build', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
const background = 0xffc1466b; // ABGR (little-endian) -> rgba(0x6b,0x46,0xc1,0xff)

const main = async () => {
  const Jimp = JimpNS.Jimp ?? JimpNS; // support both ESM/CJS shapes
  for (const size of sizes) {
    const img = new Jimp({ width: size, height: size, color: background });
    // Optional: draw a simple white circle
    const center = size / 2;
    const radius = Math.floor(size * 0.32);
    const white = 0xffffffff;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        if (dx * dx + dy * dy <= radius * radius) {
          img.setPixelColor(white, x, y);
        }
      }
    }
    const file = path.join(outDir, `${size}x${size}.png`);
    await img.write(file);
    const stat = fs.statSync(file);
    console.log(`Wrote ${file} (${stat.size} bytes)`);
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

