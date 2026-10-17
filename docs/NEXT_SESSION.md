# Handoff: Supabase setup and data import

## DONE (2026-10-17, previous session)
- April schema archived to `legacy_april` (D21); migrations 0001–0004 applied; founder is owner admin.
- Loaded: 8,229 USDA foods, 175,273 grocery products, 1,366 Kansas City places (620 restaurants, 370 fast food,
  151 cafés, 86 grocery, 139 convenience) from OpenStreetMap via the `overpass.kumi.systems` mirror. DB 227 MB / 500 MB.
- Library screens built and verified against the live server (Explore tab: Meal ideas / Foods / Near me; migrations 0005–0006).
  `mobile/.env.development` has the public URL + publishable key.
- Remaining: widen `tools/library/overpass.ql` to where testers live (ask founder for cities/ZIPs); founder device test.

---

Branch: `claude/eatos-redesign-wip` (fast-forward into `claude/eatos-mvp` when verified).

## State (2026-10-17)
- Founder has a Supabase org "Harris Tech" (free plan) with one project, which is EatOS. It may be empty or may already have tables: check before running anything.
- Network allowlist (Custom): fdc.nal.usda.gov, api.nal.usda.gov, world.openfoodfacts.org, static.openfoodfacts.org, overpass-api.de, *.supabase.co, plus package managers. Founder is adding `api.supabase.com` and env vars `SUPABASE_ACCESS_TOKEN` (scoped token, EatOS project only, 7 days: Project Settings read, Advisors read, Database read-write, Migrations read-write; it can NOT read API keys) and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (public anon key). Get the project URL via the API (`/v1/projects/{ref}` or the `get_project_url` capability). Never ask for tokens or passwords in chat.
- Direct Postgres (port 5432/6543) probably can't pass the HTTPS proxy, so use the Management API: `POST https://api.supabase.com/v1/projects/{ref}/database/query` with `Authorization: Bearer $SUPABASE_ACCESS_TOKEN`, body `{"query": "..."}`.

Project ref: `fkhtvstwcgpvvicgikoj` (region us-west-2), so the URL is `https://fkhtvstwcgpvvicgikoj.supabase.co`. The anon key may be a new `sb_publishable_…` key; `mobile/src/analytics/usage.ts` handles both.

## Steps
1. `GET https://api.supabase.com/v1/projects` → find the EatOS project ref. Check which tables exist (`select table_name from information_schema.tables where table_schema='public'`).
2. Run any of `supabase/migrations/0001_init.sql`, `0002_library.sql`, `0003_retention.sql` that aren't applied yet, in order. Then re-run the read/write checks that `supabase/tests/*.sql` cover, where they make sense on the real project (don't leave test users behind).
3. Re-create the data (scratch files don't survive sessions):
   - USDA: download `https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2025-12-18.zip` and `.../FoodData_Central_sr_legacy_food_csv_2018-04.zip`, unzip into separate empty dirs, run `node tools/library/usda.mjs <dir> out.tsv` for each. Expect 436 + 7,793 foods.
   - Open Food Facts: `curl -sL https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz | gunzip -c | node tools/library/off.mjs /dev/stdin off.tsv` (~6 min, ~855k US products). Verified on the real export (2026-10-17): 855,503 US products; 9.9% have label allergens, 0.9% "may contain", 11.7% have nutrition. That is the data, not a bug (a raw sample of 200k US rows has nutrition on ~10.5%).
   - OSM places: needs the founder's launch city (ask). Edit the bounding box in `tools/library/overpass.ql`.
4. Load in batches through the Management API: insert into `public.foods` / `public.places` with `on conflict (source, source_id) do update` (same columns as `tools/library/load.sql`). Keep each request a few MB. Verify row counts afterwards.
5. Free plan database limit is 500 MB. Load only the 175,096 products that have nutrition, label allergens or "may contain" (~88 MB of rows before indexes); the other ~680k are just a name and barcode. Check `select pg_size_pretty(pg_database_size(current_database()))` after loading and tell the founder.
6. After migrations, run the advisors (`GET /v1/projects/{ref}/advisors/security`) and fix anything they flag. Then put the project URL and the anon key (from `$EXPO_PUBLIC_SUPABASE_ANON_KEY`) in `mobile/.env` as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (anon key is public by design; never the service_role key). Make sure `.env` is gitignored and tell the founder.

## Still waiting on the founder
- Launch city (for restaurants and grocery stores).
- Device test on their phone (`DEVICE_TEST_CHECKLIST.md`).
- Sign-off on D9, D12, D15 in `DECISIONS.md`.
