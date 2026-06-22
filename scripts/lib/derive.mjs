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
similar: []       # list of { name: "...", href: "..." }
sections:
  variants:
  traits:
  history:
---
<!-- Write the intro lore here in Markdown. Game data (genome, products,
     obtaining, breeding) is filled in automatically from _data/bees.json. -->
`;
}
