# Plan C — Bee Page Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development). Steps use checkbox (`- [ ]`) syntax. Use @superpowers:test-driven-development for the sync-script tasks.

**Goal:** Generate a wiki page for every bee species from the mod's dump, joining machine game-data (`_data/bees.json`) with human-written content (`_bees/<id>.md`) via a Jekyll `bee` layout — so regenerating data never touches human writing, and new/addon species get stub pages automatically.

**Architecture:** A Node script (`scripts/sync-bees.mjs`) ingests the raw `bees.json` dump, **derives** a per-species `_data/bees.json` (inverting hives→`obtained_from` and mutations→`mutations_into`/`mutations_from`), and creates a `_bees/<id>.md` stub for any species missing one (never overwriting). The Jekyll `bee` layout renders game data from `site.data.bees[page.species_id]` through small includes, and renders human prose from the doc's front matter + Markdown body. Hand-maintained `_data/items.yml` / `_data/hives.yml` map mod IDs → wiki icons/links/labels. A generated `pageindex.js` adds every bee to the existing Fuse.js search.

**Tech Stack:** Jekyll 4.4 (collections, Liquid includes), Node 22 (ESM, built-in `node:test`), the Plan B foundation.

**Repo:** `/home/thedarkcolour/WebstormProjects/forestry-wiki`, branch `bee-wiki-pipeline` (continues from Plan B).

---

## Context the executor needs

- **Plan B is done** on this branch: `docs/_config.yml` (baseurl `/wiki`), `docs/Gemfile`, `docs/_layouts/article.html`, the Actions deploy. `bundle exec jekyll build` (run from `docs/`) works.
- **Golden fixture:** `test/fixtures/bees.sample.json` — a real dump (69 species, 11 hives, 114 mutations). Shape (verified):
  - `species` is an object keyed by id like `"forestry:bee_forest"`. Each value: `display_name, binomial, genus, family, authority, complexity, secret, dominant, glint, colors{body,stripes,outline}, climate{temperature,humidity}, genome{<trait>:{value,display,allele_id,dominant}}, products[{item,chance,display}], specialties[...], jubilance`.
  - `hives` is an array: `{id, gen_chance, drops:[{species, chance, ignoble_chance, princess_chance, bonus_items[]}]}`.
  - `mutations` is an array: `{parent1, parent2, result, chance, secret, conditions[]}`.
- **Target page to reproduce:** `docs/Forest+Bee/index.html` (the hand-written page). Game-data parts the layout must regenerate: the info table (Family/Products/Flowers/Bee Effect/Authority + image), the Default-Genome `wiki-info-table2` (Life/Worker/Temperature Tolerance/Humidity Tolerance/Fertility/Territory/Activity), and the Products `centrifuge-grid`. Human parts: the `maintext` intro lore, `articleimage`, the per-section notes (Variants, Traits intro, History), and the `similar` links.
- **CSS classes already defined** in `docs/article_style.css` (reuse exactly): `wiki-grid, toc-sidebar, toc-list, wiki-content, article-header, topic-links, split-panel, text-col, table-col, warning-panel, maintext, reference, articleimage, wiki-info-table, image-cell, table-image, mainimage, tooltip, tooltiptext, tooltipbg, icon, collapsible-section, section-toggle, section-label, section-content, subsection, wiki-info-table2, table2-1, centrifuge-grid, centrifuge-grid-input, centrifuge-grid-output, minecraft-item, wiki-footer, footer-attribution`.
- **`article.js`** injects the header/footer and builds the TOC from `.collapsible-section` + `.subsection h4` at runtime — so the layout must emit that same DOM (collapsible sections with `<h4>` subsections) and include `article.js`.
- **Search:** `docs/mainpage/index.html` loads `mainpage/pageindex.js` (defines `const data = [{title, link, desc}, ...]`) then `mainpage/mainpage.js` (Fuse over `title`/`desc`). Static HTML pages have no front matter, so they are **static files, not in `site.pages`** — the generated index keeps a hardcoded core-page list and appends `site.bees`.

