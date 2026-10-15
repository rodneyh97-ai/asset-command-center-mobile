// Pure app-state logic (no React, no storage) so it can be unit-tested.
import { CATALOG, safetyCheck, type Context, type FeedbackEvent, type FeedbackKind, type Feeling, type MealIdea, type MealTime, type Profile, type Setting } from '../engine';
import { combineProfiles, sanitizeMembers, type Member } from '../engine/household';
import { activeMemories, dislikedFoodIn, sanitizeMemories, upsertMemory, type Memory } from '../engine/memory';
import { isSaved } from '../engine/recommend';
import { sanitizeContext, sanitizeFeedback, sanitizeProfile, VALID } from '../engine/validate';
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
  /** The user's plan for their next meal (implementation intention), if any. */
  plan: MealPlan | null;
  /** Meals the user asked to be reminded about. Empty = reminders off (the default). */
  reminders: ('breakfast' | 'lunch' | 'dinner')[];
  /** Optional Face ID / fingerprint lock. Off by default. */
  appLock: boolean;
  /** When the owner last unlocked in this session. Never restored from storage, so cold starts are locked. */
  sessionUnlockedAt: number | null;
  /** Joined the EatOS+ waitlist (no payment is ever taken here). */
  premiumInterest: boolean;
  /** User consent for sending anonymous crash reports (only matters when a crash server is configured). */
  crashReports: boolean;
  /** People the user sometimes eats with (nicknames + food needs only). */
  members: Member[];
  /** Who's eating right now (member ids); empty = just me. */
  eatingWith: string[];
  /** Long-term personal memories (see engine/memory.ts). */
  memories: Memory[];
  /** User controls over personalization. */
  personalization: { learnFromBehavior: boolean; trackMood: boolean };
  /** One-question-at-a-time prompts: when each was answered/skipped, and the last time one was shown. */
  questions: { done: Record<string, string>; lastShownAt: string | null };
  /** Weekly reflection: when it last happened / was snoozed until. */
  checkin: { lastAt: string | null; snoozeUntil: string | null };
  /**
   * Raw stored data we couldn't read (newer app version, corruption). Never persisted
   * as state; the provider copies it to a backup key before anything overwrites it.
   */
  unreadable?: string;
}

export interface MealPlan {
  mealId: string;
  mealTime: Exclude<MealTime, 'snack'>;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  setting: Setting;
}

export const initialState: AppState = {
  version: SCHEMA_VERSION,
  profile: null,
  history: [],
  lastContext: null,
  analytics: [],
  plan: null,
  reminders: [],
  crashReports: true,
  members: [],
  eatingWith: [],
  memories: [],
  personalization: { learnFromBehavior: true, trackMood: true },
  questions: { done: {}, lastShownAt: null },
  appLock: false,
  sessionUnlockedAt: null,
  premiumInterest: false,
  checkin: { lastAt: null, snoozeUntil: null },
};

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'completeOnboarding'; profile: Profile }
  | { type: 'updateProfile'; patch: Partial<Omit<Profile, 'createdAt'>> }
  | { type: 'setLastContext'; context: SavedContext }
  | { type: 'feedback'; mealId: string; kind: FeedbackKind; at: string; setting?: Setting; mealTime?: MealTime; feeling?: Feeling; with?: string[]; source?: 'logged' }
  | { type: 'removeEvent'; mealId: string; at: string }
  | { type: 'track'; event: AnalyticsEvent }
  | { type: 'deleteAll' }
  | { type: 'clearHidden' }
  | { type: 'undoAccept'; mealId: string }
  | { type: 'setPlan'; plan: MealPlan }
  | { type: 'clearPlan' }
  | { type: 'setReminders'; meals: AppState['reminders'] }
  | { type: 'setCrashReports'; on: boolean }
  | { type: 'saveMember'; member: Member }
  | { type: 'removeMember'; id: string }
  | { type: 'setEatingWith'; ids: string[] }
  | { type: 'remember'; memory: Memory }
  | { type: 'forget'; id: string }
  | { type: 'setPersonalization'; patch: Partial<AppState['personalization']> }
  | { type: 'questionDone'; id: string; at: string }
  | { type: 'questionShown'; at: string }
  | { type: 'setAppLock'; on: boolean; at: number }
  | { type: 'unlocked'; at: number }
  | { type: 'setPremiumInterest'; on: boolean }
  | { type: 'checkinDone'; at: string }
  | { type: 'checkinSnooze'; until: string };

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
        history: [
          ...state.history,
          {
            mealId: action.mealId,
            kind: action.kind,
            at: action.at,
            ...(action.setting ? { setting: action.setting } : {}),
            ...(action.mealTime ? { mealTime: action.mealTime } : {}),
            ...(action.feeling ? { feeling: action.feeling } : {}),
            ...(action.with?.length ? { with: action.with } : {}),
            ...(action.source ? { source: action.source } : {}),
          },
        ].slice(-MAX_HISTORY),
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
    case 'setPlan':
      return { ...state, plan: action.plan };
    case 'clearPlan':
      return { ...state, plan: null };
    case 'setReminders':
      return { ...state, reminders: action.meals };
    case 'setAppLock':
      // Turning it on requires a successful check first, so this session counts as unlocked.
      return { ...state, appLock: action.on, sessionUnlockedAt: action.on ? action.at : null };
    case 'unlocked':
      return { ...state, sessionUnlockedAt: action.at };
    case 'setPremiumInterest':
      return { ...state, premiumInterest: action.on };
    case 'saveMember': {
      const exists = state.members.some((m) => m.id === action.member.id);
      return {
        ...state,
        members: exists ? state.members.map((m) => (m.id === action.member.id ? action.member : m)) : [...state.members, action.member],
      };
    }
    case 'removeMember':
      return {
        ...state,
        members: state.members.filter((m) => m.id !== action.id),
        memories: state.memories.filter((m) => m.subject !== action.id),
        eatingWith: state.eatingWith.filter((x) => x !== action.id),
      };
    case 'removeEvent':
      return { ...state, history: state.history.filter((e) => !(e.mealId === action.mealId && e.at === action.at)) };
    case 'remember':
      return { ...state, memories: upsertMemory(state.memories, action.memory) };
    case 'forget':
      return { ...state, memories: state.memories.filter((m) => m.id !== action.id) };
    case 'setPersonalization':
      return { ...state, personalization: { ...state.personalization, ...action.patch } };
    case 'questionDone':
      // Answering or skipping counts as today's question, so at most one per day.
      return { ...state, questions: { done: { ...state.questions.done, [action.id]: action.at }, lastShownAt: action.at } };
    case 'questionShown':
      return { ...state, questions: { ...state.questions, lastShownAt: action.at } };
    case 'setEatingWith':
      return { ...state, eatingWith: action.ids.filter((id) => state.members.some((m) => m.id === id)) };
    case 'setCrashReports':
      return { ...state, crashReports: action.on };
    case 'checkinDone':
      return { ...state, checkin: { lastAt: action.at, snoozeUntil: null } };
    case 'checkinSnooze':
      return { ...state, checkin: { ...state.checkin, snoozeUntil: action.until } };
    case 'clearHidden':
      return { ...state, history: state.history.filter((e) => e.kind !== 'disliked') };
  }
}

