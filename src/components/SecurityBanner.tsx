/**
 * Privacy / security reassurance banner shown at the bottom of the page.
 */
export default function SecurityBanner() {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-5 py-4 text-center">
      <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
        <svg
          className="h-4 w-4 text-emerald-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
          />
        </svg>
        Your documents are never stored. They are processed securely and deleted
        immediately.
      </div>
    </div>
  );
}
