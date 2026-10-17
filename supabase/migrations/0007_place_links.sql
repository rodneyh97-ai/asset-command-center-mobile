-- A place's own website and menu link, and when it was last edited on OpenStreetMap (ODbL).
-- osm_updated_at is the last edit of the map entry (any edit), not the day the place opened:
-- the app says "new or updated on the map", never "newly opened". All nullable; nothing deleted.
alter table public.places
  add column website text check (website is null or ((website like 'https://%' or website like 'http://%') and char_length(website) <= 300)),
  add column menu_url text check (menu_url is null or ((menu_url like 'https://%' or menu_url like 'http://%') and char_length(menu_url) <= 300)),
  add column osm_updated_at timestamptz;

-- Same signature, search_path and grants as before (0002, 0004, 0005). p.* now includes the new columns;
-- restated so the function that serves them is in this migration.
create or replace function public.places_near(p_lat double precision, p_lon double precision, p_km double precision default 5, p_kind text default null)
returns setof public.places language sql stable set search_path = public, extensions as $$
  with r as (select least(greatest(coalesce(p_km, 5), 0.1), 50) as km)  -- radius clamped to 0.1–50 km
  select p.* from public.places p, r
  where p.lat between p_lat - r.km / 111.0 and p_lat + r.km / 111.0
    and p.lon between p_lon - r.km / (111.0 * greatest(cos(radians(p_lat)), 0.01)) and p_lon + r.km / (111.0 * greatest(cos(radians(p_lat)), 0.01))
    and (p_kind is null or p.kind = p_kind)
  order by (p.lat - p_lat) ^ 2 + ((p.lon - p_lon) * cos(radians(p_lat))) ^ 2
  limit 50;
$$;
grant execute on function public.places_near(double precision, double precision, double precision, text) to anon, authenticated;
