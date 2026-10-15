import { ALL_ALLERGENS } from '../catalog';
import { combineProfiles, sanitizeMembers, type Member } from '../household';
import { recommend, violatesDiet } from '../recommend';
import type { Diet, Profile } from '../types';

const me: Profile = { goal: 'eat_better', struggles: [], cuisines: ['mexican', 'asian'], allergens: ['dairy'], diets: [], budget: 2, considerations: [], createdAt: '' };
const sam = (over: Partial<Member> = {}): Member => ({ id: 'm-sam', name: 'Sam', allergens: [], diets: [], cuisines: ['asian', 'italian'], ...over });

describe('eating together', () => {
  it('safety is the union of everyone; taste favors overlap', () => {
    const p = combineProfiles(me, [sam({ allergens: ['peanut'], diets: ['vegetarian'] })]);
    expect(p.allergens.sort()).toEqual(['dairy', 'peanut']);
    expect(p.diets).toEqual(['vegetarian']);
    expect(p.cuisines).toEqual(['asian']);
    expect(p.goal).toBe(me.goal);
  });

  it('no overlap in tastes → consider everyone’s favorites', () => {
    expect(combineProfiles(me, [sam({ cuisines: ['indian'] })]).cuisines.sort()).toEqual(['asian', 'indian', 'mexican']);
  });

  it.each(ALL_ALLERGENS)('never recommends a meal with the partner’s %s allergy, anywhere, any time', (a) => {
    const diets: Diet[][] = [[], ['vegetarian'], ['vegan']];
    for (const d of diets) {
      const p = combineProfiles(me, [sam({ allergens: [a], diets: d })]);
      for (const setting of ['home', 'takeout', 'restaurant', 'work', 'on_the_go'] as const)
        for (const mealTime of ['breakfast', 'lunch', 'dinner', 'snack'] as const)
          for (const time of [10, 20, 60] as const)
            for (const budget of [1, 2, 3, 4] as const) {
              const r = recommend(p, { setting, mealTime, time, budget, hunger: 'normal', feeling: 'fine' });
              for (const x of [r.primary, ...r.alternatives]) {
                if (!x) continue;
                expect(x.meal.contains).not.toContain(a);
                expect(x.meal.contains).not.toContain('dairy');
                expect(violatesDiet(x.meal, p)).toBe(false);
              }
            }
    }
  });

  it('hostile stored members are cleaned or dropped', () => {
    const out = sanitizeMembers([
      { id: 'm-1', name: '  Sam  ', allergens: ['peanut', 'uranium'], diets: ['vegan', 7], cuisines: 'x' },
      { id: '../../x', name: 'Bad id' },
      { id: 'm-2', name: '' },
      { id: 'm-3', name: 'A'.repeat(500) },
      null,
      ...Array.from({ length: 20 }, (_, i) => ({ id: `m-z${i}`, name: 'X' })),
    ]);
    expect(out[0]).toEqual({ id: 'm-1', name: 'Sam', allergens: ['peanut'], diets: ['vegan'], cuisines: [] });
    expect(out.find((m) => m.id === '../../x')).toBeUndefined();
    expect(out.find((m) => m.id === 'm-3')?.name.length).toBe(30);
    expect(out.length).toBeLessThanOrEqual(8);
  });
});
