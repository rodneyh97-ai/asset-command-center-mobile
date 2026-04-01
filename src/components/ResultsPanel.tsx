/**
 * Displays the extraction results: title, key dates, and summary bullets.
 */

import type { ExtractionResult } from "@/lib/types";

// Visual badge colours per date type
const DATE_COLORS: Record<string, string> = {
  renewal: "bg-blue-50 text-blue-700 border-blue-100",
  expiration: "bg-amber-50 text-amber-700 border-amber-100",
  deadline: "bg-red-50 text-red-700 border-red-100",
  other: "bg-gray-50 text-gray-600 border-gray-100",
};

interface Props {
  result: ExtractionResult;
}

export default function ResultsPanel({ result }: Props) {
  return (
    <div className="space-y-8">
      {/* Document title */}
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-gray-400">
          Document Title
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
          {result.title}
        </h2>
      </div>

      {/* Key Dates section */}
      <div>
        <h3 className="text-xs font-medium uppercase tracking-widest text-gray-400">
          Key Dates
        </h3>

        {result.keyDates.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400 italic">
            No dates detected in this document.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {result.keyDates.map((kd, i) => (
              <div
                key={i}
                className={`rounded-xl border px-4 py-3 ${DATE_COLORS[kd.type] || DATE_COLORS.other}`}
              >
                <p className="text-xs font-medium uppercase tracking-wide opacity-70">
                  {kd.type}
                </p>
                <p className="mt-0.5 text-sm font-semibold">{kd.date}</p>
                <p className="mt-1 text-xs opacity-70 leading-relaxed">
                  {kd.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary section */}
      <div>
        <h3 className="text-xs font-medium uppercase tracking-widest text-gray-400">
          Summary
        </h3>
        <ul className="mt-3 space-y-2">
          {result.summary.map((point, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-gray-600">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-300" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
