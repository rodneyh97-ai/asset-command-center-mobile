/**
 * Main page — single‑page layout for the Asset Command Center.
 *
 * State is held entirely in memory via React useState.
 * No database, no cookies, no local storage.
 */

"use client";

import { useCallback, useRef, useState } from "react";
import type { ExtractionResult } from "@/lib/types";

import Header from "@/components/Header";
import UploadBox from "@/components/UploadBox";
import ResultsPanel from "@/components/ResultsPanel";
import Dashboard from "@/components/Dashboard";
import SecurityBanner from "@/components/SecurityBanner";

export default function Home() {
  // In‑memory state: holds all extraction results from this session
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [latestResult, setLatestResult] = useState<ExtractionResult | null>(null);
  const uploadRef = useRef<HTMLDivElement>(null);

  const handleResult = useCallback((result: ExtractionResult) => {
    setLatestResult(result);
    setResults((prev) => [...prev, result]);
  }, []);

  const scrollToUpload = useCallback(() => {
    uploadRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="flex flex-1 flex-col bg-gray-50/40">
      <Header />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-12">
        {/* Hero / tagline */}
        <section className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Document intelligence,
            <br />
            <span className="text-gray-400">instantly.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-gray-500 leading-relaxed">
            Upload a document and get the title, key dates, and a concise
            summary — all extracted in seconds. Nothing is ever stored.
          </p>
        </section>

        {/* Upload box */}
        <section ref={uploadRef}>
          <UploadBox onResult={handleResult} />
        </section>

        {/* Results panel — shown after a document is processed */}
        {latestResult && (
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <ResultsPanel result={latestResult} />
          </section>
        )}

        {/* Dashboard — always visible, populates as documents are processed */}
        <Dashboard results={results} onAddMore={scrollToUpload} />

        {/* Security notice */}
        <SecurityBanner />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white py-6 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} Asset Command Center &mdash; Built with Next.js
      </footer>
    </div>
  );
}
