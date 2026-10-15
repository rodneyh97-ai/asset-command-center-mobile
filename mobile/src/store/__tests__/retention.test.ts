import type { FeedbackEvent, Profile } from '../../engine';
import {
  daysSinceStart,
  initialState,
  learnedCount,
  parseStored,
  reducer,
  reviewDue,
  setupDue,
  usageAskDue,
  weekProgress,
  weeklyGoalAskDue,
  weeksGoalReached,
  weekStart,
  type AppState,
} from '../state';

const profile: Profile = { goal: 'eat_better', struggles: [], cuisines: [], allergens: [], diets: [], budget: 2, considerations: [], createdAt: '2026-10-01T12:00:00' };
const ev = (at: string, over: Partial<FeedbackEvent> = {}): FeedbackEvent => ({ mealId: 'burrito-bowl', kind: 'accepted', at: new Date(at).toISOString(), ...over });
const withState = (over: Partial<AppState>): AppState => ({ ...initialState, profile, ...over });

describe('short onboarding → setup later', () => {
  it('new profiles start with setup not done; setup is offered only after the first meal', () => {
    const s = reducer(initialState, { type: 'completeOnboarding', profile });
    expect(s.setup.done).toBe(false);
    const now = new Date('2026-10-02T12:00:00');
    expect(setupDue(s, now)).toBe(false);
    const after = { ...s, history: [ev('2026-10-02T11:00:00')] };
    expect(setupDue(after, now)).toBe(true);
  });

  it('"Later" hides it for two days; done hides it for good', () => {
    const s = withState({ setup: { done: false, snoozeUntil: null }, history: [ev('2026-10-02T11:00:00')] });
    const snoozed = reducer(s, { type: 'setupSnooze', until: '2026-10-04T12:00:00.000Z' });
    expect(setupDue(snoozed, new Date('2026-10-03T12:00:00Z'))).toBe(false);
    expect(setupDue(snoozed, new Date('2026-10-05T12:00:00Z'))).toBe(true);
    expect(setupDue(reducer(snoozed, { type: 'setupDone' }), new Date('2026-10-05T12:00:00Z'))).toBe(false);
  });

  it('profiles saved before the short onboarding already answered everything', () => {
    const legacy = parseStored(JSON.stringify({ version: 1, profile, history: [] }));
    expect(legacy.setup.done).toBe(true);
    expect(parseStored(JSON.stringify({ version: 1, profile: null })).setup.done).toBe(false);
  });
});

describe('anonymous usage sharing', () => {
  it('is asked once, only when a server exists, after the first meal', () => {
    const s = withState({ history: [ev('2026-10-02T11:00:00')] });
    expect(usageAskDue(s, false)).toBe(false);
    expect(usageAskDue(s, true)).toBe(true);
    expect(usageAskDue(reducer(s, { type: 'setUsageSharing', on: false }), true)).toBe(false);
  });

  it('turning it off forgets the random id and sent days', () => {
    let s = reducer(initialState, { type: 'setUsageSharing', on: true, installId: '00000000-0000-4000-8000-000000000001' });
    s = reducer(s, { type: 'usageSent', day: 0 });
    expect(s.usageSharing).toMatchObject({ on: true, sentDays: [0] });
    s = reducer(s, { type: 'setUsageSharing', on: false });
    expect(s.usageSharing).toEqual({ on: false, asked: true, installId: null, sentDays: [] });
  });

  it('storage can’t turn sharing on without a valid id, or smuggle junk', () => {
    const p = (u: unknown) => parseStored(JSON.stringify({ version: 1, profile, usageSharing: u })).usageSharing;
    expect(p({ on: true, installId: 'not-a-uuid' }).on).toBe(false);
    expect(p({ on: true, installId: '00000000-0000-4000-8000-000000000001', sentDays: [0, -1, 1.5, 'x', 3] }).sentDays).toEqual([0, 3]);
  });

  it('day numbers are whole local days since the profile was created', () => {
    expect(daysSinceStart('2026-10-01T23:59:00', new Date('2026-10-01T00:01:00'))).toBe(0);
    expect(daysSinceStart('2026-10-01T23:59:00', new Date('2026-10-02T00:01:00'))).toBe(1);
    expect(daysSinceStart('2026-10-01T12:00:00', new Date('2026-10-31T08:00:00'))).toBe(30);
  });
});

