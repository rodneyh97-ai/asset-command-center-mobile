# EatOS server (Supabase)

Schema: `migrations/0001_init.sql` (accounts, memory, requests) `migrations/0002_library.sql` (public food and place library) `migrations/0003_retention.sql` (opt-in anonymous retention signal) and `migrations/0004_hardening.sql` (fixes from Supabase's security advisor). Tests: `tests/run.sh` runs on any local PostgreSQL 16: 23 privacy checks, 24 library checks (imports the fixture data with the real importers) and 12 retention checks.

## What's protected
- Profiles, memories, history, household data: **owner-only** (row-level security). No admin bypass.
- Admins get **counts only** via `admin_metrics()`; moderation of requests and food submissions is **audit-logged** (append-only).
- New requests are forced to `submitted`; food submissions to `pending` + unverified. Only `owner`/`content` admins can change them.
- `delete_my_account()` removes the user and everything they own.
- Retention pings: insert-only from the app; nobody can read them back; admins get only D1/D7/D30 percentages via `retention_metrics()`; `forget_install(id)` deletes an install's pings on opt-out.
- Library (`foods`, `places`, `data_sources`): readable by signed-in users, **writable only by the import pipeline** (service role). Users can't alter allergen data or remove attribution. `favorite_places` (incl. "my grocery store") is owner-only.

## Founder setup (≈15 minutes)
1. Create a project at supabase.com (free tier is enough for testing).
2. SQL editor → paste and run `migrations/0001_init.sql`, then `migrations/0002_library.sql`, then `migrations/0003_retention.sql`, then `migrations/0004_hardening.sql`.
3. Sign up in the app (once sync is wired), then make yourself owner:
   `insert into admins (user_id, role) values ('<your auth user id>', 'owner');`
4. Give the app **only** the project URL and the *anon* key (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). **Never** put the service-role key in the app.
5. Fill the library: see `tools/library/README.md`.
6. For this cloud session to reach your project, allow `*.supabase.co` in the environment's network settings.

## Not yet built (needs the project to exist)
App sign-in and sync, the request/voting screens, the admin dashboard, and server-side AI with per-user spending caps.

## Live project (applied 2026-10-17)
Project `fkhtvstwcgpvvicgikoj` (EatOS, us-west-2, free plan). Migrations 0001–0004 applied through the Management API.
The April 2026 EatOS schema that was already there (profiles, preferences, favorites, food/weight/meal logs, Stripe
subscriptions, revenue views; 1 user, 1 profile, otherwise empty) was **moved, not deleted**, into schema `legacy_april`
with no API access. Its sign-up trigger was dropped; `legacy_april._restore` has the statements to put it back.
Data: load with `tools/library/load-api.mjs` (HTTPS only).
