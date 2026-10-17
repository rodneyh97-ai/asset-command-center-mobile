// node --test tools/library/importers.test.mjs — checks the importers against small fixtures in the real file formats.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { FOOD_COLUMNS, PLACE_COLUMNS, pg } from './lib.mjs';
import { importOff } from './off.mjs';
import { importOsm } from './osm.mjs';
import { importUsda } from './usda.mjs';

const fx = (p) => new URL(`./fixtures/${p}`, import.meta.url).pathname;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eatos-lib-'));

// Reverse of pg(): read COPY text format back into values.
const unescape = (v) => (v === '\\N' ? null : v.replace(/\\(.)/g, (_, c) => ({ t: '\t', n: '\n', r: '\r' })[c] ?? c));
function readOut(file, columns) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((line) => {
    const f = line.split('\t');
    assert.equal(f.length, columns.length, `column count in: ${line}`);
    return Object.fromEntries(columns.map((c, i) => [c, unescape(f[i])]));
  });
}

test('pg() escapes COPY special characters and arrays', () => {
  assert.equal(pg('a\tb\nc\\d'), 'a\\tb\\nc\\\\d');
  assert.equal(pg(undefined), '\\N');
  assert.equal(pg([]), '{}');
  assert.equal(pg(['a"b', 'c\\d']), '{"a\\\\"b","c\\\\\\\\d"}');
  assert.equal(pg({ a: 1 }), '{"a":1}');
});

test('USDA: generic foods are verified, nutrients mapped, unknown allergens never "free of"', async () => {
  const out = path.join(tmp, 'usda.tsv');
  const n = await importUsda(fx('usda'), out);
  const rows = readOut(out, FOOD_COLUMNS);
  assert.equal(n, 2);
  const broccoli = rows.find((r) => r.source_id === '170379');
  assert.equal(broccoli.kind, 'generic');
  assert.equal(broccoli.verified, 'true');
  assert.equal(broccoli.category, 'Vegetables and Vegetable Products');
  // First value wins; water (not mapped) is ignored.
  assert.deepEqual(JSON.parse(broccoli.nutrients), { energy_kcal: 34, protein_g: 2.82, vitamin_c_mg: 89.2 });
  assert.equal(broccoli.allergens_known, 'false');
  // Newer Foundation data: calories and sugars under fallback ids, used only when the main id is missing.
  const egg = rows.find((r) => r.source_id === '748967');
  assert.deepEqual(JSON.parse(egg.nutrients), { energy_kcal: 143, protein_g: 12.4, iron_mg: 1.67, sugars_g: 0.2 });
  assert.ok(!rows.some((r) => r.source_id === '999'), 'survey foods skipped');
});

test('USDA --branded: multi-line quoted names, brand, gtin, serving; blank names skipped; not verified', async () => {
  const out = path.join(tmp, 'usda-b.tsv');
  const n = await importUsda(fx('usda'), out, { branded: true });
  const rows = readOut(out, FOOD_COLUMNS);
  assert.equal(n, 3);
  const pb = rows.find((r) => r.source_id === '2000001');
  assert.equal(pb.name, 'CRUNCHY "PEANUT" BUTTER, with sea salt');
  assert.equal(pb.kind, 'branded');
  assert.equal(pb.verified, 'false');
  assert.equal(pb.brand, 'Acme');
  assert.equal(pb.gtin, '0012345678905');
  assert.equal(pb.serving_g, '32');
  assert.equal(pb.allergens_known, 'false', 'FDC has no structured allergens, even for peanut butter');
});

test('USDA: refuses to import when a nutrient id changes meaning', async () => {
  const dir = path.join(tmp, 'usda-bad');
  fs.cpSync(fx('usda'), dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'nutrient.csv'), '"id","name","unit_name"\n"1003","Caffeine","MG"\n');
  await assert.rejects(importUsda(dir, path.join(tmp, 'x.tsv')), /1003/);
});

