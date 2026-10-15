import { ALL_ALLERGENS, CATALOG } from '../catalog';
import { mealTimeFor, recommend, swapsFor, violatesDiet } from '../recommend';
import type {
  Allergen,
  BudgetTier,
  Context,
  Diet,
  FeedbackEvent,
  Feeling,
  Hunger,
  MealTime,
  Profile,
  Setting,
  TimeAvailable,
} from '../types';

const NOW = new Date('2026-10-15T18:30:00');

const profile = (over: Partial<Profile> = {}): Profile => ({
  goal: 'eat_better',
  struggles: [],
  cuisines: [],
  allergens: [],
  diets: [],
  budget: 2,
  considerations: [],
  createdAt: NOW.toISOString(),
  ...over,
});

const ctx = (over: Partial<Context> = {}): Context => ({
  setting: 'home',
  hunger: 'normal',
  time: 20,
  budget: 2,
  feeling: 'fine',
  mealTime: 'dinner',
  ...over,
});

const allResults = (p: Profile, c: Context) => {
  const r = recommend(p, c, { now: NOW });
  return [r.primary, ...r.alternatives].filter(Boolean).map((x) => x!);
};

describe('catalog integrity', () => {
  it('has unique ids and complete entries', () => {
    const ids = new Set(CATALOG.map((m) => m.id));
    expect(ids.size).toBe(CATALOG.length);
    for (const m of CATALOG) {
      expect(m.settings.length).toBeGreaterThan(0);
      expect(m.mealTimes.length).toBeGreaterThan(0);
      expect(m.howTo.length).toBeGreaterThan(10);
      // Each allergen sits in exactly one bucket.
      const buckets = [m.contains, m.mayContain, Object.keys(m.removable ?? {}), m.crossContact ?? []];
      const all = buckets.flat();
      expect({ id: m.id, dupes: all.filter((a, i) => all.indexOf(a) !== i) }).toEqual({ id: m.id, dupes: [] });
    }
  });

  it('never contains calorie or dollar figures (we have no reliable data for either)', () => {
    for (const m of CATALOG) {
      const text = [m.name, m.summary, m.howTo, ...m.swaps].join(' ');
      expect(text).not.toMatch(/\$\d|calorie|kcal/i);
    }
  });

  it('obvious allergen words are tagged', () => {
    const checks: [RegExp, Allergen][] = [
      [/peanut/i, 'peanut'],
      [/cheese|yogurt|feta/i, 'dairy'],
      [/tofu|soy sauce|edamame/i, 'soy'],
      [/hummus|tahini/i, 'sesame'],
      [/tuna|salmon/i, 'fish'],
    ];
    for (const m of CATALOG) {
      const text = `${m.name} ${m.summary}`;
      for (const [re, allergen] of checks) {
        if (re.test(text)) {
          expect({ id: m.id, tagged: [...m.contains, ...m.mayContain].includes(allergen) }).toEqual({
            id: m.id,
            tagged: true,
          });
        }
      }
    }
  });
});