### ID / filename rules (used by the sync script and layout)
- `site.data.bees` is keyed by the full mod id (`"forestry:bee_forest"`); Liquid lookup: `site.data.bees[page.species_id]`.
- Stub filename: namespace `forestry` → drop it (`forestry:bee_forest` → `_bees/bee_forest.md`); other namespaces → `ns__path` (`mobees:foo` → `_bees/mobees__foo.md`).
- Default permalink for a bee doc: `/bees/<filename>/` (front matter can override).

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `package.json` | create | Node tooling: `sync-bees` + `test` scripts, ESM |
| `scripts/sync-bees.mjs` | create | CLI: dump → `_data/bees.json` + stubs + report |
| `scripts/lib/derive.mjs` | create | **pure** transforms (derive data, invert, unmapped, stub text, filename) |
| `scripts/lib/derive.test.mjs` | create | `node:test` unit tests over the fixture |
| `docs/_data/items.yml` | create | item/flower/effect id → `{name, icon, link}` |
| `docs/_data/hives.yml` | create | hive id → `{name, biomes, link}` |
| `docs/_data/bees.json` | generated | machine-owned derived data (by the script) |
| `docs/_bees/<id>.md` | generated/human | per-species human content (stub created once) |
| `docs/_layouts/bee.html` | create | joins data + human content |
| `docs/_includes/item-icon.html` | create | one item id → tooltip icon (via items.yml) |
| `docs/_includes/centrifuge.html` | create | products grid |
| `docs/_includes/genome-table.html` | create | Default-Genome table from `genome` |
| `docs/_includes/bee-info-table.html` | create | right-column info table |
| `docs/_includes/obtaining.html` | create | hives that drop the species (+princess %) |
| `docs/_includes/breeding.html` | create | mutations into/from |
| `docs/mainpage/pageindex.js` | convert to template | core pages + `site.bees` for search |
| `docs/_config.yml` | modify | add `bees` collection |

---

## Task group A — Node tooling + sync script (TDD)

### Task A1: Bootstrap Node tooling

**Files:** `package.json` (create)

- [ ] **Step 1:** Create `package.json`:

```json
{
  "name": "forestry-wiki-tools",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "sync-bees": "node scripts/sync-bees.mjs",
    "test": "node --test"
  }
}
```

- [ ] **Step 2:** Verify the test runner works: `node --test` → exits 0 with "no tests found" (or similar). Commit:
```bash
git add package.json && git commit -m "chore(wiki): bootstrap Node tooling for bee sync"
```

### Task A2: Pure derivation library (TDD)

**Files:** `scripts/lib/derive.mjs` (create), `scripts/lib/derive.test.mjs` (create test first)

The pure core: no file I/O, fully unit-testable against the fixture.

- [ ] **Step 1: Write failing tests** `scripts/lib/derive.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deriveBees, stubFilename, unmappedItems, stubMarkdown } from './derive.mjs';

const dump = JSON.parse(readFileSync(
  fileURLToPath(new URL('../../test/fixtures/bees.sample.json', import.meta.url))));

test('deriveBees keys by species id and preserves species fields', () => {
  const bees = deriveBees(dump);
  const forest = bees['forestry:bee_forest'];
  assert.ok(forest, 'forest species present');
  assert.equal(forest.display_name, dump.species['forestry:bee_forest'].display_name);
  assert.ok(forest.genome.lifespan);
});

test('deriveBees inverts hive drops into obtained_from', () => {
  const forest = deriveBees(dump)['forestry:bee_forest'];
  assert.ok(Array.isArray(forest.obtained_from));
  assert.ok(forest.obtained_from.some(o => o.hive === 'forestry:beehive_forest'));
  for (const o of forest.obtained_from) {
    assert.ok(o.princess_chance >= 0 && o.princess_chance <= 1);
  }
});

test('deriveBees splits mutations into into/from with partner', () => {
  const bees = deriveBees(dump);
  // pick any mutation from the dump and assert both endpoints see it
  const m = dump.mutations[0];
  const result = bees[m.result];
  assert.ok(result.mutations_into.some(x => x.parent1 === m.parent1 && x.parent2 === m.parent2));
  const p1 = bees[m.parent1];
  assert.ok(p1.mutations_from.some(x => x.result === m.result && x.partner === m.parent2));
});

test('stubFilename strips forestry namespace, prefixes others', () => {
  assert.equal(stubFilename('forestry:bee_forest'), 'bee_forest');
  assert.equal(stubFilename('mobees:foo'), 'mobees__foo');
});

test('unmappedItems lists product/drop items absent from the icon map', () => {
  const items = unmappedItems(dump, { 'forestry:bee_comb_honey': {} });
  assert.ok(Array.isArray(items));
  assert.ok(!items.includes('forestry:bee_comb_honey'));
});

test('stubMarkdown emits front matter with species_id and bee layout', () => {
  const md = stubMarkdown('forestry:bee_forest', dump.species['forestry:bee_forest']);
  assert.match(md, /species_id: forestry:bee_forest/);
  assert.match(md, /layout: bee/);
});
```

