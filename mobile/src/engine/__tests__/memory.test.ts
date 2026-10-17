import { CATALOG } from '../catalog';
import { MEAL_INGREDIENTS, INGREDIENTS } from '../ingredients';
import { learnTaste } from '../learn';
import { activeMemories, dislikedFoodIn, newMemory, sanitizeMemories, upsertMemory } from '../memory';
import { nextQuestion } from '../questions';
import { recommend } from '../recommend';
import type { FeedbackEvent, Profile } from '../types';

const NOW = new Date('2026-10-15T18:30:00');
const me: Profile = { goal: 'eat_better', struggles: [], cuisines: [], allergens: [], diets: [], budget: 3, considerations: [], createdAt: '' };
const mem = (topic: Parameters<typeof newMemory>[0], value: string, extra: object = {}) => newMemory(topic, value, { source: 'manual', now: NOW, ...extra });

describe('ingredients', () => {
  it('every meal has ingredients from the controlled vocabulary', () => {
    for (const m of CATALOG) {
      expect({ id: m.id, n: (MEAL_INGREDIENTS[m.id] ?? []).length > 0 }).toEqual({ id: m.id, n: true });
      for (const i of MEAL_INGREDIENTS[m.id]) expect(INGREDIENTS).toContain(i);
    }
  });
  it('ingredient lists agree with what the meal text names', () => {
    const checks: [RegExp, string][] = [[/chicken/i, 'chicken'], [/salmon/i, 'salmon'], [/tofu/i, 'tofu'], [/avocado|guac/i, 'avocado'], [/potato/i, 'potato'], [/\beggs?\b|omelet/i, 'eggs']];
    for (const m of CATALOG)
      for (const [re, ing] of checks)
        if (re.test(`${m.name} ${m.summary}`.replace(/\bor \w+/gi, ""))) expect({ id: m.id, has: MEAL_INGREDIENTS[m.id].includes(ing as never) }).toEqual({ id: m.id, has: true });
  });
});

describe('memory store', () => {
  it('liking and disliking the same food: the newest statement wins', () => {
    let all = upsertMemory([], mem('dislike_food', 'olives'));
    all = upsertMemory(all, mem('like_food', 'olives'));
    expect(all.map((m) => m.topic)).toEqual(['like_food']);
  });
  it('confirming and rejecting the same guess are mutually exclusive', () => {
    let all = upsertMemory([], mem('not_true', 'cuisine:mexican'));
    all = upsertMemory(all, mem('confirmed_trait', 'cuisine:mexican', { kind: 'confirmed' }));
    expect(all.map((m) => m.topic)).toEqual(['confirmed_trait']);
  });
  it('temporary memories stop applying when they expire', () => {
    const t = mem('tradeoff', 'faster', { expiresInDays: 7 });
    expect(t.kind).toBe('temporary');
    expect(activeMemories([t], NOW)).toHaveLength(1);
    expect(activeMemories([t], new Date(NOW.getTime() + 8 * 86400000))).toHaveLength(0);
  });
  it('memories are scoped to their person', () => {
    const sam = mem('dislike_food', 'tofu', { subject: 'm-sam' });
    expect(activeMemories([sam], NOW, ['me'])).toHaveLength(0);
    expect(activeMemories([sam], NOW, ['me', 'm-sam'])).toHaveLength(1);
  });
  it('hostile or malformed stored memories are dropped', () => {
    const good = mem('dislike_food', 'olives');
    const out = sanitizeMemories(
      [good, { ...good, id: 'x2', value: 'uranium' }, { ...good, id: 'x3', subject: 'someone-else' }, { ...good, id: 'x4', topic: 'ssn' }, { ...good, id: 'x5', kind: 'temporary' }, null, 'x'],
      [],
    );
    expect(out).toEqual([good]);
  });
});

describe('memories change recommendations', () => {
  const all = (r: ReturnType<typeof recommend>) => [r.primary, ...r.alternatives].filter(Boolean).map((x) => x!.meal);
  it('a disliked food is never suggested, in any situation', () => {
    const d = [mem('dislike_food', 'mushrooms'), mem('dislike_food', 'beans')];
    for (const setting of ['home', 'takeout', 'restaurant', 'work', 'on_the_go'] as const)
      for (const mealTime of ['breakfast', 'lunch', 'dinner', 'snack'] as const)
        for (const m of all(recommend(me, { setting, mealTime, time: 60, budget: 4, hunger: 'normal', feeling: 'fine' }, { now: NOW, memories: d })))
          expect(dislikedFoodIn(m, d)).toBeNull();
  });
  it('"faster this week" favors low-effort meals and says why', () => {
    const r = recommend(me, { setting: 'home', mealTime: 'dinner', time: 60, budget: 3, hunger: 'normal', feeling: 'fine' }, { now: NOW, memories: [mem('tradeoff', 'faster', { expiresInDays: 7 })] });
    expect(r.primary!.meal.effort).not.toBe('medium');
    expect(r.primary!.reasons).toContain('Quick, like you asked for this week');
  });
  it('a pattern the user rejected is never learned', () => {
    const h: FeedbackEvent[] = Array.from({ length: 10 }, (_, i) => ({ mealId: 'burrito-bowl', kind: 'loved' as const, at: new Date(NOW.getTime() - i * 86400000).toISOString() }));
    expect(learnTaste(h, CATALOG, NOW).affinity.get('cuisine:mexican')).toBeGreaterThan(0.4);
    expect(learnTaste(h, CATALOG, NOW, new Set(['cuisine:mexican'])).affinity.has('cuisine:mexican')).toBe(false);
  });
});

describe('one question at a time', () => {
  const created = new Date(NOW.getTime() - 3 * 86400000).toISOString();
  it('never on the first day, then one per day, skipped ones not repeated', () => {
    expect(nextQuestion({ done: {}, lastShownAt: null }, NOW.toISOString(), NOW)).toBeNull();
    expect(nextQuestion({ done: {}, lastShownAt: null }, created, NOW)?.id).toBe('tradeoff_week');
    expect(nextQuestion({ done: { tradeoff_week: NOW.toISOString() }, lastShownAt: NOW.toISOString() }, created, NOW)).toBeNull();
    const tomorrow = new Date(NOW.getTime() + 86400000);
    expect(nextQuestion({ done: { tradeoff_week: NOW.toISOString() }, lastShownAt: NOW.toISOString() }, created, tomorrow)?.id).toBe('dislikes');
  });
  it('weekly questions come back after their answer expires', () => {
    const all = { tradeoff_week: NOW.toISOString(), dislikes: NOW.toISOString(), weeknight_cook: NOW.toISOString(), cooking_skill: NOW.toISOString(), name: NOW.toISOString(), likes: NOW.toISOString() };
    expect(nextQuestion({ done: all, lastShownAt: null }, created, new Date(NOW.getTime() + 2 * 86400000))).toBeNull();
    expect(nextQuestion({ done: all, lastShownAt: null }, created, new Date(NOW.getTime() + 8 * 86400000))?.id).toBe('tradeoff_week');
  });
});
