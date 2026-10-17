// Understands what people type about food ("I hate mushrooms, love spicy food",
// "allergic to shrimp") with word lists, on the phone. No AI, nothing sent anywhere.
// Rules: allergies found here are only *suggestions* the user must confirm; anything
// that can't be matched is kept as a visible note and never silently used.
import type { Ingredient } from './ingredients';
import type { Allergen, Context, Cuisine } from './types';

export interface Understood {
  likes: Ingredient[];
  dislikes: Ingredient[];
  /** Cuisines the user said they like. */
  cuisines: Cuisine[];
  /** Allergens the user mentioned. Never applied without confirmation. */
  allergens: Allergen[];
  /** True when the user mentioned an allergy EatOS can't screen for (e.g. mustard). */
  unscreenedAllergy: boolean;
  /** Part of the text wasn't understood, so it's worth keeping as a note. */
  leftover: boolean;
}

export const MAX_TYPED = 120;

type Feeling = 'like' | 'dislike' | 'allergy';
type Hit = { at: number; end: number } & ({ kind: 'food'; v: Ingredient[] } | { kind: 'cuisine'; v: Cuisine } | { kind: 'allergen'; v: Allergen[] } | { kind: 'feeling'; v: Feeling });

const FOOD_WORDS: [string, Ingredient[]][] = [
  ['peanut butter', ['peanut butter']], ['sunflower butter', ['sunflower butter']], ['sunbutter', ['sunflower butter']],
  ['sour cream', ['sour cream']], ['soy sauce', ['soy sauce']], ['ground beef', ['beef']],
  ['bell peppers', ['peppers']], ['bell pepper', ['peppers']], ['sweet potatoes', ['potato']], ['sweet potato', ['potato']],
  ['spicy food', ['spicy']], ['hot sauce', ['spicy']], ['red meat', ['beef', 'pork']], ['cheesy', ['cheese']],
  ['seafood', ['fish', 'shrimp', 'salmon', 'tuna']], ['poultry', ['chicken', 'turkey']],
  ['mushrooms', ['mushrooms']], ['mushroom', ['mushrooms']], ['shrooms', ['mushrooms']],
  ['olives', ['olives']], ['olive', ['olives']], ['cilantro', ['cilantro']], ['coriander', ['cilantro']],
  ['onions', ['onion']], ['onion', ['onion']],
  ['spicy', ['spicy']], ['spice', ['spicy']], ['jalapenos', ['spicy']], ['jalapeños', ['spicy']],
  ['tofu', ['tofu']], ['fish', ['fish']], ['salmon', ['salmon']], ['tuna', ['tuna']], ['shrimp', ['shrimp']], ['prawns', ['shrimp']],
  ['avocados', ['avocado']], ['avocado', ['avocado']], ['guacamole', ['avocado']], ['guac', ['avocado']],
  ['beans', ['beans']], ['bean', ['beans']], ['chickpeas', ['chickpeas']], ['chickpea', ['chickpeas']], ['garbanzo', ['chickpeas']],
  ['lentils', ['lentils']], ['lentil', ['lentils']], ['eggs', ['eggs']], ['egg', ['eggs']],
  ['cheese', ['cheese']], ['yogurt', ['yogurt']], ['yoghurt', ['yogurt']], ['milk', ['milk']], ['mayonnaise', ['mayo']], ['mayo', ['mayo']],
  ['chicken', ['chicken']], ['turkey', ['turkey']], ['beef', ['beef']], ['steak', ['beef']], ['burgers', ['beef']], ['burger', ['beef']],
  ['pork', ['pork']], ['bacon', ['pork']], ['ham', ['pork']], ['sausage', ['pork']],
  ['rice', ['rice']], ['pasta', ['pasta']], ['spaghetti', ['pasta']], ['noodles', ['noodles']],
  ['bread', ['bread']], ['toast', ['bread']], ['tortillas', ['tortilla']], ['tortilla', ['tortilla']], ['wraps', ['tortilla']],
  ['potatoes', ['potato']], ['potato', ['potato']], ['fries', ['potato']], ['tomatoes', ['tomato']], ['tomato', ['tomato']], ['salsa', ['salsa']],
  ['peppers', ['peppers']], ['broccoli', ['broccoli']], ['spinach', ['spinach']], ['corn', ['corn']], ['cucumbers', ['cucumber']], ['cucumber', ['cucumber']],
  ['salad', ['greens']], ['lettuce', ['greens']], ['greens', ['greens']], ['kale', ['greens']],
  ['seaweed', ['seaweed']], ['coconut', ['coconut']], ['curry', ['curry spices']], ['hummus', ['hummus']],
  ['oatmeal', ['oats']], ['oats', ['oats']], ['granola', ['granola']], ['cereal', ['cereal']], ['crackers', ['crackers']],
  ['nuts', ['nuts']], ['almonds', ['nuts']], ['cashews', ['nuts']], ['walnuts', ['nuts']],
  ['berries', ['berries']], ['strawberries', ['berries']], ['blueberries', ['berries']],
  ['apples', ['apple']], ['apple', ['apple']], ['bananas', ['banana']], ['banana', ['banana']], ['fruit', ['fruit']],
];

