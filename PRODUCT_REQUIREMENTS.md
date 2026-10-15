# Product Requirements: EatOS MVP

## Problem
People don't fail at eating well because they lack information. They fail because deciding is tiring,
happens many times a day, and usually happens while busy, tired, or out.

## Promise
A useful answer to "what should I eat right now?" in under 15 seconds, with no logging.

## Smallest complete daily loop (built)
1. **Onboarding (6 tap-only steps):** goal → what makes it hard → foods enjoyed → allergies & diet → budget → other considerations.
2. **Home:** "Where are you eating?" + one big **Help me decide** button. Hunger, time, budget, and mood default to last-used values (collapsed; tap to change).
3. **Recommendation:** one primary pick, ≤2 alternatives, "why this fits", how to make or order it, swaps, typical cost tier, safety notes.
4. **Actions:** I'll have this · Something else · Save · Not for me.
5. **Return loop:** next open asks "How was it?" (Loved it / Fine / Not again) with one tap. "Have again" gives one-tap repeats of saved and recent meals. A one-line weekly reflection, no streaks.
6. **Preferences:** edit everything; changing the main goal requires an explicit confirmation. Delete all data.

## Hard rules
- Allergies and diets are **constraints, not preferences**. See `DECISIONS.md` D4.
- Never invent restaurant availability, menu items, prices, or nutrition figures. Meals are generic patterns; cost is a relative tier.
- No calorie numbers. Optional "no weight or diet talk" mode. "Medical condition" adds a not-medical-advice note.
- Allergy safety is never paywalled.

## Validation goal (Phase 3)
20 real users × 14 days. Primary signals: Day-1/7 return, decisions per active day, acceptance rate, median time-to-decision, "Not again" rate, and qualitative reasons people stop.

## Non-goals for MVP
Calorie/macro tracking, barcode/photo logging, restaurant-specific menus, social features, AI chat.

## Known product risks (KillCritic)
- **Generic suggestions feel like a listicle.** The catalog has 40 meal patterns; repeat users will hit its edges in about 2 weeks. Biggest risk to retention.
- **Eating out is the hardest moment** and the one where we can say the least without licensed menu data.
- **Free alternatives exist** (ChatGPT, "what's for dinner" lists). The edge must be speed, memory of the user, and trust, not content.