test('Open Food Facts (real CSV column names): country filter, allergens, traces as may_contain, sodium g→mg', async () => {
  const out = path.join(tmp, 'off.tsv');
  const n = await importOff(fx('off.tsv'), out);
  const rows = readOut(out, FOOD_COLUMNS);
  assert.equal(n, 3, 'French product and invalid barcode skipped');
  const bar = rows.find((r) => r.source_id === '0041196910759');
  assert.equal(bar.brand, 'TrailCo');
  assert.equal(bar.allergens, '{"tree_nut","gluten"}');
  assert.equal(bar.may_contain, '{"peanut"}', 'traces kept; nuts already a full allergen');
  assert.equal(bar.allergens_known, 'true');
  assert.equal(JSON.parse(bar.nutrients).sodium_mg, 250);
  const cakes = rows.find((r) => r.source_id === '0070847811169');
  assert.equal(cakes.allergens, '{}');
  assert.equal(cakes.allergens_known, 'false', 'empty allergen list = unknown');
  assert.equal(JSON.parse(cakes.nutrients).sodium_mg, undefined);
  assert.equal(JSON.parse(cakes.nutrients).energy_kcal, 387, 'kJ-only products get kcal (1619 kJ / 4.184)');
  const odd = rows.find((r) => r.source_id === '0000000000017');
  assert.equal(odd.allergens_known, 'false', 'only unmapped allergens (mustard) = unknown for ours');
  assert.ok(odd.name.includes('\\'), 'backslashes survive COPY round trip');
});

test('Open Food Facts: other countries on request', async () => {
  const out = path.join(tmp, 'off-fr.tsv');
  assert.equal(await importOff(fx('off.tsv'), out, { country: 'en:france' }), 1);
});

test('OpenStreetMap: kinds, way centers, brand fallback, clean cuisines, skips junk', async () => {
  const out = path.join(tmp, 'osm.tsv');
  const n = await importOsm(fx('overpass.json'), out);
  const rows = readOut(out, PLACE_COLUMNS);
  assert.equal(n, 4);
  const joe = rows.find((r) => r.source_id === 'node/1');
  assert.equal(joe.kind, 'restaurant');
  assert.equal(joe.cuisines, '{"mexican","burger"}', 'tex-mex dropped by the safe pattern');
  assert.deepEqual(JSON.parse(joe.address), { housenumber: '12', street: 'Main St', city: 'Kansas City' });
  const hyvee = rows.find((r) => r.source_id === 'way/2');
  assert.equal(hyvee.kind, 'grocery');
  assert.equal(hyvee.lat, '39.05');
  assert.equal(rows.find((r) => r.source_id === 'node/3').name, 'Starbucks');
  assert.ok(!rows.some((r) => ['node/4', 'node/5', 'way/6'].includes(r.source_id)));
});

test('API loader: COPY rows round-trip to JSON rows; "useful" filter keeps only products with real data', async () => {
  const { toRow, isUseful } = await import('./load-api.mjs');
  const out = path.join(tmp, 'off2.tsv');
  await importOff(fx('off.tsv'), out);
  const rows = fs.readFileSync(out, 'utf8').trim().split('\n').map((l) => toRow(l, 'foods'));
  const bar = rows.find((r) => r.source_id === '0041196910759');
  assert.deepEqual(bar.allergens, ['tree_nut', 'gluten']);
  assert.deepEqual(bar.may_contain, ['peanut']);
  assert.equal(bar.allergens_known, true);
  assert.equal(typeof bar.nutrients, 'object');
  const odd = rows.find((r) => r.source_id === '0000000000017');
  assert.ok(odd.name.includes('\\'));
  assert.equal(isUseful(odd), false, 'no nutrition, no mapped allergens, no traces');
  assert.equal(isUseful(bar), true);
  const { dedupe } = await import('./load-api.mjs');
  assert.deepEqual(dedupe([{ source: 'a', source_id: '1', name: 'old' }, { source: 'a', source_id: '1', name: 'new' }, { source: 'b', source_id: '1', name: 'x' }]).map((r) => r.name), ['new', 'x']);
  const places = path.join(tmp, 'osm2.tsv');
  await importOsm(fx('overpass.json'), places);
  const joe = toRow(fs.readFileSync(places, 'utf8').split('\n')[0], 'places');
  assert.deepEqual(joe.cuisines, ['mexican', 'burger']);
  assert.equal(joe.lat, 39.1);
});
