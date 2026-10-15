import { CATALOG } from './catalog';
import type {
  Allergen,
  Context,
  FeedbackEvent,
  MealIdea,
  MealTime,
  Profile,
  Recommendation,
  RecommendationResult,
  ScoredReason,
  Setting,
} from './types';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const ALLERGEN_LABEL: Record<Allergen, string> = {
  peanut: 'peanut',
  tree_nut: 'tree nut',
  dairy: 'dairy',
  egg: 'egg',
  gluten: 'gluten/wheat',
  soy: 'soy',
  fish: 'fish',
  shellfish: 'shellfish',
  sesame: 'sesame',
};

const OUTSIDE_HOME = new Set<Setting>(['takeout', 'restaurant', 'on_the_go']);
const HUNGER_RANK = { light: 0, normal: 1, very: 2 } as const;

export function mealTimeFor(date: Date): MealTime {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 5 && h < 10.5) return 'breakfast';
  if (h >= 11 && h < 14.5) return 'lunch';
  if (h >= 17 && h < 21.5) return 'dinner';
  return 'snack';
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Diet rules are hard constraints, same as allergies. */
export function violatesDiet(meal: MealIdea, profile: Profile): boolean {
  const d = meal.diet;
  for (const diet of profile.diets) {
    if (diet === 'vegan' && (d.hasMeat || d.hasFish || d.hasAnimalProducts)) return true;
    if (diet === 'vegetarian' && (d.hasMeat || d.hasFish)) return true;
    if (diet === 'pescatarian' && d.hasMeat) return true;
    if (diet === 'no_pork' && d.hasPork) return true;
    if (diet === 'no_red_meat' && d.hasRedMeat) return true;
  }
  return false;
}

// Keyword guard so a suggested swap never adds something the user can't eat.
const SWAP_ALLERGEN_WORDS: Record<Allergen, RegExp> = {
  peanut: /peanut/i,
  tree_nut: /\bnuts?\b|almond|cashew|walnut|pecan|pesto/i,
  dairy: /cheese|yogurt|milk|parmesan|feta|cream|(?<!seed |peanut )butter/i,
  egg: /\begg|mayo/i,
  gluten: /bread|\bwrap\b|tortilla|pita|naan|roti|\bbun\b|pasta/i,
  soy: /tofu|soy|edamame|tamari/i,
  fish: /tuna|salmon|fish/i,
  shellfish: /shrimp|crab|lobster/i,
  sesame: /sesame|tahini|hummus/i,
};
const MEAT_WORDS = /chicken|turkey|beef|steak|sausage|pork|bacon/i;
const FISH_WORDS = /tuna|salmon|fish|shrimp/i;
const ANIMAL_WORDS = /cheese|yogurt|milk|parmesan|feta|cream|(?<!seed |peanut )butter|\begg/i;

export function swapsFor(meal: MealIdea, profile: Profile): string[] {
  const vegan = profile.diets.includes('vegan');
  const veg = vegan || profile.diets.includes('vegetarian');
  const pesc = profile.diets.includes('pescatarian');
  return meal.swaps.filter((s) => {
    if ((veg || pesc) && MEAT_WORDS.test(s)) return false;
    if (veg && FISH_WORDS.test(s)) return false;
    if (vegan && ANIMAL_WORDS.test(s) && !/dairy-free|coconut|soy yogurt|instead of dairy/i.test(s)) return false;
    // A swap that *removes* an allergen ("Corn tortillas for gluten-free",
    // "... if you avoid peanuts") is fine. Anything else mentioning it is dropped.
    for (const a of profile.allergens) {
      const label = ALLERGEN_LABEL[a].split('/')[0];
      const removes = new RegExp(`${label}-free|avoid ${label}`, 'i');
      if (SWAP_ALLERGEN_WORDS[a].test(s) && !removes.test(s)) return false;
    }
    return true;
  });
}

interface Eligibility {
  ok: boolean;
  cautions: string[];
}

/**
 * Allergy + diet check for one meal in one setting. Every path that shows a meal
 * to the user (recommendations, "Have again") must go through this.
 */
export function safetyCheck(meal: MealIdea, profile: Profile, setting: Setting): Eligibility {
  if (violatesDiet(meal, profile)) return { ok: false, cautions: [] };
  // A known allergen in the standard version always excludes.
  if (meal.contains.some((a) => profile.allergens.includes(a))) return { ok: false, cautions: [] };
  const uncertain = meal.mayContain.filter((a) => profile.allergens.includes(a));
  if (uncertain.length === 0) return { ok: true, cautions: [] };
  // Outside the home the user can't read labels or control prep: exclude.
  if (OUTSIDE_HOME.has(setting)) return { ok: false, cautions: [] };
  return {
    ok: true,
    cautions: [`Check labels: some versions contain ${list(uncertain.map((a) => ALLERGEN_LABEL[a]))}.`],
  };
}

