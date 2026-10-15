// Main ingredients per meal, from a controlled vocabulary so "I don't like X" can be
// enforced reliably. Lists cover the standard version; optional toppings are included
// when the meal's description names them. Names only — gram amounts and verified
// nutrition (USDA FoodData Central) come later.

export const INGREDIENTS = [
  'avocado', 'banana', 'beans', 'beef', 'berries', 'bread', 'broccoli', 'cheese', 'chicken', 'chickpeas',
  'cilantro', 'coconut', 'corn', 'cucumber', 'curry spices', 'eggs', 'fish', 'granola', 'greens', 'hummus',
  'lentils', 'mayo', 'mushrooms', 'nuts', 'oats', 'olives', 'onion', 'pasta', 'peanut butter', 'peppers',
  'pork', 'potato', 'rice', 'salmon', 'salsa', 'seaweed', 'shrimp', 'sour cream', 'soy sauce', 'spicy',
  'spinach', 'sunflower butter', 'tofu', 'tomato', 'tortilla', 'tuna', 'turkey', 'yogurt', 'apple', 'fruit',
] as const;

export type Ingredient = (typeof INGREDIENTS)[number];

export const MEAL_INGREDIENTS: Record<string, Ingredient[]> = {
  'greek-yogurt-bowl': ['yogurt', 'berries', 'granola', 'oats'],
  'eggs-and-toast': ['eggs', 'bread', 'fruit'],
  'pb-banana-oatmeal': ['oats', 'banana', 'peanut butter'],
  'pb-banana-toast': ['bread', 'peanut butter', 'banana'],
  'tofu-scramble': ['tofu', 'spinach', 'salsa'],
  'black-bean-rice-bowl': ['beans', 'rice', 'salsa', 'avocado'],
  'sheet-pan-chicken': ['chicken', 'potato', 'broccoli'],
  'bean-quesadilla': ['tortilla', 'beans', 'cheese', 'salsa'],
  'tuna-wrap': ['tuna', 'mayo', 'yogurt', 'greens', 'tortilla'],
  'veggie-stir-fry': ['tofu', 'peppers', 'broccoli', 'soy sauce', 'rice'],
  'lentil-marinara-pasta': ['pasta', 'tomato', 'lentils', 'spinach'],
  'salmon-rice-greens': ['salmon', 'rice', 'greens'],
  'rotisserie-chicken-plate': ['chicken', 'greens', 'rice'],
  'turkey-bean-chili': ['turkey', 'beans', 'tomato', 'onion', 'spicy'],
  'egg-fried-rice': ['eggs', 'rice', 'soy sauce'],
  'grilled-cheese-soup': ['bread', 'cheese', 'tomato'],
  'chickpea-salad': ['chickpeas', 'cucumber', 'tomato', 'cheese'],
  'loaded-baked-potato': ['potato', 'beans', 'salsa', 'greens'],
  'cottage-cheese-fruit': ['cheese', 'fruit'],
  'apple-peanut-butter': ['apple', 'peanut butter'],
  'hummus-veg-pita': ['hummus', 'cucumber', 'bread'],
  'grab-and-go-snack': ['banana', 'cheese', 'nuts'],
  'deli-turkey-sandwich': ['turkey', 'bread', 'greens', 'tomato'],
  'coffee-shop-egg-sandwich': ['eggs', 'cheese', 'bread'],
  'burrito-bowl': ['rice', 'beans', 'chicken', 'peppers', 'onion', 'salsa', 'greens', 'cheese', 'sour cream'],
  'poke-bowl': ['rice', 'fish', 'tuna', 'salmon', 'cucumber', 'seaweed', 'soy sauce'],
  'chicken-shawarma-plate': ['chicken', 'rice', 'greens', 'hummus'],
  'falafel-bowl': ['chickpeas', 'hummus', 'greens', 'tomato'],
  'veggie-pizza-salad': ['bread', 'cheese', 'tomato', 'peppers', 'mushrooms', 'olives', 'greens'],
  'sushi-rolls': ['rice', 'fish', 'salmon', 'tuna', 'seaweed', 'soy sauce'],
  'grilled-chicken-sandwich': ['chicken', 'bread', 'greens', 'fruit'],
  'burger-side-salad': ['beef', 'bread', 'cheese', 'greens'],
  'beef-pho': ['beef', 'rice', 'onion', 'cilantro'],
  'chana-masala-rice': ['chickpeas', 'tomato', 'onion', 'curry spices', 'rice'],
  'tandoori-chicken': ['chicken', 'yogurt', 'curry spices', 'rice', 'greens'],
  'build-your-own-salad': ['greens', 'chicken', 'rice', 'tomato', 'cucumber'],
  'restaurant-grilled-fish': ['fish', 'potato', 'broccoli'],
  'steak-potato-veg': ['beef', 'potato', 'broccoli'],
  'pasta-marinara-restaurant': ['pasta', 'tomato', 'greens'],
  'diner-veggie-omelet': ['eggs', 'peppers', 'onion', 'spinach', 'bread', 'fruit'],
  'cafe-oatmeal': ['oats', 'fruit'],
  'cafe-yogurt-parfait': ['yogurt', 'fruit', 'granola'],
  'diner-eggs-potatoes': ['eggs', 'potato', 'fruit'],
  'breakfast-tacos': ['eggs', 'potato', 'tortilla', 'corn', 'salsa'],
  'avocado-toast': ['bread', 'avocado', 'spicy'],
  'fruit-and-nuts': ['fruit', 'nuts'],
  edamame: ['beans'],
  'chips-guac-salsa': ['corn', 'avocado', 'salsa'],
  'cup-of-soup': ['beans', 'lentils', 'tomato'],
  'veggie-burrito-bowl': ['rice', 'beans', 'peppers', 'onion', 'salsa', 'avocado'],
  'fajitas-corn-tortillas': ['chicken', 'peppers', 'onion', 'tortilla', 'corn', 'salsa', 'avocado'],
  'baked-potato-broccoli': ['potato', 'broccoli', 'greens'],
  'grilled-chicken-salad': ['chicken', 'greens', 'tomato', 'cucumber'],
  'veggie-sushi': ['rice', 'avocado', 'cucumber', 'seaweed', 'beans', 'soy sauce'],
  'grocery-hot-bar': ['chicken', 'rice', 'broccoli'],
  'frozen-veggie-burrito': ['tortilla', 'beans', 'rice', 'fruit'],
  'rice-bean-greens-bowl': ['rice', 'beans', 'greens'],
  'banana-and-sunbutter': ['banana', 'sunflower butter'],
};

export function ingredientsOf(mealId: string): Ingredient[] {
  return MEAL_INGREDIENTS[mealId] ?? [];
}
