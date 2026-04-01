/**
 * POST /api/extract
 *
 * Accepts a multipart form upload containing a single file.
 * 1. Reads the file into memory (never written to disk).
 * 2. Extracts raw text based on file type (PDF, DOCX, image, plain text).
 * 3. Runs the AI extraction pipeline to pull title, dates, and summary.
 * 4. Returns structured JSON — the original file buffer is discarded.
 */

import { NextRequest, NextResponse } from "next/server";
import { extractText } from "@/lib/extract";
import { aiExtract } from "@/lib/ai-extract";

// Maximum upload size: 10 MB
const MAX_SIZE = 10 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
]);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10 MB." },
        { status: 400 },
      );
    }

    // Validate MIME type
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 },
      );
    }

    // Read file into memory — never persisted to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Step 1: extract raw text
    const rawText = await extractText(buffer, file.type, file.name);

    // Step 2: run AI extraction
    const result = aiExtract(rawText, file.name);

    // The buffer is now eligible for garbage collection — nothing stored.
    return NextResponse.json(result);
  } catch (err) {
    console.error("Extraction error:", err);
    return NextResponse.json(
      { error: "Failed to process document. Please try again." },
      { status: 500 },
    );
  }
}
