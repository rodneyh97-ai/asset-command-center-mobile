# Component Map

## Screen Hierarchy

```
App
├── Welcome Dashboard
│   ├── Recent Matches (quick resume)
│   ├── Quick Start (new match shortcut)
│   └── Navigation to Club/Team Setup
│
├── Club & Team Setup
│   ├── Club List / Create Club
│   ├── Season List / Create Season
│   └── Team List / Create Team
│
├── Roster Management
│   ├── Player List (sortable by number, name, position)
│   ├── Add/Edit Player Form
│   ├── CSV Import Dialog
│   └── Player Availability Toggle
│
├── Saved Lineup Library
│   ├── Lineup Card Grid
│   ├── Create New Lineup
│   ├── Duplicate Lineup
│   └── Delete Lineup (with confirmation)
│
├── Starting Lineup Builder
│   ├── Court Diagram (6 positions, drag-drop or tap-assign)
│   ├── Available Players Sidebar
│   ├── Libero Designation
│   ├── Ruleset Validation Indicators
│   └── Save / Start Match Actions
│
└── Live Match Dashboard
    ├── Scoreboard (large, always visible)
    ├── Court Rotation View (current 6 on court)
    ├── Score Buttons (one-tap: Our Point / Their Point)
    ├── Substitution Panel (three-tap flow)
    ├── Libero Toggle Button
    ├── Timeout Button
    ├── Undo Button
    ├── Set Summary Bar (set scores)
    ├── Notes Button (add text note)
    └── Match Controls (end set, end match)
```

## Navigation Flow

1. **Welcome Dashboard** is the entry point. Coaches see their recent/live matches and can jump directly back into one.
2. **Club/Team Setup** is accessed from the dashboard for initial configuration or team management.
3. **Roster Management** is reached from a specific team. Coaches add players here before building lineups.
4. **Saved Lineup Library** shows all saved lineups for a team. Coaches select one to edit or use as a match starting lineup.
5. **Starting Lineup Builder** is used to configure or tweak a lineup before starting a match. Validates against the selected ruleset.
6. **Live Match Dashboard** is the primary in-match screen. Coaches stay on this single screen for the entire match.

## Component Design Principles

- **Large touch targets** -- minimum 44x44px, preferred 56x56px for primary actions
- **High contrast** -- scoreboard and rotation numbers readable at arm's length
- **Minimal modals** -- prefer inline expansion or slide-in panels over modals that block the court view
- **Landscape orientation** -- all layouts assume landscape as default; portrait is a narrow fallback
- **Color coding** -- consistent position colors across lineup builder and live match (e.g., setters always blue, middles always red)

## Shared Components

| Component | Used In | Purpose |
|-----------|---------|---------|
| CourtDiagram | Lineup Builder, Live Match | Visual 6-position court |
| PlayerChip | Roster, Lineup, Live Match | Compact player display (number + name) |
| ScoreDisplay | Live Match, Set Summary | Large-format score |
| RuleViolationToast | Lineup Builder, Live Match | Warning/error notifications |
| ConfirmSheet | Multiple | Bottom sheet for destructive actions |
| ActionButton | Live Match | Large circular tap targets |
