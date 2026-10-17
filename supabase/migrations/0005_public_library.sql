-- The food and place library is public data (USDA public domain; Open Food Facts and OpenStreetMap
-- under ODbL), so the app can read it before anyone signs in. Read-only; nothing personal here.
grant select on public.foods, public.places, public.data_sources to anon;
create policy foods_read_anon on public.foods for select to anon using (true);
create policy places_read_anon on public.places for select to anon using (true);
create policy sources_read_anon on public.data_sources for select to anon using (true);

-- Supabase already grants this by default; stated here so search works on any Postgres.
grant usage on schema extensions to anon, authenticated;

-- Food search: name or brand contains the text; verified (USDA) foods first, then closest match.
create function public.search_foods(q text, lim int default 25)
returns setof public.foods language sql stable set search_path = public, extensions as $$
  with t as (select left(regexp_replace(trim(coalesce(q, '')), '[%_\\]', '', 'g'), 60) as s)
  select f.* from public.foods f, t
  where char_length(t.s) >= 2
    and (f.name ilike '%' || t.s || '%' or f.brand ilike '%' || t.s || '%')
  order by f.verified desc, extensions.similarity(f.name, t.s) desc, char_length(f.name)
  limit least(greatest(coalesce(lim, 25), 1), 50);
$$;
grant execute on function public.search_foods(text, int) to anon, authenticated;
grant execute on function public.places_near(double precision, double precision, double precision, text) to anon;
