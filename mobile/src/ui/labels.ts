// User-facing labels and icons for every option, matched to the design. One place for wording.
import type {
  Allergen,
  BudgetTier,
  Consideration,
  Cuisine,
  Diet,
  Feeling,
  Goal,
  Hunger,
  Setting,
  Struggle,
  TimeAvailable,
} from '../engine';
import type { IconName, Option } from './components';

export interface RichOption<T extends string | number> extends Option<T> {
  icon: IconName;
  subtitle?: string;
}

/** Goals offered in onboarding (design shows four). 'more_energy' remains valid for existing users. */
export const GOALS: RichOption<Goal>[] = [
  { value: 'lose_weight', label: 'Lose weight', subtitle: '(leaner, healthier)', icon: 'trending-down-outline' },
  { value: 'build_muscle', label: 'Build muscle', subtitle: '(stronger, more energy)', icon: 'barbell-outline' },
  { value: 'maintain', label: 'Maintain weight', subtitle: '(stay consistent)', icon: 'scale-outline' },
  { value: 'eat_better', label: 'Be healthier', subtitle: '(more energy, better habits)', icon: 'leaf-outline' },
];
export const GOAL_LABEL: Record<Goal, string> = {
  lose_weight: 'Lose weight',
  build_muscle: 'Build muscle',
  maintain: 'Maintain weight',
  eat_better: 'Be healthier',
  more_energy: 'Have more energy',
};

export const STRUGGLES: Option<Struggle>[] = [
  { value: 'no_time', label: 'No time' },
  { value: 'decision_fatigue', label: 'Too tired to decide' },
  { value: 'cravings', label: 'Cravings win' },
  { value: 'budget', label: 'Tight budget' },
  { value: 'cooking', label: 'Not confident cooking' },
  { value: 'eating_out', label: 'I eat out a lot' },
];

export const CUISINES: (Option<Cuisine> & { emoji: string })[] = [
  { value: 'american', label: 'American', emoji: '🍔' },
  { value: 'mexican', label: 'Mexican', emoji: '🌮' },
  { value: 'italian', label: 'Pasta & Italian', emoji: '🍝' },
  { value: 'chinese', label: 'Chinese', emoji: '🥡' },
  { value: 'japanese', label: 'Japanese & sushi', emoji: '🍣' },
  { value: 'thai', label: 'Thai', emoji: '🍜' },
  { value: 'korean', label: 'Korean', emoji: '🥘' },
  { value: 'vietnamese', label: 'Vietnamese', emoji: '🍲' },
  { value: 'asian', label: 'Asian fusion & bowls', emoji: '🥢' },
  { value: 'mediterranean', label: 'Greek & Mediterranean', emoji: '🥗' },
  { value: 'middle_eastern', label: 'Middle Eastern', emoji: '🧆' },
  { value: 'indian', label: 'Indian', emoji: '🍛' },
  { value: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { value: 'simple', label: 'Simple & plain', emoji: '🍚' },
];

export const ALLERGENS: RichOption<Allergen>[] = [
  { value: 'peanut', label: 'Peanut allergy', icon: 'alert-circle-outline' },
  { value: 'tree_nut', label: 'Tree nut allergy', icon: 'alert-circle-outline' },
  { value: 'dairy', label: 'Dairy free', icon: 'water-outline' },
  { value: 'egg', label: 'Egg allergy', icon: 'egg-outline' },
  { value: 'gluten', label: 'Gluten free', icon: 'nutrition-outline' },
  { value: 'soy', label: 'Soy allergy', icon: 'alert-circle-outline' },
  { value: 'fish', label: 'Fish allergy', icon: 'fish-outline' },
  { value: 'shellfish', label: 'Shellfish allergy', icon: 'fish-outline' },
  { value: 'sesame', label: 'Sesame allergy', icon: 'alert-circle-outline' },
];

export const DIETS: RichOption<Diet>[] = [
  { value: 'vegetarian', label: 'Vegetarian', icon: 'leaf-outline' },
  { value: 'vegan', label: 'Vegan', icon: 'flower-outline' },
  { value: 'pescatarian', label: 'Pescatarian', icon: 'fish-outline' },
  { value: 'no_pork', label: 'No pork', icon: 'close-circle-outline' },
  { value: 'no_red_meat', label: 'No red meat', icon: 'close-circle-outline' },
];

/** The user's own budget preference (not a claim about what any meal costs). */
export const BUDGETS: Option<BudgetTier>[] = [
  { value: 1, label: 'Under $10' },
  { value: 2, label: '$10 – $15' },
  { value: 3, label: '$15 – $25' },
  { value: 4, label: '$25+' },
];

/** Typical relative cost of a meal pattern. Estimates only; prices vary by place. */
export const BUDGET_SHORT: Record<BudgetTier, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

export const CONSIDERATIONS: Option<Consideration>[] = [
  { value: 'medical', label: 'A medical condition affects what I eat' },
  { value: 'ed_sensitive', label: 'I prefer no weight or diet talk' },
  { value: 'household', label: 'I usually feed others too' },
  { value: 'none', label: 'Nothing else' },
];

export const SETTINGS: RichOption<Setting>[] = [
  { value: 'home', label: 'At home', icon: 'home-outline' },
  { value: 'restaurant', label: 'Restaurant', icon: 'restaurant-outline' },
  { value: 'takeout', label: 'Takeout', icon: 'bag-handle-outline' },
  { value: 'work', label: 'At work', icon: 'briefcase-outline' },
  { value: 'on_the_go', label: 'On the go', icon: 'airplane-outline' },
];

export const HUNGER: Option<Hunger>[] = [
  { value: 'light', label: 'Light' },
  { value: 'normal', label: 'Normal' },
  { value: 'very', label: 'Very' },
];

export const TIMES: Option<TimeAvailable>[] = [
  { value: 10, label: '5–10 min' },
  { value: 20, label: '10–20 min' },
  { value: 60, label: '20+ min' },
];

/** Feelings shown on Home (design shows four). 'comfort' remains valid in the engine. */
export const FEELINGS: (Option<Feeling> & { emoji: string })[] = [
  { value: 'stressed', label: 'Stressed', emoji: '😣' },
  { value: 'tired', label: 'Tired', emoji: '😴' },
  { value: 'fine', label: 'Good', emoji: '🙂' },
  { value: 'energized', label: 'Energized', emoji: '💪' },
];
export const FEELING_EMOJI: Record<Feeling, string> = {
  stressed: '😣',
  tired: '😴',
  fine: '🙂',
  energized: '💪',
  comfort: '🫶',
};
