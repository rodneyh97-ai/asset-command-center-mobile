import type { FeedbackEvent, Profile } from '../../engine';
import { initialState, parseStored, pendingRating, recentMealIds, reducer, weeklyReflection } from '../state';

const NOW = new Date('2026-10-15T18:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();
const profile: Profile = {
  goal: 'build_muscle',
  struggles: [],
  cuisines: [],
  allergens: ['peanut'],
  diets: [],
  budget: 2,
  considerations: [],
  createdAt: NOW.toISOString(),
};

describe('reducer', () => {
  it('completing onboarding saves the profile and sensible defaults', () => {
    const s = reducer(initialState, { type: 'completeOnboarding', profile });
    expect(s.profile).toEqual(profile);
    expect(s.lastContext).toMatchObject({ setting: 'home', budget: 2 });
  });

  it('goal only changes when explicitly updated; other edits keep it stable', () => {
    let s = reducer(initialState, { type: 'completeOnboarding', profile });
    s = reducer(s, { type: 'updateProfile', patch: { cuisines: ['mexican'], budget: 3 } });
    expect(s.profile?.goal).toBe('build_muscle');
    s = reducer(s, { type: 'updateProfile', patch: { goal: 'maintain' } });
    expect(s.profile?.goal).toBe('maintain');
    expect(s.profile?.allergens).toEqual(['peanut']);
  });

  it('delete wipes everything', () => {
    let s = reducer(initialState, { type: 'completeOnboarding', profile });
    s = reducer(s, { type: 'feedback', mealId: 'x', kind: 'saved', at: NOW.toISOString() });
    expect(reducer(s, { type: 'deleteAll' })).toEqual(initialState);
  });
});

describe('parseStored', () => {
  it('round-trips valid state', () => {
    const s = reducer(initialState, { type: 'completeOnboarding', profile });
    expect(parseStored(JSON.stringify(s))).toEqual(s);
  });

  it.each([null, '', 'not json', '{"version":999}', '[]', '{"version":1,"profile":{"goal":5}}'])(
    'safely handles bad data: %s',
    (raw) => {
      const s = parseStored(raw);
      expect(s.profile).toBeNull();
      expect(Array.isArray(s.history)).toBe(true);
    },
  );

  it('drops malformed history entries', () => {
    const raw = JSON.stringify({ ...initialState, history: [{ mealId: 'a', kind: 'saved', at: NOW.toISOString() }, { mealId: 'b', kind: 'saved', at: 'not-a-date' }, { nope: 1 }] });
    expect(parseStored(raw).history).toHaveLength(1);
  });
});

describe('retention helpers', () => {
  const h: FeedbackEvent[] = [
    { mealId: 'a', kind: 'accepted', at: hoursAgo(50) },
    { mealId: 'b', kind: 'accepted', at: hoursAgo(26) },
    { mealId: 'a', kind: 'accepted', at: hoursAgo(3) },
  ];

  it('recent meals are newest-first and unique', () => {
    expect(recentMealIds(h)).toEqual(['a', 'b']);
  });

  it('asks for a rating after the last meal, once', () => {
    expect(pendingRating(h, NOW)?.mealId).toBe('a');
    const rated = [...h, { mealId: 'a', kind: 'loved' as const, at: hoursAgo(1) }];
    expect(pendingRating(rated, NOW)).toBeNull();
  });

  it('does not ask right after choosing, or days later', () => {
    expect(pendingRating([{ mealId: 'a', kind: 'accepted', at: hoursAgo(0.2) }], NOW)).toBeNull();
    expect(pendingRating([{ mealId: 'a', kind: 'accepted', at: hoursAgo(100) }], NOW)).toBeNull();
  });

  it('weekly reflection counts decisions and days', () => {
    expect(weeklyReflection(h, NOW)).toEqual({ decisions: 3, activeDays: 3 });
  });
});
