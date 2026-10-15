# EatOS server (Supabase)

Schema: `migrations/0001_init.sql` (accounts, memory, requests) and `migrations/0002_library.sql` (public food and place library). Tests: `tests/run.sh` runs on any local PostgreSQL 16: 23 privacy checks plus 24 library checks (imports the fixture data with the real importers).

## What's protected
- Profiles, memories, history, household data: **owner-only** (row-level security). No admin bypass.
- Admins get **counts only** via `admin_metrics()`; moderation of requests and food submissions is **audit-logged** (append-only).
- New requests are forced to `submitted`; food submissions to `pending` + unverified. Only `owner`/`content` admins can change them.
- `delete_my_account()` removes the user and everything they own.
- Library (`foods`, `places`, `data_sources`): readable by signed-in users, **writable only by the import pipeline** (service role). Users can't alter allergen data or remove attribution. `favorite_places` (incl. "my grocery store") is owner-only.

## Founder setup (≈15 minutes)
1. Create a project at supabase.com (free tier is enough for testing).
2. SQL editor → paste and run `migrations/0001_init.sql`, then `migrations/0002_library.sql`.
3. Sign up in the app (once sync is wired), then make yourself owner:
   `insert into admins (user_id, role) values ('<your auth user id>', 'owner');`
4. Give the app **only** the project URL and the *anon* key (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). **Never** put the service-role key in the app.
5. Fill the library: see `tools/library/README.md`.
6. For this cloud session to reach your project, allow `*.supabase.co` in the environment's network settings.

## Not yet built (needs the project to exist)
App sign-in and sync, the request/voting screens, the admin dashboard, and server-side AI with per-user spending caps.