describe('forgiving weekly goals', () => {
  const thu = new Date('2026-10-15T18:00:00'); // week starts Mon 12 Oct

  it('weeks start on Monday', () => {
    expect(weekStart(thu).toDateString()).toBe(new Date('2026-10-12T00:00:00').toDateString());
    expect(weekStart(new Date('2026-10-18T23:00:00')).toDateString()).toBe(new Date('2026-10-12T00:00:00').toDateString());
  });

  it('counts only this week, by goal type', () => {
    const history = [
      ev('2026-10-09T18:00:00', { setting: 'home' }), // last week
      ev('2026-10-12T18:00:00', { setting: 'home' }),
      ev('2026-10-13T18:00:00', { setting: 'takeout', with: ['m1'] }),
      ev('2026-10-14T18:00:00', { setting: 'home', mealId: 'poke-bowl' }),
      ev('2026-10-14T19:00:00', { kind: 'loved' }),
    ];
    const p = (kind: 'cook_home' | 'eat_together' | 'try_new' | 'decide', target = 3) => weekProgress(withState({ history, weeklyGoal: { kind, target } }), thu);
    expect(p('cook_home')).toEqual({ count: 2, target: 3, done: false });
    expect(p('eat_together', 1)).toEqual({ count: 1, target: 1, done: true });
    expect(p('try_new')!.count).toBe(1); // burrito bowl was had last week; poke bowl is new
    expect(p('decide')!.count).toBe(3);
  });

  it('counts past weeks reached, never "missed"', () => {
    const history = [ev('2026-10-05T18:00:00'), ev('2026-10-06T18:00:00'), ev('2026-09-21T18:00:00')];
    expect(weeksGoalReached(withState({ history, weeklyGoal: { kind: 'decide', target: 2 } }), thu)).toBe(1);
  });

  it('is offered after 3 meals, once', () => {
    const history = [ev('2026-10-12T18:00:00'), ev('2026-10-13T18:00:00'), ev('2026-10-14T18:00:00')];
    expect(weeklyGoalAskDue(withState({ history: history.slice(0, 2) }))).toBe(false);
    expect(weeklyGoalAskDue(withState({ history }))).toBe(true);
    expect(weeklyGoalAskDue(reducer(withState({ history }), { type: 'setWeeklyGoal', goal: null }))).toBe(false);
  });

  it('stored goals are validated', () => {
    const g = (x: unknown) => parseStored(JSON.stringify({ version: 1, profile, weeklyGoal: x })).weeklyGoal;
    expect(g({ kind: 'cook_home', target: 3 })).toEqual({ kind: 'cook_home', target: 3 });
    expect(g({ kind: 'cook_home', target: 99 })).toBeNull();
    expect(g({ kind: '__proto__', target: 3 })).toBeNull();
    expect(g({ kind: 'toString', target: 3 })).toBeNull();
  });
});

describe('welcome back', () => {
  it('shows after 10+ days away, not after a normal gap, and is never restored from storage', () => {
    let s = withState({ lastOpenAt: '2026-10-01T12:00:00.000Z' });
    expect(reducer(s, { type: 'opened', at: '2026-10-05T12:00:00.000Z' }).welcomeBack).toBe(false);
    s = reducer(s, { type: 'opened', at: '2026-10-12T12:00:00.000Z' });
    expect(s.welcomeBack).toBe(true);
    expect(parseStored(JSON.stringify({ ...s, welcomeBack: true })).welcomeBack).toBe(false);
    expect(reducer(s, { type: 'dismissWelcomeBack' }).welcomeBack).toBe(false);
  });
});

describe('rating prompt', () => {
  const good = [ev('2026-10-02T12:00:00'), ev('2026-10-03T12:00:00'), ev('2026-10-04T12:00:00'), ev('2026-10-04T14:00:00', { kind: 'loved' })];
  const now = new Date('2026-10-05T12:00:00');

  it('only after 3 meals, a "loved", and 3+ days', () => {
    expect(reviewDue(withState({ history: good }), now)).toBe(true);
    expect(reviewDue(withState({ history: good.filter((e) => e.kind !== 'loved') }), now)).toBe(false);
    expect(reviewDue(withState({ history: good.slice(1) }), now)).toBe(false);
    expect(reviewDue(withState({ history: good, profile: { ...profile, createdAt: '2026-10-04T00:00:00' } }), now)).toBe(false);
  });

  it('never twice within 120 days, never more than 3 times', () => {
    const asked = reducer(withState({ history: good }), { type: 'reviewPrompted', at: now.toISOString() });
    expect(reviewDue(asked, new Date('2026-12-01T12:00:00'))).toBe(false);
    expect(reviewDue(asked, new Date('2027-03-01T12:00:00'))).toBe(true);
    expect(reviewDue(withState({ history: good, reviewPrompts: ['2020-01-01T00:00:00Z', '2021-01-01T00:00:00Z', '2022-01-01T00:00:00Z'] }), now)).toBe(false);
  });
});

describe('visible learning', () => {
  it('counts the user’s memories and open guesses, not rejected ones', () => {
    const at = '2026-10-01T00:00:00.000Z';
    const mem = (id: string, topic: string, value: string) => ({ id, subject: 'me', topic, value, kind: 'stated', source: 'manual', createdAt: at, updatedAt: at });
    const s = withState({
      memories: [mem('a', 'dislike_food', 'olives'), mem('b', 'like_food', 'rice'), mem('c', 'not_true', 'cuisine:mexican')] as AppState['memories'],
      personalization: { learnFromBehavior: false, trackMood: true },
    });
    expect(learnedCount(s, new Date('2026-10-05T00:00:00Z'))).toBe(2);
  });
});
