// Long-term personal memory: structured, attributable, editable, on-device.
// Rule: inferred patterns are never stored as facts. They're shown as "EatOS thinks…"
// and only become memories when the user confirms them.
import { INGREDIENTS, ingredientsOf, type Ingredient } from './ingredients';
import type { MealIdea } from './types';

export type MemoryKind =
  | 'stated' // the user told EatOS directly
  | 'confirmed' // the user confirmed something EatOS noticed
  | 'temporary'; // true for a limited time (has expiresAt)

export type MemorySource = 'onboarding' | 'profile' | 'question' | 'inference' | 'manual';

export type MemoryTopic =
  | 'preferred_name'
  | 'dislike_food'
  | 'like_food'
  | 'tradeoff' // 'faster' | 'cheaper' | 'both'
  | 'weeknight_cook_minutes' // '10' | '20' | '45'
  | 'weekly_grocery_budget' // '50' | '75' | '100' | '150'
  | 'cooking_skill' // 'beginner' | 'comfortable' | 'confident'
  | 'meals_per_day' // '2' | '3' | '4+'
  | 'not_true' // an inference the user rejected, e.g. 'cuisine:mexican'
  | 'confirmed_trait'; // an inference the user confirmed

export interface Memory {
  id: string;
  /** 'me' or a household member id. */
  subject: string;
  topic: MemoryTopic;
  value: string;
  kind: MemoryKind;
  source: MemorySource;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

const TOPICS: MemoryTopic[] = [
  'preferred_name',
  'dislike_food',
  'like_food',
  'tradeoff',
  'weeknight_cook_minutes',
  'weekly_grocery_budget',
  'cooking_skill',
  'meals_per_day',
  'not_true',
  'confirmed_trait',
];
const KINDS: MemoryKind[] = ['stated', 'confirmed', 'temporary'];
const SOURCES: MemorySource[] = ['onboarding', 'profile', 'question', 'inference', 'manual'];
const ALLOWED_VALUES: Partial<Record<MemoryTopic, readonly string[]>> = {
  dislike_food: INGREDIENTS,
  like_food: INGREDIENTS,
  tradeoff: ['faster', 'cheaper', 'both'],
  weeknight_cook_minutes: ['10', '20', '45'],
  weekly_grocery_budget: ['50', '75', '100', '150'],
  cooking_skill: ['beginner', 'comfortable', 'confident'],
  meals_per_day: ['2', '3', '4+'],
};
export const MAX_MEMORIES = 300;

/** Only memories that are still true right now. */
export function activeMemories(all: Memory[], now: Date, subjects: string[] = ['me']): Memory[] {
  return all.filter((m) => subjects.includes(m.subject) && (!m.expiresAt || Date.parse(m.expiresAt) > now.getTime()));
}

export function valuesOf(mems: Memory[], topic: MemoryTopic): string[] {
  return mems.filter((m) => m.topic === topic).map((m) => m.value);
}

/** Meals containing a disliked food are excluded, just like an allergy (but not labelled as one). */
export function dislikedFoodIn(meal: Pick<MealIdea, 'id'>, mems: Memory[]): Ingredient | null {
  const dislikes = valuesOf(mems, 'dislike_food');
  return ingredientsOf(meal.id).find((i) => dislikes.includes(i)) ?? null;
}

/** Add or replace a memory. One value per (subject, topic) except list-like topics. */
export function upsertMemory(all: Memory[], m: Memory): Memory[] {
  const listTopics: MemoryTopic[] = ['dislike_food', 'like_food', 'not_true', 'confirmed_trait'];
  // Confirming and rejecting the same trait are mutually exclusive.
  if (m.topic === 'not_true' || m.topic === 'confirmed_trait') {
    const other = m.topic === 'not_true' ? 'confirmed_trait' : 'not_true';
    all = all.filter((x) => !(x.subject === m.subject && x.topic === other && x.value === m.value));
  }
  const rest = all.filter((x) =>
    listTopics.includes(m.topic)
      ? !(x.subject === m.subject && x.topic === m.topic && x.value === m.value)
      : !(x.subject === m.subject && x.topic === m.topic),
  );
  // A food can't be liked and disliked at once: the newest statement wins.
  const opposite = m.topic === 'like_food' ? 'dislike_food' : m.topic === 'dislike_food' ? 'like_food' : null;
  const cleaned = opposite ? rest.filter((x) => !(x.subject === m.subject && x.topic === opposite && x.value === m.value)) : rest;
  return [...cleaned, m].slice(-MAX_MEMORIES);
}

export function sanitizeMemories(raw: unknown, memberIds: string[]): Memory[] {
  if (!Array.isArray(raw)) return [];
  const out: Memory[] = [];
  for (const r of raw.slice(-MAX_MEMORIES)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const topic = o.topic as MemoryTopic;
    if (typeof o.id !== 'string' || o.id.length > 60) continue;
    if (typeof o.subject !== 'string' || !(o.subject === 'me' || memberIds.includes(o.subject))) continue;
    if (!TOPICS.includes(topic) || !KINDS.includes(o.kind as MemoryKind) || !SOURCES.includes(o.source as MemorySource)) continue;
    if (typeof o.value !== 'string' || o.value.length > 60) continue;
    const allowed = ALLOWED_VALUES[topic];
    if (allowed && !allowed.includes(o.value)) continue;
    if (topic === 'preferred_name' && !o.value.trim()) continue;
    const date = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
    if (!date(o.createdAt) || !date(o.updatedAt)) continue;
    if (o.kind === 'temporary' && !date(o.expiresAt)) continue;
    out.push({
      id: o.id,
      subject: o.subject,
      topic,
      value: o.value.trim(),
      kind: o.kind as MemoryKind,
      source: o.source as MemorySource,
      createdAt: o.createdAt as string,
      updatedAt: o.updatedAt as string,
      ...(o.expiresAt && date(o.expiresAt) ? { expiresAt: o.expiresAt as string } : {}),
    });
  }
  return out;
}

export function newMemory(
  topic: MemoryTopic,
  value: string,
  opts: { kind?: MemoryKind; source: MemorySource; subject?: string; now: Date; expiresInDays?: number },
): Memory {
  const at = opts.now.toISOString();
  const kind = opts.expiresInDays ? 'temporary' : (opts.kind ?? 'stated');
  return {
    id: `mem-${opts.now.getTime().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    subject: opts.subject ?? 'me',
    topic,
    value,
    kind,
    source: opts.source,
    createdAt: at,
    updatedAt: at,
    ...(opts.expiresInDays ? { expiresAt: new Date(opts.now.getTime() + opts.expiresInDays * 86400000).toISOString() } : {}),
  };
}
