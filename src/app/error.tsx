'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <main className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-slate-400 mb-6 max-w-md">
        An unexpected error occurred. Your data is safe — it&apos;s stored locally on this device.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-medium touch-manipulation"
        >
          Try Again
        </button>
        <a
          href="/"
          className="bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-xl font-medium touch-manipulation"
        >
          Back to Home
        </a>
      </div>
    </main>
  );
}
