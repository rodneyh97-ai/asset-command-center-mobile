import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Volleyball Rotation App',
  description: 'iPad-first volleyball rotation and live match management',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="bg-slate-900 text-white min-h-full flex flex-col">{children}</body>
    </html>
  );
}
