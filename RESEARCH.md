# Research: What Drives Use and Return, and What EatOS Does With It

Confidence tags: **[Certain]** = confirmed in a primary or peer-reviewed source · **[Likely]** = consistent secondary sources · **[Guessing]** = inference, needs our own data.

## 1. Evidence → feature map

| Finding | Strength | What EatOS does |
|---|---|---|
| **Choice overload is real only under specific conditions.** A meta-analysis of 50 experiments found an average effect of ~zero (Scheibehenne et al., 2010). A later meta-analysis (99 observations, 53 studies) found it *is* significant when tasks are hard, preferences are uncertain, and people want to minimise effort (Chernev et al., 2015). | [Certain] | Tired, hungry people deciding food match all three conditions. EatOS shows **1 pick + ≤2 alternatives**, with "Something else" for more. We log which slot people accept (`rank`) so our own data can tune this. |
| **Implementation intentions** ("when X, I will do Y") improve goal attainment, d = 0.65 across 94 tests (Gollwitzer & Sheeran, 2006). | [Certain] | **Plan my next meal**: decide ahead, then one tap ("Having it") at meal time. Missed plans vanish quietly. |
| **Motivational interviewing** (open questions, the person voices their own reasons, autonomy respected) has a small, durable effect: g = 0.28 vs weak controls across 119 studies (Lundahl et al., 2010). | [Certain] | Onboarding questions and the **weekly check-in** use MI style: open questions, affirmation, changes only with consent. |
| **NEPQ** (Neuro-Emotional Persuasion Questioning) | **No peer-reviewed evidence found.** Only founder/promotional claims. | We keep what overlaps with MI (problem awareness, self-discovery, commitment through choice) and drop persuasion/pressure tactics. |
| **Habits take time and vary a lot**: median 66 days, range 18–254, in a small study (n≈39) (Lally et al., 2010). "21 days" is a myth. | [Certain] (small study) | No streaks. Learning uses a 30-day half-life; success is measured over 14-60 days, not day 1. |
| **Push notifications** are actively studied with micro-randomized trials; too many or badly timed ones are irritating and reduce effectiveness. | [Likely] | Reminders are **opt-in**, user-chosen meals, max 3/day, friendly copy, never guilt. Candidate for our own A/B test. |
| **Retention benchmark**: Health & Fitness apps median ≈ 38% D1 / 18% D7 / 8% D30 (vendor data). | [Guessing] (vendor, definitions vary) | Our D7 bar stays at 40% for hand-recruited testers (friendlier than strangers). |
| **Early value drives return**: users who complete one meaningful action early retain better. | [Likely] | ~7 taps from install to first recommendation; nothing mandatory beyond a goal and budget. |

## 2. Competitors: what to take, what to leave

Sources are review aggregators and Reddit summaries; treat as directional. [Likely]

| App | Take | Leave |
|---|---|---|
| **MyFitnessPal** | Speed of repeat entry ("recent", "copy meal") → our **Have again** one-tap repeat | Paywalling core features (barcode), ads, unverified user-entered data, calorie-first framing |
| **Cronometer** | Verified data and trust; a generous free tier → our **curated, reviewed catalog** and free safety features | Micronutrient complexity, dense dashboards |
| **MacroFactor** | Adaptive algorithm that improves with use; judgment-free tone → our **on-device learning** and no-guilt copy | Paid-only, numbers-heavy |
| **Noom** | Psychology-informed framing → our **MI-style questions** | Coercive-feeling tactics, high price, hard-to-cancel subscriptions |
| **Meal planners (Eat This Much, Mealime)** | Deciding ahead → our **Plan my next meal** | Rigid full-week plans that break on day 2 |
| **All of them** | — | Shame mechanics, streak anxiety, subscription traps, mandatory logging |

**Why EatOS doesn't copy their feature lists:** their core loop is *logging after eating*. Ours is *deciding before eating*. Adding calorie logging would make us a worse MyFitnessPal instead of a better decision tool.

## 3. "Will it get smarter?" — measured, not claimed

`mobile/src/engine/__tests__/learning.test.ts` simulates 5 people with hidden tastes using EatOS for 60 days (2 meals/day). Metric: how often at least one of the 3 options shown is something they actually want.

| | Static app | Meal memory only | Full on-device learning |
|---|---|---|---|
| Average across 5 personas | 57% | 83% | **93%** |

This is a simulation with made-up tastes **[Guessing]** for real people. Our 20-tester study will measure it for real (`acceptanceRate`, `rank`, `wasNew` in the usage summary).

## Sources
- Scheibehenne, Greifeneder & Todd (2010), *J. Consumer Research* 37(3) — https://abcwest.cogs.indiana.edu/pmwiki/pdf/scheibehenne.options.2010.pdf
- Chernev, Böckenholt & Goodman (2015), *J. Consumer Psychology* — https://www.kellogg.northwestern.edu/faculty/research/detail/2015/when-product-assortment-leads-to-choice-overload-a-conceptual
- Gollwitzer & Sheeran (2006), *Adv. Experimental Social Psychology* — https://stafforini.com/works/gollwitzer-2006-implementation-intentions-and/
- Lundahl et al. (2010), *Research on Social Work Practice* 20(2) — https://media.wcwpds.wisc.edu/website-docs/wcwpds/resources/motivational-interviewing/Research-on-Social-Work-Practice.pdf
- Lally et al. (2010) summary — https://www.thebehavioralscientist.com/articles/how-long-to-form-a-habit ; https://www.surrey.ac.uk/news/does-it-really-take-66-days-form-habit-we-asked-expert-dr-pippa-lally
- Micro-randomized trials of notifications — https://mhealth.jmir.org/2018/11/e10123/ ; https://mhealth.jmir.org/2023/1/e38342/PDF ; https://arxiv.org/pdf/2107.03544
- Retention benchmarks (vendor) — https://unstar.app/de/blog/app-retention-benchmarks-2026 ; https://www.braze.com/resources/articles/mobile-app-retention
- Competitor reviews (aggregators) — https://unstar.app/blog/calorie-tracking-apps-ranked-1-star-reviews-2026 ; https://gummysearch.com/tools/best-products/calorie-counter/
- NEPQ search (promotional only) — https://youngandprofiting.podbean.com/e/jeremy-miner-the-neuroscience-of-selling-master-the-secrets-to-effortless-sales-e297
