/**
 * Document text extraction utilities.
 *
 * Extracts raw text from PDF, DOCX, and image files so the AI extraction
 * pipeline can process it. Files are handled entirely in memory — nothing
 * touches the filesystem.
 */

import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

/** Extract text from a PDF buffer */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

/** Extract text from a DOCX buffer */
export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  // mammoth expects { buffer: Buffer }
  const result = await (mammoth as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> }).extractRawText({ buffer });
  return result.value;
}

/**
 * For images we return a placeholder — real OCR would require an external
 * service (Google Vision, Tesseract, etc.). The AI extraction layer will
 * still produce a best‑effort result from the filename and metadata.
 */
export function extractTextFromImage(_buffer: Buffer, fileName: string): string {
  return `[Image file: ${fileName}] — OCR extraction would be performed here in production.`;
}

/** Route to the correct extractor based on MIME type */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<string> {
  if (mimeType === "application/pdf") {
    return extractTextFromPDF(buffer);
  }
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    return extractTextFromDOCX(buffer);
  }
  if (mimeType.startsWith("image/")) {
    return extractTextFromImage(buffer, fileName);
  }
  // Fallback: treat as plain text
  return buffer.toString("utf-8");
}
