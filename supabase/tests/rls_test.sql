\set ON_ERROR_STOP on
-- Users: A (normal), B (normal), O (owner admin)
insert into auth.users values
 ('aaaaaaaa-0000-0000-0000-000000000001','a@x'),('bbbbbbbb-0000-0000-0000-000000000002','b@x'),('00000000-0000-0000-0000-0000000000ff','owner@x');
insert into public.admins values ('00000000-0000-0000-0000-0000000000ff','owner');

create function pg_temp.as_user(u text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u, false); end $$;
create function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin if not ok then raise exception 'FAIL: %', msg; end if; raise notice 'ok: %', msg; end $$;

set role authenticated;

-- A writes private data
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.profiles (user_id, data) values (auth.uid(), '{"allergens":["peanut"]}');
insert into public.memories (user_id, topic, value, kind, source) values (auth.uid(), 'dislike_food', 'mushrooms', 'stated', 'manual');
insert into public.feedback_events (user_id, meal_id, kind) values (auth.uid(), 'burrito-bowl', 'accepted');
insert into public.household_members (owner_id, name, allergens) values (auth.uid(), 'Sam', '{shellfish}');

-- B cannot see or touch A's data
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect((select count(*) from public.profiles) = 0, 'B cannot read A''s profile');
select pg_temp.expect((select count(*) from public.memories) = 0, 'B cannot read A''s memories');
select pg_temp.expect((select count(*) from public.feedback_events) = 0, 'B cannot read A''s history');
select pg_temp.expect((select count(*) from public.household_members) = 0, 'B cannot read A''s household');
update public.memories set value = 'olives';
delete from public.memories;
do $$ begin
  begin
    insert into public.memories (user_id, topic, value, kind, source) values ('aaaaaaaa-0000-0000-0000-000000000001', 'like_food', 'x', 'stated', 'manual');
    raise exception 'FAIL: B wrote a memory into A''s account';
  exception when insufficient_privilege then raise notice 'ok: B cannot write into A''s account';
  end;
end $$;

-- The OWNER admin also cannot read private data
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ff');
select pg_temp.expect((select count(*) from public.memories) = 0, 'owner admin cannot read user memories');
select pg_temp.expect((select count(*) from public.profiles) = 0, 'owner admin cannot read user profiles');
select pg_temp.expect((select users from public.admin_metrics()) = 3, 'owner admin sees aggregate counts only');

-- A's data is intact
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect((select value from public.memories) = 'mushrooms', 'B''s update/delete attempts had no effect');

-- Requests: anyone submits, status forced to submitted, only admins change status
insert into public.feature_requests (kind, title, status, author_id) values ('feature', 'Grocery list export', 'released', 'bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect((select status from public.feature_requests) = 'submitted', 'new request forced to submitted');
select pg_temp.expect((select author_id from public.feature_requests) = auth.uid(), 'author cannot be spoofed');
update public.feature_requests set status = 'released';
select pg_temp.expect((select status from public.feature_requests) = 'submitted', 'non-admin cannot change request status');
insert into public.request_votes (request_id, user_id) select id, auth.uid() from public.feature_requests;
do $$ begin
  begin
    insert into public.request_votes (request_id, user_id) select id, auth.uid() from public.feature_requests;
    raise exception 'FAIL: double vote';
  exception when unique_violation then raise notice 'ok: one vote per person';
  end;
end $$;

-- Food submissions can't self-verify
insert into public.food_submissions (name, status, verified) values ('Mystery bar', 'approved', true);
select pg_temp.expect((select status from public.food_submissions) = 'pending' and not (select verified from public.food_submissions), 'food submissions start pending and unverified');
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect((select count(*) from public.food_submissions) = 0, 'others cannot see unapproved submissions');

-- Admin moderation is audited
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ff');
update public.feature_requests set status = 'planned';
update public.food_submissions set status = 'approved', verified = true;
select pg_temp.expect((select count(*) from public.audit_log) = 2, 'admin moderation is written to the audit log');
delete from public.audit_log;
select pg_temp.expect((select count(*) from public.audit_log) = 2, 'audit log cannot be deleted');

-- Non-admins can't call admin metrics
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
do $$ begin
  begin perform public.admin_metrics(); raise exception 'FAIL: non-admin read metrics';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: non-admin cannot read admin metrics';
  end;
end $$;
select pg_temp.expect((select count(*) from public.audit_log) = 0, 'non-admins cannot read the audit log');

-- Account deletion removes everything
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.delete_my_account();
reset role;
select pg_temp.expect((select count(*) from public.memories where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'deleting the account deletes memories');
select pg_temp.expect((select count(*) from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'deleting the account deletes the profile');
select pg_temp.expect((select count(*) from public.household_members where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'deleting the account deletes household data');
select pg_temp.expect((select count(*) from public.feedback_events where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'deleting the account deletes history');
\echo ALL RLS TESTS PASSED
