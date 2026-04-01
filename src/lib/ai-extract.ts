/**
 * AI extraction layer.
 *
 * Uses heuristics and pattern matching to pull structured data from raw
 * document text. In production this would call an LLM (Claude, GPT, etc.)
 * but this MVP uses deterministic rules so there are zero external
 * dependencies or API keys required.
 */

import type { ExtractionResult, KeyDate } from "./types";

// Common date formats: MM/DD/YYYY, YYYY-MM-DD, Month DD YYYY, DD Month YYYY
const DATE_REGEX =
  /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi;

// Keywords that hint at what kind of date we found
const RENEWAL_KEYWORDS = ["renew", "renewal", "renews"];
const EXPIRATION_KEYWORDS = ["expir", "expire", "expiration", "expires", "end date", "termination"];
const DEADLINE_KEYWORDS = ["deadline", "due", "due date", "submit by", "respond by"];

/**
 * Classify a date based on surrounding context words.
 */
function classifyDate(context: string): KeyDate["type"] {
  const lower = context.toLowerCase();
  if (RENEWAL_KEYWORDS.some((kw) => lower.includes(kw))) return "renewal";
  if (EXPIRATION_KEYWORDS.some((kw) => lower.includes(kw))) return "expiration";
  if (DEADLINE_KEYWORDS.some((kw) => lower.includes(kw))) return "deadline";
  return "other";
}

/**
 * Build a human‑readable label from the text surrounding a date match.
 */
function buildLabel(context: string, dateStr: string): string {
  // Grab the ~60 chars before the date as context
  const idx = context.indexOf(dateStr);
  const before = context.slice(Math.max(0, idx - 60), idx).trim();
  // Take the last sentence fragment
  const parts = before.split(/[.;\n]/);
  const fragment = parts[parts.length - 1].trim();
  return fragment || "Document date";
}

/**
 * Extract a title from the document text.
 * Strategy: first non‑empty line that looks like a heading.
 */
function extractTitle(text: string, fileName: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  // Use the first line that is reasonably short (likely a heading)
  const heading = lines.find((line) => line.length > 3 && line.length < 200);
  return heading || fileName.replace(/\.[^.]+$/, "");
}

/**
 * Produce a bullet‑point summary of the document.
 * Picks the most "informative" sentences (longest non‑trivial ones).
 */
function extractSummary(text: string): string[] {
  const sentences = text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 500);

  if (sentences.length === 0) {
    return ["No extractable summary content found in this document."];
  }

  // Deduplicate and pick up to 7 sentences, spread across the document
  const unique = [...new Set(sentences)];
  const step = Math.max(1, Math.floor(unique.length / 7));
  const picks: string[] = [];
  for (let i = 0; i < unique.length && picks.length < 7; i += step) {
    picks.push(unique[i]);
  }
  return picks;
}

/**
 * Main extraction function — the "AI" pipeline.
 */
export function aiExtract(text: string, fileName: string): ExtractionResult {
  const title = extractTitle(text, fileName);

  // Find all dates and classify them
  const keyDates: KeyDate[] = [];
  let match: RegExpExecArray | null;
  // Reset regex state
  DATE_REGEX.lastIndex = 0;
  while ((match = DATE_REGEX.exec(text)) !== null) {
    const dateStr = match[0];
    // Get surrounding context (200 chars)
    const start = Math.max(0, match.index - 100);
    const end = Math.min(text.length, match.index + dateStr.length + 100);
    const context = text.slice(start, end);

    keyDates.push({
      label: buildLabel(context, dateStr),
      date: dateStr,
      type: classifyDate(context),
    });
  }

  const summary = extractSummary(text);

  return { title, keyDates, summary };
}
