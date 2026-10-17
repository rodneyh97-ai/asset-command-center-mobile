// Read-only client for the public food & place library on the EatOS server.
// Everything coming back is treated as untrusted input: validated, clamped, typed.
import type { Allergen } from '../engine';
import { serverHeaders, serverUrl, usageServerConfigured } from '../analytics/usage';

export const libraryConfigured = () => usageServerConfigured();

const ALLERGENS: Allergen[] = ['peanut', 'tree_nut', 'dairy', 'egg', 'gluten', 'soy', 'fish', 'shellfish', 'sesame'];
const NUTRIENT_KEYS = [
  'energy_kcal', 'protein_g', 'carbs_g', 'fat_g', 'sat_fat_g', 'fiber_g', 'sugars_g', 'sodium_mg',
  'calcium_mg', 'iron_mg', 'potassium_mg', 'magnesium_mg', 'zinc_mg', 'vitamin_c_mg', 'vitamin_d_ug', 'vitamin_b12_ug',
] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export type PlaceKind = 'restaurant' | 'fast_food' | 'cafe' | 'grocery' | 'convenience';
const PLACE_KINDS: PlaceKind[] = ['restaurant', 'fast_food', 'cafe', 'grocery', 'convenience'];

export interface Food {
  id: number;
  source: 'usda_fdc' | 'open_food_facts';
  name: string;
  brand: string | null;
  allergens: Allergen[];
  allergensKnown: boolean;
  mayContain: Allergen[];
  /** Per 100 g. Only keys the source actually measured. */
  nutrients: Partial<Record<NutrientKey, number>>;
  verified: boolean;
}

export interface Place {
  id: number;
  kind: PlaceKind;
  name: string;
  cuisines: string[];
  lat: number;
  lon: number;
  street: string | null;
  /** The place's own site / menu page from OpenStreetMap (http/https only). */
  website?: string | null;
  menuUrl?: string | null;
  /** Last edit of the OSM entry (any edit). Not the day the place opened. */
  osmUpdatedAt?: string | null;
}

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
/** An http(s) web link with a host, at most 300 characters; anything else (javascript:, tel:, junk) is dropped. */
export const webLink = (v: unknown): string | null =>
  typeof v === 'string' && v.length <= 300 && /^https?:\/\/[^\s/?#]+\.[^\s]*$/i.test(v) ? v : null;
const isoTime = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null);
const allergenList = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((a): a is Allergen => ALLERGENS.includes(a as Allergen)))] : []);

export function parseFood(r: unknown): Food | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  const name = str(o.name, 200);
  if (!Number.isInteger(o.id) || !name || (o.source !== 'usda_fdc' && o.source !== 'open_food_facts')) return null;
  const nutrients: Food['nutrients'] = {};
  const n = o.nutrients && typeof o.nutrients === 'object' ? (o.nutrients as Record<string, unknown>) : {};
  for (const k of NUTRIENT_KEYS) {
    const v = n[k];
    // USDA computes carbs "by difference", which can dip just below zero (e.g. -0.43 g for raw chicken): that's 0.
    if (typeof v === 'number' && Number.isFinite(v) && v > -1 && v < 100000) nutrients[k] = Math.max(0, v);
  }
  return {
    id: o.id as number,
    source: o.source,
    name,
    brand: str(o.brand, 120),
    allergens: allergenList(o.allergens),
    allergensKnown: o.allergens_known === true,
    mayContain: allergenList(o.may_contain),
    nutrients,
    verified: o.verified === true,
  };
}

export function parsePlace(r: unknown): Place | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  const name = str(o.name, 200);
  const lat = Number(o.lat);
  const lon = Number(o.lon);
  if (!Number.isInteger(o.id) || !name || !PLACE_KINDS.includes(o.kind as PlaceKind)) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const a = o.address && typeof o.address === 'object' ? (o.address as Record<string, unknown>) : {};
  const street = [str(a.housenumber, 20), str(a.street, 120)].filter(Boolean).join(' ') || null;
  return {
    id: o.id as number,
    kind: o.kind as PlaceKind,
    name,
    cuisines: Array.isArray(o.cuisines) ? o.cuisines.filter((x): x is string => typeof x === 'string' && /^[a-z_]{2,30}$/.test(x)).slice(0, 4) : [],
    lat,
    lon,
    street,
    website: webLink(o.website),
    menuUrl: webLink(o.menu_url),
    osmUpdatedAt: isoTime(o.osm_updated_at),
  };
}

const NEW_ON_MAP_DAYS = 90;
/** Added or edited on OpenStreetMap in the last 90 days. Says nothing about when the place opened. */
export function newOnMap(p: Pick<Place, 'osmUpdatedAt'>, now: Date): boolean {
  const t = p.osmUpdatedAt ? Date.parse(p.osmUpdatedAt) : NaN;
  const age = now.getTime() - t;
  return Number.isFinite(age) && age >= -86400000 && age <= NEW_ON_MAP_DAYS * 86400000;
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
interface Opts {
  url?: string;
  key?: string;
  fetchImpl?: Fetch;
}

async function rpc(fn: string, body: object, opts: Opts): Promise<unknown[]> {
  const url = opts.url ?? serverUrl();
  const key = opts.key;
  const res = await (opts.fetchImpl ?? (fetch as unknown as Fetch))(`${url.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { ...serverHeaders(key), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`library ${fn} failed (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data.slice(0, 50) : [];
}

export async function searchFoods(q: string, opts: Opts = {}): Promise<Food[]> {
  const query = q.trim().slice(0, 60);
  if (query.length < 2) return [];
  const rows = await rpc('search_foods', { q: query, lim: 25 }, opts);
  return rows.map(parseFood).filter((f): f is Food => !!f);
}

export async function placesNear(lat: number, lon: number, kind: PlaceKind | null, opts: Opts = {}): Promise<Place[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  const rows = await rpc('places_near', { p_lat: lat, p_lon: lon, p_km: 8, p_kind: kind }, opts);
  return rows.map(parsePlace).filter((p): p is Place => !!p);
}

/** Great-circle distance in miles. */
export function milesBetween(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLon - aLon) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}
