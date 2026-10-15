# Test Plan

Run: `cd mobile && npm test && npm run typecheck && npm run lint`

## Automated (171 tests in the regular suite, plus the deep suite below)
| Area | File | What's covered |
|---|---|---|
| Allergy filtering | `src/engine/__tests__/recommend.test.ts` | Each of 9 allergens × every setting/meal time/time/budget combination never yields a `contains` match; outside home never yields `mayContain`; at-home label caution; staff-confirm caution; multi-allergy; swaps never add allergens |
| Diet rules | same | vegan/vegetarian/pescatarian/no-red-meat never violated; no meat swaps for vegetarians |
| Recommendation selection | same | setting, time, budget limits; tired → low effort; goal fit; meal time; ≤2 alternatives; every pick has reasons; honest empty state |
| Feedback & personalization | same | disliked never returns; saved ranks up; no repeat within 20h; swap excludes seen |
| Sensitive experiences | same | gentle mode has no weight language; medical note |
| Catalog integrity | same | unique ids, no $ or calorie figures, obvious allergen words tagged |
| Saved prefs / goal changes / deletion | `src/store/__tests__/state.test.ts` | goal stable unless explicitly changed; corrupt storage resets safely; delete wipes all |
| Retention helpers | same | recent meals, rating prompt timing, weekly reflection |
| Analytics | `src/analytics/__tests__/events.test.ts` | D1/D7 return, acceptance, time-to-decision; shared summary has no dietary data |
| Onboarding, navigation, persistence, error states | `src/__tests__/flow.test.tsx` | full onboarding → decide → accept; returning user skips onboarding; can't continue without goal; allergy enforced on screen; swap; one-tap repeat; delete → onboarding |

| **Adversarial** | `src/__tests__/attacks.test.ts` | 20,000-case seeded fuzz of allergy/diet/alternatives invariants; "Have again" allergy & diet bypass; ingredient-text vs allergen-tag audit; hostile/corrupt storage payloads (bad enums, prototype pollution, junk history); newer-version data preserved; hostile deep links (path traversal, `javascript:`, oversized, unknown routes) |
| **Coverage** | `src/engine/__tests__/coverage.test.ts` | 12 user types (no restriction, vegetarian, vegan, each major allergy, combos) × 320 situations: every one gets ≥1 option that fits the meal time. `COVERAGE_REPORT=1` prints the table |
| **Learning** | `src/engine/__tests__/learning.test.ts` | 60-day simulation of 5 hidden-taste personas: full learning ≥ static app per persona, improves over time, beats static by ≥15 pts and memory-only by ≥5 pts on average; single events don't overreact; old behaviour fades; learning never overrides allergies; taste capped; exploration slot; habits |
| **Planning** | `state.test.ts`, `flow.test.tsx` | next-meal slot at every time of day; due/upcoming/expired; plan → one-tap "Having it" at meal time (time travel); missed plan disappears quietly; plan re-checked after new allergy |
| **Reminders** | `src/notifications/__tests__/reminders.test.ts` | one per chosen meal, replace not duplicate, off cancels all, no guilt copy, permission asked only when needed |
| **Weekly check-in** | `state.test.ts`, `flow.test.tsx` | timing (≥1 week, ≥3 decisions, snooze); two questions; focus changes only with consent |
| **Sentry** | `src/analytics/__tests__/sentry.test.ts` | off without DSN; privacy-safe options; off switch; scrubs user/request/extras/breadcrumbs/device name |
| **Crash capture** | `src/analytics/__tests__/crash.test.ts` | records, caps, truncates; survives corrupt log; global handler chains |
| **Adversarial (UI)** | `src/__tests__/flow.test.tsx` | deep links to /decide & /settings with no profile; /onboarding can't overwrite profile; double-tap records one decision and doesn't dismiss confirmation; storage read failure never overwrites data; garbage storage backed up and app still opens; crash screen; restore hidden meals |

## Deep suite (`DEEP=1 npx jest src/__tests__/deep`, ~1 min + journeys)
- **Exhaustive safety:** all 512 allergen combinations × 6 diet settings × 5 places × 4 meal times × 3 time buckets × 4 budgets = **737,280 recommendations**: none unsafe, none diet-breaking, all explained, ≤2 alternatives.
- **safetyCheck** cross-checked for every meal × allergen combination × setting.
- **100,000 random hostile deep links**: every one resolves to a known screen.
- **10,000 corrupted saved-data blobs**: no crash; surviving allergy lists contain only real allergens.
- **1,000 random user journeys** through the real screens (30 random taps each), checking after every tap for crash screens and that any meal on a recommendation screen is safe for the user's current allergies/diet.

## Browser accessibility audit (Playwright + axe-core)
All 19 screens × 3 widths (320, 390, 768) × light/dark = 114 audits: WCAG 2.1 AA, horizontal overflow, touch targets ≥ 44px, page/console errors. Result: 0 findings (after fixing toggle/radio semantics, tab-label contrast, splash overflow).

## Browser monkey
30 sessions × 300 random taps (incl. hostile search text, random back/tab jumps) on the built web app, checking for crashes, blank screens, overflow, errors.

## Browser sweep (automated, Playwright + axe-core, run 3× consecutively)
4 sizes (320, 390, 430, 768 px) × light/dark. Each run: full onboarding with allergies + diet + gentle mode, all 5 locations, "Something else" until exhausted, save, double-tap accept, reload persistence, Preferences, keyboard-only navigation. Checks: page errors, console errors, horizontal overflow, WCAG 2.1 AA (axe), touch targets ≥ 44px, empty results, weight language in gentle mode. Also covers: Plan-my-next-meal screens. Result: 0 findings (final run on the finished build).

## Native builds
`expo export` for iOS and Android compiles to Hermes bytecode without errors. `expo-doctor`: 19/21 pass; the 2 failures need Expo's servers, which this sandbox's network blocks.

## Manually verified
- Malicious percent-encoded link (`%C3`×3200) against the built web app loads in ~0.3 s with no errors (before fix: 800 repeats froze parsing for 15.6 s).
- Shipped web bundle no longer contains the vulnerable decoder pattern.
- Web build renders at 390×844 (phone size) with no console errors and no horizontal overflow; screenshots reviewed for onboarding, home, recommendation, accepted, returning home.

## NOT verified yet (see DEVICE_TEST_CHECKLIST.md)
- Running on a physical iPhone / Android device or simulator
- VoiceOver / TalkBack behaviour (labels and roles are set, but untested with a real screen reader)
- Dark mode visuals
- Large text / dynamic type layouts
- Native deep-link handling (`+native-intent.tsx`) on a real device. Unit-tested only.
- Accuracy of allergen tags in `catalog.ts` beyond automated keyword checks. **Needs human review.**
- Authentication, database permissions, subscriptions, SEO: not built yet (by design, see ROADMAP)
