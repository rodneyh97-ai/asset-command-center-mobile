-- Hardening from Supabase's security advisor (2026-10-17).

-- Signed-out visitors need exactly one thing: sending an opt-in retention ping.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant insert on public.retention_pings to anon;
-- New tables don't get anon access by default either.
alter default privileges in schema public revoke all on tables from anon;

-- Internal helpers are not API endpoints. Triggers and event triggers still run them.
revoke all on function public.audit() from public, anon, authenticated;
revoke all on function public.is_admin(text[]) from public, anon;
-- Row-level security policies call is_admin() as the signed-in user, so they need it.
grant execute on function public.is_admin(text[]) to authenticated;
do $$ begin
  if exists (select 1 from pg_proc where proname = 'rls_auto_enable' and pronamespace = 'public'::regnamespace) then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

-- Pin search_path on functions that didn't.
alter function public.force_submitted() set search_path = public;
alter function public.force_pending() set search_path = public;
alter function public.places_near(double precision, double precision, double precision, text) set search_path = public, extensions;

-- Keep extensions out of the API schema. Existing trigram indexes keep working.
create schema if not exists extensions;
alter extension pg_trgm set schema extensions;

-- Archived April tables (only where that archive exists): no API access at all.
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'legacy_april') then
    execute 'revoke all on all tables in schema legacy_april from public, anon, authenticated';
    execute 'revoke all on all functions in schema legacy_april from public, anon, authenticated';
  end if;
end $$;
