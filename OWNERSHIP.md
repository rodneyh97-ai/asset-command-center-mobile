# Ownership Map

Goal: own the parts that make EatOS valuable, rent only what's unavoidable, and keep an exit for everything.

## What you own outright (in this repo)
- **Recommendation engine, learning, safety rules, meal catalog** (`mobile/src/engine/`). This is the product. No AI vendor, no API fees.
- **All user data.** Stored on the user's phone; no EatOS server exists yet.
- **Analytics** (`mobile/src/analytics/events.ts`). On-device, our own event names.
- **Crash capture** (`mobile/src/analytics/crash.ts`). On-device fallback that needs no vendor.
- **The patched link decoder** (`mobile/vendor/`).

## What you rely on, and your exit
| Piece | Owner / license | Lock-in | Exit path |
|---|---|---|---|
| React Native, Expo SDK, Expo Router | Meta / Expo, open source (MIT) | Low | Code is yours; frameworks are free and forkable |
| EAS Build (cloud builds) | Expo, proprietary service | Low | Build locally: `npx expo run:ios` / `run:android`, or `eas build --local` [Likely] |
| Sentry SDK | Sentry, open source SDK | Low | Point `EXPO_PUBLIC_SENTRY_DSN` at **self-hosted GlitchTip or self-hosted Sentry**; no code change [Likely] |
| AsyncStorage | Open source | None | — |
| expo-notifications (local only) | Expo, open source | None | No push server used |
| **Apple App Store / Google Play** | Apple / Google | **Unavoidable** for native apps | Web app (already builds) as a backup channel |

## Future choices, picked for ownership
| Need | Recommended | Why it preserves control |
|---|---|---|
| Accounts + sync | **Supabase** | Open-source Postgres stack; start hosted, self-host later [Likely] |
| Product analytics | **PostHog** (opt-in) | Open source, self-hostable [Likely] |
| Subscriptions | **Direct App Store / Play Billing** via an open-source library, *or* RevenueCat for speed | Direct = full control but more work; RevenueCat = proprietary, 1% of revenue above a threshold [Guessing on current pricing] |
| Website | Static site (Astro) on any host | Plain files; move hosts in minutes |

## The honest trade-off
Self-hosting everything from day one costs time and server bills you don't need yet. Recommendation: **use hosted versions of open-source tools now** (exit is a config change), self-host when revenue or privacy demands justify it.
