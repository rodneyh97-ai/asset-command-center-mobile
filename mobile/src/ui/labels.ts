// User-facing labels for every option. Kept in one place for consistent wording.
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
import type { Option } from './components';

export const GOALS: Option<Goal>[] = [
  { value: 'eat_better', label: 'Eat better overall' },
  { value: 'lose_weight', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain my weight' },
  { value: 'build_muscle', label: 'Build muscle' },
  { value: 'more_energy', label: 'Have more energy' },
];

export const STRUGGLES: Option<Struggle>[] = [
  { value: 'no_time', label: 'No time' },
  { value: 'decision_fatigue', label: 'Too tired to decide' },
  { value: 'cravings', label: 'Cravings win' },
  { value: 'budget', label: 'Tight budget' },
  { value: 'cooking', label: 'Not confident cooking' },
  { value: 'eating_out', label: 'I eat out a lot' },
];

export const CUISINES: Option<Cuisine>[] = [
  { value: 'american', label: 'American' },
  { value: 'mexican', label: 'Mexican' },
  { value: 'italian', label: 'Italian' },
  { value: 'asian', label: 'Asian' },
  { value: 'mediterranean', label: 'Mediterranean' },
  { value: 'indian', label: 'Indian' },
  { value: 'breakfast', label: 'Breakfast foods' },
  { value: 'simple', label: 'Simple & plain' },
];

export const ALLERGENS: Option<Allergen>[] = [
  { value: 'peanut', label: 'Peanuts' },
  { value: 'tree_nut', label: 'Tree nuts' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'egg', label: 'Eggs' },
  { value: 'gluten', label: 'Gluten / wheat' },
  { value: 'soy', label: 'Soy' },
  { value: 'fish', label: 'Fish' },
  { value: 'shellfish', label: 'Shellfish' },
  { value: 'sesame', label: 'Sesame' },
];

export const DIETS: Option<Diet>[] = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'no_pork', label: 'No pork' },
  { value: 'no_red_meat', label: 'No red meat' },
];

export const BUDGETS: Option<BudgetTier>[] = [
  { value: 1, label: '$ Keep it cheap' },
  { value: 2, label: '$$ Moderate' },
  { value: 3, label: '$$$ Treat' },
  { value: 4, label: '$$$$ Splurge' },
];

export const BUDGET_SHORT: Record<BudgetTier, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

export const CONSIDERATIONS: Option<Consideration>[] = [
  { value: 'medical', label: 'A medical condition affects what I eat' },
  { value: 'ed_sensitive', label: 'I prefer no weight or diet talk' },
  { value: 'household', label: 'I usually feed others too' },
  { value: 'none', label: 'Nothing else' },
];

export const SETTINGS: Option<Setting>[] = [
  { value: 'home', label: 'Home' },
  { value: 'takeout', label: 'Takeout' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'work', label: 'At work' },
  { value: 'on_the_go', label: 'On the go' },
];

export const HUNGER: Option<Hunger>[] = [
  { value: 'light', label: 'A little' },
  { value: 'normal', label: 'Hungry' },
  { value: 'very', label: 'Starving' },
];

export const TIMES: Option<TimeAvailable>[] = [
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: 'An hour' },
];

export const FEELINGS: Option<Feeling>[] = [
  { value: 'fine', label: 'Fine' },
  { value: 'tired', label: 'Tired' },
  { value: 'stressed', label: 'Stressed' },
  { value: 'comfort', label: 'Want comfort' },
  { value: 'energized', label: 'Energized' },
];
