/**
 * Top navigation bar with branding.
 */
export default function Header() {
  return (
    <header className="border-b border-gray-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        {/* Brand mark */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-sm font-bold text-white">
            AC
          </div>
          <span className="text-lg font-semibold tracking-tight text-gray-900">
            Asset Command Center
          </span>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          Secure &middot; No data stored
        </div>
      </div>
    </header>
  );
}
