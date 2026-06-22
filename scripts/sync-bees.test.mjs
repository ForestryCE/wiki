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
