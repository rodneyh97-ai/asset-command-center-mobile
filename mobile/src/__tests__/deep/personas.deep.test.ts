// 1,000 simulated people, each using EatOS for 14 days with their own needs.
// Measures what a real user would feel: variety, dead ends, repeats, safety, and how
// different the place cards are. Run: DEEP=1 npx jest src/__tests__/deep/personas
// Optional real places: PLACES_TSV=/path/to/places.tsv (tools/library/osm.mjs output).
import fs from 'node:fs';

import { ALL_ALLERGENS, CATALOG } from '../../engine/catalog';
import { combineProfiles, type Member } from '../../engine/household';
import { INGREDIENTS, ingredientsOf, type Ingredient } from '../../engine/ingredients';
import { newMemory, type Memory } from '../../engine/memory';
import { recommend, violatesDiet } from '../../engine/recommend';
import type { Allergen, Context, Cuisine, Diet, FeedbackEvent, Goal, MealTime, Profile, Recommendation, Setting, Struggle } from '../../engine/types';
import type { Place } from '../../library/client';
import { ideasForRow } from '../../library/placeIdeas';

const run = process.env.DEEP ? describe : describe.skip;
const START = new Date('2026-10-01T07:00:00');
const OUT = new Set<Setting>(['takeout', 'restaurant', 'on_the_go']);
const CUISINES: Cuisine[] = ['american', 'mexican', 'italian', 'asian', 'chinese', 'japanese', 'thai', 'korean', 'vietnamese', 'mediterranean', 'middle_eastern', 'indian', 'breakfast', 'simple'];

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

type Persona = { profile: Profile; dislikes: Ingredient[]; partner: Member | null; loves: Cuisine[]; settings: Setting[] };

function makePersona(r: () => number, i: number): Persona {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const some = <T>(xs: readonly T[], max: number) => [...new Set(Array.from({ length: Math.floor(r() * (max + 1)) }, () => pick(xs)))];
  // Roughly realistic: most people have no allergy; some have one; a few have several.
  const nAllergy = r() < 0.7 ? 0 : r() < 0.75 ? 1 : r() < 0.8 ? 2 : 3;
  const allergens = some(ALL_ALLERGENS, 9).slice(0, nAllergy) as Allergen[];
  const dietRoll = r();
  const diets: Diet[] = dietRoll < 0.08 ? ['vegetarian'] : dietRoll < 0.11 ? ['vegan'] : dietRoll < 0.14 ? ['pescatarian'] : dietRoll < 0.17 ? ['no_pork'] : dietRoll < 0.19 ? ['no_red_meat'] : [];
  const goals: Goal[] = ['eat_better', 'lose_weight', 'maintain', 'build_muscle', 'more_energy'];
  const struggles: Struggle[] = ['no_time', 'decision_fatigue', 'cravings', 'budget', 'cooking', 'eating_out'];
  const loves = some(CUISINES, 4);
  const profile: Profile = {
    goal: pick(goals),
    struggles: some(struggles, 3),
    cuisines: r() < 0.6 ? loves : [],
    allergens,
    diets,
    budget: pick([1, 2, 2, 3, 4] as const),
    considerations: r() < 0.05 ? ['ed_sensitive'] : r() < 0.08 ? ['medical'] : [],
    createdAt: START.toISOString(),
  };
  const partner: Member | null =
    r() < 0.25
      ? { id: `m-${i}`, name: 'Partner', allergens: r() < 0.3 ? (some(ALL_ALLERGENS, 1) as Allergen[]) : [], diets: r() < 0.1 ? ['vegetarian'] : [], cuisines: some(CUISINES, 3) } as Member
      : null;
  const lifestyle = pick([
    ['home', 'home', 'work', 'takeout'],
    ['takeout', 'restaurant', 'on_the_go', 'home'],
    ['work', 'on_the_go', 'takeout'],
    ['home', 'home', 'home', 'restaurant'],
    ['restaurant', 'takeout', 'restaurant', 'home'],
  ] as Setting[][]);
  return { profile, dislikes: some(INGREDIENTS, 4) as Ingredient[], partner, loves, settings: lifestyle };
}

// A few real-looking Kansas City places of each common type (or the real export via PLACES_TSV).
function samplePlaces(): Place[] {
  const file = process.env.PLACES_TSV;
  if (file && fs.existsSync(file)) {
    return fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line, i) => {
        const f = line.split('\t');
        const cuisines = f[5] === '{}' ? [] : f[5].replace(/[{}"]/g, '').split(',').filter(Boolean);
        return { id: i + 1, kind: f[2] as Place['kind'], name: f[3], cuisines, lat: Number(f[6]), lon: Number(f[7]), street: null };
      })
      .filter((p) => p.kind === 'restaurant' || p.kind === 'fast_food' || p.kind === 'cafe');
  }
  const tags = ['burger', 'burger', 'sandwich', 'mexican', 'pizza', 'american', 'chicken', 'chinese', 'barbecue', 'breakfast', 'italian', 'sushi', 'thai', 'indian', 'mediterranean', 'wings', 'seafood', 'steak_house', 'coffee_shop', ''];
  return tags.flatMap((t, i) =>
    [0, 1, 2].map((k) => ({ id: i * 10 + k + 1, kind: (t === 'coffee_shop' ? 'cafe' : t === 'burger' || t === 'chicken' ? 'fast_food' : 'restaurant') as Place['kind'], name: `${t || 'untagged'} ${k}`, cuisines: t ? [t] : [], lat: 39.1, lon: -94.58, street: null })),
  );
}

