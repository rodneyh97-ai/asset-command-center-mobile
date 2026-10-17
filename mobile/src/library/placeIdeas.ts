// Which of the user's own safe ideas to show on each place's card.
// Ideas come from what that kind of place usually serves (its OpenStreetMap food tags,
// then its EatOS cuisine, then the kind of place), so a burger joint, a sub shop and a
// BBQ spot don't all show the same "American" list. Only meals already checked as safe
// for this user (the `ideas` list) are ever shown. Never a claim about a real menu.
import type { Recommendation } from '../engine';
import type { Place } from './client';
import { placeCuisines } from './personalize';

export const IDEAS_PER_PLACE = 8;

// Dishes most places with this OpenStreetMap food tag have.
const TAG_MEALS: Record<string, string[]> = {
  burger: ['burger-side-salad', 'grilled-chicken-sandwich', 'chicken-nuggets-fruit', 'chili-side-salad', 'grilled-chicken-wrap', 'grilled-chicken-salad'],
  sandwich: ['deli-turkey-sandwich', 'veggie-sub', 'caprese-sandwich', 'grilled-chicken-wrap', 'cup-of-soup', 'chicken-noodle-soup', 'build-your-own-salad'],
  sub: ['deli-turkey-sandwich', 'veggie-sub', 'grilled-chicken-wrap'],
  deli: ['deli-turkey-sandwich', 'veggie-sub', 'caprese-sandwich', 'cup-of-soup', 'chicken-noodle-soup'],
  pizza: ['margherita-pizza', 'veggie-pizza-salad', 'pasta-marinara-restaurant', 'chicken-pasta-primavera', 'build-your-own-salad'],
  chicken: ['chicken-nuggets-fruit', 'grilled-chicken-sandwich', 'grilled-chicken-wrap', 'grilled-chicken-salad', 'rotisserie-chicken-plate', 'wings-and-veggies'],
  wings: ['wings-and-veggies', 'grilled-chicken-salad', 'chicken-nuggets-fruit', 'baked-potato-broccoli'],
  barbecue: ['bbq-burnt-ends-plate', 'bbq-pulled-pork-sandwich', 'bbq-smoked-chicken-plate', 'baked-potato-broccoli', 'grilled-chicken-salad'],
  bbq: ['bbq-burnt-ends-plate', 'bbq-pulled-pork-sandwich', 'bbq-smoked-chicken-plate', 'baked-potato-broccoli'],
  american: ['burger-side-salad', 'grilled-chicken-sandwich', 'steak-potato-veg', 'chicken-noodle-soup', 'grilled-chicken-salad', 'build-your-own-salad', 'baked-potato-broccoli'],
  diner: ['diner-eggs-potatoes', 'diner-veggie-omelet', 'pancakes-and-eggs', 'burger-side-salad', 'chicken-noodle-soup', 'grilled-chicken-sandwich'],
  steak_house: ['steak-potato-veg', 'restaurant-grilled-fish', 'grilled-chicken-salad', 'baked-potato-broccoli', 'build-your-own-salad'],
  seafood: ['restaurant-grilled-fish', 'poke-bowl', 'grilled-chicken-salad', 'build-your-own-salad'],
  fish: ['restaurant-grilled-fish', 'poke-bowl'],
  breakfast: ['diner-eggs-potatoes', 'diner-veggie-omelet', 'pancakes-and-eggs', 'breakfast-tacos', 'avocado-toast', 'cafe-oatmeal', 'cafe-yogurt-parfait'],
  pancake: ['pancakes-and-eggs', 'diner-eggs-potatoes', 'diner-veggie-omelet', 'cafe-oatmeal'],
  brunch: ['pancakes-and-eggs', 'diner-veggie-omelet', 'avocado-toast', 'cafe-yogurt-parfait', 'breakfast-tacos'],
  coffee_shop: ['coffee-shop-egg-sandwich', 'bagel-cream-cheese', 'cafe-oatmeal', 'cafe-yogurt-parfait', 'avocado-toast', 'cafe-smoothie'],
  bagel: ['bagel-cream-cheese', 'coffee-shop-egg-sandwich', 'cafe-yogurt-parfait'],
  bakery: ['bagel-cream-cheese', 'coffee-shop-egg-sandwich', 'avocado-toast', 'cafe-oatmeal'],
  donut: ['coffee-shop-egg-sandwich', 'bagel-cream-cheese', 'cafe-yogurt-parfait'],
  juice: ['cafe-smoothie', 'cafe-yogurt-parfait', 'cafe-oatmeal'],
  smoothie: ['cafe-smoothie', 'cafe-yogurt-parfait'],
  salad: ['build-your-own-salad', 'grilled-chicken-salad', 'chicken-souvlaki-salad'],
  sushi: ['sushi-rolls', 'veggie-sushi', 'poke-bowl', 'edamame', 'chicken-teriyaki-rice'],
  poke: ['poke-bowl', 'veggie-sushi', 'edamame'],
  hawaiian: ['poke-bowl', 'chicken-teriyaki-rice'],
  ramen: ['chicken-teriyaki-rice', 'edamame'],
  tex_mex: ['fajitas-corn-tortillas', 'burrito-bowl', 'veggie-burrito-bowl', 'chips-guac-salsa'],
  taco: ['pork-tacos', 'burrito-bowl', 'veggie-burrito-bowl', 'chips-guac-salsa', 'breakfast-tacos'],
  tacos: ['pork-tacos', 'burrito-bowl', 'veggie-burrito-bowl', 'chips-guac-salsa', 'breakfast-tacos'],
  burrito: ['burrito-bowl', 'veggie-burrito-bowl', 'chips-guac-salsa'],
  greek: ['gyro-plate', 'chicken-souvlaki-salad', 'falafel-bowl'],
  kebab: ['chicken-shawarma-plate', 'gyro-plate', 'falafel-bowl'],
  falafel: ['falafel-bowl', 'hummus-veg-pita', 'chicken-shawarma-plate'],
};

