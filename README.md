# Volleyball Rotation Manager

A production-quality, iPad-first volleyball rotation and live match-management web app. Designed as a coaching assistant for tracking rotations, substitutions, and match flow without requiring connectivity.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Persistence:** IndexedDB (via idb)
- **Testing:** Vitest + React Testing Library
- **Target Device:** iPad landscape (responsive down to phone)

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000) in an iPad browser or desktop browser (landscape orientation recommended).

## Architecture Overview

```
src/
  app/              # Next.js App Router pages
  components/       # React components (organized by screen)
  stores/           # Zustand stores (match, roster, lineup, settings)
  engine/           # Rules engine and rotation logic
  events/           # Event sourcing: types, dispatcher, reducer
  db/               # IndexedDB schema and access layer
  types/            # Shared TypeScript interfaces
  utils/            # Helpers (CSV parsing, validation, etc.)
docs/               # Project documentation
```

### Key Design Decisions

- **Event-sourced match state** -- every match action is an immutable event. State is rebuilt by replaying the event log, enabling undo/redo and crash recovery.
- **Offline-first** -- all data lives in IndexedDB. No network required during a match.
- **Rules engine** -- pluggable rulesets (USAV, NFHS, AAU) with configurable strictness from "planning only" to "strict validation."
- **iPad-optimized UX** -- large touch targets, one-tap scoring, three-tap substitutions, no typing required during live play.

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

## License

Private -- not open source.
