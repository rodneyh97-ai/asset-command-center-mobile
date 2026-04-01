import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Asset Command Center",
  description: "Upload documents. Extract insights instantly. Nothing stored.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
