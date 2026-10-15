-- EatOS server schema (Supabase / PostgreSQL). Every user table is protected by
-- row-level security: a user can only ever touch their own rows. Admins get
-- aggregate numbers and moderation tools, never other users' memories or health data.

create extension if not exists pgcrypto;

-- ---------- Admin roles ----------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'content', 'support')),
  created_at timestamptz not null default now()
);

create function public.is_admin(allowed text[] default array['owner', 'content', 'support'])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid() and a.role = any (allowed));
$$;

-- ---------- Private user data (owner-only) ----------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 32768),
  personalization jsonb not null default '{"learnFromBehavior": true, "trackMood": true}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  allergens text[] not null default '{}',
  diets text[] not null default '{}',
  cuisines text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject text not null default 'me' check (char_length(subject) <= 60),
  topic text not null check (topic in ('preferred_name', 'dislike_food', 'like_food', 'tradeoff', 'weeknight_cook_minutes',
    'weekly_grocery_budget', 'cooking_skill', 'meals_per_day', 'not_true', 'confirmed_trait')),
  value text not null check (char_length(value) between 1 and 60),
  kind text not null check (kind in ('stated', 'confirmed', 'temporary')),
  source text not null check (source in ('onboarding', 'profile', 'question', 'inference', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  check (kind <> 'temporary' or expires_at is not null)
);
create index memories_user_idx on public.memories (user_id);

create table public.feedback_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  meal_id text not null check (char_length(meal_id) <= 100),
  kind text not null check (kind in ('accepted', 'saved', 'unsaved', 'disliked', 'swapped', 'loved', 'fine')),
  at timestamptz not null default now(),
  setting text,
  meal_time text
);
create index feedback_user_idx on public.feedback_events (user_id, at desc);

-- ---------- Requests & voting (shared, moderated) ----------
create table public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('food', 'brand', 'menu_item', 'recipe', 'feature', 'integration', 'improvement')),
  title text not null check (char_length(title) between 3 and 120),
  body text check (char_length(body) <= 2000),
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'planned', 'in_progress', 'released', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.request_votes (
  request_id uuid not null references public.feature_requests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

-- Food additions never show as verified until an admin approves them.
create table public.food_submissions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  details jsonb not null default '{}'::jsonb check (pg_column_size(details) < 16384),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  verified boolean not null default false,
  reviewed_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  check (verified = false or status = 'approved')
);

-- ---------- Audit log (append-only) ----------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target text,
  details jsonb,
  at timestamptz not null default now()
);

create function public.audit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor_id, action, target, details)
  values (auth.uid(), tg_table_name || '.' || lower(tg_op), coalesce(new.id::text, old.id::text),
          jsonb_build_object('status', coalesce(new.status, old.status)));
  return coalesce(new, old);
end $$;
create trigger audit_requests after update or delete on public.feature_requests for each row execute function public.audit();
create trigger audit_food after update or delete on public.food_submissions for each row execute function public.audit();

-- New requests always start as 'submitted', whatever the client sends.
create function public.force_submitted() returns trigger language plpgsql as $$
begin new.status := 'submitted'; new.author_id := auth.uid(); return new; end $$;
create trigger requests_new before insert on public.feature_requests for each row execute function public.force_submitted();

create function public.force_pending() returns trigger language plpgsql as $$
begin new.status := 'pending'; new.verified := false; new.reviewed_by := null; new.author_id := auth.uid(); return new; end $$;
create trigger food_new before insert on public.food_submissions for each row execute function public.force_pending();

-- ---------- Row-level security ----------
alter table public.admins enable row level security;
alter table public.profiles enable row level security;
alter table public.household_members enable row level security;
alter table public.memories enable row level security;
alter table public.feedback_events enable row level security;
alter table public.feature_requests enable row level security;
alter table public.request_votes enable row level security;
alter table public.food_submissions enable row level security;
alter table public.audit_log enable row level security;

-- Owner-only tables: no admin bypass on purpose.
create policy own_profile on public.profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_members on public.household_members for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy own_memories on public.memories for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_feedback on public.feedback_events for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy admins_self on public.admins for select to authenticated using (user_id = auth.uid());

create policy requests_read on public.feature_requests for select to authenticated using (true);
create policy requests_create on public.feature_requests for insert to authenticated with check (true);
create policy requests_moderate on public.feature_requests for update to authenticated
  using (public.is_admin(array['owner', 'content'])) with check (public.is_admin(array['owner', 'content']));

create policy votes_read on public.request_votes for select to authenticated using (true);
create policy votes_own on public.request_votes for insert to authenticated with check (user_id = auth.uid());
create policy votes_unvote on public.request_votes for delete to authenticated using (user_id = auth.uid());

create policy food_create on public.food_submissions for insert to authenticated with check (true);
create policy food_read on public.food_submissions for select to authenticated
  using (author_id = auth.uid() or status = 'approved' or public.is_admin(array['owner', 'content']));
create policy food_review on public.food_submissions for update to authenticated
  using (public.is_admin(array['owner', 'content'])) with check (public.is_admin(array['owner', 'content']));

create policy audit_owner_read on public.audit_log for select to authenticated using (public.is_admin(array['owner']));

-- ---------- Privacy-preserving admin metrics (counts only) ----------
create function public.admin_metrics()
returns table (users bigint, weekly_active bigint, decisions_7d bigint, open_requests bigint, pending_food bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query select
    (select count(*) from auth.users),
    (select count(distinct user_id) from public.feedback_events where at > now() - interval '7 days'),
    (select count(*) from public.feedback_events where kind = 'accepted' and at > now() - interval '7 days'),
    (select count(*) from public.feature_requests where status in ('submitted', 'reviewing')),
    (select count(*) from public.food_submissions where status = 'pending');
end $$;

-- ---------- Account deletion ----------
create function public.delete_my_account() returns void language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.admin_metrics() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.admin_metrics() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
