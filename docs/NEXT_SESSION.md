# Handoff: Supabase setup and data import

Branch: `claude/eatos-redesign-wip` (fast-forward into `claude/eatos-mvp` when verified).

## State (2026-10-17)
- Founder has a Supabase org "Harris Tech" (free plan) with one project, which is EatOS. It may be empty or may already have tables: check before running anything.
- Network allowlist (Custom): fdc.nal.usda.gov, api.nal.usda.gov, world.openfoodfacts.org, static.openfoodfacts.org, overpass-api.de, *.supabase.co, plus package managers. Founder is adding `api.supabase.com` and env var `SUPABASE_ACCESS_TOKEN` (personal access token). Never ask for tokens or passwords in chat.
- Direct Postgres (port 5432/6543) probably can't pass the HTTPS proxy, so use the Management API: `POST https://api.supabase.com/v1/projects/{ref}/database/query` with `Authorization: Bearer $SUPABASE_ACCESS_TOKEN`, body `{"query": "..."}`.

## Steps
1. `GET https://api.supabase.com/v1/projects` → find the EatOS project ref. Check which tables exist (`select table_name from information_schema.tables where table_schema='public'`).
2. Run any of `supabase/migrations/0001_init.sql`, `0002_library.sql`, `0003_retention.sql` that aren't applied yet, in order. Then re-run the read/write checks that `supabase/tests/*.sql` cover, where they make sense on the real project (don't leave test users behind).
3. Re-create the data (scratch files don't survive sessions):
   - USDA: download `https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2025-12-18.zip` and `.../FoodData_Central_sr_legacy_food_csv_2018-04.zip`, unzip into separate empty dirs, run `node tools/library/usda.mjs <dir> out.tsv` for each. Expect 436 + 7,793 foods.
   - Open Food Facts: `curl -sL https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz | gunzip -c | node tools/library/off.mjs /dev/stdin off.tsv` (~6 min, ~855k US products). Sanity-check: allergens_known should be well above 0% and energy_kcal coverage much higher than 11.7% (both were bugs fixed in b5c88c2).
   - OSM places: needs the founder's launch city (ask). Edit the bounding box in `tools/library/overpass.ql`.
4. Load in batches through the Management API: insert into `public.foods` / `public.places` with `on conflict (source, source_id) do update` (same columns as `tools/library/load.sql`). Keep each request a few MB. Verify row counts afterwards.
5. Free plan database limit is 500 MB. 855k grocery products plus indexes may not fit: measure with `select pg_size_pretty(pg_database_size(current_database()))` after loading a sample, and if it won't fit, load only products with nutrition and allergen data and tell the founder.
6. Put the project URL and anon key in `mobile/.env` as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (anon key is public by design; never the service_role key). Make sure `.env` is gitignored and tell the founder.

## Still waiting on the founder
- Launch city (for restaurants and grocery stores).
- Device test on their phone (`DEVICE_TEST_CHECKLIST.md`).
- Sign-off on D9, D12, D15 in `DECISIONS.md`.
