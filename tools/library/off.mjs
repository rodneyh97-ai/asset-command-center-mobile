// Open Food Facts (ODbL) → foods.tsv. Input: the tab-separated CSV export
// (https://world.openfoodfacts.org/data → "en.openfoodfacts.org.products.csv"), unzipped.
// Usage: node off.mjs <products.csv> <out.tsv> [--country=en:united-states]
import { ALLERGEN_TAGS, FOOD_COLUMNS, clean, gtin, num, readTable, writer } from './lib.mjs';

export async function importOff(input, outPath, { country = 'en:united-states' } = {}) {
  const out = writer(outPath, FOOD_COLUMNS);
  for await (const p of readTable(input, '\t')) {
    if (country && !(p.countries_tags ?? '').split(',').includes(country)) continue;
    const name = clean(p.product_name);
    const code = gtin(p.code);
    if (!name || !code) continue;
    const map = (field) => [...new Set((field ?? '').split(',').map((t) => ALLERGEN_TAGS[t.trim()]).filter(Boolean))];
    // The CSV export names these `allergens` and `traces_tags` (the API uses `allergens_tags`).
    const allergens = map(p.allergens_tags ?? p.allergens);
    const mayContain = map(p.traces_tags ?? p.traces).filter((a) => !allergens.includes(a));
    // Many products list energy only in kJ; 1 kcal = 4.184 kJ.
    const kj = num(p['energy-kj_100g']) ?? num(p.energy_100g);
    const kcal = num(p['energy-kcal_100g']) ?? (kj !== undefined ? Math.round((kj / 4.184) * 10) / 10 : undefined);
    const n = {
      energy_kcal: kcal,
      protein_g: num(p.proteins_100g),
      fat_g: num(p.fat_100g),
      sat_fat_g: num(p['saturated-fat_100g']),
      carbs_g: num(p.carbohydrates_100g),
      fiber_g: num(p.fiber_100g),
      sugars_g: num(p.sugars_100g),
      sodium_mg: num(p.sodium_100g) !== undefined ? Math.round(num(p.sodium_100g) * 1000 * 100) / 100 : undefined,
    };
    out.write({
      source: 'open_food_facts',
      source_id: code,
      kind: 'branded',
      name,
      brand: clean(p.brands, 120).split(',')[0] || undefined,
      category: clean(p.main_category_en || p.categories_en, 120).split(',')[0] || undefined,
      gtin: code,
      ingredients_text: clean(p.ingredients_text, 4000) || undefined,
      allergens,
      // Only trust allergen data when the product lists some; an empty list may just mean "not entered".
      allergens_known: allergens.length > 0,
      may_contain: mayContain,
      nutrients: Object.fromEntries(Object.entries(n).filter(([, v]) => v !== undefined)),
      verified: false,
    });
  }
  return out.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [input, out] = process.argv.slice(2);
  const country = (process.argv.find((a) => a.startsWith('--country=')) ?? '').split('=')[1];
  importOff(input, out, { country: country ?? 'en:united-states' }).then((n) => console.log(`off: ${n} products → ${out}`));
}
