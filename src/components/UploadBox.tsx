/**
 * Drag‑and‑drop / click‑to‑upload box.
 *
 * Handles file selection, posts to /api/extract, and passes the result
 * back to the parent via onResult.
 */

"use client";

import { useCallback, useRef, useState } from "react";
import type { ExtractionResult } from "@/lib/types";

interface Props {
  onResult: (result: ExtractionResult) => void;
}

export default function UploadBox({ onResult }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);

        const res = await fetch("/api/extract", { method: "POST", body: form });
        const json = await res.json();

        if (!res.ok) {
          setError(json.error || "Something went wrong.");
          return;
        }

        onResult(json as ExtractionResult);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [onResult],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        group relative cursor-pointer rounded-2xl border-2 border-dashed
        px-8 py-16 text-center transition-all duration-200
        ${
          dragging
            ? "border-gray-900 bg-gray-50"
            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50"
        }
      `}
    >
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt"
        onChange={handleChange}
      />

      {uploading ? (
        <div className="flex flex-col items-center gap-3">
          {/* Spinner */}
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
          <p className="text-sm text-gray-500">Processing your document&hellip;</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {/* Upload icon */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 transition-colors group-hover:bg-gray-200">
            <svg
              className="h-6 w-6 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>

          <div>
            <p className="text-base font-medium text-gray-700">
              Drop a file here, or{" "}
              <span className="text-gray-900 underline underline-offset-2">browse</span>
            </p>
            <p className="mt-1 text-xs text-gray-400">
              PDF, DOC, DOCX, PNG, JPG, or TXT &mdash; up to 10 MB
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm font-medium text-red-500">{error}</p>
      )}
    </div>
  );
}
