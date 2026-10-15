import type { FeedbackEvent, Profile } from '../../engine';
import {
  initialState,
  nextMealSlot,
  parseStored,
  pendingRating,
  planStatus,
  quickPicksFor,
  recentMealIds,
  reducer,
  weeklyReflection,
} from '../state';

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

describe('undo', () => {
  it('removes only the most recent accept of that meal', () => {
    let s = reducer(initialState, { type: 'feedback', mealId: 'a', kind: 'accepted', at: hoursAgo(30) });
    s = reducer(s, { type: 'feedback', mealId: 'a', kind: 'saved', at: hoursAgo(29) });
    s = reducer(s, { type: 'feedback', mealId: 'a', kind: 'accepted', at: hoursAgo(1) });
    s = reducer(s, { type: 'undoAccept', mealId: 'a' });
    expect(s.history.map((e) => e.kind)).toEqual(['accepted', 'saved']);
    expect(reducer(s, { type: 'undoAccept', mealId: 'zzz' })).toBe(s);
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

describe('quick picks', () => {
  it('only offers meals possible where the user is eating', () => {
    const h: FeedbackEvent[] = [
      { mealId: 'sheet-pan-chicken', kind: 'saved', at: hoursAgo(5) },
      { mealId: 'burrito-bowl', kind: 'saved', at: hoursAgo(4) },
    ];
    const p = { ...profile, allergens: [] };
    expect(quickPicksFor(p, h, 'restaurant').map((q) => q.meal.id)).toEqual(['burrito-bowl']);
    expect(quickPicksFor(p, h, 'home').map((q) => q.meal.id)).toEqual(['sheet-pan-chicken']);
  });
});

describe('meal planning', () => {
  const at = (hhmm: string, day = 15) => new Date(`2026-10-${day}T${hhmm}:00`);

  it.each([
    ['03:00', 'breakfast', '2026-10-15'],
    ['08:00', 'lunch', '2026-10-15'],
    ['13:00', 'dinner', '2026-10-15'],
    ['18:00', 'breakfast', '2026-10-16'],
    ['23:30', 'breakfast', '2026-10-16'],
  ])('at %s the next meal to plan is %s on %s', (hhmm, mealTime, date) => {
    expect(nextMealSlot(at(hhmm))).toEqual({ mealTime, date });
  });

  it('plan is upcoming, then due at meal time, then quietly expires', () => {
    const plan = { mealId: 'burrito-bowl', mealTime: 'dinner' as const, date: '2026-10-15', setting: 'takeout' as const };
    expect(planStatus(plan, at('13:00'))).toBe('upcoming');
    expect(planStatus(plan, at('18:30'))).toBe('due');
    expect(planStatus(plan, at('01:00', 16))).toBe('due'); // late dinner still counts
    expect(planStatus(plan, at('04:00', 16))).toBe('expired');
  });

  it('plans survive a restart and junk plans are dropped', () => {
    const plan = { mealId: 'burrito-bowl', mealTime: 'dinner', date: '2026-10-15', setting: 'takeout' };
    const good = parseStored(JSON.stringify({ ...initialState, plan }));
    expect(good.plan).toEqual(plan);
    for (const bad of [{ ...plan, mealId: 'nope' }, { ...plan, mealTime: 'snack' }, { ...plan, date: 'tomorrow' }, 'x']) {
      expect(parseStored(JSON.stringify({ ...initialState, plan: bad })).plan).toBeNull();
    }
  });
});

