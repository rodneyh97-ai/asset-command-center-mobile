// Exhaustive + fuzz safety checks. Slow (minutes); run with: DEEP=1 npx jest src/__tests__/deep
import { ALL_ALLERGENS, CATALOG } from '../../engine/catalog';
import { recommend, safetyCheck, swapsFor, violatesDiet } from '../../engine/recommend';
import type { Allergen, Context, Diet, FeedbackEvent, Profile } from '../../engine/types';
import { sanitizeIncomingPath, ALLOWED_PATHS } from '../../security/links';
import { initialState, parseStored } from '../../store/state';

const run = process.env.DEEP ? describe : describe.skip;
const NOW = new Date('2026-10-15T12:30:00');
const OUT = new Set(['takeout', 'restaurant', 'on_the_go']);

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

run('EXHAUSTIVE: every allergen combination × diet × situation', () => {
  it('737,280 recommendations: never unsafe, never diet-breaking, always explained', () => {
    const diets: Diet[][] = [[], ['vegetarian'], ['vegan'], ['pescatarian'], ['no_pork'], ['no_red_meat']];
    let calls = 0;
    let empty = 0;
    for (let mask = 0; mask < 1 << ALL_ALLERGENS.length; mask++) {
      const allergens = ALL_ALLERGENS.filter((_, i) => mask & (1 << i)) as Allergen[];
      for (const d of diets) {
        const p: Profile = { goal: 'eat_better', struggles: [], cuisines: [], allergens, diets: d, budget: 2, considerations: [], createdAt: '' };
        for (const setting of ['home', 'takeout', 'restaurant', 'work', 'on_the_go'] as const)
          for (const mealTime of ['breakfast', 'lunch', 'dinner', 'snack'] as const)
            for (const time of [10, 20, 60] as const)
              for (const budget of [1, 2, 3, 4] as const) {
                const ctx: Context = { setting, mealTime, time, budget, hunger: 'normal', feeling: 'fine' };
                const r = recommend(p, ctx, { now: NOW });
                calls++;
                if (!r.primary) {
                  empty++;
                  expect(r.emptyReason).toBeTruthy();
                }
                for (const x of [r.primary, ...r.alternatives]) {
                  if (!x) continue;
                  const m = x.meal;
                  if (m.contains.some((a) => allergens.includes(a))) throw new Error(`UNSAFE contains ${m.id} ${allergens}`);
                  if (OUT.has(setting) && m.mayContain.some((a) => allergens.includes(a))) throw new Error(`UNSAFE mayContain ${m.id}`);
                  if (violatesDiet(m, p)) throw new Error(`DIET ${m.id} ${d}`);
                  if (x.reasons.length === 0) throw new Error(`NO REASON ${m.id}`);
                  const soft = [...Object.keys(m.removable ?? {}), ...(OUT.has(setting) ? (m.crossContact ?? []) : [])].filter((a) =>
                    allergens.includes(a as Allergen),
                  );
                  if (soft.length && x.cautions.length === 0) throw new Error(`NO CAUTION ${m.id}`);
                }
                expect(r.alternatives.length).toBeLessThanOrEqual(2);
              }
        for (const m of CATALOG) for (const s of swapsFor(m, p)) expect(typeof s).toBe('string');
      }
    }
    console.log(`exhaustive: ${calls} recommendations checked, ${empty} honest "nothing fits" results`);
    expect(calls).toBe(512 * 6 * 240);
  });

  it('safetyCheck agrees with the rules for every meal × allergen combination × setting', () => {
    for (let mask = 0; mask < 512; mask++) {
      const allergens = ALL_ALLERGENS.filter((_, i) => mask & (1 << i)) as Allergen[];
      const p: Profile = { goal: 'eat_better', struggles: [], cuisines: [], allergens, diets: [], budget: 2, considerations: [], createdAt: '' };
      for (const m of CATALOG)
        for (const setting of ['home', 'restaurant'] as const) {
          const ok = safetyCheck(m, p, setting).ok;
          const bad = m.contains.some((a) => allergens.includes(a)) || (setting === 'restaurant' && m.mayContain.some((a) => allergens.includes(a)));
          expect(ok).toBe(!bad);
        }
    }
  });
});

run('FUZZ: hostile input', () => {
  it('100,000 random deep links always resolve to a known screen, fast', () => {
    const r = rng(7);
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789-_/.:?#%&=<>"\'`\\@!$*()[]{}|^~ \u0000‮﻿éü中🍔';
    const pieces = ['eatos://', 'exp://h/--', 'https://evil.example', 'javascript:', '/meal/', '/../', '%2e%2e/', '%C3', '//', 'settings', 'decide', '?a=1', '#x'];
    const t0 = Date.now();
    for (let i = 0; i < 100_000; i++) {
      let s = '';
      const len = Math.floor(r() * 40);
      for (let k = 0; k < len; k++) s += r() < 0.3 ? pieces[Math.floor(r() * pieces.length)] : alphabet[Math.floor(r() * alphabet.length)];
      const out = sanitizeIncomingPath(s);
      if (!(ALLOWED_PATHS as readonly string[]).includes(out) && !/^\/meal\/[a-z0-9-]{1,60}$/.test(out)) throw new Error(`escaped: ${JSON.stringify(s)} -> ${out}`);
    }
    expect(Date.now() - t0).toBeLessThan(20_000);
  });

  it('10,000 corrupted saved-data blobs never crash loading and never invent allergies away', () => {
    const r = rng(11);
    const good = JSON.stringify({
      ...initialState,
      profile: { goal: 'eat_better', struggles: [], cuisines: [], allergens: ['peanut', 'shellfish'], diets: ['vegan'], budget: 2, considerations: [], createdAt: '' },
      history: [{ mealId: 'burrito-bowl', kind: 'accepted', at: NOW.toISOString() }],
      plan: { mealId: 'burrito-bowl', mealTime: 'dinner', date: '2026-10-15', setting: 'takeout' },
    });
    for (let i = 0; i < 10_000; i++) {
      const chars = good.split('');
      const edits = 1 + Math.floor(r() * 6);
      for (let e = 0; e < edits; e++) {
        const at = Math.floor(r() * chars.length);
        const op = r();
        if (op < 0.33) chars.splice(at, 1);
        else if (op < 0.66) chars.splice(at, 0, '{}[]",:0aZ'[Math.floor(r() * 10)]);
        else chars[at] = '{}[]",:0aZ'[Math.floor(r() * 10)];
      }
      const s = parseStored(chars.join(''));
      if (s.profile) {
        // Fail safe: if the allergy list survived parsing, it only contains real allergens.
        for (const a of s.profile.allergens) expect(ALL_ALLERGENS).toContain(a);
        const ctx: Context = { setting: 'restaurant', mealTime: 'dinner', time: 20, budget: 2, hunger: 'normal', feeling: 'fine' };
        expect(() => recommend(s.profile!, ctx, { history: s.history as FeedbackEvent[], now: NOW })).not.toThrow();
      }
    }
  });
});
