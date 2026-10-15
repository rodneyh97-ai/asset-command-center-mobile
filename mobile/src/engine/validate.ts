// Runtime validation for anything read back from storage (or, later, the network).
// Rule: keep every valid allergy/diet we can recover (fail safe), drop anything unknown.
import type {
  Allergen,
  BudgetTier,
  Consideration,
  Context,
  Cuisine,
  Diet,
  FeedbackEvent,
  FeedbackKind,
  Feeling,
  Goal,
  Hunger,
  Profile,
  Setting,
  Struggle,
  TimeAvailable,
} from './types';

export const VALID = {
  goal: ['eat_better', 'lose_weight', 'maintain', 'build_muscle', 'more_energy'] as Goal[],
  struggle: ['no_time', 'decision_fatigue', 'cravings', 'budget', 'cooking', 'eating_out'] as Struggle[],
  cuisine: ['american', 'mexican', 'italian', 'asian', 'mediterranean', 'indian', 'breakfast', 'simple'] as Cuisine[],
  allergen: ['peanut', 'tree_nut', 'dairy', 'egg', 'gluten', 'soy', 'fish', 'shellfish', 'sesame'] as Allergen[],
  diet: ['vegetarian', 'vegan', 'pescatarian', 'no_pork', 'no_red_meat'] as Diet[],
  budget: [1, 2, 3, 4] as BudgetTier[],
  consideration: ['medical', 'ed_sensitive', 'household'] as Consideration[],
  setting: ['home', 'takeout', 'restaurant', 'work', 'on_the_go'] as Setting[],
  hunger: ['light', 'normal', 'very'] as Hunger[],
  time: [5, 15, 30, 60] as TimeAvailable[],
  feeling: ['fine', 'tired', 'stressed', 'comfort', 'energized'] as Feeling[],
  feedback: ['accepted', 'saved', 'unsaved', 'disliked', 'swapped', 'loved', 'fine'] as FeedbackKind[],
};

function oneOf<T>(allowed: readonly T[], v: unknown, fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

function listOf<T>(allowed: readonly T[], v: unknown): T[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x) => allowed.includes(x as T)) as T[])];
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Returns null only when the safety-critical fields are unreadable, so the user is
 * asked again rather than silently treated as having no allergies.
 */
export function sanitizeProfile(raw: unknown): Profile | null {
  if (!isObj(raw)) return null;
  if (!Array.isArray(raw.allergens) || !Array.isArray(raw.diets)) return null;
  return {
    goal: oneOf(VALID.goal, raw.goal, 'eat_better'),
    struggles: listOf(VALID.struggle, raw.struggles),
    cuisines: listOf(VALID.cuisine, raw.cuisines),
    allergens: listOf(VALID.allergen, raw.allergens),
    diets: listOf(VALID.diet, raw.diets),
    budget: oneOf(VALID.budget, raw.budget, 2),
    considerations: listOf(VALID.consideration, raw.considerations),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
  };
}

export function sanitizeContext(raw: unknown): Omit<Context, 'mealTime'> | null {
  if (!isObj(raw)) return null;
  return {
    setting: oneOf(VALID.setting, raw.setting, 'home'),
    hunger: oneOf(VALID.hunger, raw.hunger, 'normal'),
    time: oneOf(VALID.time, raw.time, 15),
    budget: oneOf(VALID.budget, raw.budget, 2),
    feeling: oneOf(VALID.feeling, raw.feeling, 'fine'),
  };
}

export function sanitizeFeedback(raw: unknown): FeedbackEvent | null {
  if (!isObj(raw)) return null;
  if (typeof raw.mealId !== 'string' || raw.mealId.length > 100) return null;
  if (!VALID.feedback.includes(raw.kind as FeedbackKind)) return null;
  if (typeof raw.at !== 'string' || Number.isNaN(Date.parse(raw.at))) return null;
  return { mealId: raw.mealId, kind: raw.kind as FeedbackKind, at: raw.at };
}
