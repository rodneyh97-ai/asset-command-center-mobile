\set ON_ERROR_STOP on
-- Runs after load.sql has imported the fixture TSVs. Library = read-only public data; favorites = private.
create function pg_temp.as_user(u text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u, false); end $$;
create function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin if not ok then raise exception 'FAIL: %', msg; end if; raise notice 'ok: %', msg; end $$;
create function pg_temp.denied(stmt text, msg text) returns void language plpgsql as $$
declare n bigint;
begin
  execute stmt; get diagnostics n = row_count;
  if n > 0 then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok: %', msg;
exception when insufficient_privilege then raise notice 'ok: %', msg;
end $$;

insert into auth.users values ('cccccccc-0000-0000-0000-000000000003','c@x'),('dddddddd-0000-0000-0000-000000000004','d@x');

-- Import is idempotent: loading the same files twice must not duplicate rows.
select pg_temp.expect((select count(*) from public.foods) = 5, 'fixture foods imported once (2 USDA generic + 3 OFF)');
select pg_temp.expect((select count(*) from public.places) = 4, 'fixture places imported once');
select pg_temp.expect((select may_contain from public.foods where source_id = '0041196910759') = '{peanut}', 'may-contain traces stored');
select pg_temp.expect((select (nutrients->>'protein_g')::numeric from public.foods where source_id = '748967') = 12.4, 'nutrients stored per 100 g');

set role anon;
select pg_temp.expect((select count(*) from public.foods) = 5, 'signed-out app can read the public food library');
select pg_temp.expect((select string_agg(source_id, ',') from public.search_foods('broc')) = '170379', 'food search finds by name');
select pg_temp.expect((select count(*) from public.search_foods('%')) = 0, 'wildcards alone match nothing');
select pg_temp.expect((select string_agg(source_id, ',') from public.search_foods('raw broccoli')) = '170379', 'words match in any order ("raw broccoli" finds "Broccoli, raw")');
select pg_temp.expect((select count(*) from public.search_foods('broccoli pizza')) = 0, 'every word must match');
select pg_temp.expect((select string_agg(source_id, ',') from public.search_foods('trailco granola')) = '0041196910759', 'brand + name words both count');
select pg_temp.expect((select count(*) from public.search_foods('a')) = 0, 'one letter is too short to search');
select pg_temp.expect((select count(*) from public.search_foods('acme')) = 0, 'branded USDA food not imported without --branded');
select pg_temp.expect((select source from public.search_foods('e') limit 1) is null, 'short queries return nothing');
select pg_temp.denied($$insert into public.foods (source, source_id, kind, name) values ('usda_fdc', 'x', 'generic', 'x')$$, 'signed-out users cannot add foods');
select pg_temp.denied($$update public.places set name = 'x'$$, 'signed-out users cannot change places');
do $$ begin
  begin perform count(*) from public.memories; raise exception 'FAIL: anon read memories';
  exception when insufficient_privilege then raise notice 'ok: signed-out users still cannot read private tables';
  end;
end $$;
reset role;

set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect((select count(*) from public.foods where name ilike '%broccoli%') = 1, 'signed-in users can search foods');
select pg_temp.expect((select count(*) from public.data_sources) = 3, 'signed-in users can read sources and attribution');
select pg_temp.denied($$insert into public.foods (source, source_id, kind, name) values ('usda_fdc', 'fake', 'generic', 'Fake food')$$, 'users cannot add library foods');
select pg_temp.denied($$update public.foods set allergens = '{}', allergens_known = true$$, 'users cannot rewrite allergen data');
select pg_temp.denied($$delete from public.places$$, 'users cannot delete places');
select pg_temp.denied($$update public.data_sources set attribution = ''$$, 'users cannot remove attribution');
reset role;
select pg_temp.expect((select count(*) from public.foods where allergens_known) = 1, 'allergen data unchanged after attempts');
select pg_temp.expect((select count(*) from public.places) = 4, 'places unchanged after attempts');
set role authenticated;

-- Nearby search: nearest first, kind filter, radius clamped.
select pg_temp.expect((select string_agg(source_id, ',') from public.places_near(39.10, -94.58, 10)) = 'node/1,node/3,way/2', 'places_near returns nearest first and excludes far places');
select pg_temp.expect((select string_agg(source_id, ',') from public.places_near(39.10, -94.58, 10, 'grocery')) = 'way/2', 'places_near filters to grocery stores');
select pg_temp.expect((select count(*) from public.places_near(39.10, -94.58, 100000)) = 3, 'radius is capped at 50 km');
select pg_temp.expect((select count(*) from public.places_near(39.10, -94.58, -5)) = 1, 'negative radius treated as minimum');

-- Favorites are private.
insert into public.favorite_places (user_id, place_id, role) select auth.uid(), id, 'my_grocery_store' from public.places where source_id = 'way/2';
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000004');
select pg_temp.expect((select count(*) from public.favorite_places) = 0, 'D cannot see C''s grocery store');
select pg_temp.denied($$delete from public.favorite_places$$, 'D cannot delete C''s favorites');
do $$ begin
  begin
    insert into public.favorite_places (user_id, place_id) select 'cccccccc-0000-0000-0000-000000000003', id from public.places limit 1;
    raise exception 'FAIL: D wrote a favorite into C''s account';
  exception when insufficient_privilege then raise notice 'ok: D cannot write C''s favorites';
  end;
end $$;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect((select count(*) from public.favorite_places) = 1, 'C still has their grocery store');
select public.delete_my_account();
reset role;
select pg_temp.expect((select count(*) from public.favorite_places) = 0, 'deleting the account deletes favorites');
\echo ALL LIBRARY TESTS PASSED
