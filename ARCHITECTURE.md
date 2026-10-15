# Architecture

## Now (validation prototype)
```
mobile/                      Expo SDK 57 · React Native 0.86 · TypeScript · Expo Router
  src/engine/                Pure TS recommendation engine (no React). Reusable on server/web later.
    types.ts                 Domain model
    catalog.ts               40 curated meal patterns with allergen + diet facts
    recommend.ts             Hard filters → scoring → explanations → cautions; shared safetyCheck()
    validate.ts              Field-by-field validation of anything read from storage
  src/security/links.ts      Deep-link allowlist (used by src/app/+native-intent.tsx)
  vendor/decode-uri-component  Patched link decoder (see DECISIONS D8)
  src/store/                 App state (pure reducer) + AsyncStorage persistence (on-device only)
  src/analytics/events.ts    Privacy-first local event log + validation metrics
  src/ui/                    Design tokens (light/dark), reusable components, labels
  src/app/                   Screens: onboarding, index (home), decide, settings
```
- **No backend, no accounts, no network calls.** All data stays on the device. Nothing to secure server-side yet, and no API keys exist.
- **Recommendation engine:** deterministic rules. Hard constraints (allergy, diet, location, time, budget+2, disliked) remove meals; soft scoring ranks the rest (goal, cuisine, hunger, mood, struggles, saved/loved/accepted history, recent-repeat and swap penalties). Every pick carries human-readable reasons. Runs in <5 ms on-device; costs $0 per decision.

## Next (when validation justifies it)
| Need | Choice | Why |
|---|---|---|
| Accounts + sync | Supabase (Postgres, Auth, Row-Level Security) | Proven, cheap, RLS enforces per-user data access in the database |
| Secrets / server logic | Supabase Edge Functions | Keeps any API keys out of the app |
| Subscriptions | RevenueCat over App Store / Play billing | Handles receipts, entitlements, both stores |
| Analytics | PostHog (opt-in), same event names as today | Free tier covers validation; no dietary data sent |
| Builds / OTA updates | EAS Build + EAS Update | No local Xcode needed |
| Public website | Astro (static) on Cloudflare Pages or Vercel | Fast, SEO-friendly, near-zero cost |

## Estimated running costs [estimates — verify current pricing before committing]
- Apple Developer: $99/yr. Google Play: $25 one-time.
- EAS: free tier is enough for a 20-user TestFlight / internal-testing round.
- Supabase, PostHog, RevenueCat, Cloudflare Pages: all have free tiers that cover < ~1,000 users.
- Realistic monthly cost through validation: **$0–$25**, plus the developer accounts.

## Security & privacy notes
- Allergies/diets/medical flags are sensitive. Today they never leave the device. When sync is added: RLS on every table, no dietary data in analytics, account deletion = hard delete.
- Stored data is validated on load (`parseStored`); corrupt or unknown-version data resets safely rather than crashing.
