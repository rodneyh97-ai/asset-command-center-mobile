-- Food search matches every word in any order ("greek yogurt" finds "Yogurt, Greek, plain, nonfat").
-- The first word narrows through the trigram indexes; the rest must also appear in the name or brand.
create or replace function public.search_foods(q text, lim int default 25)
returns setof public.foods language sql stable set search_path = public, extensions as $$
  with t as (select left(regexp_replace(trim(coalesce(q, '')), '[%_\\]', '', 'g'), 60) as s),
  w as (
    select t.s, array(select x from unnest(regexp_split_to_array(lower(t.s), '[^[:alnum:]]+')) x where char_length(x) >= 2 limit 6) as words
    from t
  )
  select f.* from public.foods f, w
  where cardinality(w.words) > 0
    and (f.name ilike '%' || w.words[1] || '%' or f.brand ilike '%' || w.words[1] || '%')
    and (select bool_and(f.name || ' ' || coalesce(f.brand, '') ilike '%' || x || '%') from unnest(w.words) x)
  order by f.verified desc, extensions.similarity(f.name, w.s) desc, char_length(f.name)
  limit least(greatest(coalesce(lim, 25), 1), 50);
$$;
