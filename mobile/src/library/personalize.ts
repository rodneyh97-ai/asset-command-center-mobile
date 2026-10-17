// Personal ordering for the library, from what EatOS has learned (on-device only).
// It only reorders and explains: it never hides results and never touches allergy warnings.
import { CATALOG, INGREDIENTS, learnTaste, valuesOf, type Cuisine, type Ingredient, type Memory } from '../engine';
import type { AppState } from '../store/state';
import { memoriesNow } from '../store/state';
import type { Food, Place } from './client';

export interface Taste {
  /** Roughly -2…+2 per cuisine: stated preferences plus learned behaviour. */
  cuisine: Partial<Record<Cuisine, number>>;
  likes: Ingredient[];
  dislikes: Ingredient[];
}

const CUISINE_WORD: Record<Cuisine, string> = {
  american: 'American', mexican: 'Mexican', italian: 'Italian', asian: 'Asian', mediterranean: 'Mediterranean',
  indian: 'Indian', breakfast: 'breakfast spots', simple: 'simple food',
};

/** Me + whoever I'm eating with: their dislikes count too. */
export function tasteFor(state: AppState, now: Date): Taste {
  const mems: Memory[] = memoriesNow(state, now);
  const mine = mems.filter((m) => m.subject === 'me');
  const cuisine: Taste['cuisine'] = {};
  for (const c of state.profile?.cuisines ?? []) cuisine[c] = (cuisine[c] ?? 0) + 1;
  if (state.personalization.learnFromBehavior) {
    const rejected = new Set(valuesOf(mine, 'not_true'));
    const t = learnTaste(state.history, CATALOG, now, rejected);
    for (const [trait, a] of t.affinity) {
      const [kind, v] = trait.split(':');
      if (kind === 'cuisine') cuisine[v as Cuisine] = (cuisine[v as Cuisine] ?? 0) + a;
    }
  }
  for (const v of valuesOf(mine, 'confirmed_trait')) {
    const [kind, c] = v.split(':');
    if (kind === 'cuisine') cuisine[c as Cuisine] = (cuisine[c as Cuisine] ?? 0) + 0.5;
  }
  const dislikes = [...new Set(valuesOf(mems, 'dislike_food'))] as Ingredient[];
  const likes = (valuesOf(mine, 'like_food') as Ingredient[]).filter((l) => !dislikes.includes(l));
  return { cuisine, likes, dislikes };
}

// "mushrooms" must match "Soup, mushroom" and vice versa: match the singular stem plus an optional plural.
const stem = (i: string) => (/[^su]s$/.test(i) ? i.slice(0, -1) : i);
const word = (i: string) => new RegExp(`\\b${stem(i).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(e?s)?\\b`, 'i');
const INGREDIENT_RX = new Map<Ingredient, RegExp>(INGREDIENTS.map((i) => [i, word(i)]));

export interface Ranked<T> {
  item: T;
  reason: string | null;
  /** Something the user (or someone they're eating with) said they don't like. */
  disliked: boolean;
}

/** Keeps the server's relevance order, nudged by likes/dislikes. */
export function rankFoods(foods: Food[], taste: Taste): Ranked<Food>[] {
  const scored = foods.map((f, i) => {
    const text = `${f.name} ${f.brand ?? ''}`;
    const bad = taste.dislikes.find((d) => INGREDIENT_RX.get(d)?.test(text));
    const good = taste.likes.find((l) => INGREDIENT_RX.get(l)?.test(text));
    const score = -i / Math.max(1, foods.length) + (good ? 0.6 : 0) - (bad ? 5 : 0);
    const reason = bad ? `You said you don’t like ${bad}` : good ? `You like ${good}` : null;
    return { item: f, reason, disliked: !!bad, score };
  });
  return scored.sort((a, b) => b.score - a.score).map(({ score: _s, ...r }) => r);
}

// OpenStreetMap cuisine tags → EatOS cuisines.
const OSM_CUISINE: Record<string, Cuisine> = {
  mexican: 'mexican', tex_mex: 'mexican', tacos: 'mexican', taco: 'mexican', burrito: 'mexican', latin_american: 'mexican',
  italian: 'italian', pizza: 'italian', pasta: 'italian',
  chinese: 'asian', japanese: 'asian', sushi: 'asian', thai: 'asian', vietnamese: 'asian', korean: 'asian', asian: 'asian', ramen: 'asian', noodle: 'asian', pho: 'asian', filipino: 'asian',
  mediterranean: 'mediterranean', greek: 'mediterranean', lebanese: 'mediterranean', middle_eastern: 'mediterranean', turkish: 'mediterranean', falafel: 'mediterranean', kebab: 'mediterranean', persian: 'mediterranean',
  indian: 'indian', pakistani: 'indian', nepalese: 'indian',
  breakfast: 'breakfast', pancake: 'breakfast', bagel: 'breakfast', brunch: 'breakfast', donut: 'breakfast',
  american: 'american', burger: 'american', bbq: 'american', barbecue: 'american', chicken: 'american', sandwich: 'american', steak_house: 'american', diner: 'american', hot_dog: 'american', wings: 'american',
};
export const placeCuisines = (p: Pick<Place, 'cuisines'>): Cuisine[] => [...new Set(p.cuisines.map((c) => OSM_CUISINE[c]).filter((c): c is Cuisine => !!c))];

/** Distance first; a cuisine you like counts as up to ~1.5 mi closer, one you avoid ~1 mi further. */
export function rankPlaces(places: Place[], milesTo: (p: Place) => number, taste: Taste, myStoreId: number | null): Ranked<Place>[] {
  const scored = places.map((p) => {
    const cs = placeCuisines(p);
    const best = cs.map((c) => ({ c, a: taste.cuisine[c] ?? 0 })).sort((x, y) => y.a - x.a)[0];
    const a = best ? Math.max(-1, Math.min(2, best.a)) : 0;
    const mine = p.id === myStoreId;
    const effective = mine ? -1 : milesTo(p) - 0.75 * a;
    const reason = mine ? 'Your grocery store' : best && best.a >= 0.5 ? `You like ${CUISINE_WORD[best.c]}` : null;
    return { item: p, reason, disliked: a <= -0.5, effective };
  });
  return scored.sort((x, y) => x.effective - y.effective).map(({ effective: _e, ...r }) => r);
}
