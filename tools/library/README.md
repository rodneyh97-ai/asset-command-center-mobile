# Public-data library importers

Turn public datasets into rows for `foods` and `places` (`supabase/migrations/0002_library.sql`). Node 20+, no dependencies; files are streamed, so the multi-GB dumps are fine.

| Source | What it gives | License | Importer |
|---|---|---|---|
| [USDA FoodData Central](https://fdc.nal.usda.gov/download-datasets) (CSV) | ~8k generic foods with lab-measured macros and micros; optionally ~400k branded labels | Public domain | `usda.mjs` |
| [Open Food Facts](https://world.openfoodfacts.org/data) (CSV export, tab-separated) | US grocery products by barcode, label allergens and "may contain" traces, per-100 g nutrition | ODbL | `off.mjs` |
| [OpenStreetMap](https://www.openstreetmap.org) via Overpass | Restaurants, fast food, cafes, grocery and convenience stores with location, brand, cuisine | ODbL | `osm.mjs` + `overpass.ql` |

Not available from any public source: restaurant menus, dish prices, reliable opening hours.

## Run
```sh
node usda.mjs ./FoodData_Central_csv usda.tsv            # add --branded for branded labels
node off.mjs en.openfoodfacts.org.products.csv off.tsv   # --country=en:canada etc.
curl -s https://overpass-api.de/api/interpreter --data-urlencode "data@overpass.ql" > area.json   # edit the box first
node osm.mjs area.json places.tsv
cat usda.tsv off.tsv > foods.tsv
psql "$DATABASE_URL" -v foods=foods.tsv -v places=places.tsv -f load.sql   # upserts; safe to re-run
```
`$DATABASE_URL` is the database connection string (service role). Never put it in the app.

## Safety rules built in
- No structured allergen data (all USDA rows, OFF rows with an empty list) → `allergens_known = false`. The app must treat these as unknown, never as allergen-free.
- OFF "traces" → `may_contain`.
- The USDA importer stops if a nutrient id changes meaning in a new release.

## Tests
`node --test tools/library/importers.test.mjs` (formats, escaping, allergen rules) and `supabase/tests/run.sh` (load + access rules).
