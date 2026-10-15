-- Opt-in anonymous retention signal: (random install id, day N since install). Nothing else.
-- Anyone with the app's public key can add a ping; nobody can read pings except through
-- the admin-only aggregate below. The install id itself is the only "key" to delete them.

create table public.retention_pings (
  install_id uuid not null,
  day int not null check (day between 0 and 3650),
  platform text not null check (platform in ('ios', 'android', 'web')),
  app_version text not null check (char_length(app_version) between 1 and 20),
  received_on date not null default current_date,
  primary key (install_id, day)
);
alter table public.retention_pings enable row level security;
-- Inserts only, and received_on can't be backdated.
create policy pings_insert on public.retention_pings for insert to anon, authenticated
  with check (received_on = current_date);
revoke all on public.retention_pings from anon, authenticated;
grant insert on public.retention_pings to anon, authenticated;

-- Opt-out: delete everything sent under an id (only someone holding the random id can).
create function public.forget_install(p_install_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.retention_pings where install_id = p_install_id;
$$;
revoke all on function public.forget_install(uuid) from public;
grant execute on function public.forget_install(uuid) to anon, authenticated;

-- Admins see cohort percentages only: of installs whose day 0 is at least N days old,
-- how many came back on day 1, around day 7 (6–8) and around day 30 (28–32).
create function public.retention_metrics()
returns table (installs bigint, d1_pct numeric, d7_pct numeric, d30_pct numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  with starts as (select install_id, received_on as day0 from public.retention_pings where day = 0),
  back as (
    select s.install_id, s.day0,
      bool_or(p.day = 1) as d1, bool_or(p.day between 6 and 8) as d7, bool_or(p.day between 28 and 32) as d30
    from starts s join public.retention_pings p using (install_id) group by s.install_id, s.day0
  )
  select count(*),
    round(100.0 * count(*) filter (where d1 and day0 <= current_date - 1) / nullif(count(*) filter (where day0 <= current_date - 1), 0), 1),
    round(100.0 * count(*) filter (where d7 and day0 <= current_date - 8) / nullif(count(*) filter (where day0 <= current_date - 8), 0), 1),
    round(100.0 * count(*) filter (where d30 and day0 <= current_date - 32) / nullif(count(*) filter (where day0 <= current_date - 32), 0), 1)
  from back;
end $$;
revoke all on function public.retention_metrics() from public, anon;
grant execute on function public.retention_metrics() to authenticated;