function checkHardConstraints(
  meal: MealIdea,
  profile: Profile,
  ctx: Context,
  dislikedIds: Set<string>,
): Eligibility {
  if (dislikedIds.has(meal.id)) return { ok: false, cautions: [] };
  if (!meal.settings.includes(ctx.setting)) return { ok: false, cautions: [] };
  const safety = safetyCheck(meal, profile, ctx.setting);
  if (!safety.ok) return safety;
  const cautions = [...safety.cautions];

  // Time: home/work meals must fit the time available.
  const needsPrep = ctx.setting === 'home' || ctx.setting === 'work';
  if (needsPrep && meal.prepMinutes > ctx.time) return { ok: false, cautions };

  // Budget: two or more tiers over is never shown.
  if (meal.budget - ctx.budget >= 2) return { ok: false, cautions };
  if (meal.budget > ctx.budget) cautions.push('May be a bit above the budget you picked.');

  return { ok: true, cautions };
}

/** Safety notes shown on every recommendation for this user/context, regardless of meal. */
export function standingCautions(profile: Profile, ctx: Context): string[] {
  const out: string[] = [];
  if (profile.allergens.length > 0 && OUTSIDE_HOME.has(ctx.setting)) {
    out.push(
      `Recipes and shared kitchens vary. Tell staff about your ${list(
        profile.allergens.map((a) => ALLERGEN_LABEL[a]),
      )} allergy and confirm before ordering. EatOS can't verify restaurant ingredients.`,
    );
  }
  if (profile.considerations.includes('medical')) {
    out.push('General idea, not medical advice. If your care team gave you a plan, follow theirs.');
  }
  return out;
}

function scoreMeal(
  meal: MealIdea,
  profile: Profile,
  ctx: Context,
  history: FeedbackEvent[],
  now: Date,
): { score: number; reasons: ScoredReason[] } {
  const reasons: ScoredReason[] = [];
  const add = (weight: number, text: string) => reasons.push({ weight, text });
  const gentle = profile.considerations.includes('ed_sensitive');

  // Goal fit
  switch (profile.goal) {
    case 'build_muscle':
      if (meal.highProtein) add(3, 'High in protein for your muscle-building goal');
      if (meal.satiety === 'very') add(1, 'A substantial meal');
      break;
    case 'lose_weight':
      if (meal.highProtein && meal.highFiber) add(3, gentle ? 'Balanced and filling' : 'Protein and fiber keep you full longer');
      else if (meal.highProtein) add(2, gentle ? 'Balanced and filling' : 'Protein helps you stay full');
      else if (meal.highFiber) add(2, gentle ? 'Balanced and filling' : 'Fiber helps you stay full');
      break;
    case 'maintain':
      if (meal.highProtein || meal.highFiber) add(1.5, 'Balanced and satisfying');
      break;
    case 'eat_better':
      if (meal.highFiber) add(2, 'Includes fiber-rich whole foods');
      if (meal.highProtein) add(1, 'Good source of protein');
      break;
    case 'more_energy':
      if (meal.highProtein && meal.highFiber) add(2.5, 'Protein and fiber for steadier energy');
      else if (meal.highProtein || meal.highFiber) add(1.5, 'Steadier energy than a quick snack');
      break;
  }

  // Taste
  if (profile.cuisines.includes(meal.cuisine)) add(2, 'Matches food you enjoy');

  // Meal time
  if (meal.mealTimes.includes(ctx.mealTime)) add(2, '');
  else add(-4, '');

  // Hunger
  const diff = Math.abs(HUNGER_RANK[meal.satiety] - HUNGER_RANK[ctx.hunger]);
  if (diff === 0) add(2, ctx.hunger === 'very' ? 'Filling enough for how hungry you are' : 'Right-sized for your hunger');
  else if (diff === 2) add(-3, '');

  // Time / effort
  const athome = ctx.setting === 'home' || ctx.setting === 'work';
  if (athome && ctx.time <= 15 && meal.prepMinutes <= 5) add(1.5, `Ready in about ${Math.max(meal.prepMinutes, 2)} minutes`);
  else if (athome && meal.prepMinutes <= ctx.time) add(0.5, `Ready in about ${meal.prepMinutes} minutes`);

  // Feeling
  if (ctx.feeling === 'tired' || ctx.feeling === 'stressed') {
    if (meal.effort === 'none') add(2, 'Almost no effort on a draining day');
    else if (meal.effort === 'low') add(1, 'Low effort');
    else add(-2, '');
  }
  if (ctx.feeling === 'comfort' && meal.comfort) add(3, 'Comforting without derailing your goal');
  if (ctx.feeling === 'energized' && meal.highFiber) add(0.5, '');

  // Budget
  if (meal.budget <= ctx.budget) add(meal.budget < ctx.budget ? 1 : 0.5, meal.budget === 1 ? 'Budget-friendly' : 'Fits your budget');
  else add(-3, '');

  // What makes eating well hard for this user
  if (profile.struggles.includes('no_time') && meal.effort === 'none') add(1, '');
  if (profile.struggles.includes('budget') && meal.budget === 1) add(1, '');
  if (profile.struggles.includes('cooking') && meal.effort !== 'medium') add(1, 'No real cooking skills needed');
  if (profile.struggles.includes('cravings') && meal.comfort && (meal.highProtein || meal.highFiber)) {
    add(1, 'Satisfying, so cravings are less likely to win later');
  }

  // Learned from explicit feedback
  const mine = history.filter((e) => e.mealId === meal.id);
  const saved = isSaved(meal.id, history);
  if (saved) add(2, 'One of your saved meals');
  if (mine.some((e) => e.kind === 'loved')) add(1.5, 'You loved this last time');
  const accepted = mine.filter((e) => e.kind === 'accepted');
  const familiarity = profile.struggles.includes('decision_fatigue') ? 1.5 : 1;
  if (accepted.length > 0) add(Math.min(accepted.length, 3) * familiarity, 'You’ve picked this before');
  if (accepted.some((e) => now.getTime() - Date.parse(e.at) < 20 * HOUR)) add(-5, '');
  const recentSwaps = mine.filter((e) => e.kind === 'swapped' && now.getTime() - Date.parse(e.at) < 7 * DAY);
  if (recentSwaps.length > 0) add(-Math.min(recentSwaps.length, 3), '');

  const score = reasons.reduce((s, r) => s + r.weight, 0);
  return { score, reasons };
}

