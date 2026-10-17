import type { FeedbackEvent } from '../../engine';
import { initialState, type AppState } from '../../store/state';
import type { Food, Place } from '../client';
import { placeCuisines, rankFoods, rankPlaces, tasteFor } from '../personalize';

const now = new Date('2026-10-17T12:00:00Z');
const at = now.toISOString();
const mem = (id: string, subject: string, topic: string, value: string) => ({ id, subject, topic, value, kind: 'stated', source: 'manual', createdAt: at, updatedAt: at });
const food = (id: number, name: string): Food => ({ id, source: 'usda_fdc', name, brand: null, allergens: [], allergensKnown: false, mayContain: [], nutrients: {}, verified: true });
const place = (id: number, cuisines: string[], lat: number): Place => ({ id, kind: 'restaurant', name: `P${id}`, cuisines, lat, lon: 0, street: null });
const base = (over: Partial<AppState>): AppState => ({
  ...initialState,
  profile: { goal: 'eat_better', struggles: [], cuisines: [], allergens: [], diets: [], budget: 2, considerations: [], createdAt: at },
  ...over,
});

describe('library follows what EatOS learned', () => {
  it('dislikes (mine and my partner’s when eating together) sink with a reason; likes rise', () => {
    const state = base({
      members: [{ id: 'm-sam', name: 'Sam', allergens: [], diets: [], cuisines: [] }] as AppState['members'],
      eatingWith: ['m-sam'],
      memories: [mem('1', 'me', 'like_food', 'rice'), mem('2', 'm-sam', 'dislike_food', 'mushrooms')] as AppState['memories'],
    });
    const t = tasteFor(state, now);
    const ranked = rankFoods([food(1, 'Soup, mushroom'), food(2, 'Bread, white'), food(3, 'Rice, brown, cooked')], t);
    expect(ranked.map((r) => r.item.id)).toEqual([3, 2, 1]);
    expect(ranked[0].reason).toBe('You like rice');
    expect(ranked[2]).toMatchObject({ disliked: true, reason: 'You said you don’t like mushrooms' });
  });

  it('without signals, the server’s relevance order is kept', () => {
    const foods = [food(1, 'A'), food(2, 'B'), food(3, 'C')];
    expect(rankFoods(foods, tasteFor(base({}), now)).map((r) => r.item.id)).toEqual([1, 2, 3]);
  });

  it('learned cuisine affinity moves liked places up, but never past something much closer', () => {
    const history: FeedbackEvent[] = Array.from({ length: 8 }, (_, i) => ({ mealId: 'burrito-bowl', kind: 'loved', at: new Date(now.getTime() - i * 86400000).toISOString() }));
    const t = tasteFor(base({ history }), now);
    expect((t.cuisine.mexican ?? 0)).toBeGreaterThan(0.5);
    const places = [place(1, ['burger'], 0.5), place(2, ['mexican'], 1.0), place(3, ['mexican'], 4.0)];
    const miles = (p: Place) => p.lat;
    const r = rankPlaces(places, miles, t, null);
    expect(r[0].item.id).toBe(2); // 1.0 mi Mexican beats 0.5 mi burgers for a Mexican lover
    expect(r[0].reason).toBe('You like Mexican');
    expect(r[r.length - 1].item.id).toBe(3); // 4 mi Mexican doesn't jump the queue
  });

  it('turning off learning from behavior stops behavior-based ordering', () => {
    const history: FeedbackEvent[] = Array.from({ length: 8 }, () => ({ mealId: 'burrito-bowl', kind: 'loved', at }));
    const t = tasteFor(base({ history, personalization: { learnFromBehavior: false, trackMood: true } }), now);
    expect(t.cuisine.mexican ?? 0).toBe(0);
  });

  it('a guess the user rejected is never used', () => {
    const history: FeedbackEvent[] = Array.from({ length: 8 }, () => ({ mealId: 'burrito-bowl', kind: 'loved', at }));
    const t = tasteFor(base({ history, memories: [mem('1', 'me', 'not_true', 'cuisine:mexican')] as AppState['memories'] }), now);
    expect(t.cuisine.mexican ?? 0).toBe(0);
  });

  it('my grocery store stays first; OSM cuisine tags map to EatOS cuisines', () => {
    const r = rankPlaces([place(1, [], 0.1), place(2, [], 3)], (p) => p.lat, tasteFor(base({}), now), 2);
    expect(r[0]).toMatchObject({ reason: 'Your grocery store' });
    expect(placeCuisines({ cuisines: ['tex_mex', 'pizza', 'sushi', 'unknown'] })).toEqual(['mexican', 'italian', 'japanese']);
  });
});

it('matches singular and plural forms of liked/disliked foods', () => {
  const t = { cuisine: {}, likes: [], dislikes: ['mushrooms', 'eggs', 'hummus', 'olives'] as never };
  const r = rankFoods([food(1, 'Mushroom, raw'), food(2, 'Egg, whole'), food(3, 'Hummus, commercial'), food(4, 'Olive oil'), food(5, 'Rice')], t);
  expect(r.filter((x) => x.disliked).map((x) => x.item.id).sort()).toEqual([1, 2, 3, 4]);
});
