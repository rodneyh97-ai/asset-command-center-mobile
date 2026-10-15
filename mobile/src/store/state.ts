// Pure app-state logic (no React, no storage) so it can be unit-tested.
import { CATALOG, safetyCheck, type Context, type FeedbackEvent, type FeedbackKind, type MealIdea, type Profile, type Setting } from '../engine';
import { isSaved } from '../engine/recommend';
import { sanitizeContext, sanitizeFeedback, sanitizeProfile } from '../engine/validate';
import type { AnalyticsEvent } from '../analytics/events';

export const SCHEMA_VERSION = 1;
const MAX_HISTORY = 1000;
const MAX_ANALYTICS = 2000;

export type SavedContext = Omit<Context, 'mealTime'>;

export interface AppState {
  version: number;
  profile: Profile | null;
  history: FeedbackEvent[];
  /** Last context the user picked; used as the default next time so they don't re-answer. */
  lastContext: SavedContext | null;
  analytics: AnalyticsEvent[];
  /**
   * Raw stored data we couldn't read (newer app version, corruption). Never persisted
   * as state; the provider copies it to a backup key before anything overwrites it.
   */
  unreadable?: string;
}

export const initialState: AppState = {
  version: SCHEMA_VERSION,
  profile: null,
  history: [],
  lastContext: null,
  analytics: [],
};

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'completeOnboarding'; profile: Profile }
  | { type: 'updateProfile'; patch: Partial<Omit<Profile, 'createdAt'>> }
  | { type: 'setLastContext'; context: SavedContext }
  | { type: 'feedback'; mealId: string; kind: FeedbackKind; at: string }
  | { type: 'track'; event: AnalyticsEvent }
  | { type: 'deleteAll' }
  | { type: 'clearHidden' }
  | { type: 'undoAccept'; mealId: string };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'completeOnboarding':
      return { ...state, profile: action.profile, lastContext: state.lastContext ?? defaultContext(action.profile) };
    case 'updateProfile':
      if (!state.profile) return state;
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case 'setLastContext':
      return { ...state, lastContext: action.context };
    case 'feedback':
      return {
        ...state,
        history: [...state.history, { mealId: action.mealId, kind: action.kind, at: action.at }].slice(-MAX_HISTORY),
      };
    case 'track':
      return { ...state, analytics: [...state.analytics, action.event].slice(-MAX_ANALYTICS) };
    case 'deleteAll':
      return initialState;
    case 'undoAccept': {
      const i = state.history.map((e) => e.mealId === action.mealId && e.kind === 'accepted').lastIndexOf(true);
      if (i === -1) return state;
      return { ...state, history: [...state.history.slice(0, i), ...state.history.slice(i + 1)] };
    }
    case 'clearHidden':
      return { ...state, history: state.history.filter((e) => e.kind !== 'disliked') };
  }
}

export function defaultContext(profile: Profile): SavedContext {
  return { setting: 'home', hunger: 'normal', time: 15, budget: profile.budget, feeling: 'fine' };
}

/** Validate + migrate whatever was in storage. Unreadable data is kept aside, never dropped silently. */
export function parseStored(raw: string | null): AppState {
  if (!raw) return initialState;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...initialState, unreadable: raw };
  }
  if (!data || typeof data !== 'object' || (data as { version?: unknown }).version !== SCHEMA_VERSION) {
    return { ...initialState, unreadable: raw };
  }
  const d = data as Record<string, unknown>;
  const profile = d.profile == null ? null : sanitizeProfile(d.profile);
  if (d.profile != null && !profile) return { ...initialState, unreadable: raw };
  return {
    version: SCHEMA_VERSION,
    profile,
    history: Array.isArray(d.history)
      ? d.history.map(sanitizeFeedback).filter((e): e is FeedbackEvent => !!e).slice(-MAX_HISTORY)
      : [],
    lastContext: sanitizeContext(d.lastContext),
    analytics: Array.isArray(d.analytics)
      ? d.analytics
          .filter(
            (e): e is AnalyticsEvent =>
              !!e && typeof e === 'object' && typeof (e as AnalyticsEvent).name === 'string' && typeof (e as AnalyticsEvent).at === 'string',
          )
          .slice(-MAX_ANALYTICS)
      : [],
  };
}

export interface QuickPick {
  meal: MealIdea;
  saved: boolean;
  cautions: string[];
}

/** Saved + recent meals for one-tap repeat that are possible where the user is and safe for them today. */
export function quickPicksFor(profile: Profile, history: FeedbackEvent[], setting: Setting, limit = 4): QuickPick[] {
  const ids = [...CATALOG.filter((m) => isSaved(m.id, history)).map((m) => m.id), ...recentMealIds(history)];
  const out: QuickPick[] = [];
  for (const id of new Set(ids)) {
    const meal = CATALOG.find((m) => m.id === id);
    if (!meal || !meal.settings.includes(setting)) continue; // only meals possible where the user is
    const safety = safetyCheck(meal, profile, setting);
    if (!safety.ok) continue;
    out.push({ meal, saved: isSaved(id, history), cautions: safety.cautions });
    if (out.length >= limit) break;
  }
  return out;
}

/** Most recent accepted meal ids, newest first, de-duplicated. */
export function recentMealIds(history: FeedbackEvent[], limit = 5): string[] {
  const out: string[] = [];
  for (let i = history.length - 1; i >= 0 && out.length < limit; i--) {
    const e = history[i];
    if (e.kind === 'accepted' && !out.includes(e.mealId)) out.push(e.mealId);
  }
  return out;
}

/** The last accepted meal if it hasn't been rated yet and was at least an hour ago. */
export function pendingRating(history: FeedbackEvent[], now: Date): FeedbackEvent | null {
  let idx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].kind === 'accepted') {
      idx = i;
      break;
    }
  }
  if (idx === -1) return null;
  const last = history[idx];
  const rated = history
    .slice(idx + 1)
    .some((e) => e.mealId === last.mealId && (e.kind === 'loved' || e.kind === 'fine' || e.kind === 'disliked'));
  if (rated) return null;
  const age = now.getTime() - Date.parse(last.at);
  // Ask after the meal, but not about something from days ago.
  if (age < 60 * 60 * 1000 || age > 3 * 24 * 60 * 60 * 1000) return null;
  return last;
}

/** Positive, guilt-free summary of the last 7 days. */
export function weeklyReflection(history: FeedbackEvent[], now: Date) {
  const since = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const accepted = history.filter((e) => e.kind === 'accepted' && Date.parse(e.at) >= since);
  const days = new Set(accepted.map((e) => e.at.slice(0, 10)));
  return { decisions: accepted.length, activeDays: days.size };
}
