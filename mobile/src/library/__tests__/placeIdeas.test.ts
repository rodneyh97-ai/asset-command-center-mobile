import { recommend } from '../../engine/recommend';
import type { Context, Profile } from '../../engine/types';
import type { Place } from '../client';
import { ideasForPlace, ideasForRow, ideasWithLabel } from '../placeIdeas';

const me: Profile = { goal: 'eat_better', struggles: [], cuisines: [], allergens: [], diets: [], budget: 3, considerations: [], createdAt: '2026-10-01T00:00:00Z' };
const ctx: Context = { setting: 'takeout', hunger: 'normal', time: 20, budget: 3, feeling: 'fine', mealTime: 'dinner' };
const safe = (p: Profile = me, c: Context = ctx) => {
  const r = recommend(p, c, { now: new Date('2026-10-17T18:00:00') });
  return [r.primary!, ...r.alternatives, ...(r.more ?? [])];
};
const place = (id: number, kind: Place['kind'], cuisines: string[]): Place => ({ id, kind, name: `p${id}`, cuisines, lat: 39.1, lon: -94.58, street: null });

describe('ideas on place cards', () => {
  it('a burger joint, a sub shop and a BBQ spot show different dishes, not one "American" list', () => {
    const ideas = safe();
    const burger = ideasForPlace(place(1, 'fast_food', ['burger']), ideas).map((r) => r.meal.id);
    const sub = ideasForPlace(place(2, 'fast_food', ['sandwich']), ideas).map((r) => r.meal.id);
    const bbq = ideasForPlace(place(3, 'restaurant', ['barbecue']), ideas).map((r) => r.meal.id);
    expect(burger[0]).not.toBe(sub[0]);
    expect(bbq.slice(0, 3).some((id) => id.startsWith('bbq-'))).toBe(true);
    expect(sub.slice(0, 3).some((id) => /sub|sandwich|soup/.test(id))).toBe(true);
    expect(new Set([burger.join(), sub.join(), bbq.join()]).size).toBe(3);
  });

  it('places with no food tag still get ideas that fit the kind of place', () => {
    const cafe = ideasWithLabel(place(4, 'cafe', []), safe(me, { ...ctx, mealTime: 'breakfast' }));
    expect(cafe.label).toBe('cafés');
    expect(cafe.ideas.length).toBeGreaterThan(0);
    expect(ideasWithLabel(place(5, 'restaurant', []), safe()).ideas.length).toBeGreaterThanOrEqual(4);
  });

  it('only ever shows meals that already passed this person’s safety checks', () => {
    const allergic: Profile = { ...me, allergens: ['gluten', 'dairy'] };
    const ideas = safe(allergic);
    const ok = new Set(ideas.map((r) => r.meal.id));
    for (const tags of [['burger'], ['pizza'], ['barbecue'], ['sandwich'], ['breakfast'], []])
      for (const r of ideasForPlace(place(9, 'restaurant', tags), ideas)) {
        expect(ok.has(r.meal.id)).toBe(true);
        expect(r.meal.contains).not.toContain('gluten');
        expect(r.meal.contains).not.toContain('dairy');
      }
  });

  it('a row of same-kind places varies its top picks instead of repeating one', () => {
    const row = ideasForRow([1, 2, 3, 4].map((i) => place(i, 'fast_food', ['burger'])), safe());
    expect(new Set(row.map((r) => r.ideas[0].meal.id)).size).toBeGreaterThan(1);
  });
});
