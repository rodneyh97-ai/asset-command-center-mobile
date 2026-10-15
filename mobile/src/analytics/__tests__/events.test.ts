import { summarize, summaryText, type AnalyticsEvent } from '../events';

const day = (d: number, h = 12) => new Date(Date.UTC(2026, 9, 1 + d, h)).toISOString();

describe('analytics summary', () => {
  const events: AnalyticsEvent[] = [
    { name: 'app_open', at: day(0) },
    { name: 'onboarding_completed', at: day(0) },
    { name: 'recommendation_shown', at: day(0) },
    { name: 'recommendation_accepted', at: day(0), props: { msSinceStart: 9000 } },
    { name: 'app_open', at: day(1) },
    { name: 'recommendation_shown', at: day(1) },
    { name: 'recommendation_swapped', at: day(1) },
    { name: 'recommendation_shown', at: day(1) },
    { name: 'recommendation_accepted', at: day(1), props: { msSinceStart: 15000 } },
    { name: 'app_open', at: day(7) },
    { name: 'repeat_meal', at: day(7) },
  ];

  it('computes validation metrics', () => {
    const s = summarize(events, new Date(day(8)));
    expect(s).toMatchObject({
      activated: true,
      activeDays: 3,
      returnedDay1: true,
      returnedDay7: true,
      returnedDay30: false,
      decisions: 3,
      acceptanceRate: 0.67,
      medianSecondsToDecision: 12,
      repeats: 1,
      swaps: 1,
    });
  });

  it('shared summary contains no dietary or health information', () => {
    const text = summaryText(events, new Date(day(8)));
    expect(text).not.toMatch(/allerg|peanut|vegan|vegetarian|weight|goal|medical/i);
  });
});
