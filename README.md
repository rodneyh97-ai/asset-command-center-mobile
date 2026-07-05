# Volleyball Rotation Manager

A production-quality, iPad-first volleyball rotation and live match-management web app. Designed as a coaching assistant for tracking rotations, substitutions, and match flow without requiring connectivity.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **State Management:** Zustand
- **Persistence:** IndexedDB (via idb)
- **Testing:** Vitest (45 tests)
- **PWA:** Service worker with offline caching
- **Target Device:** iPad landscape (responsive to all sizes)

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in an iPad browser or desktop browser (landscape orientation recommended).

## Architecture

```
src/
  app/                # Next.js App Router pages
    club/[id]/        # Club management
    lineup/           # Lineup builder
    match/            # Live match dashboard
    player-mode/      # Read-only player rotation cards
    roster/           # Roster management with CSV import/export
    settings/         # Backup/restore
  components/
    court/            # Volleyball court visualization
    match/            # Live match panels (sub, libero, correction, history)
    shared/           # Reusable components (PlayerRotationCard, SW registrar)
  domain/             # Pure business logic (no UI, no IO)
    types.ts          # All TypeScript interfaces
    rotation-engine.ts # Clockwise rotation, server tracking, preview
    event-sourcing.ts # Immutable event log, state rebuild, undo/redo
  stores/             # Zustand state management
    app-store.ts      # Clubs, seasons, teams, players, lineups
    match-store.ts    # Live match state with event persistence
  db/                 # IndexedDB schema and repository layer
  lib/                # Utilities
    csv.ts            # CSV import/export for rosters
    export-import.ts  # Full backup export/import (JSON)
    register-sw.ts    # PWA service worker registration
public/
  sw.js               # Service worker for offline caching
  manifest.json       # PWA manifest (landscape orientation)
docs/                 # Full project documentation
```

### Key Design Decisions

- **Event-sourced match state** — every match action is an immutable event. State is rebuilt by replaying the event log, enabling undo/redo and crash recovery.
- **Offline-first** — all data lives in IndexedDB. No network required during a match.
- **Rules engine** — pluggable rulesets (USAV, NFHS, AAU) with configurable strictness from "planning only" to "strict validation."
- **iPad-optimized UX** — large touch targets (44px minimum), one-tap scoring, three-tap substitutions, no typing required during live play.
- **PWA support** — installable with offline caching, landscape-preferred orientation.
- **Future-ready** — repository pattern enables Supabase integration without rewriting the app.

## Features

### Phase 1 (Complete)
- Club/Season/Team/Player CRUD
- Roster management with search/sort
- Lineup builder with court visualization
- Live match dashboard with automatic rotation on side-out
- Event-sourced undo/redo
- IndexedDB persistence and recovery after refresh

### Phase 2 (Complete)
- Substitution workflow with 3-tap confirmation and preview
- Libero replacement tracking (separate from sub count)
- Player availability status changes during match
- Rotation preview (current + next 3)
- Correct Match State with mandatory audit notes
- Full match event history viewer

### Phase 3 (Complete)
- PWA with service worker and offline app-shell caching
- JSON backup export/import
- CSV roster import/export
- Player Mode (read-only rotation cards)
- Accessibility: skip-to-content, focus rings, ARIA labels, minimum tap targets
- iPad landscape CSS optimizations and safe-area padding

## Documentation

| Document | Description |
|----------|-------------|
| [Product Requirements](docs/product-requirements.md) | Core product promise and scope boundaries |
| [Data Model](docs/data-model.md) | All entities and their fields |
| [Rules Engine](docs/rules-engine.md) | Rulesets, strictness levels, substitution/libero rules |
| [Event Sourcing](docs/event-sourcing.md) | Immutable event log, undo/redo, recovery |
| [Component Map](docs/component-map.md) | Screen hierarchy and navigation |
| [Test Plan](docs/test-plan.md) | Testing strategy and key scenarios |
| [Offline & Recovery](docs/offline-recovery.md) | Persistence, backup, and future sync |

## Not Included (by design)

- No backend or login system
- No multi-device live sync
- No video, AI stats, parent portal, recruiting, payments, or messaging
- No strict USAV/NFHS rule enforcement until explicitly enabled by coach

## License

Private — not open source.
