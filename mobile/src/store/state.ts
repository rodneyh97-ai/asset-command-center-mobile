// Pure app-state logic (no React, no storage) so it can be unit-tested.
import type { Context, FeedbackEvent, FeedbackKind, Profile } from '../engine';
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
  | { type: 'deleteAll' };

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
  }
}

export function defaultContext(profile: Profile): SavedContext {
  return { setting: 'home', hunger: 'normal', time: 15, budget: profile.budget, feeling: 'fine' };
}

/** Validate + migrate whatever was in storage. Anything unrecognised resets safely. */
export function parseStored(raw: string | null): AppState {
  if (!raw) return initialState;
  try {
    const data = JSON.parse(raw) as Partial<AppState>;
    if (typeof data !== 'object' || data === null || data.version !== SCHEMA_VERSION) return initialState;
    return {
      version: SCHEMA_VERSION,
      profile: isProfile(data.profile) ? data.profile : null,
      history: Array.isArray(data.history) ? data.history.filter(isFeedback) : [],
      lastContext: data.lastContext ?? null,
      analytics: Array.isArray(data.analytics) ? data.analytics : [],
    };
  } catch {
    return initialState;
  }
}

function isProfile(p: unknown): p is Profile {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return typeof o.goal === 'string' && Array.isArray(o.allergens) && Array.isArray(o.diets);
}

function isFeedback(e: unknown): e is FeedbackEvent {
  if (!e || typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  return typeof o.mealId === 'string' && typeof o.kind === 'string' && typeof o.at === 'string';
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
