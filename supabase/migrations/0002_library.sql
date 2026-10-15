-- Public-data library: foods & grocery products (USDA FoodData Central, Open Food Facts)
-- and places (OpenStreetMap). Readable by signed-in users; written only by the import
-- pipeline (service role). Every row keeps its source, license and verification status.

create extension if not exists pg_trgm;

create table public.data_sources (
  id text primary key,                 -- 'usda_fdc', 'open_food_facts', 'openstreetmap'
  name text not null,
  license text not null,               -- 'Public domain (CC0)', 'ODbL 1.0'
  attribution text not null,           -- text that must be shown in the app
  url text not null
);
insert into public.data_sources values
  ('usda_fdc', 'USDA FoodData Central', 'Public domain (CC0 1.0)', 'Food data: U.S. Department of Agriculture, FoodData Central.', 'https://fdc.nal.usda.gov'),
  ('open_food_facts', 'Open Food Facts', 'ODbL 1.0 (database), DbCL (contents)', 'Product data © Open Food Facts contributors, ODbL.', 'https://world.openfoodfacts.org'),
  ('openstreetmap', 'OpenStreetMap', 'ODbL 1.0', 'Map data © OpenStreetMap contributors, ODbL.', 'https://www.openstreetmap.org/copyright');

create table public.foods (
  id bigint generated always as identity primary key,
  source text not null references public.data_sources (id),
  source_id text not null,
  kind text not null check (kind in ('generic', 'branded')),
  name text not null check (char_length(name) between 1 and 300),
  brand text,
  category text,
  gtin text check (gtin ~ '^[0-9]{6,14}$'),
  ingredients_text text,
  -- Allergens from the source's own allergen data (label-derived). Empty + allergens_known=false means UNKNOWN, never "free of".
  allergens text[] not null default '{}',
  allergens_known boolean not null default false,
  may_contain text[] not null default '{}',  -- precautionary "may contain" (traces) from the label
  -- Per 100 g (or 100 ml): {"energy_kcal": .., "protein_g": .., "fat_g": .., "carbs_g": .., "fiber_g": .., "sugars_g": .., "sodium_mg": .., "iron_mg": .., ...}
  nutrients jsonb not null default '{}'::jsonb,
  serving_g numeric,
  verified boolean not null default false,  -- true only for curated sources (USDA generic) or admin-approved rows
  imported_at timestamptz not null default now(),
  unique (source, source_id)
);
create index foods_name_trgm on public.foods using gin (name gin_trgm_ops);
create index foods_brand_trgm on public.foods using gin (brand gin_trgm_ops);
create index foods_gtin on public.foods (gtin);

create table public.places (
  id bigint generated always as identity primary key,
  source text not null references public.data_sources (id),
  source_id text not null,                 -- e.g. 'node/123456'
  kind text not null check (kind in ('restaurant', 'fast_food', 'cafe', 'grocery', 'convenience')),
  name text not null check (char_length(name) between 1 and 200),
  brand text,
  cuisines text[] not null default '{}',
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  address jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique (source, source_id)
);
create index places_name_trgm on public.places using gin (name gin_trgm_ops);
create index places_geo on public.places (lat, lon);

-- Users' own picks (private).
create table public.favorite_places (
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id bigint not null references public.places (id) on delete cascade,
  role text not null default 'favorite' check (role in ('favorite', 'my_grocery_store')),
  created_at timestamptz not null default now(),
  primary key (user_id, place_id, role)
);

alter table public.data_sources enable row level security;
alter table public.foods enable row level security;
alter table public.places enable row level security;
alter table public.favorite_places enable row level security;

create policy sources_read on public.data_sources for select to authenticated using (true);
create policy foods_read on public.foods for select to authenticated using (true);
create policy places_read on public.places for select to authenticated using (true);
-- No insert/update/delete policies on library tables: only the service-role import pipeline writes.
create policy own_favorite_places on public.favorite_places for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Nearby places within a radius (km), simple and index-friendly (no PostGIS needed at this scale).
create function public.places_near(p_lat double precision, p_lon double precision, p_km double precision default 5, p_kind text default null)
returns setof public.places language sql stable as $$
  with r as (select least(greatest(coalesce(p_km, 5), 0.1), 50) as km)  -- radius clamped to 0.1–50 km
  select p.* from public.places p, r
  where p.lat between p_lat - r.km / 111.0 and p_lat + r.km / 111.0
    and p.lon between p_lon - r.km / (111.0 * greatest(cos(radians(p_lat)), 0.01)) and p_lon + r.km / (111.0 * greatest(cos(radians(p_lat)), 0.01))
    and (p_kind is null or p.kind = p_kind)
  order by (p.lat - p_lat) ^ 2 + ((p.lon - p_lon) * cos(radians(p_lat))) ^ 2
  limit 50;
$$;
grant execute on function public.places_near(double precision, double precision, double precision, text) to authenticated;
