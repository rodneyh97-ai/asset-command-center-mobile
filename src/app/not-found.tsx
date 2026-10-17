import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="text-5xl mb-4">🏐</div>
      <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
      <p className="text-slate-400 mb-6">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link
        href="/"
        className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-medium touch-manipulation"
      >
        Back to Dashboard
      </Link>
    </main>
  );
}
