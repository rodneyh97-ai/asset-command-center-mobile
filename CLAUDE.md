# EatOS — notes for Claude sessions

Read this first; it exists so new sessions don't spend tokens rediscovering the project.
Founder: non-developer, on Windows. Explain in plain steps; ask before destructive changes,
new paid services, production deploys or major migrations. Never ask for tokens/passwords in chat.

## Where things are
- Branches: work on `claude/eatos-redesign-wip`, fast-forward `claude/eatos-mvp` when verified.
- `mobile/` Expo SDK 57 app (expo-router, TypeScript). Also read `mobile/AGENTS.md`.
  - `src/engine/` pure TS: recommend (safety filters first), learn, memory, household, catalog (58 meals), ingredients.
  - `src/store/state.ts` all app state + reducer + `parseStored` (validates every field). `AppProvider.tsx` persistence.
  - `src/app/` screens; `(tabs)/` home, history, favorites, search (Explore: ideas/foods/near me), profile.
  - `src/library/` public food & place library client, allergy status (only ever warns), personal ranking.
  - `src/security/links.ts` deep-link allowlist — add new routes there.
- `supabase/migrations/0001–0006` (applied to live project `fkhtvstwcgpvvicgikoj`), `supabase/tests/run.sh`.
- `tools/library/` importers (USDA, Open Food Facts, OSM) + `load-api.mjs` (loads via Management API).
- Docs: `DECISIONS.md` (D1–D22, read before changing behaviour), `docs/NEXT_SESSION.md` (current handoff),
  ROADMAP, ARCHITECTURE, TEST_PLAN, PRIVACY_POLICY (draft).

## Commands (run from `mobile/`)
- `npx jest` (~15 s, ~270 tests) · `npx tsc --noEmit` · `npm run lint` (= expo lint; raw eslint flags vendor/ — ignore)
- Deep suites: `DEEP=1 npx jest src/__tests__/deep` (1,000 journeys ≈ 20 min; use `JOURNEYS=200` for a check)
- DB: `bash supabase/tests/run.sh` (local Postgres 16; RLS + library + retention suites)
- Importers: `node --test tools/library/importers.test.mjs`

## Gotchas in the cloud environment
- Install Expo packages with `EXPO_OFFLINE=1 npx expo install <pkg>` (Expo API is blocked). Docs at docs.expo.dev are blocked: read types in node_modules.
- Node `fetch` needs `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`.
- `$SUPABASE_ACCESS_TOKEN` may be wrapped in `< >`: strip with `T=${SUPABASE_ACCESS_TOKEN#<}; T=${T%>}`. Scoped to EatOS only; expires ~2026-10-23.
- Live SQL: POST `https://api.supabase.com/v1/projects/fkhtvstwcgpvvicgikoj/database/query` (migrations: `/database/migrations` with a name). Granting roles/admins needs the founder's approval.
- Overpass: `overpass-api.de` resets connections here; use `overpass.kumi.systems`.
- Tests: expo-router test renderer uses fake timers — use `jest.advanceTimersByTime`; time travel via `clock.set()` (src/clock.ts), never Date mocks. "Done" on the decide screen ignores taps within 700 ms.
- Don't `pkill -f` with a pattern matching your own command.

## Rules that must not regress
- Allergies are hard constraints everywhere (`safetyCheck`); missing allergen data is "unknown — check the label", never safe.
- Never invent restaurant menus, prices, hours or nutrition. Library data keeps its source + attribution.
- No guilt mechanics (no streaks, no "missed"); reminders opt-in; anything leaving the phone is opt-in.
- Personal data stays on-device until the founder approves sync. Admins see aggregates only.
