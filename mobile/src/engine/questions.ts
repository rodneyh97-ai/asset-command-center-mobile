// One short question at a time. Only questions whose answers change recommendations
// are asked (no data collected without a purpose). Every question can be skipped.
import type { MemoryTopic } from './memory';

export interface Question {
  id: string;
  topic: MemoryTopic;
  prompt: string;
  /** Tap options; 'multi' lets the user pick several. 'text' = short free text. */
  input: 'single' | 'multi' | 'text';
  options?: { value: string; label: string }[];
  /** Answer is only true for this long (then the question may be asked again). */
  expiresInDays?: number;
}

export const QUESTIONS: Question[] = [
  {
    id: 'tradeoff_week',
    topic: 'tradeoff',
    prompt: 'What would make eating well easier this week: faster meals, or cheaper ones?',
    input: 'single',
    options: [
      { value: 'faster', label: 'Faster' },
      { value: 'cheaper', label: 'Cheaper' },
      { value: 'both', label: 'Both matter' },
    ],
    expiresInDays: 7,
  },
  {
    id: 'dislikes',
    topic: 'dislike_food',
    prompt: 'Any foods you’d rather never see suggested?',
    input: 'multi',
    options: ['mushrooms', 'olives', 'cilantro', 'onion', 'spicy', 'tofu', 'fish', 'avocado', 'beans', 'eggs'].map((v) => ({
      value: v,
      label: v[0].toUpperCase() + v.slice(1),
    })),
  },
  {
    id: 'weeknight_cook',
    topic: 'weeknight_cook_minutes',
    prompt: 'On a busy weeknight, how long are you happy to spend cooking?',
    input: 'single',
    options: [
      { value: '10', label: '10 min' },
      { value: '20', label: '20 min' },
      { value: '45', label: '45 min' },
    ],
  },
  {
    id: 'cooking_skill',
    topic: 'cooking_skill',
    prompt: 'How comfortable do you feel cooking?',
    input: 'single',
    options: [
      { value: 'beginner', label: 'Just starting' },
      { value: 'comfortable', label: 'Comfortable' },
      { value: 'confident', label: 'Confident' },
    ],
  },
  { id: 'name', topic: 'preferred_name', prompt: 'What should EatOS call you?', input: 'text' },
  {
    id: 'likes',
    topic: 'like_food',
    prompt: 'Any foods you always enjoy?',
    input: 'multi',
    options: ['chicken', 'pasta', 'rice', 'eggs', 'cheese', 'avocado', 'salmon', 'beans', 'spicy', 'potato'].map((v) => ({
      value: v,
      label: v[0].toUpperCase() + v.slice(1),
    })),
  },
];

const DAY = 86400000;

/**
 * The next question to show, or null. At most one per day, never on the first day,
 * never one already answered (until its answer expires) or skipped for good.
 */
export function nextQuestion(
  q: { done: Record<string, string>; lastShownAt: string | null },
  profileCreatedAt: string,
  now: Date,
): Question | null {
  if (now.getTime() - Date.parse(profileCreatedAt) < DAY) return null;
  if (q.lastShownAt && new Date(q.lastShownAt).toDateString() === now.toDateString()) return null;
  for (const question of QUESTIONS) {
    const done = q.done[question.id];
    if (!done) return question;
    if (question.expiresInDays && now.getTime() - Date.parse(done) > question.expiresInDays * DAY) return question;
  }
  return null;
}