- [ ] **Step 2:** Run `node --test scripts/lib/derive.test.mjs` → FAIL (module missing).

- [ ] **Step 3: Implement** `scripts/lib/derive.mjs`:

```js
// Pure transforms for the bee dump -> wiki data. No file I/O.

export function stubFilename(id) {
  const [ns, path] = id.includes(':') ? id.split(':', 2) : ['forestry', id];
  return ns === 'forestry' ? path : `${ns}__${path}`;
}

export function deriveBees(dump) {
  const out = {};
  for (const [id, species] of Object.entries(dump.species)) {
    out[id] = { ...species, obtained_from: [], mutations_into: [], mutations_from: [] };
  }
  // invert hives -> obtained_from
  for (const hive of dump.hives ?? []) {
    for (const drop of hive.drops ?? []) {
      const bee = out[drop.species];
      if (!bee) continue;
      bee.obtained_from.push({ hive: hive.id, princess_chance: drop.princess_chance });
    }
  }
  // split mutations -> into / from
  for (const m of dump.mutations ?? []) {
    const result = out[m.result];
    if (result) result.mutations_into.push(
      { parent1: m.parent1, parent2: m.parent2, chance: m.chance, secret: m.secret, conditions: m.conditions });
    for (const [self, partner] of [[m.parent1, m.parent2], [m.parent2, m.parent1]]) {
      const bee = out[self];
      if (bee) bee.mutations_from.push(
        { partner, result: m.result, chance: m.chance, secret: m.secret, conditions: m.conditions });
    }
  }
  return out;
}

export function unmappedItems(dump, itemMap) {
  const referenced = new Set();
  for (const s of Object.values(dump.species)) {
    for (const p of [...(s.products ?? []), ...(s.specialties ?? [])]) referenced.add(p.item);
  }
  for (const h of dump.hives ?? []) for (const d of h.drops ?? []) for (const it of d.bonus_items ?? []) referenced.add(it);
  return [...referenced].filter(it => !(it in (itemMap ?? {}))).sort();
}

export function stubMarkdown(id, species) {
  const title = `${species.display_name} Bee`;
  return `---
species_id: ${id}
layout: bee
title: ${title}
permalink: /bees/${stubFilename(id)}/
image:            # filename of the bee sprite in this page's folder (human-supplied)
og_description:
similar: []
sections:
  variants:
  traits:
  history:
---
<!-- Write the intro lore here in Markdown. Game data (genome, products,
     obtaining, breeding) is filled in automatically from _data/bees.json. -->
`;
}
```

- [ ] **Step 4:** Run `node --test scripts/lib/derive.test.mjs` → PASS (6 tests).

- [ ] **Step 5:** Commit:
```bash
git add scripts/lib/derive.mjs scripts/lib/derive.test.mjs
git commit -m "feat(wiki): pure bee-dump derivation lib with tests"
```

### Task A3: Sync CLI + stub-creation safety (TDD)

**Files:** `scripts/sync-bees.mjs` (create); extend `scripts/lib/derive.test.mjs` (or new `scripts/sync-bees.test.mjs`) for the never-overwrite guarantee.

- [ ] **Step 1: Write failing test** `scripts/sync-bees.test.mjs` for stub creation (uses a temp dir):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeStubs } from './sync-bees.mjs';

function tmp() { return mkdtempSync(join(tmpdir(), 'bees-')); }

test('writeStubs creates a file for a new species', () => {
  const dir = tmp();
  const created = writeStubs(dir, { 'forestry:bee_forest': { display_name: 'Forest' } });
  assert.ok(existsSync(join(dir, 'bee_forest.md')));
  assert.deepEqual(created, ['bee_forest.md']);
});

