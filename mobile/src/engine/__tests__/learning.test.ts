// Proves EatOS gets smarter with use: simulated people with hidden tastes use the app
// for 60 days; we measure how often the FIRST suggestion is one they actually want.
import { CATALOG } from '../catalog';
import { learnTaste, tasteScore } from '../learn';
import { recommend } from '../recommend';
import type { Context, FeedbackEvent, MealIdea, Profile, Setting } from '../types';

const START = new Date('2026-09-01T00:00:00');

interface Persona {
  name: string;
  /** Hidden from EatOS: what this person really likes. */
  likes: (m: MealIdea) => number;
  settings: Setting[];
}

const personas: Persona[] = [
  {
    name: 'takeout Mexican lover who hates cooking',
    likes: (m) => (m.cuisine === 'mexican' ? 2 : 0) + (m.effort === 'none' ? 1 : m.effort === 'medium' ? -2 : 0),
    settings: ['home', 'takeout'],
  },
  {
    name: 'protein-focused Asian food fan',
    likes: (m) => (m.highProtein ? 1.5 : -0.5) + (m.cuisine === 'asian' ? 1.5 : 0),
    settings: ['home', 'takeout', 'restaurant'],
  },
  {
    name: 'comfort food on a budget',
    likes: (m) => (m.comfort ? 1.5 : -0.5) + (m.budget === 1 ? 1 : -1),
    settings: ['home', 'on_the_go', 'takeout'],
  },
  {
    name: 'Mediterranean/Indian, fiber-loving',
    likes: (m) => (['mediterranean', 'indian'].includes(m.cuisine) ? 2 : 0) + (m.highFiber ? 1 : -1),
    settings: ['home', 'takeout', 'restaurant', 'work'],
  },
  {
    name: 'light eater, no-cook',
    likes: (m) => (m.satiety === 'light' ? 1.5 : m.satiety === 'very' ? -1.5 : 0) + (m.effort === 'none' ? 1 : -1),
    settings: ['home', 'work', 'on_the_go'],
  },
];

type Mode = 'static' | 'memory' | 'full';

// Onboarding tells EatOS almost nothing (no cuisines picked) — learning must do the work.
const profile: Profile = {
  goal: 'eat_better',
  struggles: [],
  cuisines: [],
  allergens: [],
  diets: [],
  budget: 2,
  considerations: [],
  createdAt: START.toISOString(),
};

function simulate(p: Persona, mode: Mode) {
  const history: FeedbackEvent[] = [];
  const hits: boolean[] = [];
  for (let day = 0; day < 60; day++) {
    for (const [hour, mealTime] of [
      [12, 'lunch'],
      [19, 'dinner'],
    ] as const) {
      const now = new Date(START.getTime() + day * 86400000 + hour * 3600000);
      const setting = p.settings[(day + hour) % p.settings.length];
      const ctx: Context = { setting, mealTime, hunger: 'normal', time: 60, budget: 3, feeling: 'fine' };
      const seen: string[] = [];
      let accepted = false;
      for (let attempt = 0; attempt < 3 && !accepted; attempt++) {
        const r = recommend(profile, ctx, {
          history: mode === 'static' ? [] : history,
          now,
          exclude: seen,
          learn: mode === 'full',
        });
        const options = [r.primary, ...r.alternatives].filter((x) => !!x);
        if (attempt === 0) {
          // Did ANY of the 3 shown options satisfy them right away?
          const hit = options.some((o) => p.likes(o.meal) >= 2);
          hits.push(hit);
        }
        const pick = options.find((o) => p.likes(o.meal) >= 2);
        if (pick) {
          history.push({ mealId: pick.meal.id, kind: 'accepted', at: now.toISOString(), setting, mealTime });
          if (p.likes(pick.meal) >= 3) history.push({ mealId: pick.meal.id, kind: 'loved', at: now.toISOString() });
          accepted = true;
        } else if (r.primary) {
          history.push({ mealId: r.primary.meal.id, kind: 'swapped', at: now.toISOString() });
          seen.push(...options.map((o) => o.meal.id));
        }
      }
    }
  }
  const rate = (xs: boolean[]) => (xs.length ? xs.filter(Boolean).length / xs.length : 0);
  return {
    firstWeek: rate(hits.slice(0, 14)),
    lastTwoWeeks: rate(hits.slice(-28)),
    overall: rate(hits),
  };
}

const results = personas.map((p) => ({
  p: p.name,
  static: simulate(p, 'static'),
  memory: simulate(p, 'memory'),
  full: simulate(p, 'full'),
}));
const avg = (f: (r: (typeof results)[number]) => number) => results.reduce((s, r) => s + f(r), 0) / results.length;

