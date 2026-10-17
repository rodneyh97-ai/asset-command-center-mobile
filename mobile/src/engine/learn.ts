// On-device taste learning. No network, no AI calls: explainable statistics over the
// user's own explicit feedback, so recommendations improve the more EatOS is used.
import type { Cuisine, FeedbackEvent, FeedbackKind, MealIdea, MealTime, Setting } from './types';

const DAY = 24 * 60 * 60 * 1000;
/** Older behaviour fades: an event 30 days old counts half as much. */
export const HALF_LIFE_DAYS = 30;
/** Shrinkage: a trait needs several consistent signals before it moves the needle. */
const PRIOR = 4;
const MAX_TASTE_POINTS = 3;

const SIGNAL: Partial<Record<FeedbackKind, number>> = {
  accepted: 1,
  loved: 2,
  saved: 1,
  fine: 0.25,
  swapped: -0.6,
  disliked: -2,
};

export function mealFeatures(m: MealIdea): string[] {
  return [
    `cuisine:${m.cuisine}`,
    `effort:${m.effort}`,
    `budget:${m.budget}`,
    `satiety:${m.satiety}`,
    m.comfort ? 'comfort' : 'light-touch',
    ...(m.highProtein ? ['protein'] : []),
    ...(m.highFiber ? ['fiber'] : []),
  ];
}

export interface Taste {
  /** Learned affinity per trait, roughly -2…+2. */
  affinity: Map<string, number>;
  /** Decayed count of meaningful signals; 0 for a brand-new user. */
  evidence: number;
  /** Decayed accept counts per "setting|mealTime|mealId". */
  habits: Map<string, number>;
  /** Meals the user has ever accepted or saved. */
  known: Set<string>;
}

/** `rejected` holds traits the user said aren't true (e.g. 'cuisine:mexican'); they're never learned. */
export function learnTaste(history: FeedbackEvent[], catalog: MealIdea[], now: Date, rejected: Set<string> = new Set()): Taste {
  const byId = new Map(catalog.map((m) => [m.id, m]));
  const sums = new Map<string, { sum: number; n: number }>();
  const habits = new Map<string, number>();
  const known = new Set<string>();
  let evidence = 0;
  for (const e of history) {
    const w = SIGNAL[e.kind];
    const meal = byId.get(e.mealId);
    if (w === undefined || !meal) continue;
    const ageDays = Math.max(0, (now.getTime() - Date.parse(e.at)) / DAY);
    const decay = Number.isFinite(ageDays) ? Math.pow(0.5, ageDays / HALF_LIFE_DAYS) : 0;
    evidence += decay;
    if (e.kind === 'accepted' || e.kind === 'saved') known.add(e.mealId);
    for (const f of mealFeatures(meal)) {
      const s = sums.get(f) ?? { sum: 0, n: 0 };
      s.sum += w * decay;
      s.n += decay;
      sums.set(f, s);
    }
    if (e.kind === 'accepted' && e.setting && e.mealTime) {
      const k = habitKey(e.setting, e.mealTime, e.mealId);
      habits.set(k, (habits.get(k) ?? 0) + decay);
    }
  }
  const affinity = new Map<string, number>();
  for (const [f, s] of sums) if (!rejected.has(f)) affinity.set(f, s.sum / (s.n + PRIOR));
  return { affinity, evidence, habits, known };
}

export function habitKey(setting: Setting, mealTime: MealTime, mealId: string): string {
  return `${setting}|${mealTime}|${mealId}`;
}

const CUISINE_WORD: Partial<Record<Cuisine, string>> = {
  american: 'American',
  mexican: 'Mexican',
  italian: 'Italian',
  asian: 'Asian',
  chinese: 'Chinese',
  japanese: 'Japanese',
  thai: 'Thai',
  korean: 'Korean',
  vietnamese: 'Vietnamese',
  middle_eastern: 'Middle Eastern',
  mediterranean: 'Mediterranean',
  indian: 'Indian',
  breakfast: 'breakfast-style',
};

export function tasteScore(meal: MealIdea, taste: Taste): { points: number; reason?: string } {
  if (taste.evidence < 1) return { points: 0 };
  let total = 0;
  for (const f of mealFeatures(meal)) total += taste.affinity.get(f) ?? 0;
  const points = Math.max(-MAX_TASTE_POINTS, Math.min(MAX_TASTE_POINTS, total * 1.5));

  // Explain the strongest positive learned trait, in plain words.
  const a = (f: string) => taste.affinity.get(f) ?? 0;
  const cuisine = CUISINE_WORD[meal.cuisine];
  let reason: string | undefined;
  if (cuisine && a(`cuisine:${meal.cuisine}`) >= 0.4) reason = `You often go for ${cuisine} food`;
  else if (meal.effort === 'none' && a('effort:none') >= 0.4) reason = 'Low-effort, like the meals you usually pick';
  else if (meal.highProtein && a('protein') >= 0.4) reason = 'Protein-rich, like the meals you tend to choose';
  else if (meal.comfort && a('comfort') >= 0.4) reason = 'The kind of comfort food you tend to enjoy';
  return { points, reason: points > 0.5 ? reason : undefined };
}

const SETTING_PHRASE: Record<Setting, string> = {
  home: 'at home',
  takeout: 'for takeout',
  restaurant: 'when eating out',
  work: 'at work',
  on_the_go: 'on the go',
};

export function habitBonus(
  meal: MealIdea,
  setting: Setting,
  mealTime: MealTime,
  taste: Taste,
): { points: number; reason?: string } {
  const count = taste.habits.get(habitKey(setting, mealTime, meal.id)) ?? 0;
  if (count < 1.5) return { points: 0 };
  return { points: Math.min(3, count), reason: `Your usual for ${mealTime} ${SETTING_PHRASE[setting]}` };
}

/** Patterns EatOS has noticed but the user hasn't confirmed. Shown as "EatOS thinks…", never stored as facts. */
export function inferredTraits(taste: Taste): { trait: string; text: string }[] {
  if (taste.evidence < 3) return [];
  const out: { trait: string; text: string }[] = [];
  for (const [trait, a] of taste.affinity) {
    if (a < 0.4) continue;
    const [kind, v] = trait.split(':');
    if (kind === 'cuisine' && CUISINE_WORD[v as Cuisine]) out.push({ trait, text: `You often go for ${CUISINE_WORD[v as Cuisine]} food` });
    else if (trait === 'effort:none') out.push({ trait, text: 'You prefer meals that take no cooking' });
    else if (trait === 'protein') out.push({ trait, text: 'You lean toward protein-rich meals' });
    else if (trait === 'comfort') out.push({ trait, text: 'You enjoy comfort food' });
  }
  return out.slice(0, 5);
}

/** Convenience: learn from history and list what EatOS has noticed. */
export function inferredTaste(history: FeedbackEvent[], catalog: MealIdea[], now: Date) {
  return inferredTraits(learnTaste(history, catalog, now));
}

