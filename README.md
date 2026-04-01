# Asset Command Center

Upload a document. Get the title, key dates, and a concise summary — instantly. **Nothing is ever stored.**

## Features

- **Document Upload** — Drag-and-drop or click to upload PDF, DOCX, DOC, PNG, JPG, or TXT files (up to 10 MB).
- **AI Extraction** — Automatically extracts the document title, key dates (renewals, expirations, deadlines), and a 5-7 bullet summary.
- **Zero Storage** — Files are processed entirely in memory and discarded immediately after extraction.
- **Dashboard** — Tracks upcoming renewals, deadlines, and expirations across all documents processed in the current session.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **PDF Parsing:** pdf-parse
- **DOCX Parsing:** mammoth

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Install & Run

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/
│   ├── api/extract/route.ts   # POST endpoint — file upload & extraction
│   ├── globals.css             # Tailwind + global styles
│   ├── layout.tsx              # Root layout with Inter font
│   └── page.tsx                # Main page — upload, results, dashboard
├── components/
│   ├── Dashboard.tsx           # Aggregated renewals / deadlines view
│   ├── Header.tsx              # Top navigation bar
│   ├── ResultsPanel.tsx        # Extracted title, dates, summary
│   ├── SecurityBanner.tsx      # Privacy reassurance banner
│   └── UploadBox.tsx           # Drag-and-drop file upload
└── lib/
    ├── ai-extract.ts           # Heuristic extraction pipeline
    ├── extract.ts              # Raw text extraction (PDF, DOCX, image)
    └── types.ts                # Shared TypeScript types
```

## Security

- Files are **never written to disk**. They are read into a `Buffer`, processed, and discarded.
- No database, no cookies, no external API calls.
- The extraction pipeline runs entirely on the server with zero third-party network requests.