export function isSaved(mealId: string, history: FeedbackEvent[]): boolean {
  let saved = false;
  for (const e of history) {
    if (e.mealId !== mealId) continue;
    if (e.kind === 'saved') saved = true;
    if (e.kind === 'unsaved' || e.kind === 'disliked') saved = false;
  }
  return saved;
}

export function dislikedIds(history: FeedbackEvent[]): Set<string> {
  const out = new Set<string>();
  for (const e of history) {
    if (e.kind === 'disliked') out.add(e.mealId);
    // Explicitly saving a meal later undoes an earlier dislike.
    if (e.kind === 'saved') out.delete(e.mealId);
  }
  return out;
}

export interface RecommendOptions {
  history?: FeedbackEvent[];
  /** Meals to skip in this session (e.g. after the user tapped "swap"). */
  exclude?: string[];
  now?: Date;
  catalog?: MealIdea[];
}

export function recommend(profile: Profile, ctx: Context, opts: RecommendOptions = {}): RecommendationResult {
  const history = opts.history ?? [];
  const now = opts.now ?? new Date();
  const catalog = opts.catalog ?? CATALOG;
  const exclude = new Set(opts.exclude ?? []);
  const disliked = dislikedIds(history);
  const standing = standingCautions(profile, ctx);

  const ranked: Recommendation[] = [];
  let eligibleCount = 0;
  for (const meal of catalog) {
    const elig = checkHardConstraints(meal, profile, ctx, disliked);
    if (!elig.ok) continue;
    eligibleCount++;
    if (exclude.has(meal.id)) continue;
    const { score, reasons } = scoreMeal(meal, profile, ctx, history, now);
    const shown = reasons
      .filter((r) => r.weight > 0 && r.text)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((r) => r.text);
    ranked.push({ meal, score, reasons: shown, cautions: [...elig.cautions, ...standing] });
  }

  // Stable ordering: score, then catalog order (deterministic, testable).
  ranked.sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return {
      primary: null,
      alternatives: [],
      emptyReason:
        eligibleCount > 0
          ? 'You’ve seen every option that fits right now. Change where you’re eating, time, or budget for new ideas.'
          : 'Nothing fits all of your restrictions for this situation. Try a different place to eat, more time, or a higher budget.',
    };
  }

  const [primary, ...rest] = ranked;
  // Alternatives: prefer variety in cuisine from the primary pick.
  const alternatives: Recommendation[] = [];
  for (const r of rest) {
    if (alternatives.length >= 2) break;
    if (r.meal.cuisine !== primary.meal.cuisine || rest.length <= 2) alternatives.push(r);
  }
  for (const r of rest) {
    if (alternatives.length >= 2) break;
    if (!alternatives.includes(r)) alternatives.push(r);
  }
  return { primary, alternatives };
}