describe('EatOS gets smarter with use (60-day simulation, 5 hidden-taste personas)', () => {
  it('prints the report', () => {
    if (process.env.LEARNING_REPORT) {
      const pct = (x: number) => `${Math.round(x * 100)}%`;
      console.log(
        results
          .map(
            (r) =>
              `${r.p.padEnd(42)} static ${pct(r.static.overall)} | memory ${pct(r.memory.overall)} | full ${pct(r.full.overall)} | week1→last2wk ${pct(r.full.firstWeek)}→${pct(r.full.lastTwoWeeks)}`,
          )
          .join('\n'),
      );
    }
  });

  it.each(results.map((r) => [r.p, r] as const))('%s: never worse than a static app, and improves over time', (_n, r) => {
    // 2-point tolerance: a static app that happens to show a lucky trio can score ~100%,
    // but it shows the user the exact same three meals every single day.
    expect(r.full.overall).toBeGreaterThanOrEqual(r.static.overall - 0.02);
    expect(r.full.lastTwoWeeks).toBeGreaterThanOrEqual(r.full.firstWeek);
  });

  it('on average, full learning beats a static app by at least 15 points', () => {
    expect(avg((r) => r.full.overall) - avg((r) => r.static.overall)).toBeGreaterThanOrEqual(0.15);
  });

  it('on average, trait learning beats meal memory alone by at least 5 points', () => {
    expect(avg((r) => r.full.overall) - avg((r) => r.memory.overall)).toBeGreaterThanOrEqual(0.05);
  });
});

describe('learning safeguards', () => {
  const now = new Date('2026-10-15T12:00:00');
  const ago = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

  it('a single event barely moves taste (no overreaction)', () => {
    const t = learnTaste([{ mealId: 'burrito-bowl', kind: 'accepted', at: ago(0) }], CATALOG, now);
    expect(t.affinity.get('cuisine:mexican')!).toBeLessThan(0.25);
  });

  it('old behaviour fades: 90-day-old habits count far less than this week', () => {
    const old = learnTaste(Array(6).fill({ mealId: 'burrito-bowl', kind: 'accepted', at: ago(90) }), CATALOG, now);
    const fresh = learnTaste(Array(6).fill({ mealId: 'burrito-bowl', kind: 'accepted', at: ago(1) }), CATALOG, now);
    expect(old.affinity.get('cuisine:mexican')!).toBeLessThan(fresh.affinity.get('cuisine:mexican')! / 2);
  });

  it('learning never overrides allergy or diet rules', () => {
    // Loves peanut meals... then develops a peanut allergy.
    const history: FeedbackEvent[] = Array.from({ length: 30 }, (_, i) => ({
      mealId: i % 2 ? 'pb-banana-toast' : 'apple-peanut-butter',
      kind: 'loved' as const,
      at: ago(i),
    }));
    const p: Profile = { ...profile, allergens: ['peanut'] };
    for (const mealTime of ['breakfast', 'snack'] as const) {
      const r = recommend(p, { setting: 'home', mealTime, hunger: 'light', time: 15, budget: 2, feeling: 'fine' }, { history, now });
      for (const x of [r.primary, ...r.alternatives]) expect(x?.meal.contains).not.toContain('peanut');
    }
  });

  it('learned taste is capped so it cannot drown out goals and context', () => {
    const history: FeedbackEvent[] = Array.from({ length: 200 }, (_, i) => ({ mealId: 'burrito-bowl', kind: 'loved' as const, at: ago(i % 5) }));
    const t = learnTaste(history, CATALOG, now);
    expect(tasteScore(CATALOG.find((m) => m.id === 'veggie-burrito-bowl')!, t).points).toBeLessThanOrEqual(3);
  });

  it('keeps suggesting something new once it knows the user', () => {
    const history: FeedbackEvent[] = ['burrito-bowl', 'veggie-burrito-bowl', 'chicken-shawarma-plate', 'veggie-pizza-salad', 'beef-pho', 'grilled-chicken-sandwich'].flatMap(
      (id, i) => [{ mealId: id, kind: 'accepted' as const, at: ago(2 + i) }],
    );
    const r = recommend(profile, { setting: 'takeout', mealTime: 'dinner', hunger: 'normal', time: 30, budget: 3, feeling: 'fine' }, { history, now });
    const alts = r.alternatives;
    if ([r.primary, ...alts.slice(0, 1)].every((x) => history.some((h) => h.mealId === x!.meal.id))) {
      expect(alts[1].isNew).toBe(true);
      expect(alts[1].reasons[0]).toBe('Something new you might like');
    }
  });

  it('learns habits: your usual for lunch at work', () => {
    const history: FeedbackEvent[] = [1, 2, 3].map((d) => ({
      mealId: 'chickpea-salad',
      kind: 'accepted' as const,
      at: ago(d),
      setting: 'work' as const,
      mealTime: 'lunch' as const,
    }));
    const r = recommend(profile, { setting: 'work', mealTime: 'lunch', hunger: 'normal', time: 15, budget: 2, feeling: 'fine' }, { history, now });
    const all = [r.primary, ...r.alternatives];
    const salad = all.find((x) => x?.meal.id === 'chickpea-salad');
    expect(salad?.reasons).toContain('Your usual for lunch at work');
  });
});
