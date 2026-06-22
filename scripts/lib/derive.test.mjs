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
