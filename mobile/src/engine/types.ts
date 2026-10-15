// Core domain types for the EatOS recommendation engine.
// This folder must stay free of React / React Native imports so it can be
// unit-tested in isolation and later reused on a server or the website.

export type Goal = 'eat_better' | 'lose_weight' | 'maintain' | 'build_muscle' | 'more_energy';

export type Struggle =
  | 'no_time'
  | 'decision_fatigue'
  | 'cravings'
  | 'budget'
  | 'cooking'
  | 'eating_out';

export type Cuisine =
  | 'american'
  | 'mexican'
  | 'italian'
  | 'asian'
  | 'mediterranean'
  | 'indian'
  | 'breakfast'
  | 'simple';

// The nine major US allergens (FASTER Act). Treated as hard safety constraints.
export type Allergen =
  | 'peanut'
  | 'tree_nut'
  | 'dairy'
  | 'egg'
  | 'gluten'
  | 'soy'
  | 'fish'
  | 'shellfish'
  | 'sesame';

export type Diet = 'vegetarian' | 'vegan' | 'pescatarian' | 'no_pork' | 'no_red_meat';

/** 1 = budget-friendly, 2 = moderate, 3 = treat, 4 = splurge. No dollar figures: we have no reliable price data. */
export type BudgetTier = 1 | 2 | 3 | 4;

export type Setting = 'home' | 'takeout' | 'restaurant' | 'work' | 'on_the_go';
export type Hunger = 'light' | 'normal' | 'very';
/** Minutes until the user needs to be eating. */
export type TimeAvailable = 5 | 15 | 30 | 60;
export type Feeling = 'fine' | 'tired' | 'stressed' | 'comfort' | 'energized';
export type MealTime = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type Consideration = 'medical' | 'ed_sensitive' | 'household' | 'none';

export interface Profile {
  goal: Goal;
  struggles: Struggle[];
  cuisines: Cuisine[];
  allergens: Allergen[];
  diets: Diet[];
  budget: BudgetTier;
  considerations: Consideration[];
  createdAt: string;
}

export interface Context {
  setting: Setting;
  hunger: Hunger;
  time: TimeAvailable;
  budget: BudgetTier;
  feeling: Feeling;
  mealTime: MealTime;
}

export type DietFacts = {
  hasMeat: boolean; // any land animal
  hasRedMeat: boolean;
  hasPork: boolean;
  hasFish: boolean; // fish or shellfish
  hasAnimalProducts: boolean; // includes dairy, egg, honey
};

export interface MealIdea {
  id: string;
  name: string;
  /** One-line, concrete description of what this actually is. */
  summary: string;
  settings: Setting[];
  mealTimes: MealTime[];
  /** Hands-on minutes when made at home / assembled. Ignored for takeout/restaurant. */
  prepMinutes: number;
  cuisine: Cuisine;
  budget: BudgetTier;
  satiety: Hunger;
  /** Low-effort meals suit tired/stressed moments. */
  effort: 'none' | 'low' | 'medium';
  comfort: boolean;
  highProtein: boolean;
  highFiber: boolean;
  /** Allergens present in the standard version of this meal. */
  contains: Allergen[];
  /** Allergens hidden in some versions or sauces — can't be reliably avoided when eating out. */
  mayContain: Allergen[];
  /**
   * Allergens in an optional, visible component the user can ask to leave off,
   * with the instruction to give (e.g. dairy: 'skip the cheese and sour cream').
   */
  removable?: Partial<Record<Allergen, string>>;
  /** Not in the dish itself, but commonly handled in the same kitchen (shared fryers, grills, prep lines). */
  crossContact?: Allergen[];
  diet: DietFacts;
  /** What to do: how to make it or how to order it. */
  howTo: string;
  swaps: string[];
}

/**
 * accepted: user chose it. loved/fine: after-meal rating. disliked: "not for me" / "not again".
 * swapped: user asked for something else while it was the primary pick.
 */
export type FeedbackKind = 'accepted' | 'saved' | 'unsaved' | 'disliked' | 'swapped' | 'loved' | 'fine';

export interface FeedbackEvent {
  mealId: string;
  kind: FeedbackKind;
  at: string; // ISO timestamp
}

export interface ScoredReason {
  text: string;
  weight: number;
}

export interface Recommendation {
  meal: MealIdea;
  score: number;
  reasons: string[];
  /** Safety notes that must be shown with the recommendation. Never hidden. */
  cautions: string[];
}

export interface RecommendationResult {
  primary: Recommendation | null;
  alternatives: Recommendation[];
  /** Populated when nothing could be recommended, explaining why. */
  emptyReason?: string;
}
