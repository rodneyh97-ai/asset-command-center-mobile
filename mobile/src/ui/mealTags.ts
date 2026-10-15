// Short, truthful descriptors shown as tags. Derived only from facts we hold about the
// meal pattern — no calorie numbers, no weight-loss claims.
import type { MealIdea, Setting } from '../engine';
import { BUDGET_SHORT } from './labels';

export function mealTags(meal: MealIdea, max = 3): string[] {
  const tags: string[] = [];
  if (meal.highProtein) tags.push('High Protein');
  if (meal.highFiber) tags.push('High Fiber');
  if (meal.effort === 'none' || (meal.prepMinutes > 0 && meal.prepMinutes <= 10)) tags.push('Quick');
  if (meal.budget === 1) tags.push('Budget-friendly');
  if (!meal.diet.hasAnimalProducts) tags.push('Vegan');
  else if (!meal.diet.hasMeat && !meal.diet.hasFish) tags.push('Vegetarian');
  if (meal.comfort) tags.push('Comfort');
  return tags.slice(0, max);
}

/** "~10 min" for things you make; "Order out" for things you buy. */
export function timeLabel(meal: MealIdea, setting?: Setting): string {
  const makeIt = meal.prepMinutes > 0 && (setting === undefined || setting === 'home' || setting === 'work');
  if (makeIt) return `~${meal.prepMinutes} min`;
  return meal.prepMinutes > 0 ? 'Grab & go' : 'Order out';
}

export function costLabel(meal: MealIdea): string {
  return `${BUDGET_SHORT[meal.budget]} est.`;
}