test('writeStubs NEVER overwrites an existing human file', () => {
  const dir = tmp();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'bee_forest.md'), 'HUMAN EDITED');
  const created = writeStubs(dir, { 'forestry:bee_forest': { display_name: 'Forest' } });
  assert.equal(readFileSync(join(dir, 'bee_forest.md'), 'utf8'), 'HUMAN EDITED');
  assert.deepEqual(created, []);
});
```

- [ ] **Step 2:** Run `node --test scripts/sync-bees.test.mjs` → FAIL.

- [ ] **Step 3: Implement** `scripts/sync-bees.mjs`:

```js
#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'node:util';  // placeholder; see note
import { deriveBees, unmappedItems, stubMarkdown, stubFilename } from './lib/derive.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');

export function writeStubs(beesDir, derived) {
  mkdirSync(beesDir, { recursive: true });
  const created = [];
  for (const [id, species] of Object.entries(derived)) {
    const file = `${stubFilename(id)}.md`;
    if (existsSync(join(beesDir, file))) continue;       // never overwrite
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
```

> **Note for executor:** the `parse as parseYaml` import line is a placeholder — **delete it**; the script does not parse YAML values, only scans `items.yml` for top-level keys via regex (`readItemKeys`). Keep the script dependency-free (no npm installs).

- [ ] **Step 4:** Run `node --test` (all tests) → PASS.

- [ ] **Step 5:** Run the real sync against the fixture:
```bash
node scripts/sync-bees.mjs test/fixtures/bees.sample.json
```
Expected: reports ~69 species, creates ~69 stubs under `docs/_bees/`, writes `docs/_data/bees.json`, lists unmapped items (all of them, since `items.yml` doesn't exist yet).

- [ ] **Step 6:** Commit script + the generated data + stubs:
```bash
git add scripts/sync-bees.mjs scripts/sync-bees.test.mjs docs/_data/bees.json docs/_bees/
git commit -m "feat(wiki): sync-bees CLI (derive data + create stubs, never overwrite)"
```

---

## Task group B — Hand-maintained mapping data

### Task B1: items.yml and hives.yml (seed with the known Forestry items)

**Files:** `docs/_data/items.yml`, `docs/_data/hives.yml` (create)

- [ ] **Step 1:** Create `docs/_data/items.yml` seeded with the items the sync report flagged for the core combs/products (use existing `cdn/` icons where present). Example entries:

```yaml
forestry:bee_comb_honey: { name: "Honey Comb", icon: /cdn/honeycomb.png, link: /Honey+Comb/ }
forestry:beeswax:        { name: "Beeswax",    icon: /cdn/beeswax.png,    link: /Beeswax/ }
forestry:honey_drop:     { name: "Honey Drop", icon: /cdn/honey_drop.png, link: /Honey+Drop/ }
```

Run `node scripts/sync-bees.mjs test/fixtures/bees.sample.json` again and work down the "Unmapped items" list, adding entries for items that have a `cdn/` icon. Items without art yet may be left unmapped (the layout falls back to the display name).

- [ ] **Step 2:** Create `docs/_data/hives.yml` for the 11 hives (human-written biome blurbs). Example:

```yaml
forestry:beehive_forest: { name: "Forest Hive", biomes: "Non-snowy forests", link: /Hives/ }
```

- [ ] **Step 3:** Commit:
```bash
git add docs/_data/items.yml docs/_data/hives.yml
git commit -m "feat(wiki): seed item + hive presentation maps"
```

---

## Task group C — Bee collection, layout, includes

### Task C1: Register the `bees` collection

**Files:** `docs/_config.yml` (modify)

- [ ] **Step 1:** Add to `docs/_config.yml`:

```yaml
collections:
  bees:
    output: true
    permalink: /bees/:path/
```

- [ ] **Step 2:** `cd docs && bundle exec jekyll build` → succeeds; `_site/bees/bee_forest/index.html` exists (from a stub). Commit:
```bash
git add docs/_config.yml && git commit -m "feat(wiki): register bees collection"
```

### Task C2: Includes (build each, verify in isolation by building)

**Files:** `docs/_includes/{item-icon,centrifuge,genome-table,bee-info-table,obtaining,breeding}.html`

- [ ] **Step 1: `item-icon.html`** — resolve one item id via `items.yml`, fall back to a label. Params: `id`, optional `label` suffix (e.g. a chance).

```liquid
{%- assign item = site.data.items[include.id] -%}
<div class="tooltip">
  {%- if item -%}
  <a href="{{ item.link | relative_url }}"><img src="{{ item.icon | relative_url }}" class="icon"></a>
  <span class="tooltiptext"><span class="tooltipbg">{{ item.name }}{{ include.label }}</span></span>
  {%- else -%}
  {%- comment %} Fallback for items with no items.yml entry yet: show the id's last segment as text.
       Uses only the existing .icon class; add a small .icon-missing style later if desired. {% endcomment -%}
  <span class="icon">{{ include.id | split: ':' | last }}</span>
  <span class="tooltiptext"><span class="tooltipbg">{{ include.id }}{{ include.label }}</span></span>
  {%- endif -%}
</div>
```

- [ ] **Step 2: `centrifuge.html`** — input item + output products with chances. Param: `bee` (the species data object).

```liquid
<div class="centrifuge-grid">
  <div class="centrifuge-grid-input">
    <div class="minecraft-item">{% include item-icon.html id=include.input label=" - Input" %}</div>
  </div>
  <div class="centrifuge-grid-output">
    {%- for p in include.bee.products -%}
    <div class="minecraft-item">{% include item-icon.html id=p.item label=" - " %}{% comment %}chance below{% endcomment %}</div>
    {%- endfor -%}
  </div>
</div>
```
(Executor: format chance as a percent — `{{ p.chance | times: 100 | round }}%` — appended to the label; adjust the include call so the tooltip reads e.g. "Beeswax - 100%".)

- [ ] **Step 3: `genome-table.html`** — the Default-Genome table. Map raw genome keys → display rows, mirroring `wiki-info-table2` from the Forest Bee page. Param: `bee`.

```liquid
<div class="table-col">
  <table class="wiki-info-table2">
    {%- assign g = include.bee.genome -%}
    {%- assign rows = "lifespan:Life,speed:Worker,temperature_tolerance:Temperature Tolerance,humidity_tolerance:Humidity Tolerance,fertility:Fertility,territory:Territory,activity:Activity" | split: "," -%}
    {%- for row in rows -%}
      {%- assign kv = row | split: ":" -%}
      {%- assign trait = g[kv[0]] -%}
      {%- if trait -%}
      <tr><td class="table2-1"><b>{{ kv[1] }}</b></td><td>{{ trait.display }}</td></tr>
      {%- endif -%}
    {%- endfor -%}
  </table>
</div>
```

- [ ] **Step 4: `bee-info-table.html`** — right-column table (image + Family/Products/Flowers/Bee Effect/Authority). Param: `bee`, `page` (for image). Mirror the Forest Bee `wiki-info-table`. Products loop uses `item-icon.html`. Flowers from `bee.genome.flower_type.display`, Bee Effect from `bee.genome.bee_effect.display` (the fixture's genome key is `bee_effect`, not `effect`). Authority from `bee.authority`.

- [ ] **Step 5: `obtaining.html`** — list `bee.obtained_from` hives via `hives.yml`, with princess %. Param: `bee`.

```liquid
{%- if include.bee.obtained_from and include.bee.obtained_from.size > 0 -%}
<ul>
{%- for o in include.bee.obtained_from -%}
  {%- assign hive = site.data.hives[o.hive] -%}
  <li><a href="{{ hive.link | relative_url }}">{{ hive.name | default: o.hive }}</a>
      — {{ o.princess_chance | times: 100 | round: 1 }}% princess{% if hive.biomes %} ({{ hive.biomes }}){% endif %}</li>
{%- endfor -%}
</ul>
{%- else -%}<p>Not obtained directly from a hive.</p>{%- endif -%}
```

- [ ] **Step 6: `breeding.html`** — `mutations_into` ("how to breed this") and `mutations_from` ("what this breeds into"), linking partner/result species by id → `site.data.bees[id].display_name` and `/bees/<filename>/`. Param: `bee`. Render chance as %, list conditions.

- [ ] **Step 7:** After each include, build (`cd docs && bundle exec jekyll build`) to catch Liquid errors early. Commit the set:
```bash
git add docs/_includes/ && git commit -m "feat(wiki): bee-page includes (info table, genome, centrifuge, obtaining, breeding)"
```

### Task C3: The `bee` layout

**Files:** `docs/_layouts/bee.html` (create)

- [ ] **Step 1:** Create `docs/_layouts/bee.html` that reproduces the Forest Bee page structure, pulling game data from `site.data.bees[page.species_id]` and human content from front matter (`title, image, og_description, similar, sections.*`) + the Markdown body (`{{ content }}` = intro lore). Skeleton:

```liquid
{%- assign bee = site.data.bees[page.species_id] -%}
<!DOCTYPE html>
<html lang="en">
<head id="head">
  <meta property="og:site_name" content="Forestry: Community Edition - Wiki">
  <meta property="og:title" content="{{ page.title }}">
  <meta property="og:description" content="{{ page.og_description }}">
  <meta property="og:image" content="{{ page.og_image }}">
  <meta name="theme-color" content="#f3a90a" data-react-helmet="true" />
  {% if page.image %}<link rel="icon" href="{{ page.image }}">{% endif %}
  <link rel="stylesheet" href="{{ '/article_style.css' | relative_url }}">
</head>
<body>
  <header class="sticky-header" id="mainHeader"></header>
  <div class="wiki-grid">
    <aside class="toc-sidebar"><h3>{{ page.title }}</h3><ul class="toc-list" id="dynamic-toc"></ul></aside>
    <main class="wiki-content">
      <div class="article-header">
        <h2 style="text-transform:uppercase" id="articletitle">{{ page.title }}</h2>
        {% if page.similar %}<div class="topic-links"><span>similar:</span>
          {% for item in page.similar %}<a href="{{ item.href }}">{{ item.name }}</a>{% endfor %}</div>{% endif %}
      </div>
      <div class="split-panel">
        <div class="text-col">
          <div class="warning-panel"><img src="{{ '/cdn/warning.png' | relative_url }}"><span>This page's data was automatically generated from the mod. Help expand it by <a href="https://github.com/ForestryCE/wiki/">Contributing</a>!</span></div>
          {{ content }}
          {% if page.image %}<div class="articleimage"><img src="{{ page.image }}"></div>{% endif %}
        </div>
        <div class="table-col">{% include bee-info-table.html bee=bee page=page %}</div>
      </div>

      <section class="collapsible-section">
        <input type="checkbox" class="section-toggle" id="toggle1" checked>
        <label for="toggle1" class="section-label">Default Genome</label>
        <div class="section-content">
          <div class="subsection"><h4>Defaults</h4>{% include genome-table.html bee=bee %}</div>
          {% if page.sections.variants %}<div class="subsection"><h4>Variants</h4>{{ page.sections.variants | markdownify }}</div>{% endif %}
        </div>
      </section>

      <section class="collapsible-section">
        <input type="checkbox" class="section-toggle" id="toggle2">
        <label for="toggle2" class="section-label">Traits</label>
        <div class="section-content">
          {% if page.sections.traits %}{{ page.sections.traits | markdownify }}{% endif %}
          {% if bee.products and bee.products.size > 0 %}<div class="subsection"><h4>Products</h4>{% include centrifuge.html bee=bee input=bee.products[0].item %}</div>{% endif %}
        </div>
      </section>

      <section class="collapsible-section">
        <input type="checkbox" class="section-toggle" id="toggle3">
        <label for="toggle3" class="section-label">Obtaining</label>
        <div class="section-content">
          <div class="subsection"><h4>Hives</h4>{% include obtaining.html bee=bee %}</div>
          <div class="subsection"><h4>Breeding</h4>{% include breeding.html bee=bee %}</div>
        </div>
      </section>

      {% if page.sections.history %}
      <section class="collapsible-section">
        <input type="checkbox" class="section-toggle" id="toggle4">
        <label for="toggle4" class="section-label">History</label>
        <div class="section-content">{{ page.sections.history | markdownify }}</div>
      </section>{% endif %}
    </main>
  </div>
  <footer class="wiki-footer" id="footer">{% if page.page_author %}<div class="footer-attribution">original page author · {{ page.page_author }}</div>{% endif %}</footer>
  <script src="{{ '/article.js' | relative_url }}"></script>
</body>
</html>
```

- [ ] **Step 2:** Build and inspect the generated Forest page:
```bash
cd docs && bundle exec jekyll build && test -f _site/bees/bee_forest/index.html && echo OK
```
Open/grep `_site/bees/bee_forest/index.html` and confirm it contains: the info table with `Authority` `Sengir` (the data value — the legacy hand-written HTML said "SirSengir", but the layout reads `bee.authority` which is `Sengir`); a `wiki-info-table2` with `Shorter`/`Slowest`/`Down 1`/`Average`; a `centrifuge-grid`; an Obtaining list mentioning the Forest Hive with a princess %.

- [ ] **Step 3:** Commit:
```bash
git add docs/_layouts/bee.html && git commit -m "feat(wiki): bee layout joining _data + human content"
```

### Task C4: Port the existing Forest Bee human content into its stub

**Files:** `docs/_bees/bee_forest.md` (edit the generated stub)

- [ ] **Step 1:** Move the **human** parts of the old `docs/Forest+Bee/index.html` into `docs/_bees/bee_forest.md`: the intro lore paragraphs (→ Markdown body), the `similar` links (→ front matter), the bee image, the Variants note (→ `sections.variants`). Set `permalink: /Forest+Bee/` to preserve the existing URL. Leave the old `docs/Forest+Bee/` directory in place for now (its images are referenced; the sweep that removes the old hand-coded page is out of scope — see note).

- [ ] **Step 2:** Build; confirm `_site/Forest+Bee/index.html` now renders from the layout with the ported lore + generated tables. Commit:
```bash
git add docs/_bees/bee_forest.md && git commit -m "content(wiki): port Forest Bee human content into the bees collection"
```

> Note: the old standalone `docs/Forest+Bee/index.html` and the permalink collision are reconciled in the deferred page-migration sweep (out of scope for this plan). For now, if both define `/Forest+Bee/`, Jekyll will warn about a conflict — resolve by giving the collection doc the canonical permalink and deleting the old `index.html` (keep the images), or keep the collection page at `/bees/bee_forest/` until the sweep. Executor: pick the non-conflicting option and note it.

---

## Task group D — Search index

### Task D1: Generate pageindex.js from core pages + bees

**Files:** `docs/mainpage/pageindex.js` (convert to a Liquid template)

- [ ] **Step 1:** Replace `docs/mainpage/pageindex.js` with a front-matter'd Liquid template that emits the same `const data = [...]` shape, combining a hardcoded core-page list with every bee:

```liquid
---
---
const data = [
  { title: "Main Page", link: "{{ '/' | absolute_url }}", desc: "The very Home of Forestry:CE Wiki" },
  {%- for bee in site.bees %}
  { title: {{ bee.title | jsonify }}, link: "{{ bee.url | absolute_url }}", desc: {{ bee.og_description | default: bee.title | jsonify }} },
  {%- endfor %}
];
```

- [ ] **Step 2:** Build; confirm `_site/mainpage/pageindex.js` lists the bees (e.g. `grep -c "title:" _site/mainpage/pageindex.js` ≫ 2). Commit:
```bash
git add docs/mainpage/pageindex.js && git commit -m "feat(wiki): auto-generate search index from bees collection"
```

---

## Task group E — End-to-end verification

### Task E1: Full clean build + regeneration safety

- [ ] **Step 1: Clean build**
```bash
cd docs && rm -rf _site .jekyll-cache && bundle exec jekyll build && echo "clean build OK"
```
Expected: success; `_site/bees/` has a page per species; the Forest page renders with generated data + ported lore.

- [ ] **Step 2: Prove regeneration never tramples human content.** Edit a human note in `docs/_bees/bee_forest.md` (e.g. add a sentence), then re-run the sync against the fixture and confirm the file is unchanged:
```bash
node scripts/sync-bees.mjs test/fixtures/bees.sample.json
git diff --quiet docs/_bees/bee_forest.md && echo "human file untouched ✓" || echo "ERROR: stub overwrote human content"
```
Expected: `human file untouched ✓` (only `docs/_data/bees.json` may change).

- [ ] **Step 3: Unit + (optional) link check**
```bash
node --test
cd docs && bundle exec jekyll build
```
Expected: all Node tests pass; build clean.

- [ ] **Step 4:** Final commit if anything pending; report completion.

---

## Definition of done

- `node --test` green (derivation + never-overwrite stub guarantees).
- `npm run sync-bees -- test/fixtures/bees.sample.json` regenerates `docs/_data/bees.json` + creates missing stubs, never overwriting human files (E1 Step 2 proves it).
- `bundle exec jekyll build` clean; a generated bee page (Forest) reproduces the info table, genome table, products grid, and an obtaining/breeding section from data, with ported human lore.
- Every bee appears in the generated search index.
- Unmapped items are reported (not silently dropped); the layout falls back gracefully for them.

> Out of scope (deferred sweep, separate plan): migrating the remaining non-bee hand-coded pages to layouts, and deleting the old standalone `docs/Forest+Bee/index.html` in favor of the collection page.