export function defaultContext(profile: Profile): SavedContext {
  return { setting: 'home', hunger: 'normal', time: 20, budget: profile.budget, feeling: 'fine' };
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
    plan: sanitizePlan(d.plan),
    reminders: Array.isArray(d.reminders)
      ? [...new Set(d.reminders.filter((m): m is AppState['reminders'][number] => ['breakfast', 'lunch', 'dinner'].includes(m as string)))]
      : [],
    crashReports: d.crashReports !== false,
    members: sanitizeMembers(d.members),
    memories: sanitizeMemories(d.memories, sanitizeMembers(d.members).map((m) => m.id)),
    personalization: {
      learnFromBehavior: (d.personalization as Record<string, unknown> | undefined)?.learnFromBehavior !== false,
      trackMood: (d.personalization as Record<string, unknown> | undefined)?.trackMood !== false,
    },
    questions: sanitizeQuestions(d.questions),
    eatingWith: Array.isArray(d.eatingWith)
      ? d.eatingWith.filter((id): id is string => typeof id === 'string' && sanitizeMembers(d.members).some((m) => m.id === id))
      : [],
    appLock: d.appLock === true,
    sessionUnlockedAt: null,
    premiumInterest: d.premiumInterest === true,
    checkin: sanitizeCheckin(d.checkin),
  };
}

function sanitizeQuestions(raw: unknown): AppState['questions'] {
  const ok = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
  if (!raw || typeof raw !== 'object') return { done: {}, lastShownAt: null };
  const q = raw as { done?: unknown; lastShownAt?: unknown };
  const done: Record<string, string> = {};
  if (q.done && typeof q.done === 'object') {
    for (const [k, v] of Object.entries(q.done as Record<string, unknown>).slice(0, 50)) if (/^[a-z_]{1,40}$/.test(k) && ok(v)) done[k] = v as string;
  }
  return { done, lastShownAt: ok(q.lastShownAt) ? (q.lastShownAt as string) : null };
}

function sanitizeCheckin(raw: unknown): AppState['checkin'] {
  const ok = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);
  if (!raw || typeof raw !== 'object') return { lastAt: null, snoozeUntil: null };
  const c = raw as Record<string, unknown>;
  return { lastAt: ok(c.lastAt), snoozeUntil: ok(c.snoozeUntil) };
}

/**
 * Weekly reflection is offered only to people actually using EatOS: at least a week
 * since they started (or since the last check-in), 3+ decisions, and not snoozed.
 */