describe('allergy safety (hard constraint)', () => {
  const settings: Setting[] = ['home', 'takeout', 'restaurant', 'work', 'on_the_go'];
  const mealTimes: MealTime[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  const times: TimeAvailable[] = [10, 20, 60];
  const budgets: BudgetTier[] = [1, 2, 3, 4];

  it.each(ALL_ALLERGENS)('never recommends a meal that contains %s, in any situation', (allergen) => {
    const p = profile({ allergens: [allergen] });
    for (const setting of settings)
      for (const mealTime of mealTimes)
        for (const time of times)
          for (const budget of budgets) {
            for (const r of allResults(p, ctx({ setting, mealTime, time, budget }))) {
              expect(r.meal.contains).not.toContain(allergen);
            }
          }
  });

  it.each(ALL_ALLERGENS)('outside the home, never recommends a meal that may contain %s', (allergen) => {
    const p = profile({ allergens: [allergen] });
    for (const setting of ['takeout', 'restaurant', 'on_the_go'] as Setting[])
      for (const mealTime of mealTimes) {
        for (const r of allResults(p, ctx({ setting, mealTime, budget: 4, time: 60 }))) {
          expect(r.meal.mayContain).not.toContain(allergen);
        }
      }
  });

  it('at home, an uncertain allergen is shown with a label-check caution', () => {
    const p = profile({ allergens: ['gluten'] });
    const r = recommend(p, ctx({ mealTime: 'breakfast', hunger: 'light' }), {
      now: NOW,
      catalog: CATALOG.filter((m) => m.id === 'greek-yogurt-bowl'),
    });
    expect(r.primary?.meal.id).toBe('greek-yogurt-bowl');
    expect(r.primary?.cautions.join(' ')).toMatch(/check labels.*gluten/i);
  });

  it('outside the home, every recommendation tells allergic users to confirm with staff', () => {
    const p = profile({ allergens: ['peanut', 'shellfish'] });
    for (const r of allResults(p, ctx({ setting: 'takeout' }))) {
      expect(r.cautions.join(' ')).toMatch(/peanut and shellfish allergy.*confirm/i);
    }
  });

  it('multiple allergies combine', () => {
    const allergens: Allergen[] = ['dairy', 'gluten', 'egg', 'soy'];
    const p = profile({ allergens });
    for (const r of allResults(p, ctx({ mealTime: 'lunch', time: 60 }))) {
      expect(r.meal.contains.some((a) => allergens.includes(a))).toBe(false);
    }
  });

  it('suggested swaps never add an allergen the user has', () => {
    const p = profile({ allergens: ['peanut', 'dairy', 'soy'] });
    for (const m of CATALOG) {
      for (const s of swapsFor(m, p)) {
        // Swaps that remove the allergen ("Skip feta for dairy-free") are allowed.
        if (/dairy-free|avoid dairy|avoid peanut|soy-free/i.test(s)) continue;
        expect(s).not.toMatch(/peanut|tofu|soy|tamari|cheese|parmesan|feta|milk|yogurt/i);
      }
    }
    // A swap that removes one allergen but adds another is still dropped.
    const yogurt = CATALOG.find((m) => m.id === 'greek-yogurt-bowl')!;
    expect(swapsFor(yogurt, p).join(' ')).not.toMatch(/soy yogurt/i);
    expect(swapsFor(yogurt, profile({ allergens: ['dairy'] })).join(' ')).toMatch(/soy yogurt/i);
    // Allergen-removing swaps are kept.
    const oat = CATALOG.find((m) => m.id === 'pb-banana-oatmeal')!;
    expect(swapsFor(oat, profile({ allergens: ['peanut'] }))).toContain('Use sunflower seed butter if you avoid peanuts');
  });
});

describe('diet rules (hard constraint)', () => {
  const cases: [Diet, (m: (typeof CATALOG)[number]) => boolean][] = [
    ['vegan', (m) => m.diet.hasAnimalProducts || m.diet.hasMeat || m.diet.hasFish],
    ['vegetarian', (m) => m.diet.hasMeat || m.diet.hasFish],
    ['pescatarian', (m) => m.diet.hasMeat],
    ['no_red_meat', (m) => m.diet.hasRedMeat],
  ];
  it.each(cases)('%s users never get violating meals', (diet, violates) => {
    const p = profile({ diets: [diet] });
    for (const setting of ['home', 'takeout', 'restaurant'] as Setting[]) {
      for (const r of allResults(p, ctx({ setting, budget: 4, time: 60 }))) {
        expect(violates(r.meal)).toBe(false);
        expect(violatesDiet(r.meal, p)).toBe(false);
      }
    }
  });

  it('vegetarians are not offered meat swaps', () => {
    const p = profile({ diets: ['vegetarian'] });
    for (const m of CATALOG) for (const s of swapsFor(m, p)) expect(s).not.toMatch(/chicken|turkey|tuna|shrimp|sausage/i);
  });
});

describe('situation fit', () => {
  it('only recommends meals that work where the user is', () => {
    for (const setting of ['home', 'takeout', 'restaurant', 'work', 'on_the_go'] as Setting[]) {
      for (const r of allResults(profile(), ctx({ setting, budget: 4, time: 60 }))) {
        expect(r.meal.settings).toContain(setting);
      }
    }
  });

  it('at home, never exceeds the time available', () => {
    for (const time of [10, 20] as TimeAvailable[]) {
      for (const r of allResults(profile(), ctx({ time }))) {
        expect(r.meal.prepMinutes).toBeLessThanOrEqual(time);
      }
    }
  });

  it('never goes two budget tiers over, and flags one tier over', () => {
    for (const r of allResults(profile(), ctx({ setting: 'restaurant', budget: 1 }))) {
      expect(r.meal.budget).toBeLessThanOrEqual(2);
      if (r.meal.budget > 1) expect(r.cautions.join(' ')).toMatch(/above the budget/);
    }
  });

  it('prefers low-effort meals when the user is tired', () => {
    const r = recommend(profile(), ctx({ feeling: 'tired', time: 60 }), { now: NOW });
    expect(['none', 'low']).toContain(r.primary!.meal.effort);
  });

  it('prefers high-protein meals for a muscle-building goal', () => {
    const r = recommend(profile({ goal: 'build_muscle' }), ctx({ time: 60 }), { now: NOW });
    expect(r.primary!.meal.highProtein).toBe(true);
    expect(r.primary!.reasons.join(' ')).toMatch(/protein/i);
  });

  it('matches meal time', () => {
    for (const mealTime of ['breakfast', 'lunch', 'dinner', 'snack'] as MealTime[]) {
      const hunger: Hunger = mealTime === 'snack' ? 'light' : 'normal';
      const r = recommend(profile(), ctx({ mealTime, hunger, time: 60 }), { now: NOW });
      expect(r.primary!.meal.mealTimes).toContain(mealTime);
    }
  });

  it('never makes a snack the main pick for lunch or dinner unless the user is only a little hungry', () => {
    for (const setting of ['home', 'takeout', 'restaurant', 'work', 'on_the_go'] as Setting[])
      for (const mealTime of ['lunch', 'dinner'] as MealTime[])
        for (const goal of ['lose_weight', 'build_muscle', 'eat_better'] as const)
          for (const feeling of ['tired', 'fine'] as Feeling[]) {
            const r = recommend(profile({ goal, cuisines: ['asian'] }), ctx({ setting, mealTime, feeling, budget: 1 }), { now: NOW });
            if (r.primary) expect({ id: r.primary.meal.id, ok: r.primary.meal.mealTimes.some((t) => t !== 'snack') }).toEqual({ id: r.primary.meal.id, ok: true });
          }
  });

  it('returns at most two alternatives, none duplicating the primary', () => {
    const r = recommend(profile(), ctx(), { now: NOW });
    expect(r.alternatives.length).toBeLessThanOrEqual(2);
    expect(r.alternatives.map((a) => a.meal.id)).not.toContain(r.primary!.meal.id);
  });

  it('every recommendation explains itself', () => {
    const feelings: Feeling[] = ['fine', 'tired', 'stressed', 'comfort', 'energized'];
    for (const feeling of feelings) {
      for (const r of allResults(profile({ cuisines: ['mexican'] }), ctx({ feeling }))) {
        expect(r.reasons.length).toBeGreaterThan(0);
      }
    }
  });

  it('is honest when nothing fits', () => {
    const p = profile({ allergens: ['peanut'] });
    const onlyPeanutMeals = CATALOG.filter((m) => m.contains.includes('peanut'));
    const r = recommend(p, ctx({ mealTime: 'breakfast' }), { now: NOW, catalog: onlyPeanutMeals });
    expect(r.primary).toBeNull();
    expect(r.emptyReason).toMatch(/nothing fits/i);
  });
});

describe('learning from feedback', () => {
  const at = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * 3600_000).toISOString();

  it('never shows a disliked meal again', () => {
    const first = recommend(profile(), ctx(), { now: NOW }).primary!.meal.id;
    const history: FeedbackEvent[] = [{ mealId: first, kind: 'disliked', at: at(1) }];
    const all = allResults(profile(), ctx());
    expect(all.length).toBeGreaterThan(0);
    const next = recommend(profile(), ctx(), { now: NOW, history });
    expect([next.primary, ...next.alternatives].map((r) => r?.meal.id)).not.toContain(first);
  });

  it('saved meals rank higher', () => {
    const base = recommend(profile(), ctx(), { now: NOW });
    const target = base.alternatives[1].meal.id;
    const history: FeedbackEvent[] = [{ mealId: target, kind: 'saved', at: at(48) }];
    const r = recommend(profile(), ctx(), { now: NOW, history });
    expect(r.primary!.meal.id).toBe(target);
    expect(r.primary!.reasons).toContain('One of your saved meals');
  });

  it('does not repeat a meal eaten in the last 20 hours as the primary pick', () => {
    const first = recommend(profile(), ctx(), { now: NOW }).primary!.meal.id;
    const history: FeedbackEvent[] = [{ mealId: first, kind: 'accepted', at: at(3) }];
    expect(recommend(profile(), ctx(), { now: NOW, history }).primary!.meal.id).not.toBe(first);
  });

  it('swap excludes already-seen meals in the session', () => {
    const r1 = recommend(profile(), ctx(), { now: NOW });
    const seen = [r1.primary!, ...r1.alternatives].map((r) => r.meal.id);
    const r2 = recommend(profile(), ctx(), { now: NOW, exclude: seen });
    for (const r of [r2.primary, ...r2.alternatives]) if (r) expect(seen).not.toContain(r.meal.id);
  });
});

describe('sensitive experiences', () => {
  it('gentle mode avoids weight-focused language', () => {
    const p = profile({ goal: 'lose_weight', considerations: ['ed_sensitive'] });
    for (const r of allResults(p, ctx({ time: 60 }))) {
      expect(r.reasons.join(' ')).not.toMatch(/weight|full longer|calorie/i);
    }
  });

  it('medical consideration adds a not-medical-advice note', () => {
    const p = profile({ considerations: ['medical'] });
    expect(recommend(p, ctx(), { now: NOW }).primary!.cautions.join(' ')).toMatch(/not medical advice/i);
  });
});

describe('mealTimeFor', () => {
  it.each([
    ['07:00', 'breakfast'],
    ['12:30', 'lunch'],
    ['15:30', 'snack'],
    ['19:00', 'dinner'],
    ['23:00', 'snack'],
  ])('%s → %s', (hhmm, expected) => {
    expect(mealTimeFor(new Date(`2026-10-15T${hhmm}:00`))).toBe(expected);
  });
});