// What a place is called on its card ("dishes most burger places have").
const TAG_WORD: Record<string, string> = {
  burger: 'burger places', sandwich: 'sandwich shops', sub: 'sub shops', deli: 'delis', pizza: 'pizza places', chicken: 'chicken places',
  wings: 'wing spots', barbecue: 'BBQ spots', bbq: 'BBQ spots', diner: 'diners', steak_house: 'steakhouses', seafood: 'seafood spots',
  fish: 'seafood spots', breakfast: 'breakfast spots', pancake: 'pancake houses', brunch: 'brunch spots', coffee_shop: 'coffee shops',
  bagel: 'bagel shops', bakery: 'bakeries', donut: 'donut shops', juice: 'juice bars', smoothie: 'smoothie bars', salad: 'salad places',
  sushi: 'sushi spots', poke: 'poke places', hawaiian: 'Hawaiian spots', ramen: 'ramen shops', tex_mex: 'Tex-Mex spots', taco: 'taquerias',
  tacos: 'taquerias', burrito: 'burrito shops', greek: 'Greek spots', kebab: 'kebab places', falafel: 'falafel places', american: 'American spots',
  mexican: 'Mexican spots', italian: 'Italian spots', chinese: 'Chinese spots', japanese: 'Japanese spots', thai: 'Thai spots', korean: 'Korean spots',
  vietnamese: 'Vietnamese spots', indian: 'Indian spots', mediterranean: 'Mediterranean spots', middle_eastern: 'Middle Eastern spots', asian: 'Asian spots',
};

// Places with no food tag: what most places of that kind have.
const KIND_MEALS: Record<Place['kind'], string[]> = {
  cafe: TAG_MEALS.coffee_shop,
  fast_food: ['burger-side-salad', 'grilled-chicken-sandwich', 'grilled-chicken-wrap', 'chicken-nuggets-fruit', 'chili-side-salad', 'veggie-sub', 'grilled-chicken-salad', 'cafe-smoothie', 'coffee-shop-egg-sandwich'],
  restaurant: ['grilled-chicken-salad', 'build-your-own-salad', 'steak-potato-veg', 'restaurant-grilled-fish', 'pasta-marinara-restaurant', 'burger-side-salad', 'chicken-noodle-soup', 'grilled-chicken-sandwich', 'baked-potato-broccoli', 'diner-veggie-omelet'],
  grocery: ['grocery-hot-bar', 'grocery-salad-kit', 'rotisserie-chicken-plate', 'protein-snack-box', 'string-cheese-apple'],
  convenience: ['protein-snack-box', 'hard-boiled-eggs-fruit', 'jerky-and-fruit', 'string-cheese-apple', 'protein-shake-banana'],
};
const KIND_WORD: Record<Place['kind'], string> = { cafe: 'cafés', fast_food: 'fast-food spots', restaurant: 'restaurants', grocery: 'grocery stores', convenience: 'convenience stores' };

