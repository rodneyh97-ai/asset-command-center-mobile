import { INGREDIENTS, ingredientsOf } from '../ingredients';
import { recommend } from '../recommend';
import type { Context, Profile } from '../types';
import { understandFoodText, understandMood } from '../understand';

describe('what are you in the mood for?', () => {
  it('reads mood, hunger, time and cravings', () => {
    const m = understandMood('tired and starving, want something cheesy and quick, nothing spicy');
    expect(m.patch).toEqual({ feeling: 'tired', hunger: 'very', time: 10 });
    expect(m.foods).toEqual(['cheese']);
    expect(m.avoid).toEqual(['spicy']);
  });
  it('“no time” is about time, not a dislike; places and budget are read too', () => {
    const m = understandMood('no time, ordering in, something cheap, craving thai');
    expect(m.patch).toEqual({ time: 10, setting: 'takeout', budget: 1 });
    expect(m.cuisines).toEqual(['thai']);
    expect(m.avoid).toEqual([]);
  });
  it('steers one recommendation toward the craving and away from what to avoid, never past allergies', () => {
    const p: Profile = { goal: 'eat_better', struggles: [], cuisines: [], allergens: ['dairy'], diets: [], budget: 3, considerations: [], createdAt: '' };
    const ctx: Context = { setting: 'home', hunger: 'normal', time: 60, budget: 3, feeling: 'fine', mealTime: 'dinner' };
    const r = recommend(p, ctx, { craving: { foods: ['cheese', 'lentils'], cuisines: [], avoid: ['rice'] } });
    const all = [r.primary!, ...r.alternatives];
    expect(r.primary!.reasons.join(' ')).toMatch(/you said you wanted/);
    for (const x of all) expect(x.meal.contains).not.toContain('dairy');
    for (const x of all) expect(ingredientsOf(x.meal.id)).not.toContain('rice');
  });
});

describe('understanding typed answers', () => {
  it('reads likes and dislikes from one sentence, each food taking the nearest feeling', () => {
    const u = understandFoodText('I like chicken and hate fish');
    expect(u.likes).toEqual(['chicken']);
    expect(u.dislikes).toEqual(['fish']);
    const v = understandFoodText('love tacos, but I can’t stand cilantro or onions');
    expect(v.cuisines).toEqual(['mexican']);
    expect(v.dislikes).toEqual(['cilantro', 'onion']);
  });

  it('“don’t like” is a dislike, not a like', () => {
    expect(understandFoodText("I don't like mushrooms").dislikes).toEqual(['mushrooms']);
    expect(understandFoodText("I don't like mushrooms").likes).toEqual([]);
  });

  it('a bare list takes the meaning of where it was typed', () => {
    expect(understandFoodText('olives, raw tomatoes', 'dislike').dislikes).toEqual(['olives', 'tomato']);
    expect(understandFoodText('sushi and anything with cheese', 'like')).toMatchObject({ likes: ['cheese'], cuisines: ['japanese'] });
  });

  it('the later statement wins when a food is mentioned twice', () => {
    const u = understandFoodText('I hate eggs. Actually I love eggs');
    expect(u.likes).toEqual(['eggs']);
    expect(u.dislikes).toEqual([]);
  });

  it('allergies are found as allergens (to confirm), not as dislikes', () => {
    const u = understandFoodText('allergic to shrimp and peanuts');
    expect(u.allergens.sort()).toEqual(['peanut', 'shellfish']);
    expect(u.dislikes).toEqual([]);
    expect(understandFoodText('I have celiac').allergens).toEqual(['gluten']);
    expect(understandFoodText('allergic to nuts').allergens.sort()).toEqual(['peanut', 'tree_nut']);
    expect(understandFoodText('allergic to tree nuts').allergens).toEqual(['tree_nut']);
  });

  it('an allergy EatOS can’t screen for is flagged and kept as a note', () => {
    const u = understandFoodText('allergic to mustard');
    expect(u.allergens).toEqual([]);
    expect(u.unscreenedAllergy).toBe(true);
    expect(u.leftover).toBe(true);
    expect(understandFoodText('allergic to peanuts').unscreenedAllergy).toBe(false);
  });

  it('words it can’t match are kept as a note instead of being guessed', () => {
    expect(understandFoodText('I hate mushrooms and durian').leftover).toBe(true);
    expect(understandFoodText('I hate mushrooms').leftover).toBe(false);
    expect(understandFoodText('trying to eat more home cooked meals')).toMatchObject({ likes: [], dislikes: [], leftover: true });
  });

  it('only ever returns known ingredients, and survives odd input', () => {
    for (const s of ['', '!!!', 'a'.repeat(500), 'Ñandú 🍕 <script>', 'no no no', 'like like hate']) {
      const u = understandFoodText(s);
      for (const i of [...u.likes, ...u.dislikes]) expect(INGREDIENTS).toContain(i);
    }
  });
});
