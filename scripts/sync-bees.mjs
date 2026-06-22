#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveBees, unmappedItems, stubMarkdown, stubFilename } from './lib/derive.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');

export function writeStubs(beesDir, derived) {
  mkdirSync(beesDir, { recursive: true });
  const created = [];
  for (const [id, species] of Object.entries(derived)) {
    const file = `${stubFilename(id)}.md`;
    if (existsSync(join(beesDir, file))) continue;       // never overwrite human files
    writeFileSync(join(beesDir, file), stubMarkdown(id, species));
    created.push(file);
  }
  return created.sort();
}

// Minimal items.yml key reader (we only need the top-level keys for the unmapped report).
function readItemKeys(itemsYmlPath) {
  if (!existsSync(itemsYmlPath)) return {};
  const map = {};
  for (const line of readFileSync(itemsYmlPath, 'utf8').split('\n')) {
    const m = line.match(/^([\w.:+/-]+):/);   // top-level "namespace:item:" keys
    if (m) map[m[1]] = {};
  }
  return map;
}

function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) { console.error('usage: npm run sync-bees -- <path-to-bees.json>'); process.exit(2); }
  const dump = JSON.parse(readFileSync(dumpPath, 'utf8'));

  const derived = deriveBees(dump);
  mkdirSync(join(DOCS, '_data'), { recursive: true });
  writeFileSync(join(DOCS, '_data', 'bees.json'), JSON.stringify(derived, null, 2) + '\n');

  const created = writeStubs(join(DOCS, '_bees'), derived);
  const unmapped = unmappedItems(dump, readItemKeys(join(DOCS, '_data', 'items.yml')));
  const secret = Object.entries(derived).filter(([, s]) => s.secret).map(([id]) => id);

  console.log(`Wrote _data/bees.json (${Object.keys(derived).length} species).`);
  console.log(`Created ${created.length} new stub(s): ${created.join(', ') || '(none)'}`);
  console.log(`Unmapped items (add to _data/items.yml): ${unmapped.length}`);
  unmapped.forEach(i => console.log(`  - ${i}`));
  if (secret.length) console.log(`Secret species (shown normally): ${secret.length}`);
}

// Only run main() when invoked directly, not when imported by tests.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
