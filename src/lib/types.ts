// Shared types for the Asset Command Center application

/** A key date extracted from a document (renewal, expiration, deadline, etc.) */
export interface KeyDate {
  label: string;
  date: string;
  type: "renewal" | "expiration" | "deadline" | "other";
}

/** The full result returned after processing a document */
export interface ExtractionResult {
  title: string;
  keyDates: KeyDate[];
  summary: string[];
}
