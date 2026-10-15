# Roadmap

## Phase 1: Audit & architecture ✅
Repo contained only a README. No code to preserve. Expo + local-first chosen (DECISIONS D1–D2).

## Phase 2: Functional MVP ✅ (this branch)
Onboarding, saved preferences, daily decision, rules engine, feedback, one-tap repeat, after-meal rating, weekly line, delete data, 74 automated tests.

**Remaining before testers:**
- [ ] Run on a real iPhone and Android device (Expo Go), with VoiceOver/TalkBack pass
- [ ] App icon, splash, bundle identifiers (needs founder decisions)
- [ ] Expand catalog to ~80 patterns, especially breakfast, vegetarian takeout, and allergy-friendly options
- [ ] Optional daily reminder (user-chosen time, off by default) via expo-notifications
- [ ] Founder review of every catalog entry (allergen tags especially)

## Phase 3: Validation (20 users × 14 days)
- Distribute via TestFlight + Play internal testing (requires developer accounts)
- Collect: in-app "Share my usage summary" (counts only) + 2 short interviews per user (day 3, day 14)
- Decide go / fix / pivot on: Day-7 return ≥ 40%, ≥ 1 decision per active day, "Not again" < 20%

## Phase 4: Personalization
Learned cuisine/meal-pattern weights from loved/disliked; time-of-day habits; household mode. AI only where it beats the rules on acceptance rate in an A/B test.

## Phase 5: Real-world integration
Licensed restaurant/menu data; location. Only with verified allergen data sources.

## Phase 6: Growth & monetization
Accounts + sync, RevenueCat subscriptions (no real charges until pricing approved), referral, public SEO site.