export function checkinDue(state: AppState, now: Date): boolean {
  if (!state.profile) return false;
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const since = Date.parse(state.checkin.lastAt ?? state.profile.createdAt);
  if (Number.isFinite(since) && now.getTime() - since < WEEK) return false;
  if (state.checkin.snoozeUntil && now.getTime() < Date.parse(state.checkin.snoozeUntil)) return false;
  return state.history.filter((e) => e.kind === 'accepted').length >= 3;
}

function sanitizePlan(raw: unknown): MealPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.mealId !== 'string' || !CATALOG.some((m) => m.id === p.mealId)) return null;
  if (!['breakfast', 'lunch', 'dinner'].includes(p.mealTime as string)) return null;
  if (typeof p.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) return null;
  if (!VALID.setting.includes(p.setting as Setting)) return null;
  return { mealId: p.mealId, mealTime: p.mealTime as MealPlan['mealTime'], date: p.date, setting: p.setting as Setting };
}

// ---------- Planning (implementation intentions) ----------

const SLOT_START: Record<MealPlan['mealTime'], number> = { breakfast: 5, lunch: 11, dinner: 17 };

export function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The next main meal after "now": what the user would plan for. */
export function nextMealSlot(now: Date): { mealTime: MealPlan['mealTime']; date: string } {
  const h = now.getHours() + now.getMinutes() / 60;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (h < 5) return { mealTime: 'breakfast', date: localDate(now) };
  if (h < 10.5) return { mealTime: 'lunch', date: localDate(now) };
  if (h < 17) return { mealTime: 'dinner', date: localDate(now) };
  return { mealTime: 'breakfast', date: localDate(tomorrow) };
}

/** due: it's that meal's time now. upcoming: later. expired: the moment has passed (dropped quietly). */
export function planStatus(plan: MealPlan, now: Date): 'due' | 'upcoming' | 'expired' {
  const [y, m, d] = plan.date.split('-').map(Number);
  const start = new Date(y, m - 1, d, SLOT_START[plan.mealTime]);
  const nextSlot = plan.mealTime === 'breakfast' ? 11 : plan.mealTime === 'lunch' ? 17 : 24 + 3;
  const end = new Date(y, m - 1, d, nextSlot);
  if (now < start) return 'upcoming';
  if (now < end) return 'due';
  return 'expired';
}

export interface QuickPick {
  meal: MealIdea;
  saved: boolean;
  cautions: string[];
}

/** Saved + recent meals for one-tap repeat that are possible where the user is and safe for them today. */
export function quickPicksFor(profile: Profile, history: FeedbackEvent[], setting: Setting, limit = 4, memories: Memory[] = []): QuickPick[] {
  const ids = [...CATALOG.filter((m) => isSaved(m.id, history)).map((m) => m.id), ...recentMealIds(history)];
  const out: QuickPick[] = [];
  for (const id of new Set(ids)) {
    const meal = CATALOG.find((m) => m.id === id);
    if (!meal || !meal.settings.includes(setting)) continue; // only meals possible where the user is
    if (dislikedFoodIn(meal, memories)) continue;
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

/** The profile recommendations should use right now: me, plus whoever I'm eating with. */
export function activeProfile(state: AppState): Profile | null {
  if (!state.profile) return null;
  const others = state.members.filter((m) => state.eatingWith.includes(m.id));
  return combineProfiles(state.profile, others);
}

export function eatingWithNames(state: AppState): string[] {
  return state.members.filter((m) => state.eatingWith.includes(m.id)).map((m) => m.name);
}

/** Memories that apply right now for me + whoever I'm eating with. */
export function memoriesNow(state: AppState, now: Date): Memory[] {
  return activeMemories(state.memories, now, ['me', ...state.eatingWith]);
}

export const OTHER_MEAL = 'other';

/** The last few things the user actually ate (EatOS picks and logged meals), newest first. */
export function lastMeals(history: FeedbackEvent[], limit = 4): FeedbackEvent[] {
  const out: FeedbackEvent[] = [];
  for (let i = history.length - 1; i >= 0 && out.length < limit; i--) if (history[i].kind === 'accepted') out.push(history[i]);
  return out;
}

/** "Tonight", "Last night", "Yesterday lunch", "Tue dinner" — friendly, no clock maths for the user. */
export function whenLabel(e: FeedbackEvent, now: Date): string {
  const d = new Date(e.at);
  const days = Math.round((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  const meal = e.mealTime && e.mealTime !== 'snack' ? e.mealTime : e.mealTime === 'snack' ? 'snack' : '';
  if (days === 0) return meal === 'dinner' ? 'Tonight' : meal ? `Today, ${meal}` : 'Today';
  if (days === 1) return meal === 'dinner' ? 'Last night' : meal ? `Yesterday, ${meal}` : 'Yesterday';
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  return days < 7 ? `${day}${meal ? ` ${meal}` : ''}` : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
