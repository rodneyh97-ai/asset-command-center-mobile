# Test Plan

Run: `cd mobile && npm test && npm run typecheck && npm run lint`

## Automated (108 tests, all passing as of 2026-10-15)
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
| **Adversarial (UI)** | `src/__tests__/flow.test.tsx` | deep links to /decide & /settings with no profile; /onboarding can't overwrite profile; double-tap records one decision and doesn't dismiss confirmation; storage read failure never overwrites data; garbage storage backed up and app still opens; crash screen; restore hidden meals |

## Manually verified
- Malicious percent-encoded link (`%C3`×3200) against the built web app loads in ~0.3 s with no errors (before fix: 800 repeats froze parsing for 15.6 s).
- Shipped web bundle no longer contains the vulnerable decoder pattern.
- Web build renders at 390×844 (phone size) with no console errors and no horizontal overflow; screenshots reviewed for onboarding, home, recommendation, accepted, returning home.

## NOT verified yet
- Running on a physical iPhone / Android device or simulator
- VoiceOver / TalkBack behaviour (labels and roles are set, but untested with a real screen reader)
- Dark mode visuals
- Large text / dynamic type layouts
- Native deep-link handling (`+native-intent.tsx`) on a real device. Unit-tested only.
- Accuracy of allergen tags in `catalog.ts` beyond automated keyword checks. **Needs human review.**
- Authentication, database permissions, subscriptions, SEO: not built yet (by design, see ROADMAP)
