# Decisions

**D1 — Expo / React Native, TypeScript.** One codebase for iOS, Android, and web preview; EAS builds without a Mac. Alternatives: Flutter (no JS/TS ecosystem reuse with the website), native ×2 (2× cost). 2026-10-15.

**D2 — Local-first, no backend for validation.** 20 testers don't need accounts. Skipping auth/DB removes most of the security surface and cost, and gets testers in faster. Trade-off: data doesn't sync across devices; we collect metrics via a user-initiated "share summary" instead of automatic analytics. Revisit at Phase 3 exit. 2026-10-15.

**D3 — Rules engine over curated meal *patterns*.** Explainable, testable, free per request. Patterns ("chicken burrito bowl at most Mexican spots") instead of named restaurants/items because we have no licensed menu data and must not invent any. Cost shown as $–$$$$ tier, never dollars. No calorie numbers. 2026-10-15.

**D4 — Allergy policy.**
- Allergen in the standard version (`contains`) → never shown, anywhere.
- Allergen in some versions (`mayContain`) → never shown when eating out; at home, shown with "check labels".
- Whenever an allergic user is eating out, every pick says to confirm with staff and that EatOS can't verify restaurant ingredients.
- Suggested swaps are filtered so they never add a user's allergen or break their diet.
- Saved/recent "Have again" meals are re-checked against current allergies.
2026-10-15.

**D5 — Privacy-first analytics.** Event names + non-sensitive numbers only, stored on device. No allergies, diets, goals, or free text in analytics, ever. 2026-10-15.

**D6 — Code lives in `mobile/` of this repo on branch `claude/eatos-mvp`.** The only repo available was `asset-command-center-mobile` (empty, **public**). **Open question for founder:** rename this repo to `eatos` (and make it private?) or create a new one. 2026-10-15.

**D7 — Sensitive-experience safeguards.** "No weight or diet talk" mode rewrites goal reasons; "medical condition" adds a not-medical-advice note to every pick. EatOS is not presented as treatment. 2026-10-15.

**D8 — Security hardening after adversarial review.** 2026-10-15.
- Vulnerable link decoder (`decode-uri-component`, GHSA-vcc3-ghjq-m6fr) ships in the app via Expo Router. A 2.4 KB malicious link froze the app for ~16 s. The upstream fix is ESM-only and breaks Expo Router, so `mobile/vendor/decode-uri-component` is a linear-time drop-in, forced via npm `overrides`. **Remove it once Expo Router upgrades query-string.**
- Incoming links are allowlisted to 4 screens (`src/security/links.ts`); all parameters are dropped.
- All stored data is validated field-by-field (`src/engine/validate.ts`). Unknown allergens/diets are dropped; unreadable data is backed up, never silently erased; a read failure never triggers a write.
- One shared `safetyCheck` gates every path that shows a meal (recommendations and "Have again").
- Crash screen with "Try again" / "Start fresh (keeps a backup)".
- Remaining `npm audit` findings (braces, node-forge, sprintf-js, uuid) are in build tooling only and are not in the shipped app bundle (verified by inspecting the bundle).

**D9 — Three-tier allergen model (NEEDS FOUNDER SIGN-OFF).** 2026-10-15.
Previously every "maybe" allergen was excluded when eating out, which left users with a gluten allergy no option that fit the meal time in 43% of situations (vegan + gluten-free: 60%). Now:
- `mayContain`: hidden in recipes/sauces → still **never** shown when eating out.
- `removable`: a visible optional topping (cheese on a bowl) → shown with "Order it without dairy: skip the cheese and sour cream."
- `crossContact`: not in the dish, but shared kitchen → shown when eating out with "Usually made without gluten, but shared kitchens can't rule out cross-contact," plus the standing "tell staff… EatOS can't verify" note.
Result: 0% "no fitting option" across 12 user types × 320 situations (enforced by `coverage.test.ts`).
Risk: someone with a severe allergy may still choose a cross-contact meal. Every such meal carries both warnings. Alternative if rejected: add a "severe allergy" toggle that restores the strict behaviour for that user.

**D10 — On-device crash capture instead of a crash service (for now).** Errors are recorded locally (capped, truncated) and included in the user-shared summary. Sentry is the upgrade path once you approve a new service. 2026-10-15.

