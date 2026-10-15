// Progress & habits, computed from on-device history. Positive and guilt-free:
// counts what went well; no streaks to break, no "missed" days highlighted.
import { CATALOG, isSaved, type FeedbackEvent, type Feeling, type MealIdea } from '../engine';
import { localDate } from './state';

const DAY = 24 * 60 * 60 * 1000;
const MOOD_SCORE: Record<Feeling, number> = { stressed: 1, tired: 2, comfort: 2.5, fine: 3, energized: 4 };

export interface Progress {
  decisions: number;
  favoritesUsed: number;
  activeDays: number;
  /** Last 7 days, oldest first. score 0 = no data that day. */
  mood: { label: string; date: string; score: number; feeling: Feeling | null }[];
  topMeals: { meal: MealIdea; count: number }[];
}

export function progressFor(history: FeedbackEvent[], now: Date, days: 7 | 30): Progress {
  const since = now.getTime() - days * DAY;
  const accepted = history.filter((e) => e.kind === 'accepted' && Date.parse(e.at) >= since);
  const counts = new Map<string, number>();
  for (const e of accepted) counts.set(e.mealId, (counts.get(e.mealId) ?? 0) + 1);
  const topMeals = [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ meal: CATALOG.find((m) => m.id === id), count }))
    .filter((x): x is { meal: MealIdea; count: number } => !!x.meal)
    .slice(0, 3);

  const mood: Progress['mood'] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = localDate(d);
    const that = history.filter((e) => e.kind === 'accepted' && e.feeling && localDate(new Date(e.at)) === key);
    const last = that.at(-1)?.feeling ?? null;
    mood.push({ label: d.toLocaleDateString('en-US', { weekday: 'short' }), date: key, score: last ? MOOD_SCORE[last] : 0, feeling: last });
  }

  return {
    decisions: accepted.length,
    favoritesUsed: accepted.filter((e) => isSaved(e.mealId, history)).length,
    activeDays: new Set(accepted.map((e) => localDate(new Date(e.at)))).size,
    mood,
    topMeals,
  };
}
