/**
 * Placeholder dashboard showing upcoming renewals, deadlines, and
 * an "Add more documents" CTA.
 *
 * In production this would pull from a database — here it aggregates
 * whatever has been extracted in the current session (in‑memory state).
 */

import type { ExtractionResult } from "@/lib/types";

interface Props {
  results: ExtractionResult[];
  onAddMore: () => void;
}

export default function Dashboard({ results, onAddMore }: Props) {
  // Aggregate all key dates from every processed document
  const allDates = results.flatMap((r) => r.keyDates);
  const renewals = allDates.filter((d) => d.type === "renewal");
  const deadlines = allDates.filter((d) => d.type === "deadline");
  const expirations = allDates.filter((d) => d.type === "expiration");

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="text-xs font-medium uppercase tracking-widest text-gray-400">
        Dashboard
      </h3>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {/* Upcoming renewals */}
        <DashboardCard
          label="Upcoming Renewals"
          count={renewals.length}
          accent="bg-blue-500"
          items={renewals.map((r) => r.date)}
        />

        {/* Upcoming deadlines */}
        <DashboardCard
          label="Upcoming Deadlines"
          count={deadlines.length}
          accent="bg-red-500"
          items={deadlines.map((d) => d.date)}
        />

        {/* Expirations */}
        <DashboardCard
          label="Expirations"
          count={expirations.length}
          accent="bg-amber-500"
          items={expirations.map((e) => e.date)}
        />
      </div>

      {/* Add more documents CTA */}
      <button
        onClick={onAddMore}
        className="mt-6 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md active:scale-[0.98]"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add more documents
      </button>
    </section>
  );
}

/** Small stat card used inside the dashboard grid. */
function DashboardCard({
  label,
  count,
  accent,
  items,
}: {
  label: string;
  count: number;
  accent: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${accent}`} />
        <p className="text-xs font-medium text-gray-500">{label}</p>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
        {count}
      </p>
      {items.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {items.slice(0, 3).map((item, i) => (
            <li key={i} className="text-xs text-gray-400">
              {item}
            </li>
          ))}
          {items.length > 3 && (
            <li className="text-xs text-gray-300">+{items.length - 3} more</li>
          )}
        </ul>
      )}
    </div>
  );
}
