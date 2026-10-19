// Copies self-hosted font files from @fontsource packages into public/fonts
// so renders work 100% offline (no Google Fonts CDN at render time).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'fonts');
fs.mkdirSync(outDir, {recursive: true});

const FONTS = [
  // [package, file prefix, weights]
  ['@fontsource/jost', 'jost', [400, 500, 600]],
  ['@fontsource/josefin-sans', 'josefin-sans', [400, 600, 700]],
  ['@fontsource/federo', 'federo', [400]],
  ['@fontsource/montserrat', 'montserrat', [600, 700, 800]],
];

let copied = 0;
for (const [pkg, prefix, weights] of FONTS) {
  const filesDir = path.join(root, 'node_modules', pkg, 'files');
  if (!fs.existsSync(filesDir)) {
    console.warn(`[fonts] ${pkg} not installed, skipping`);
    continue;
  }
  for (const w of weights) {
    // latin-ext covers Spanish accents + ñ; latin is the base subset.
    for (const subset of ['latin', 'latin-ext']) {
      const name = `${prefix}-${subset}-${w}-normal.woff2`;
      const src = path.join(filesDir, name);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(outDir, name));
        copied++;
      }
    }
  }
}
console.log(`[fonts] copied ${copied} font files to public/fonts`);