run('1,000 people × 14 days', () => {
  it('stays safe, varied, and useful for every kind of person', () => {
    const r = rng(20261017);
    const places = samplePlaces();
    const stats = {
      decisions: 0,
      empty: 0,
      unsafe: 0,
      dietBreaks: 0,
      dislikedShown: 0,
      thinList: 0, // fewer than 5 options in total
      repeatsSameWeek: 0, // the same primary 3+ times in 7 days
      repeatsWithChoice: 0, // ...even though 15+ options fit
      repeatsByConstraints: new Map<string, number>(),
      distinctPrimaries: [] as number[],
      firstPick: new Map<string, number>(),
      allPrimaries: new Map<string, number>(),
      placeCards: 0,
      placeCardsEmpty: 0,
      placeTopSame: 0, // place cards whose top idea equals the previous card's
      placeListsIdentical: 0, // a different kind of place with exactly the same list (should almost never happen)
      placeLongLists: 0,
      placeSameKindIdentical: 0, // two different restaurants of the same kind, same list in the same order
    };
    const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

    for (let i = 0; i < 1000; i++) {
      const p = makePersona(r, i);
      const memories: Memory[] = p.dislikes.map((d) => newMemory('dislike_food', d, { source: 'question', now: START }));
      const history: FeedbackEvent[] = [];
      const primaries: string[] = [];
      for (let day = 0; day < 14; day++) {
        const slots: MealTime[] = r() < 0.4 ? ['breakfast', 'lunch', 'dinner'] : ['lunch', 'dinner'];
        for (const mealTime of slots) {
          const now = new Date(START.getTime() + day * 86400000 + ({ breakfast: 1, lunch: 5, dinner: 11, snack: 8 }[mealTime]) * 3600000);
          const together = p.partner && mealTime === 'dinner' && r() < 0.5;
          const profile = together ? combineProfiles(p.profile, [p.partner!]) : p.profile;
          const setting = p.settings[Math.floor(r() * p.settings.length)];
          const ctx: Context = {
            setting,
            mealTime,
            hunger: (['light', 'normal', 'normal', 'very'] as const)[Math.floor(r() * 4)],
            time: ([10, 20, 20, 60] as const)[Math.floor(r() * 4)],
            budget: profile.budget,
            feeling: (['fine', 'fine', 'tired', 'stressed', 'comfort', 'energized'] as const)[Math.floor(r() * 6)],
          };
          const res = recommend(profile, ctx, { history, memories, now });
          stats.decisions++;
          if (!res.primary) {
            stats.empty++;
            continue;
          }
          const shown: Recommendation[] = [res.primary, ...res.alternatives, ...(res.more ?? [])];
          if (shown.length < 5) stats.thinList++;
          for (const x of shown) {
            const m = x.meal;
            if (m.contains.some((a) => profile.allergens.includes(a)) || (OUT.has(setting) && m.mayContain.some((a) => profile.allergens.includes(a)))) stats.unsafe++;
            if (violatesDiet(m, profile)) stats.dietBreaks++;
            if (ingredientsOf(m.id).some((g) => p.dislikes.includes(g))) stats.dislikedShown++;
          }
          if (day === 0 && mealTime === 'lunch') bump(stats.firstPick, res.primary.meal.id);
          bump(stats.allPrimaries, res.primary.meal.id);
          primaries.push(res.primary.meal.id);
          const week = primaries.slice(-14);
          if (week.filter((x) => x === res.primary!.meal.id).length >= 3) {
            stats.repeatsSameWeek++;
            if (shown.length >= 15) stats.repeatsWithChoice++;
            bump(stats.repeatsByConstraints, `${profile.allergens.length} allergies${profile.diets.length ? ' + ' + profile.diets[0] : ''}`);
          }

          // Place cards (what someone eating out sees in "Places near you").
          if (OUT.has(setting) && r() < 0.3) {
            const row = places.slice(Math.floor(r() * Math.max(1, places.length - 12))).slice(0, 12);
            const lists = ideasForRow(row, shown).map((x) => x.ideas.map((y) => y.meal.id).join(','));
            lists.forEach((l, k) => {
              stats.placeCards++;
              if (!l) stats.placeCardsEmpty++;
              if (k > 0 && l && l.split(',')[0] === lists[k - 1].split(',')[0]) stats.placeTopSame++;
              const tagKey = (x: Place) => `${x.kind}:${[...x.cuisines].sort().join(',')}`;
              const long = l.split(',').length >= 4; // 1-3 safe dishes can't differ much
              if (long) stats.placeLongLists++;
              if (long && lists.some((o, j) => j !== k && o === l && row[j].name !== row[k].name && tagKey(row[j]) !== tagKey(row[k]))) stats.placeListsIdentical++;
              if (long && lists.some((o, j) => j !== k && o === l && row[j].name !== row[k].name && tagKey(row[j]) === tagKey(row[k]))) stats.placeSameKindIdentical++;
            });
          }

          // How the person reacts: they take it if it's a food they love (or 60% of the time), else swap.
          const likes = p.loves.includes(res.primary.meal.cuisine) || r() < 0.6;
          const at = now.toISOString();
          if (likes) {
            history.push({ mealId: res.primary.meal.id, kind: 'accepted', at, setting, mealTime });
            if (r() < 0.3) history.push({ mealId: res.primary.meal.id, kind: r() < 0.8 ? 'loved' : 'fine', at });
          } else {
            history.push({ mealId: res.primary.meal.id, kind: 'swapped', at });
            const alt = res.alternatives[0];
            if (alt) history.push({ mealId: alt.meal.id, kind: 'accepted', at, setting, mealTime });
            if (r() < 0.1) history.push({ mealId: res.primary.meal.id, kind: 'disliked', at });
          }
        }
      }
      stats.distinctPrimaries.push(new Set(primaries).size);
    }

    const pct = (n: number, d: number) => `${((100 * n) / Math.max(1, d)).toFixed(1)}%`;
    const top = (m: Map<string, number>, n: number) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);
    const firstTotal = [...stats.firstPick.values()].reduce((a, b) => a + b, 0);
    const allTotal = [...stats.allPrimaries.values()].reduce((a, b) => a + b, 0);
    const median = [...stats.distinctPrimaries].sort((a, b) => a - b)[500];
    const report = [
      `decisions: ${stats.decisions}, nothing fits: ${pct(stats.empty, stats.decisions)}, fewer than 5 options: ${pct(stats.thinList, stats.decisions)}`,
      `UNSAFE shown: ${stats.unsafe}, diet breaks: ${stats.dietBreaks}, disliked food shown: ${stats.dislikedShown}`,
      `different top picks per person over 14 days: median ${median}`,
      `same top pick 3+ times in a week: ${pct(stats.repeatsSameWeek, stats.decisions)} (with 15+ options available: ${pct(stats.repeatsWithChoice, stats.decisions)}); by constraints: ${top(stats.repeatsByConstraints, 6).map(([k, v]) => `${k}: ${v}`).join(', ')}`,
      `day-1 lunch: ${stats.firstPick.size} different meals; most common ${top(stats.firstPick, 3).map(([k, v]) => `${k} ${pct(v, firstTotal)}`).join(', ')}`,
      `all top picks: ${stats.allPrimaries.size} of ${CATALOG.length} meals used; top 5 = ${pct(top(stats.allPrimaries, 5).reduce((a, [, v]) => a + v, 0), allTotal)}: ${top(stats.allPrimaries, 5).map(([k]) => k).join(', ')}`,
      `place cards: ${stats.placeCards}, no ideas: ${pct(stats.placeCardsEmpty, stats.placeCards)}, same top idea as the card before: ${pct(stats.placeTopSame, stats.placeCards)}, with 4+ dishes: ${pct(stats.placeLongLists, stats.placeCards)}; of those, identical to a different kind of place: ${pct(stats.placeListsIdentical, stats.placeLongLists)}, same kind + same order: ${pct(stats.placeSameKindIdentical, stats.placeLongLists)}`,
    ];
    console.log(report.join('\n'));

    // Hard rules.
    expect(stats.unsafe).toBe(0);
    expect(stats.dietBreaks).toBe(0);
    expect(stats.dislikedShown).toBe(0);
    // Experience targets for someone who downloads the app.
    expect(stats.empty / stats.decisions).toBeLessThan(0.01);
    expect(stats.thinList / stats.decisions).toBeLessThan(0.05);
    expect(median).toBeGreaterThanOrEqual(12);
    expect(stats.repeatsWithChoice / stats.decisions).toBeLessThan(0.03);
    expect(stats.repeatsSameWeek / stats.decisions).toBeLessThan(0.08);
    // No single meal is the very first pick for more than about 1 in 8 new people.
    expect(top(stats.firstPick, 1)[0][1] / firstTotal).toBeLessThan(0.125);
    expect(stats.placeCardsEmpty / stats.placeCards).toBeLessThan(0.15);
    expect(stats.placeTopSame / stats.placeCards).toBeLessThan(0.25);
    expect(stats.placeListsIdentical / stats.placeLongLists).toBeLessThan(0.05);
    expect(stats.placeSameKindIdentical / stats.placeLongLists).toBeLessThan(0.15);
  });
});
