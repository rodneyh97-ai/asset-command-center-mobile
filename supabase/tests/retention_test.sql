\set ON_ERROR_STOP on
create function pg_temp.as_user(u text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u, false); end $$;
create function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin if not ok then raise exception 'FAIL: %', msg; end if; raise notice 'ok: %', msg; end $$;

-- Seed history as the database owner: 4 installs started 40 days ago.
-- i1 back on 1, 7, 30; i2 back on 1 only; i3 never back; i4 back on 7.
insert into public.retention_pings (install_id, day, platform, app_version, received_on) values
 ('11111111-1111-4111-8111-111111111111', 0, 'ios', '1.0.0', current_date - 40),
 ('11111111-1111-4111-8111-111111111111', 1, 'ios', '1.0.0', current_date - 39),
 ('11111111-1111-4111-8111-111111111111', 7, 'ios', '1.0.0', current_date - 33),
 ('11111111-1111-4111-8111-111111111111', 30, 'ios', '1.0.0', current_date - 10),
 ('22222222-2222-4222-8222-222222222222', 0, 'android', '1.0.0', current_date - 40),
 ('22222222-2222-4222-8222-222222222222', 1, 'android', '1.0.0', current_date - 39),
 ('33333333-3333-4333-8333-333333333333', 0, 'ios', '1.0.0', current_date - 40),
 ('44444444-4444-4444-8444-444444444444', 0, 'ios', '1.0.0', current_date - 40),
 ('44444444-4444-4444-8444-444444444444', 6, 'ios', '1.0.0', current_date - 34),
 -- A brand-new install must not drag the day-7/day-30 percentages down.
 ('55555555-5555-4555-8555-555555555555', 0, 'web', '1.0.0', current_date);

set role anon;
insert into public.retention_pings (install_id, day, platform, app_version) values ('66666666-6666-4666-8666-666666666666', 0, 'ios', '1.0.0');
select pg_temp.expect(true, 'signed-out app can send a ping');
do $$ begin
  begin perform count(*) from public.retention_pings; raise exception 'FAIL: anon read pings';
  exception when insufficient_privilege then raise notice 'ok: pings cannot be read back';
  end;
end $$;
do $$ begin
  begin
    insert into public.retention_pings (install_id, day, platform, app_version, received_on) values ('77777777-7777-4777-8777-777777777777', 0, 'ios', '1', current_date - 5);
    raise exception 'FAIL: backdated ping accepted';
  exception when insufficient_privilege then raise notice 'ok: pings cannot be backdated';
  end;
end $$;
do $$ begin
  begin
    insert into public.retention_pings (install_id, day, platform, app_version) values ('66666666-6666-4666-8666-666666666666', 0, 'ios', '1.0.0');
    raise exception 'FAIL: duplicate accepted';
  exception when unique_violation then raise notice 'ok: one ping per install per day (client treats 409 as sent)';
  end;
end $$;
do $$ begin
  begin
    insert into public.retention_pings (install_id, day, platform, app_version) values ('88888888-8888-4888-8888-888888888888', 0, 'ios', repeat('x', 500));
    raise exception 'FAIL: junk accepted';
  exception when check_violation then raise notice 'ok: oversized fields rejected';
  end;
end $$;
do $$ begin
  begin perform public.retention_metrics(); raise exception 'FAIL: anon read metrics';
  exception when insufficient_privilege then raise notice 'ok: anon cannot read retention metrics';
  end;
end $$;
select public.forget_install('66666666-6666-4666-8666-666666666666');
reset role;
select pg_temp.expect((select count(*) from public.retention_pings where install_id = '66666666-6666-4666-8666-666666666666') = 0, 'opt-out deletes that install''s pings');
select pg_temp.expect((select count(*) from public.retention_pings) = 10, 'opt-out leaves other installs alone');

set role authenticated;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
do $$ begin
  begin perform public.retention_metrics(); raise exception 'FAIL: non-admin read metrics';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: non-admins cannot read retention metrics';
  end;
end $$;
select pg_temp.expect((select count(*) from public.retention_pings) = 0, 'signed-in users cannot read pings either');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ff');
select pg_temp.expect((select installs from public.retention_metrics()) = 5, 'admin sees install count');
select pg_temp.expect((select d1_pct from public.retention_metrics()) = 50.0, 'day-1 return: 2 of 4 eligible');
select pg_temp.expect((select d7_pct from public.retention_metrics()) = 50.0, 'day-7 return (days 6–8): 2 of 4 eligible');
select pg_temp.expect((select d30_pct from public.retention_metrics()) = 25.0, 'day-30 return: 1 of 4 eligible, new install excluded');
reset role;
\echo ALL RETENTION TESTS PASSED