const CUISINE_WORDS: [string, Cuisine][] = [
  ['middle eastern', 'mediterranean'], ['mexican', 'mexican'], ['tacos', 'mexican'], ['burritos', 'mexican'],
  ['italian', 'italian'], ['pizza', 'italian'],
  ['asian', 'asian'], ['chinese', 'asian'], ['japanese', 'asian'], ['thai', 'asian'], ['korean', 'asian'], ['vietnamese', 'asian'], ['sushi', 'asian'],
  ['mediterranean', 'mediterranean'], ['greek', 'mediterranean'], ['indian', 'indian'],
  ['american', 'american'], ['bbq', 'american'], ['barbecue', 'american'],
];

const ALLERGY_WORDS: [string, Allergen[]][] = [
  ['tree nuts', ['tree_nut']], ['tree nut', ['tree_nut']], ['peanuts', ['peanut']], ['peanut', ['peanut']],
  ['almonds', ['tree_nut']], ['cashews', ['tree_nut']], ['walnuts', ['tree_nut']], ['pecans', ['tree_nut']], ['pistachios', ['tree_nut']],
  ['nuts', ['peanut', 'tree_nut']], // "allergic to nuts" usually means both: the user confirms each
  ['dairy', ['dairy']], ['milk', ['dairy']], ['lactose', ['dairy']], ['cheese', ['dairy']],
  ['eggs', ['egg']], ['egg', ['egg']], ['gluten', ['gluten']], ['wheat', ['gluten']], ['celiac', ['gluten']], ['coeliac', ['gluten']],
  ['soy', ['soy']], ['soya', ['soy']],
  ['shellfish', ['shellfish']], ['shrimp', ['shellfish']], ['prawns', ['shellfish']], ['crab', ['shellfish']], ['lobster', ['shellfish']],
  ['fish', ['fish']], ['sesame', ['sesame']], ['tahini', ['sesame']],
];

const FEELING_WORDS: [string, Feeling][] = [
  ...['allergic', 'allergy', 'allergies', 'anaphylactic', 'epipen', 'intolerant', 'intolerance', "can't eat", 'cannot eat', 'celiac', 'coeliac'].map(
    (w) => [w, 'allergy'] as [string, Feeling],
  ),
  ...["don't like", 'dont like', 'do not like', "doesn't like", "can't stand", 'cannot stand', 'not a fan of', 'not a fan', 'not into', 'no more', 'hate', 'hates', 'dislike', 'dislikes', 'never', 'avoid', 'gross', 'without', 'skip', 'nothing', 'not', 'no'].map(
    (w) => [w, 'dislike'] as [string, Feeling],
  ),
  ...['love', 'loves', 'like', 'likes', 'enjoy', 'enjoys', 'favorite', 'favourite', 'favorites', 'crave', 'craving', 'obsessed with', 'into', 'want', 'wanting', 'in the mood for', 'feel like', 'feeling like'].map(
    (w) => [w, 'like'] as [string, Feeling],
  ),
];

