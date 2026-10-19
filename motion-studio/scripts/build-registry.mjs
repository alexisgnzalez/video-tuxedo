import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryJsonPath = path.join(root, 'src', 'assets', 'registry.json');
const registryMdPath = path.join(root, 'src', 'assets', 'REGISTRY.md');

const data = JSON.parse(fs.readFileSync(registryJsonPath, 'utf8'));

let md = `# Visual Component & Sound Effects Registry

> **Notice**: Automatically generated from \`registry.json\`. Do not edit manually. Run \`npm run build:registry\` to update.

---

## 1. Visual Component Registry (${data.components.length} Components)

| Asset ID | Category | Default Zone | Component Path | Description | SFX Trigger |
| :--- | :--- | :--- | :--- | :--- | :--- |
`;

for (const c of data.components) {
  md += `| \`${c.id}\` | ${c.category} | \`Zone ${c.defaultZone}\` | \`${c.componentPath}\` | ${c.description} | \`${c.sfxTrigger}\` |\n`;
}

md += `\n---\n\n## 2. Sound Effects (SFX) Registry (${data.sfx.length} Instruments)\n\n`;
md += `*Rule: Every visual entrance or kinetic event pairs with an \`<Audio src={staticFile('sfx/[id]_v[1..4].wav')} />\` tag.*\n\n`;
md += `| SFX ID | Sonic Character | Default Vol | Variants | Trigger Rule |\n`;
md += `| :--- | :--- | :--- | :--- | :--- |\n`;

for (const s of data.sfx) {
  md += `| \`${s.id}\` | ${s.character} | \`${s.defaultVolume}\` | \`${s.variants}x\` | ${s.rule} |\n`;
}

fs.writeFileSync(registryMdPath, md, 'utf8');
console.log(`[registry] Generated ${registryMdPath} with ${data.components.length} components and ${data.sfx.length} SFX.`);
