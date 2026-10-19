import esbuild from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(root, '..', 'static', 'motion');
fs.mkdirSync(outDir, { recursive: true });

const outFile = path.join(outDir, 'player.bundle.js');

console.log('[player-bundle] Bundling @remotion/player into static/motion/player.bundle.js...');

try {
  await esbuild.build({
    entryPoints: [path.join(root, 'src', 'player-entry.tsx')],
    outfile: outFile,
    bundle: true,
    minify: true,
    sourcemap: false,
    format: 'iife',
    target: ['es2020'],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    loader: {
      '.png': 'dataurl',
      '.woff2': 'dataurl',
    },
  });

  const sizeKb = Math.round(fs.statSync(outFile).size / 1024);
  console.log(`✅ [player-bundle] Successfully built ${outFile} (${sizeKb} KB)`);
} catch (err) {
  console.error('❌ [player-bundle] Build error:', err);
  process.exit(1);
}
