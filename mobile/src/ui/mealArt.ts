// Illustrated stand-ins for food photography (no licensed photos yet). Each meal gets a
// recognisable emoji on a cuisine-tinted gradient. Swap in real photos later by adding
// an `image` to the meal and rendering it in <MealArt>.
import type { Cuisine, MealIdea } from '../engine';

const BY_KEYWORD: [RegExp, string][] = [
  [/burrito|fajita|taco|quesadilla/i, '🌯'],
  [/poke|sushi/i, '🍣'],
  [/salmon|fish/i, '🐟'],
  [/pho|soup|chili/i, '🍜'],
  [/pizza/i, '🍕'],
  [/pasta/i, '🍝'],
  [/burger/i, '🍔'],
  [/sandwich|toast|grilled cheese/i, '🥪'],
  [/salad|chickpea|hummus|falafel|shawarma/i, '🥗'],
  [/oatmeal|parfait|yogurt|cottage/i, '🥣'],
  [/egg|omelet|scramble/i, '🍳'],
  [/stir-fry|fried rice|edamame/i, '🥢'],
  [/curry|masala|tandoori/i, '🍛'],
  [/steak/i, '🥩'],
  [/chicken/i, '🍗'],
  [/potato/i, '🥔'],
  [/apple|banana|fruit/i, '🍎'],
  [/chips|guac/i, '🥑'],
  [/bowl|rice|bean/i, '🍚'],
];

const CUISINE_COLORS: Record<Cuisine, [string, string]> = {
  american: ['#F6E3C8', '#E9C79B'],
  mexican: ['#F9DCC4', '#EFB48A'],
  italian: ['#F6D6CF', '#E8A99A'],
  asian: ['#DDEBD7', '#B7D6A8'],
  chinese: ['#F7D9D2', '#E8A08F'],
  japanese: ['#E2E8F2', '#B9C6DD'],
  thai: ['#E1EFD9', '#B4D69C'],
  korean: ['#F6DCCF', '#E5A585'],
  vietnamese: ['#E5F0DE', '#BFDCA9'],
  middle_eastern: ['#F3E6CF', '#DCC08E'],
  mediterranean: ['#E3EEDA', '#C3DBA9'],
  indian: ['#F7E2B8', '#EBC273'],
  breakfast: ['#FBEBC8', '#F1D08A'],
  simple: ['#E4EFE6', '#C1DCC6'],
};

export function mealEmoji(meal: Pick<MealIdea, 'name'>): string {
  return BY_KEYWORD.find(([re]) => re.test(meal.name))?.[1] ?? '🍽️';
}

export function mealColors(meal: Pick<MealIdea, 'cuisine'>): [string, string] {
  return CUISINE_COLORS[meal.cuisine];
}
