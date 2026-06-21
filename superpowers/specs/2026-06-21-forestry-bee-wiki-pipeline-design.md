# Forestry CE Bee Wiki Data Pipeline — Design

**Date:** 2026-06-21
**Status:** Approved (design); pending implementation plan
**Spans two repos:** the wiki (`forestry-wiki`, this repo) and the mod (`ForestryCE/ForestryCE-1.20.1`).

> Spec location note: this repo serves GitHub Pages from `docs/`, so design docs live at
> repo-root `superpowers/specs/` to keep them out of the published site.

---

## 1. Problem & goal

Forestry CE has ~70 bee species, and addon mods (e.g. Mo' Bees) add many more. Hand-writing a
wiki page per species is unsustainable, and addon species can't be documented from the mod's
source alone. We want to **generate the game-data portions of every bee page from a live, modded
game**, while letting human editors add flavor text, tips, and images that the game data can't
provide — and **regenerate the data without ever trampling human work**.

### Validated premises

- **One runtime dump captures everything, including addons.** Built-in and addon bees all register
  through the same `IForestryPlugin.registerApiculture(...)` API into one registry;
  `SpeciesUtil.getAllBeeSpecies()` returns the unified list. A single command run against a live
  modded game dumps all species with zero per-addon work.
- **Jekyll's `_data` + layouts are purpose-built for the gen/human split**, and make contribution
  easier (Markdown prose + reusable `{% include %}` components + GitHub-native editing) than the
  current hand-coded HTML.

---

## 2. Scope

**In scope (this spec):**
- **A — Mod command:** a Brigadier command that dumps raw bee data (species, hives, mutations) to JSON.
- **B — Jekyll foundation:** migrate the wiki to Jekyll with a GitHub Actions deploy, replacing the
  legacy "serve `docs/`" model. Existing hand-coded pages pass through unchanged initially.
- **C — Bee pipeline:** the `bees` collection, bee layout + includes, `_data/items.yml`, the Node
  sync script, and an auto-generated search index.

**Out of scope (separate follow-on spec):**
- Sweeping the remaining non-bee hand-coded pages (homepage, crafting, 404, special pages) into
  Jekyll layouts/includes. The full-migration goal is honored by building a foundation that supports
  it; the sweep itself is orthogonal to bees and is deferred to keep this effort focused.

The three in-scope workstreams share one data contract (§4), which is why they belong in one design
doc. The implementation plan will sequence them (§9).

---

## 3. Architecture & data flow

```
┌─ MOD (Java) ──────────┐   ┌─ WIKI repo (Node) ───────────┐   ┌─ Jekyll build (Ruby) ─────┐
│ /forestry dump        │   │ npm run sync-bees <dump.json>│   │ _layouts/bee.html joins:  │
│  wiki_bees            │──▶│  • derive wiki-shaped data   │──▶│  site.data.bees[id]       │
│ writes RAW truth:     │   │  • write _data/bees.json     │   │  + _data/items.yml        │
│  bees.json            │   │  • create missing _bees/*.md │   │  + {{ content }} (human)  │
│ (species+hives+muts)  │   │  • report new/unmapped       │   │ → static HTML             │
└───────────────────────┘   └──────────────────────────────┘   └───────────────────────────┘
```

**Three roles, three owners — the central principle:**

1. **Mod = raw truth.** Dumps flat, ID-keyed facts. Knows nothing about wiki URLs, icons, or layout.
   The command is extended **only when genuinely new *data* is needed** — never for new *shaping*.
2. **Sync script = wiki-shaped derivation.** Inverts and joins the raw dump into per-species data and
   creates human stubs. All wiki-presentation organization lives here and in templates, so the mod
   command stays stable and doesn't need constant updates.
3. **Jekyll = presentation.** Joins machine data (`_data`) with human content (`_bees/*.md`) at build.

**Why regeneration is safe:** generated data (`_data/bees.json`) and human writing (`_bees/*.md`)
never share a file. Regeneration overwrites only the machine-owned data file.

---

## 4. Data contract

### 4.1 Stage 1 — mod's raw dump (`config/forestry/wiki/bees.json`)

Flat, ID-keyed facts plus a provenance manifest. The mod does **not** invert or cross-reference.

```jsonc
{
  "manifest": { "forestry_version": "...", "mods": ["forestry", "mobees", "..."] },

  "species": {
    "forestry:forest": {
      "display_name": "Forest",
      "binomial": "...", "genus": "...", "family": "...",
      "authority": "SirSengir", "complexity": 3,
      "secret": false, "dominant": true, "glint": false,
      "colors":  { "body": "#ffdc16", "stripes": "#19d0ec", "outline": "#000000" },
      "climate": { "temperature": "NORMAL", "humidity": "NORMAL" },
      "genome": {
        "lifespan":              { "value": 10,      "display": "Shorter",          "allele_id": "forestry:10i",                "dominant": false },
        "speed":                 { "value": 0.3,     "display": "Slowest",          "allele_id": "forestry:0.3fd",              "dominant": true  },
        "fertility":             { "value": 3,       "display": "3",                "allele_id": "forestry:3",                  "dominant": true  },
        "temperature_tolerance": { "value": "DOWN_1","display": "Down 1",           "allele_id": "forestry:tolerance_down_1d",  "dominant": true  },
        "humidity_tolerance":    { "value": "NONE",  "display": "None",             "allele_id": "...",                         "dominant": true  },
        "territory":             { "value": [9,6,9], "display": "Average (9x6x9)",  "allele_id": "forestry:9_6_9",              "dominant": false },
        "activity":              { "value": "...",   "display": "Diurnal",          "allele_id": "...",                         "dominant": false },
        "cave_dwelling":         { "value": false,   "display": "No",               "allele_id": "forestry:false",              "dominant": true  },
        "tolerates_rain":        { "value": false,   "display": "No",               "allele_id": "forestry:false",              "dominant": true  },
        "flower_type":           { "value": "...",   "display": "Flowers",          "allele_id": "...",                         "dominant": false },
        "effect":                { "value": "...",   "display": "None",             "allele_id": "...",                         "dominant": false },
        "pollination":           { "value": 10,      "display": "Slower",           "allele_id": "...",                         "dominant": false }
        /* all 12 non-species chromosomes; each carries raw value + display + allele_id + dominant */
      },
      "products":    [ { "item": "forestry:honey_comb", "chance": 0.30, "display": "Honey Comb" } ],
      "specialties": [],
      "jubilance":   ""   // human-readable specialty condition, "" if none
    }
    /* ...one entry per species, keyed by ResourceLocation... */
  },

  "hives": [
    {
      "id": "forestry:forest",
      "gen_chance": 6.0,
      "biomes": "non-snowy",            // human-readable summary derived from biome tag logic
      "temperature": "...", "humidity": "...",
      "drops": [
        { "species": "forestry:forest",  "chance": 0.80, "ignoble_chance": 0.70, "princess_chance": 0.92, "bonus_items": [] },
        { "species": "forestry:valiant", "chance": 0.08, "ignoble_chance": 0.00, "princess_chance": 0.06, "bonus_items": [] }
      ]
    }
  ],

  "mutations": [
    {
      "parent1": "forestry:forest", "parent2": "forestry:meadows", "result": "forestry:common",
      "chance": 0.15, "secret": false,
      "conditions": [ "Temperature between WARM and HOT" ]   // already human-readable (getSpecialConditions)
    }
  ]
}
```

Notes:
- **Both raw value and display string** for every genome trait: templates show "Slowest" while the
  data stays stable and sortable.
- **`princess_chance`** is computed in the mod by the existing `computePrincessChances` (which already
  models the shuffle-and-retry hive logic) and baked into each drop. This is established game-mechanic
  math, so it stays in the mod.
- **`secret`** is recorded as a fact; it drives no hiding behavior in the wiki (see §7).

### 4.2 Stage 2 — derived `_data/bees.json` (sync script output)

Keyed by species, with cross-references inverted so templates need no filtering logic:

```jsonc
{
  "forestry:forest": {
    /* all species fields from stage 1, copied verbatim */
    "obtained_from":  [ { "hive": "forestry:forest", "princess_chance": 0.92, "biomes": "non-snowy" } ],
    "mutations_into": [],   // recipes that PRODUCE this species (empty for base species)
    "mutations_from": [ { "partner": "forestry:meadows", "result": "forestry:common", "chance": 0.15 } ]
  }
}
```

The sync script performs all inversion (hive→species "obtained_from"; mutation "into"/"from") and
passes through `princess_chance`. The mod never does this.

---

## 5. Ownership model (files)

| File | Owner | Lifecycle |
|---|---|---|
| `_data/bees.json` | **machine** | overwritten wholesale every sync |
| `_bees/<id>.md` | **human** | created once as a stub; **never overwritten** |
| `_data/items.yml` | **human** | hand-maintained: item/flower/effect ID → `{name, icon, link}` |
| `_layouts/bee.html`, `_includes/*` | **human (devs)** | the templates |

**Stub generated for a new species** (`_bees/forest.md`):

```yaml
---
species_id: forestry:forest
layout: bee
title: Forest Bee
image: forestbee.png
og_description:
summary:            # one-liner for the search index
tips:
---
<!-- Write flavor text, lore, and breeding tips here in Markdown.
     Game data (genome, products, obtaining, breeding) is filled in automatically. -->
```

**`_data/items.yml`** resolves presentation the mod can't know, with graceful fallback:

```yaml
forestry:honey_comb: { name: "Honey Comb", icon: /cdn/honeycomb.png, link: /Honey+Comb/ }
forestry:beeswax:    { name: "Beeswax",    icon: /cdn/beeswax.png,    link: /Beeswax/ }
```

Unmapped items (especially addon items) → template falls back to the dumped display name + a
placeholder icon, and the sync script **reports** them so editors know what art to add.

### Filename / ID rules
- `forestry:forest` → `_bees/forest.md` (forestry namespace dropped for brevity).
- Addon `mobees:foo` → `_bees/mobees__foo.md` (namespace-prefixed to avoid collisions).
- Liquid map lookup uses the full id: `site.data.bees["forestry:forest"]`.

---

## 6. Component design

### 6.1 Mod command (workstream A)

- **Complete and repurpose the WIP `forestry/core/commands/AllDataDump.java`.** This file is
  currently **staged-but-uncommitted and unreferenced** (not wired into any command) — distinct from
  the shipping `DumpCommand`. Current bugs to fix: `begin()` builds a lazy `.map()` stream with no
  terminal op, so nothing is written; the genome `JsonArray` is built but never attached to the
  output. The princess-chance math (`computePrincessChances`) is kept and reused. It becomes the
  implementation behind the new command below.
- **Add a NEW subcommand under `DumpCommand`** — do **not** overload the existing `bee_species`
  literal, which is already a fully implemented command that iterates species and logs stats to the
  logger. Repurposing it would change shipping behavior.
- **Command:** `/forestry dump wiki_bees`, permission level 2 (admin), writes pretty-printed JSON to
  `config/forestry/wiki/bees.json`, and replies in chat with species/hive/mutation counts (and a
  warning if unresolved translation keys are detected — see §7). (Named `wiki_bees` rather than
  `bee_species` to avoid colliding with the existing stats command, and to leave room for future
  `wiki_trees`/`wiki_butterflies` dumps.)
- **Three extractors**, all over public APIs:
  - **Species** — `SpeciesUtil.getAllBeeSpecies()`; genome via
    `species.getKaryotype().getChromosomes()` filtered against `getSpeciesChromosome()`, reading both
    raw value (`genome.getActiveValue(chromosome)`) and display (`chromosome.getDisplayName(allele)`),
    plus `allele.alleleId()` and `allele.dominant()`; products/specialties via
    `BuiltInRegistries.ITEM.getKey(p.item())` + `p.chance()`; colors as `String.format("#%06X", c & 0xFFFFFF)`;
    taxonomy by walking `getGenus().parent()` up to the FAMILY rank.
  - **Hives** — `IForestryApi.INSTANCE.getHiveManager().getHives()` → `hive.getDrops()` →
    per drop: `drop.createIndividual(EmptyBlockGetter.INSTANCE, BlockPos.ZERO).getSpecies().id()`,
    `drop.getChance(...)`, `drop.getIgnobleChance(...)`, and `princess_chance` from
    `computePrincessChances`.
  - **Mutations** — `SpeciesUtil.BEE_TYPE.get().getMutations().getAllMutations()` →
    `getFirstParent().id()`, `getSecondParent().id()`, `getResult().id()`, `getChance()`,
    `getSpecialConditions()` (already localized), `isSecret()`.

### 6.2 Jekyll foundation (workstream B)

- **Reuse what the `try-use-jekyll` branch already has** (verified): `docs/_config.yml`,
  `docs/Gemfile` (Jekyll 4.4), and a prototype `bee` *layout* that pages opt into via
  `layout: bee` front matter.
- **The `bees` collection is net-new.** That branch has **no `collections:` key and no `_bees/`
  directory** — it models bees as a per-page layout, not a collection. This design needs a real
  `bees` collection (`_bees/<id>.md` → `site.bees`), so the planner must: add the `collections:` key
  to `_config.yml`, create `_bees/`, and reconcile the prototype's layout-only approach into the
  collection model (the prototype `bee` layout is a useful starting point for `_layouts/bee.html`).
- **Deploy via GitHub Actions** (`actions/jekyll-build-pages` + `actions/deploy-pages`), since
  Jekyll 4.x + custom layouts cannot use the legacy "serve `docs/`" Pages build.
- **Jekyll source stays in `docs/`** to preserve existing directory structure and relative asset paths
  (`../article_style.css`, `../cdn/...`). Layouts use `relative_url` for robustness.
- Existing hand-coded pages have no front matter, so Jekyll copies them through unchanged — nothing
  breaks during the transition.

### 6.3 Bee pipeline (workstream C)

- **`_layouts/bee.html`** composes includes and renders game data from `site.data.bees[page.species_id]`,
  then renders `{{ content }}` (human Markdown) into the flavor slots. It emits the same DOM classes
  the current `article.js` + `article_style.css` expect, so TOC/header/footer keep working.
- **Includes** (`_includes/`):
  - `bee-info-table.html` — the right-column info table (image, family, products, flowers, effect, authority).
  - `genome-table.html` — the Default Genome trait table (uses `display` strings).
  - `centrifuge.html` — the products/recipe grid; callable as
    `{% include centrifuge.html input="honey_comb" outputs="beeswax:100, honey_drop:90" %}`.
  - `item-icon.html` — resolves an item id via `_data/items.yml` with fallback.
  - `obtaining.html` — hives the species drops from, with princess %.
  - `breeding.html` — `mutations_into` (how to breed this bee) and `mutations_from` (what it makes).
- **`_data/items.yml`** — hand-maintained icon/link/name map (§5).
- **Sync script** — `scripts/sync-bees.mjs`, invoked `npm run sync-bees -- <path-to-dump.json>`:
  reads the raw dump, derives `_data/bees.json` (§4.2), creates missing `_bees/<id>.md` stubs (never
  overwriting existing), and prints a report (new species, unmapped items, secret species). Idempotent.
  A GitHub Actions wrapper around the same script is a later addition (per chosen rollout).
  **Bootstrap note:** the wiki repo currently has no `package.json` and no `scripts/` directory, so
  the plan's first C-step is initializing Node tooling (`package.json` with the `sync-bees` script
  and a test runner for §8's sync-script tests).
- **Search index** — a Liquid template generates `search.json` from `site.pages` + `site.bees` at
  build, replacing the hand-maintained `pageindex.js`, so every bee auto-appears in search.

---

## 7. Error handling & edge cases

- **Server-side localization:** `Component.getString()` requires the language pack loaded. The dump
  must be run from **singleplayer / an integrated server** (client lang present) so display strings
  resolve to English rather than raw translation keys. The command detects unresolved keys (values
  starting with `allele.`/`for.`/`chromosome.`) and warns.
- **Unmapped / addon items:** template fallback (dumped display name + placeholder icon); the sync
  report lists them for editors to supply art/links.
- **New addon species:** stub auto-created on next sync; existing human content untouched.
- **Secret bees:** dumped with `secret: true`, but **no hiding or special-casing** — pages generate
  normally and appear in search. The wiki is a reference regardless of spoilers. (The flag remains
  available if a future "secret" badge is ever wanted.)
- **Multi-hive species** (e.g. Valiant): `obtained_from` lists every hive that drops it, each with its
  own princess %.
- **Heterozygous defaults:** default genomes are homozygous by convention, so v1 dumps the active
  allele only. The genome schema can carry an inactive allele later without disrupting existing data.
- **ID collisions across namespaces:** handled by namespace-prefixed filenames (§5).

---

## 8. Testing

- **Mod (A):** a gametest/integration test that runs the dump and asserts: JSON parses; every species
  has all 12 non-species chromosomes present (assert against the karyotype's non-species chromosome
  set, not a hard-coded count); every `chance`/`princess_chance` ∈ [0,1]; every mutation
  parent/result id resolves to a dumped species.
- **Sync script (C):** unit tests over a fixture dump — derivation correctness (hive inversion,
  mutation into/from, princess passthrough), stub creation only for missing files, **never**
  overwriting an existing human file, and unmapped-item reporting.
- **Jekyll (B/C):** `html-proofer` over the built site; a snapshot of the Forest Bee page rendered from
  a fixture `_data/bees.json` to catch layout regressions.

---

## 9. Workstreams & sequencing

Three loosely-coupled, independently testable units:

- **A — Mod command.** Independent; can proceed in parallel with B.
- **B — Jekyll foundation + deploy.** Independent of A; existing pages pass through unchanged.
- **C — Bee pipeline.** Depends on A's data contract (§4) and B's foundation.

Recommended order: **B foundation + A command (parallel) → C pipeline.** The non-bee page sweep
(out of scope, §2) is a follow-on built on B.

The data contract in §4 is the integration boundary between A and C and must be agreed before C's
sync script is written. A fixture `bees.json` conforming to §4.1 lets C be built and tested before A
is finished.
