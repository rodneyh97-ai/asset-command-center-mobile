// Privacy-first product analytics.
// Events are stored on-device only. They never include allergies, diets, goals,
// or any free text — only what's needed to answer "is EatOS useful enough to come back to?"
// A remote sink (e.g. PostHog) can be added later behind explicit consent.

export type AnalyticsName =
  | 'app_open'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'decide_started'
  | 'recommendation_shown'
  | 'recommendation_accepted'
  | 'recommendation_swapped'
  | 'recommendation_empty'
  | 'meal_saved'
  | 'meal_disliked'
  | 'repeat_meal'
  | 'repeat_undone'
  | 'meal_rated'
  | 'meal_planned'
  | 'plan_followed'
  | 'plan_changed'
  | 'plan_missed'
  | 'reminders_changed'
  | 'checkin_completed'
  | 'checkin_snoozed'
  | 'alt_more_like'
  | 'alt_swap_ingredients'
  | 'alt_lower_cost'
  | 'alt_different'
  | 'premium_viewed'
  | 'premium_interest'
  | 'search_used'
  | 'app_lock_changed'
  | 'goal_changed';

export interface AnalyticsEvent {
  name: AnalyticsName;
  at: string;
  /** Only non-sensitive scalars. */
  props?: Record<string, string | number | boolean>;
}

const DAY = 24 * 60 * 60 * 1000;

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Per-user validation metrics, computed locally. */
export function summarize(events: AnalyticsEvent[], now: Date) {
  const by = (n: AnalyticsName) => events.filter((e) => e.name === n);
  const first = events[0] ? Date.parse(events[0].at) : now.getTime();
  const dayIndex = (e: AnalyticsEvent) => Math.floor((Date.parse(e.at) - first) / DAY);
  const opens = by('app_open');
  const activeDayIdx = new Set(opens.map(dayIndex));
  const shown = by('recommendation_shown').length;
  const accepted = by('recommendation_accepted');
  const decisionMs = accepted.map((e) => Number(e.props?.msSinceStart)).filter((n) => Number.isFinite(n));
  const ratings = by('meal_rated');

  return {
    daysSinceInstall: Math.floor((now.getTime() - first) / DAY),
    activated: by('recommendation_accepted').length > 0 || by('repeat_meal').length > 0,
    activeDays: activeDayIdx.size,
    returnedDay1: activeDayIdx.has(1),
    returnedDay7: [...activeDayIdx].some((d) => d >= 6 && d <= 8),
    returnedDay30: [...activeDayIdx].some((d) => d >= 28 && d <= 32),
    decisions: accepted.length + by('repeat_meal').length - by('repeat_undone').length,
    acceptanceRate: shown ? Math.round((accepted.length / shown) * 100) / 100 : null,
    medianSecondsToDecision: decisionMs.length ? Math.round(median(decisionMs)! / 1000) : null,
    repeats: by('repeat_meal').length - by('repeat_undone').length,
    swaps: by('recommendation_swapped').length,
    emptyResults: by('recommendation_empty').length,
    lovedRatings: ratings.filter((e) => e.props?.rating === 'loved').length,
    negativeRatings: ratings.filter((e) => e.props?.rating === 'disliked').length,
    plansMade: by('meal_planned').length,
    plansFollowed: by('plan_followed').length,
  };
}

export function summaryText(events: AnalyticsEvent[], now: Date): string {
  const s = summarize(events, now);
  return [
    'EatOS usage summary (no personal or dietary details included)',
    ...Object.entries(s).map(([k, v]) => `${k}: ${v ?? 'n/a'}`),
  ].join('\n');
}
