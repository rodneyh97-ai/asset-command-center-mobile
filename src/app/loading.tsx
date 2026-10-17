export default function Loading() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-slate-400 text-sm">Loading...</p>
    </main>
  );
}
