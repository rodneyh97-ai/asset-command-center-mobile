// Adversarial tests: each one is an attempt to break EatOS's safety, data, or availability.
import { ALL_ALLERGENS, CATALOG } from '../engine/catalog';
import { recommend, swapsFor, violatesDiet } from '../engine/recommend';
import type { Allergen, Context, Diet, FeedbackEvent, Profile } from '../engine/types';
import { sanitizeIncomingPath } from '../security/links';
import { initialState, parseStored, quickPicksFor, SCHEMA_VERSION } from '../store/state';

const NOW = new Date('2026-10-15T12:30:00');
const ALLERGEN_LABEL_RE: Record<Allergen, string> = {
  peanut: 'peanut',
  tree_nut: 'tree nut',
  dairy: 'dairy',
  egg: 'egg',
  gluten: 'gluten',
  soy: 'soy',
  fish: 'fish',
  shellfish: 'shellfish',
  sesame: 'sesame',
};

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

// Deterministic PRNG so failures are reproducible.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe('ATTACK: bypass allergy filtering', () => {
  it('fuzz: 20,000 random users/situations/histories never get an unsafe or diet-breaking pick', () => {
    const r = rng(42);
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
    const some = <T>(xs: readonly T[], p: number) => xs.filter(() => r() < p);
    const diets: Diet[] = ['vegetarian', 'vegan', 'pescatarian', 'no_pork', 'no_red_meat'];
    for (let i = 0; i < 20000; i++) {
      const p = profile({
        goal: pick(['eat_better', 'lose_weight', 'maintain', 'build_muscle', 'more_energy'] as const),
        allergens: some(ALL_ALLERGENS, 0.25),
        diets: some(diets, 0.15),
        cuisines: some(['american', 'mexican', 'asian', 'italian'] as const, 0.4),
        struggles: some(['no_time', 'decision_fatigue', 'cravings', 'budget', 'cooking'] as const, 0.3),
      });
      const ctx: Context = {
        setting: pick(['home', 'takeout', 'restaurant', 'work', 'on_the_go'] as const),
        hunger: pick(['light', 'normal', 'very'] as const),
        time: pick([5, 15, 30, 60] as const),
        budget: pick([1, 2, 3, 4] as const),
        feeling: pick(['fine', 'tired', 'stressed', 'comfort', 'energized'] as const),
        mealTime: pick(['breakfast', 'lunch', 'dinner', 'snack'] as const),
      };
      const history: FeedbackEvent[] = Array.from({ length: Math.floor(r() * 20) }, () => ({
        mealId: pick(CATALOG).id,
        kind: pick(['accepted', 'saved', 'disliked', 'swapped', 'loved', 'fine', 'unsaved'] as const),
        at: new Date(NOW.getTime() - r() * 10 * 86400000).toISOString(),
      }));
      const res = recommend(p, ctx, { history, now: NOW });
      const all = [res.primary, ...res.alternatives].filter(Boolean);
      expect(res.alternatives.length).toBeLessThanOrEqual(2);
      for (const rec of all) {
        const m = rec!.meal;
        expect(m.contains.filter((a) => p.allergens.includes(a))).toEqual([]);
        if (ctx.setting !== 'home' && ctx.setting !== 'work') {
          expect(m.mayContain.filter((a) => p.allergens.includes(a))).toEqual([]);
          const soft = [...Object.keys(m.removable ?? {}), ...(m.crossContact ?? [])].filter((a) =>
            p.allergens.includes(a as Allergen),
          );
          for (const a of soft) expect(rec!.cautions.join(' ')).toMatch(new RegExp(ALLERGEN_LABEL_RE[a as Allergen], 'i'));
        }
        for (const a of Object.keys(m.removable ?? {}).filter((x) => p.allergens.includes(x as Allergen))) {
          expect(rec!.cautions.join(' ')).toMatch(/order it without|leave out/i);
          void a;
        }
        expect(violatesDiet(m, p)).toBe(false);
        // A user-visible caution must exist for any uncertain allergen.
        const uncertain = m.mayContain.filter((a) => p.allergens.includes(a));
        if (uncertain.length) expect(rec!.cautions.join(' ')).toMatch(/check labels/i);
      }
    }
  });

  it('"Have again" cannot be used to surface a meal that is unsafe where the user is now', () => {
    // User saved a yogurt bowl at home (fine then), later added a peanut allergy and is now at work.
    const history: FeedbackEvent[] = [{ mealId: 'greek-yogurt-bowl', kind: 'saved', at: NOW.toISOString() }];
    const p = profile({ allergens: ['peanut'] });
    const atRestaurant = quickPicksFor(p, history, 'restaurant');
    expect(atRestaurant.map((q) => q.meal.id)).not.toContain('greek-yogurt-bowl');
    const atHome = quickPicksFor(p, history, 'home');
    const pick = atHome.find((q) => q.meal.id === 'greek-yogurt-bowl');
    expect(pick?.cautions.join(' ')).toMatch(/check labels.*peanut/i);
  });

  it('"Have again" re-applies diet rules after a diet change', () => {
    const history: FeedbackEvent[] = [{ mealId: 'burger-side-salad', kind: 'accepted', at: NOW.toISOString() }];
    expect(quickPicksFor(profile({ diets: ['vegetarian'] }), history, 'takeout')).toEqual([]);
  });

  it('meal descriptions never mention an ingredient whose allergen is untagged', () => {
    const words: [RegExp, Allergen][] = [
      [/peanut/i, 'peanut'],
      [/\bnuts?\b|almond|cashew|pesto|granola/i, 'tree_nut'],
      [/cheese|yogurt|milk|(?<!peanut |seed )butter|cream|feta|parmesan|ghee/i, 'dairy'],
      [/\beggs?\b|omelet|mayo/i, 'egg'],
      [/bread|toast|tortilla|pita|wrap|pasta|bun\b|naan|soy sauce|granola|crust|bagel/i, 'gluten'],
      [/tofu|soy|edamame|miso/i, 'soy'],
      [/tuna|salmon|\bfish\b|fish sauce/i, 'fish'],
      [/shrimp|crab|lobster/i, 'shellfish'],
      [/sesame|tahini|hummus/i, 'sesame'],
    ];
    const problems: string[] = [];
    for (const m of CATALOG) {
      // Swaps are separately filtered; the main text must be fully tagged.
      const text = `${m.name}. ${m.summary} ${m.howTo}`.replace(/sunflower seed butter/gi, '');
      for (const [re, a] of words) {
        const tagged = [...m.contains, ...m.mayContain, ...Object.keys(m.removable ?? {}), ...(m.crossContact ?? [])];
        if (re.test(text) && !tagged.includes(a)) problems.push(`${m.id}: ${a}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('a meal whose own title names a gluten food lists gluten as definite, not "maybe"', () => {
    for (const m of CATALOG) {
      if (/toast|bread|pasta|pizza|sandwich|wrap|pita|quesadilla/i.test(m.name)) {
        expect({ id: m.id, gluten: m.contains.includes('gluten') }).toEqual({ id: m.id, gluten: true });
      }
    }
  });

  it('swaps never break the user\'s diet or allergies, for every combination', () => {
    for (const a of ALL_ALLERGENS) {
      const p = profile({ allergens: [a] });
      for (const m of CATALOG) {
        for (const s of swapsFor(m, p)) {
          // The only allowed mention of the allergen is a swap that removes it.
          if (new RegExp(`${a.replace('_', ' ')}-free|avoid ${a.replace('_', ' ')}`, 'i').test(s)) continue;
          if (a === 'gluten') expect(s).not.toMatch(/bread|tortilla|pita|wrap|bun\b|naan/i);
          if (a === 'egg') expect(s).not.toMatch(/\beggs?\b/i);
          if (a === 'shellfish') expect(s).not.toMatch(/shrimp/i);
          if (a === 'fish') expect(s).not.toMatch(/tuna|salmon/i);
        }
      }
    }
  });
});

describe('ATTACK: corrupt or hostile stored data', () => {
  const hostile = [
    { profile: { goal: 'eat_better', allergens: ['peanut', 42, null, 'plutonium', '__proto__'], diets: ['vegan', {}] } },
    { profile: { goal: 'x', allergens: 'peanut', diets: [] } },
    { profile: { goal: 'eat_better', allergens: [], diets: [], budget: 99, cuisines: 'all', struggles: null } },
    { lastContext: { setting: 'moon', hunger: 'infinite', time: -1, budget: 'free', feeling: '<script>' } },
    { history: [{ mealId: 'nope', kind: 'accepted', at: 'not-a-date' }, { mealId: 1, kind: 2, at: 3 }] },
    { analytics: [null, 1, 'x', { name: 'app_open', at: 'garbage' }] },
    { __proto__: { polluted: true } },
  ];

  it.each(hostile.map((h, i) => [i, h] as const))('hostile payload %i never crashes recommend()', (_i, h) => {
    const raw = JSON.stringify({ ...initialState, ...h, profile: { ...profile(), ...(h as { profile?: object }).profile } });
    const s = parseStored(raw);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    if (s.profile) {
      for (const a of s.profile.allergens) expect(ALL_ALLERGENS).toContain(a);
      expect([1, 2, 3, 4]).toContain(s.profile.budget);
      const ctx = { ...(s.lastContext ?? { setting: 'home', hunger: 'normal', time: 15, budget: 2, feeling: 'fine' }), mealTime: 'lunch' as const };
      expect(() => recommend(s.profile!, ctx, { history: s.history, now: NOW })).not.toThrow();
      for (const m of CATALOG) expect(() => swapsFor(m, s.profile!)).not.toThrow();
    }
    for (const e of s.analytics) expect(typeof e?.name).toBe('string');
  });

  it('keeps a valid allergy even if other parts of the profile are corrupt (fail safe, not fail open)', () => {
    const raw = JSON.stringify({
      ...initialState,
      profile: { ...profile(), allergens: ['peanut', 'garbage'], budget: 'lots', cuisines: 5 },
    });
    const s = parseStored(raw);
    expect(s.profile?.allergens).toEqual(['peanut']);
  });

  it('data from a newer app version is not silently destroyed', () => {
    const raw = JSON.stringify({ ...initialState, version: SCHEMA_VERSION + 1, profile: profile() });
    const s = parseStored(raw);
    expect(s.profile).toBeNull();
    expect(s.unreadable).toBe(raw);
  });
});

describe('ATTACK: hostile deep links', () => {
  it.each([
    ['eatos://decide', '/decide'],
    ['/settings', '/settings'],
    ['eatos://settings?reset=1&allergens=', '/settings'],
    ['eatos://../../etc/passwd', '/'],
    ['eatos://onboarding#x', '/onboarding'],
    ['https://evil.example/decide', '/decide'],
    ['javascript:alert(1)', '/'],
    ['eatos://' + '%C3'.repeat(5000), '/'],
    ['eatos://unknown', '/'],
    ['', '/'],
  ])('%s → %s', (input, expected) => {
    expect(sanitizeIncomingPath(input)).toBe(expected);
  });
});
