'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Application Error</h1>
          <p style={{ color: '#94a3b8', marginBottom: '24px', maxWidth: '400px' }}>
            A critical error occurred. Your data is safe — it&apos;s stored locally on this device.
          </p>
          <button
            onClick={reset}
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            Try Again
          </button>
        </main>
      </body>
    </html>
  );
}
