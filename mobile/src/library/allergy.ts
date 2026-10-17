// What to tell a user about a library food and their allergies. Rule: this can only ever WARN.
// Missing data is "unknown — check the label", never "safe". A name that suggests an allergen
// (e.g. "Peanut butter" in USDA data, which records no allergens) adds a warning on top.
import type { Allergen } from '../engine';
import type { Food } from './client';

// Whole-word hints in food names. Deliberately broad: a false warning is cheap, a missed one isn't.
const NAME_HINTS: Record<Allergen, RegExp> = {
  peanut: /\bpeanuts?\b|\bgroundnuts?\b|\breese'?s\b/i,
  tree_nut: /\b(almonds?|cashews?|walnuts?|pecans?|pistachios?|hazelnuts?|macadamias?|brazil nuts?|pine nuts?|nutella|praline|marzipan|mixed nuts|nut butter)\b/i,
  dairy: /\b(milk|cheese|butter|cream|yogurt|yoghurt|whey|casein|ghee|buttermilk|ice cream|custard)\b/i,
  egg: /\b(eggs?|mayonnaise|mayo|meringue|custard|omelet|omelette|quiche|eggnog)\b/i,
  gluten: /\b(wheat|bread|pasta|noodles?|flour|barley|rye|couscous|seitan|bagels?|crackers?|cookies?|cakes?|muffins?|pretzels?|croissants?|biscuits?|tortillas?)\b/i,
  soy: /\b(soy|soya|soybeans?|tofu|tempeh|edamame|miso|soy sauce)\b/i,
  fish: /\b(fish|salmon|tuna|cod|tilapia|trout|sardines?|anchov(y|ies)|halibut|mackerel|herring|pollock|haddock|catfish|bass)\b/i,
  shellfish: /\b(shrimp|prawns?|crab|lobster|crayfish|clams?|mussels?|oysters?|scallops?|squid|calamari|octopus)\b/i,
  sesame: /\b(sesame|tahini|halva|halvah)\b/i,
};

export interface AllergyStatus {
  /** Worst level for this user. */
  level: 'contains' | 'may_contain' | 'name_suggests' | 'unknown' | 'none_listed';
  contains: Allergen[];
  mayContain: Allergen[];
  nameSuggests: Allergen[];
}

export function allergyStatus(food: Pick<Food, 'name' | 'brand' | 'allergens' | 'allergensKnown' | 'mayContain'>, mine: Allergen[]): AllergyStatus {
  const contains = mine.filter((a) => food.allergens.includes(a));
  const mayContain = mine.filter((a) => food.mayContain.includes(a) && !contains.includes(a));
  const text = `${food.name} ${food.brand ?? ''}`;
  const nameSuggests = mine.filter((a) => NAME_HINTS[a].test(text) && !contains.includes(a) && !mayContain.includes(a));
  const level = contains.length
    ? 'contains'
    : mayContain.length
      ? 'may_contain'
      : nameSuggests.length
        ? 'name_suggests'
        : !food.allergensKnown
          ? 'unknown'
          : 'none_listed';
  return { level, contains, mayContain, nameSuggests };
}
