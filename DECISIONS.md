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
