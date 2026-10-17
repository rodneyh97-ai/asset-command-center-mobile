-- Upsert importer output into the library. Run with the service role / database owner:
--   psql "$DATABASE_URL" -v foods=foods.tsv -v places=places.tsv -f load.sql
\set ON_ERROR_STOP on
begin;
create temp table sf (source text, source_id text, kind text, name text, brand text, category text, gtin text, ingredients_text text,
  allergens text[], allergens_known boolean, may_contain text[], nutrients jsonb, serving_g numeric, verified boolean) on commit drop;
create temp table sp (source text, source_id text, kind text, name text, brand text, cuisines text[], lat double precision,
  lon double precision, address jsonb, website text, menu_url text, osm_updated_at timestamptz) on commit drop;
-- \copy can't expand variables directly, so build the command first.
\set copy_foods '\\copy sf from ' :'foods'
\set copy_places '\\copy sp from ' :'places'
:copy_foods
:copy_places
insert into public.foods (source, source_id, kind, name, brand, category, gtin, ingredients_text, allergens, allergens_known, may_contain, nutrients, serving_g, verified)
  select * from sf
  on conflict (source, source_id) do update set name = excluded.name, brand = excluded.brand, category = excluded.category,
    gtin = excluded.gtin, ingredients_text = excluded.ingredients_text, allergens = excluded.allergens,
    allergens_known = excluded.allergens_known, may_contain = excluded.may_contain, nutrients = excluded.nutrients, serving_g = excluded.serving_g,
    verified = excluded.verified, imported_at = now();
insert into public.places (source, source_id, kind, name, brand, cuisines, lat, lon, address, website, menu_url, osm_updated_at)
  select * from sp
  on conflict (source, source_id) do update set kind = excluded.kind, name = excluded.name, brand = excluded.brand,
    cuisines = excluded.cuisines, lat = excluded.lat, lon = excluded.lon, address = excluded.address,
    website = excluded.website, menu_url = excluded.menu_url, osm_updated_at = excluded.osm_updated_at, imported_at = now();
commit;
