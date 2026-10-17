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

**D11 — Personalization is on-device statistics, not AI.** Trait affinities with a 30-day half-life, shrinkage, habit detection, and one exploration slot. Free per decision, explainable ("You often go for Mexican food"), private. Simulation: 57% → 93% hit rate vs. a static app. AI can be A/B tested later against this baseline. 2026-10-15.

**D12 — Sentry crash reports default ON when a DSN is configured (NEEDS FOUNDER SIGN-OFF).** Reports are scrubbed (no user, breadcrumbs, extras, device name) and users can switch them off. Alternative: default OFF (fewer crash reports during the 20-user test). 2026-10-15.

**D13 — Planning and reminders over streaks.** Plans (implementation intentions, d = 0.65) and opt-in reminders support follow-through without guilt. No streaks, no "you missed" messages. 2026-10-15.

**D14 — NEPQ replaced by motivational interviewing.** NEPQ has no peer-reviewed evidence; MI does (g = 0.28). Questions stay short, open, and autonomy-respecting. 2026-10-15.

**D15 — Redesign follows the mockup, with four deliberate deviations (NEEDS FOUNDER SIGN-OFF).** 2026-10-15.
- No calorie numbers or "Great for Fat Loss": we have no verified nutrition data; tags are derived from facts we hold (High Protein, High Fiber, Quick, Budget-friendly, Vegetarian/Vegan, Comfort).
- No named nearby restaurants (Chipotle, Panera…), distances, or "Best: …" items: no licensed menu/location data. Search shows dish patterns most places offer, filtered for the user's safety, with an honest note.
- "Active days" instead of "Day streak": no streak pressure.
- EatOS+ is a waitlist: price shown as "planned", no payment possible (`DRAFT_PRICING` in `premium.tsx`).
- Also: food photos are illustrated tiles until licensed photography exists; onboarding keeps the "what gets in the way" and "anything else" (medical / no-diet-talk) questions → 6 steps.

**D16 — Optional App Lock (Face ID / fingerprint / passcode).** Off by default; must authenticate to enable; cold start locked; relocks after 5 min away; uses the OS check only (no biometric data reaches EatOS). Not available on web. 2026-10-15.

**D17 — Couples mode on one phone.** 2026-10-15. Add people you eat with (nickname + allergies, diet, tastes only). "Who's eating?" on Home combines profiles: allergies/diets are a union (safe for everyone), tastes favor overlap. "Decide together": each person marks the 3 options they'd eat (pass the phone); first shared pick wins, else new options or "just pick for us". Cross-phone sync and remote voting need the server (pending approval).

**D18 — Memory model and server schema.** 2026-10-15. Memories carry subject, topic, value, kind (stated / confirmed / temporary), source and timestamps; guesses are never stored until the user confirms them; rejected guesses are never re-learned. Only questions whose answers change recommendations are asked (no grocery-budget question until grocery planning exists). Server schema uses row-level security with no admin access to private data; admins get aggregates and an audit-logged moderation queue. Nutrition (macros/micros) waits for USDA FoodData Central access — no estimated numbers in the meantime.


**D19 — Food and place library from public data only.** 2026-10-15. Sources: USDA FoodData Central (public domain: generic foods with lab nutrients, plus branded labels), Open Food Facts (ODbL: US grocery products, label allergens and "may contain" traces), OpenStreetMap (ODbL: restaurants, cafes, fast food, grocery and convenience stores). Rules: every row keeps its source; attribution from `data_sources` is shown in the app; only USDA generic foods count as verified; an empty allergen list is *unknown*, never "free of"; "may contain" is stored separately and treated like the app's existing may-contain tier. **Public data has no restaurant menus, dish prices or hours we can trust** — restaurants appear as places ("Joe's Tacos, Mexican, 0.4 mi"), and EatOS keeps suggesting dish patterns rather than claiming a specific menu item exists. ODbL means any database we publish that is derived from OFF/OSM must stay under ODbL; using it inside the app is fine with attribution.

**D20 — Retention pack, no dark patterns.** 2026-10-15.
- **Two-question start.** Onboarding asks only allergies/diet and the medical / "no diet talk" question, then goes straight to Home. Goal, foods, budget and "what gets in the way" are offered after the first meal (one card, "Later" hides it for 2 days). Safety questions stay first; the shortcut link can't skip them.
- **Anonymous retention signal (opt-in, default off).** Asked once after the first meal, only when a server is configured. Sends `(random id, day N, platform, version)`; opt-out deletes server rows and the id. Admins see day-1/7/30 percentages only (`retention_metrics()`). Anyone holding the public key could insert fake pings; acceptable for a 20-person test, revisit before public launch.
- **Reminders pause themselves.** Scheduled 10 days ahead and renewed on each open; someone who stops using EatOS gets one "reminders paused" note, then nothing.
- **Welcome back** after 10+ days away: "No catching up needed", one tap to a pick.
- **Forgiving weekly goal** (optional) instead of streaks: nothing resets, past weeks only count when reached.
- **Visible learning:** "EatOS has learned N things about you" → What EatOS knows (editable, deletable).
- **Store rating prompt:** only after 3+ meals, at least one "Loved it", 3+ days in; ≥120 days apart, max 3.
- **Not done:** home-screen quick action / widget (the only quick-action package is unofficial and untested on this Expo version; a widget needs native code that can't be built here). iPhone users can make a Siri shortcut to `eatos://decide` (instructions in Profile). Partner invite across phones needs the server.

**D21 — April schema archived, not deleted.** 2026-10-17. Founder chose "archive, then install". The April EatOS tables, views and functions moved to `legacy_april` (no API access); its auth sign-up trigger was dropped so new sign-ups don't create April-style profiles. The `rls_auto_enable` event trigger was kept in `public` (it turns on row-level security for every new table). Grocery products load only when they carry nutrition, label allergens or "may contain" data (175k of 855k US products); the rest are just a name and barcode.

**D22 — Grow one place at a time.** 2026-10-17. Founder: "start in one spot then expand." Places (restaurants, cafés, grocery stores) cover central Kansas City (MO + KS) first, widened to wherever the 20 testers actually live. The next city is added only when day-30 retention beats 10% (category average 3–8%). The food search (USDA + grocery products) is national from day one: no location involved, no extra cost. Library is readable without an account (public data only); `mobile/.env.development` holds the public server URL and publishable key, never a secret.
