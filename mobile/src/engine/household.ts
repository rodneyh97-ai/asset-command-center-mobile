// Eating together: one recommendation that is safe for everyone at the table.
import { VALID } from './validate';
import type { Allergen, Cuisine, Diet, Profile } from './types';

export interface Member {
  id: string;
  /** Nickname only — nothing else identifying. */
  name: string;
  allergens: Allergen[];
  diets: Diet[];
  cuisines: Cuisine[];
}

/**
 * Combines the user with the people they're eating with.
 * Safety is a union (every allergy and diet rule counts); taste favors overlap.
 */
export function combineProfiles(me: Profile, others: Member[]): Profile {
  if (others.length === 0) return me;
  const uniq = <T>(xs: T[]) => [...new Set(xs)];
  const allCuisines = [me.cuisines, ...others.map((o) => o.cuisines)].filter((c) => c.length > 0);
  const shared = allCuisines.length ? allCuisines.reduce((a, b) => a.filter((x) => b.includes(x))) : [];
  return {
    ...me,
    allergens: uniq([...me.allergens, ...others.flatMap((o) => o.allergens)]),
    diets: uniq([...me.diets, ...others.flatMap((o) => o.diets)]),
    // Prefer what everyone enjoys; if there's no overlap, consider everyone's favorites.
    cuisines: shared.length ? shared : uniq(allCuisines.flat()),
  };
}

const MAX_MEMBERS = 8;

export function sanitizeMembers(raw: unknown): Member[] {
  if (!Array.isArray(raw)) return [];
  const out: Member[] = [];
  for (const m of raw.slice(0, MAX_MEMBERS)) {
    if (!m || typeof m !== 'object') continue;
    const o = m as Record<string, unknown>;
    if (typeof o.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(o.id)) continue;
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, 30) : '';
    if (!name) continue;
    const list = <T>(allowed: T[], v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x) => allowed.includes(x as T)))] as T[] : []);
    out.push({
      id: o.id,
      name,
      allergens: list(VALID.allergen, o.allergens),
      diets: list(VALID.diet, o.diets),
      cuisines: list(VALID.cuisine, o.cuisines),
    });
  }
  return out;
}
