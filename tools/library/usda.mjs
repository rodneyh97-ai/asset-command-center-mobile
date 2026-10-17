// USDA FoodData Central (public domain) → foods.tsv
// Usage: node usda.mjs <path-to-unzipped-FoodData_Central_csv_dir> <out.tsv> [--branded]
// Download: https://fdc.nal.usda.gov/download-datasets (CSV). Generic foods = Foundation + SR Legacy.
import path from 'node:path';
import { FOOD_COLUMNS, clean, gtin, num, readTable, writer } from './lib.mjs';

// FDC nutrient ids → EatOS keys (per 100 g). Verify against nutrient.csv on first run.
export const NUTRIENTS = {
  1008: 'energy_kcal', 1003: 'protein_g', 1004: 'fat_g', 1258: 'sat_fat_g', 1005: 'carbs_g', 1079: 'fiber_g',
  2000: 'sugars_g', 1093: 'sodium_mg', 1087: 'calcium_mg', 1089: 'iron_mg', 1092: 'potassium_mg',
  1162: 'vitamin_c_mg', 1114: 'vitamin_d_ug', 1178: 'vitamin_b12_ug', 1090: 'magnesium_mg', 1095: 'zinc_mg',
};
const NUTRIENT_NAMES = {
  1008: /^energy/i, 1003: /^protein/i, 1004: /^total lipid|fat/i, 1258: /saturated/i, 1005: /^carbohydrate/i, 1079: /fiber/i,
  2000: /sugars/i, 1093: /^sodium/i, 1087: /^calcium/i, 1089: /^iron/i, 1092: /^potassium/i, 1162: /vitamin c/i,
  1114: /vitamin d/i, 1178: /vitamin b-?12/i, 1090: /^magnesium/i, 1095: /^zinc/i,
};
// Newer Foundation releases report some values under different ids. Used only when the main id is missing,
// in this order (2048/2047 = calories by Atwater factors; 1063 = total sugars; 2033 = AOAC 2011.25 fiber).
export const FALLBACKS = { energy_kcal: [2048, 2047], sugars_g: [1063], fiber_g: [2033] };
Object.assign(NUTRIENT_NAMES, { 2048: /^energy/i, 2047: /^energy/i, 1063: /sugars/i, 2033: /fiber/i });
const FALLBACK_ID = new Map(Object.entries(FALLBACKS).flatMap(([key, ids]) => ids.map((id, i) => [String(id), { key, rank: i + 1 }])));

const GENERIC = new Set(['foundation_food', 'sr_legacy_food']);

export async function importUsda(dir, outPath, { branded = false } = {}) {
  // Check the nutrient ids still mean what we think (the dataset could change).
  for await (const n of readTable(path.join(dir, 'nutrient.csv'))) {
    const expect = NUTRIENT_NAMES[n.id];
    if (expect && !expect.test(n.name)) throw new Error(`Nutrient id ${n.id} is now "${n.name}" — update NUTRIENTS before importing`);
  }
  const categories = new Map();
  try {
    for await (const c of readTable(path.join(dir, 'food_category.csv'))) categories.set(c.id, c.description);
  } catch { /* optional */ }

  const wanted = new Map();
  for await (const f of readTable(path.join(dir, 'food.csv'))) {
    const isGeneric = GENERIC.has(f.data_type);
    if (isGeneric || (branded && f.data_type === 'branded_food')) wanted.set(f.fdc_id, { f, nutrients: {}, rank: {} });
  }
  for await (const fn of readTable(path.join(dir, 'food_nutrient.csv'))) {
    const w = wanted.get(fn.fdc_id);
    const amount = num(fn.amount);
    if (!w || amount === undefined) continue;
    // rank 0 = the main id; fallbacks fill in only when nothing better was found.
    const main = NUTRIENTS[fn.nutrient_id];
    const hit = main ? { key: main, rank: 0 } : FALLBACK_ID.get(fn.nutrient_id);
    if (!hit) continue;
    const prev = w.rank[hit.key];
    if (prev === undefined || hit.rank < prev) {
      w.nutrients[hit.key] = Math.round(amount * 100) / 100;
      w.rank[hit.key] = hit.rank;
    }
  }
  const brandInfo = new Map();
  if (branded) for await (const b of readTable(path.join(dir, 'branded_food.csv'))) if (wanted.has(b.fdc_id)) brandInfo.set(b.fdc_id, b);

  const out = writer(outPath, FOOD_COLUMNS);
  for (const [id, { f, nutrients }] of wanted) {
    const b = brandInfo.get(id);
    const generic = GENERIC.has(f.data_type);
    if (!clean(f.description)) continue;
    out.write({
      source: 'usda_fdc',
      source_id: id,
      kind: generic ? 'generic' : 'branded',
      name: clean(f.description),
      brand: b ? clean(b.brand_name || b.brand_owner, 120) : undefined,
      category: generic ? categories.get(f.food_category_id) : clean(b?.branded_food_category, 120),
      gtin: gtin(b?.gtin_upc),
      ingredients_text: b ? clean(b.ingredients, 4000) : undefined,
      allergens: [],
      may_contain: [],
      allergens_known: false, // FDC has no structured allergen field: unknown, never "allergen-free"
      nutrients,
      serving_g: b && /^g$/i.test(b.serving_size_unit) ? num(b.serving_size) : undefined,
      verified: generic, // lab/curated data; branded = manufacturer label, not verified by us
    });
  }
  return out.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dir, out] = process.argv.slice(2);
  importUsda(dir, out, { branded: process.argv.includes('--branded') }).then((n) => console.log(`usda: ${n} foods → ${out}`));
}