export interface PlaceIdeas {
  ideas: Recommendation[];
  /** "burger places", "cafés"… for "dishes most ___ have". */
  label: string | null;
  /** How many leading ideas are this place's own kind of food (the rest are general dishes). */
  own: number;
}

/** Candidate meal ids for a place, most specific first, plus the words for its label. */
function candidates(place: Pick<Place, 'kind' | 'cuisines'>): { ids: string[]; cuisines: string[]; label: string } {
  const tags = place.cuisines.filter((t) => TAG_MEALS[t] || TAG_WORD[t]);
  const ids = [...new Set(tags.flatMap((t) => TAG_MEALS[t] ?? []))];
  const cuisines = placeCuisines(place);
  if (ids.length || cuisines.length) return { ids, cuisines, label: TAG_WORD[tags[0]] ?? TAG_WORD[cuisines[0]] ?? KIND_WORD[place.kind] };
  return { ids: KIND_MEALS[place.kind], cuisines: [], label: KIND_WORD[place.kind] };
}

/** Ideas for one place: its specific dishes first, then same-cuisine ideas, in the user's own order. */
export function ideasForPlace(place: Pick<Place, 'id' | 'kind' | 'cuisines'>, ideas: Recommendation[], limit = IDEAS_PER_PLACE): Recommendation[] {
  return ideasWithLabel(place, ideas, limit).ideas;
}

export function ideasWithLabel(place: Pick<Place, 'id' | 'kind' | 'cuisines'>, ideas: Recommendation[], limit = IDEAS_PER_PLACE): PlaceIdeas {
  const { ids, cuisines, label } = candidates(place);
  const specific = ideas.filter((r) => ids.includes(r.meal.id));
  const broad = ideas.filter((r) => !ids.includes(r.meal.id) && cuisines.includes(r.meal.cuisine));
  // Then what most places of this kind have (a salad or grilled chicken at most sit-down
  // restaurants, a wrap or sandwich at most fast-food spots), so a card isn't left with one dish.
  const seen = new Set([...specific, ...broad]);
  const general = ideas.filter((r) => !seen.has(r) && KIND_MEALS[place.kind].includes(r.meal.id));
  const all = [...specific, ...broad, ...general];
  if (!all.length) return { ideas: [], label: null, own: 0 };
  // Keep the user's best match first; vary the rest from place to place so neighbouring
  // cards of the same kind don't read identically.
  // Rotation stays within the place's own dishes, so general ones never jump ahead of them.
  const ownList = [...specific, ...broad];
  const [first, ...rest] = ownList.length ? ownList : general;
  const tail = ownList.length ? general : [];
  const shift = rest.length ? Math.abs(place.id) % rest.length : 0;
  return { ideas: [first, ...rest.slice(shift), ...rest.slice(0, shift), ...tail].slice(0, limit), label, own: Math.min(limit, ownList.length) };
}

/**
 * Ideas for a row of places shown together: each card's top pick avoids repeating the
 * card before it when the place has another good option, so the row reads as a real choice.
 */
export function ideasForRow(places: Pick<Place, 'id' | 'kind' | 'cuisines'>[], ideas: Recommendation[], limit = IDEAS_PER_PLACE): PlaceIdeas[] {
  const out: PlaceIdeas[] = [];
  const usedTop = new Map<string, number>();
  for (const p of places) {
    const res = ideasWithLabel(p, ideas, limit);
    if (res.own > 1) {
      // Prefer a top pick that hasn't led a card yet (or has led the fewest), among the first three of its own dishes.
      const head = res.ideas.slice(0, Math.min(3, res.own));
      const best = head.reduce((a, b) => ((usedTop.get(b.meal.id) ?? 0) < (usedTop.get(a.meal.id) ?? 0) ? b : a));
      res.ideas = [best, ...res.ideas.filter((r) => r !== best)];
    }
    if (res.ideas[0]) usedTop.set(res.ideas[0].meal.id, (usedTop.get(res.ideas[0].meal.id) ?? 0) + 1);
    out.push(res);
  }
  return out;
}