// Words with no food meaning: leftovers made only of these don't need a note.
const FILLER = new Set(
  "i i'm im me my we our a an the and or but to of in on at with for so too also really very much just food foods meal meals eat eating is are am was it it's its that this them they all any some kind kinds stuff things of be have has prefer please lot lots".split(' '),
);

const norm = (s: string) => ` ${s.toLowerCase().replace(/’/g, "'").replace(/[^a-zà-ÿ' ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;

/** All non-overlapping phrase hits in `t` (longest phrases claim their words first). */
function scan(t: string): { hits: Hit[]; unknown: string[] } {
  const taken = new Array<boolean>(t.length).fill(false);
  const hits: Hit[] = [];
  const add = <K extends Hit['kind']>(kind: K, words: [string, Extract<Hit, { kind: K }>['v']][]) => {
    for (const [phrase, v] of words) {
      const needle = ` ${phrase} `;
      for (let i = t.indexOf(needle); i !== -1; i = t.indexOf(needle, i + 1)) {
        const s = i + 1;
        const e = s + phrase.length;
        if (taken.slice(s, e).some(Boolean)) continue;
        for (let k = s; k < e; k++) taken[k] = true;
        hits.push({ at: s, end: e, kind, v } as Hit);
      }
    }
  };
  const byLength = <T>(xs: [string, T][]) => [...xs].sort((a, b) => b[0].length - a[0].length);
  add('feeling', byLength(FEELING_WORDS));
  add('food', byLength(FOOD_WORDS));
  add('cuisine', byLength(CUISINE_WORDS));
  const rest = t.split('').map((ch, i) => (taken[i] ? ' ' : ch)).join('');
  return { hits: hits.sort((a, b) => a.at - b.at), unknown: rest.split(' ').filter((w) => w && !FILLER.has(w)) };
}

/**
 * `start` is what a bare list of foods means where it was typed: under "foods you'd
 * rather never see" it's 'dislike'; under "foods you love" it's 'like'.
 */
export function understandFoodText(raw: string, start: 'like' | 'dislike' | 'neutral' = 'neutral'): Understood {
  const out: Understood = { likes: [], dislikes: [], cuisines: [], allergens: [], unscreenedAllergy: false, leftover: false };
  const push = <T>(xs: T[], v: T) => void (xs.includes(v) ? null : xs.push(v));
  let feeling: Feeling | 'neutral' = start;
  // Clauses: "love tacos, but hate cilantro". Allergy wording only lasts for its own clause.
  for (const clause of raw.slice(0, MAX_TYPED).split(/[,.;!?\n]+|\bbut\b|\bexcept\b|\bhowever\b/i)) {
    const t = norm(clause);
    if (!t.trim()) continue;
    const { hits, unknown } = scan(t);
    const allergyClause = hits.some((h) => h.kind === 'feeling' && h.v === 'allergy');
    if (allergyClause) {
      // Re-read the clause with allergen words; anything else named is an allergy EatOS can't check.
      const found = ALLERGY_WORDS.filter(([w]) => t.includes(` ${w} `));
      const longest = found.filter(([w]) => !found.some(([o]) => o !== w && o.includes(w)));
      for (const [, as] of longest) for (const a of as) push(out.allergens, a);
      const covered = new Set(longest.flatMap(([w]) => w.split(' ')));
      const other = [...unknown, ...hits.filter((h) => h.kind !== 'feeling').map((h) => t.slice(h.at, h.end))].filter((w) => !w.split(' ').every((x) => covered.has(x)));
      if (other.length) {
        out.unscreenedAllergy = true;
        out.leftover = true;
      }
      continue;
    }
    for (const h of hits) {
      if (h.kind === 'feeling') feeling = h.v;
      else if (h.kind === 'food') {
        for (const i of h.v) {
          if (feeling === 'like') {
            push(out.likes, i);
            out.dislikes = out.dislikes.filter((x) => x !== i); // the later statement wins
          } else if (feeling === 'dislike') {
            push(out.dislikes, i);
            out.likes = out.likes.filter((x) => x !== i);
          } else out.leftover = true; // a food with no clear feeling: keep the words as a note
        }
      } else if (h.kind === 'cuisine') {
        if (feeling === 'like') push(out.cuisines, h.v);
        else out.leftover = true;
      }
    }
    if (unknown.length) out.leftover = true;
  }
  return out;
}

// ---------- "What are you in the mood for?" ----------

export interface MoodRead {
  /** Choices to flip on the Home screen, visibly (the user can still change them). */
  patch: Partial<Pick<Context, 'feeling' | 'hunger' | 'time' | 'budget' | 'setting'>>;
  /** Foods and cuisines to lean toward for this one decision. */
  foods: Ingredient[];
  cuisines: Cuisine[];
  /** Foods to leave out for this one decision ("nothing spicy"). */
  avoid: Ingredient[];
}

// Checked longest-first and removed before food words, so "no time" isn't read as a dislike.
const MOOD_WORDS: [string, MoodRead['patch']][] = [
  ...['tired', 'exhausted', 'sleepy', 'drained', 'wiped', 'low energy'].map((w) => [w, { feeling: 'tired' }] as [string, MoodRead['patch']]),
  ...['stressed', 'anxious', 'overwhelmed', 'busy day', 'hectic'].map((w) => [w, { feeling: 'stressed' }] as [string, MoodRead['patch']]),
  ...['sad', 'down', 'rough day', 'bad day', 'comfort food', 'comfort', 'cozy', 'sick'].map((w) => [w, { feeling: 'comfort' }] as [string, MoodRead['patch']]),
  ...['energized', 'great', 'pumped', 'after my workout', 'after a workout', 'post workout', 'just worked out'].map((w) => [w, { feeling: 'energized' }] as [string, MoodRead['patch']]),
  ...['starving', 'famished', 'very hungry', 'really hungry', 'so hungry', 'super hungry'].map((w) => [w, { hunger: 'very' }] as [string, MoodRead['patch']]),
  ...['a snack', 'snack', 'peckish', 'a little hungry', 'not very hungry', 'not that hungry', 'something light', 'light'].map((w) => [w, { hunger: 'light' }] as [string, MoodRead['patch']]),
  ...['quick', 'fast', 'no time', 'in a hurry', 'in a rush', 'easy', 'minutes'].map((w) => [w, { time: 10 }] as [string, MoodRead['patch']]),
  ...['cheap', 'broke', 'on a budget', 'budget', 'inexpensive'].map((w) => [w, { budget: 1 }] as [string, MoodRead['patch']]),
  ...['treat myself', 'splurge', 'fancy', 'celebrate', 'celebrating'].map((w) => [w, { budget: 3 }] as [string, MoodRead['patch']]),
  ...['takeout', 'take out', 'delivery', 'order in', 'ordering in', 'pick up'].map((w) => [w, { setting: 'takeout' }] as [string, MoodRead['patch']]),
  ...['eat out', 'eating out', 'restaurant', 'dine out', 'sit down'].map((w) => [w, { setting: 'restaurant' }] as [string, MoodRead['patch']]),
  ...['at home', 'cook', 'cooking', 'make something'].map((w) => [w, { setting: 'home' }] as [string, MoodRead['patch']]),
  ...['at work', 'at the office', 'work lunch'].map((w) => [w, { setting: 'work' }] as [string, MoodRead['patch']]),
  ...['on the go', 'on the road', 'driving', 'airport', 'gas station'].map((w) => [w, { setting: 'on_the_go' }] as [string, MoodRead['patch']]),
];

export function understandMood(raw: string): MoodRead {
  let t = norm(raw.slice(0, MAX_TYPED));
  let patch: MoodRead['patch'] = {};
  for (const [phrase, p] of [...MOOD_WORDS].sort((a, b) => b[0].length - a[0].length)) {
    const needle = ` ${phrase} `;
    if (!t.includes(needle)) continue;
    patch = { ...p, ...patch }; // the first, most specific phrase for each choice wins
    t = t.split(needle).join(' , ');
  }
  // What's left is about food: a bare food here means "I want that".
  const u = understandFoodText(t, 'like');
  return { patch, foods: u.likes, cuisines: u.cuisines, avoid: u.dislikes };
}

export function understoodAnything(u: Understood): boolean {
  return u.likes.length + u.dislikes.length + u.cuisines.length + u.allergens.length > 0;
}
