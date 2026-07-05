# Product Requirements

## Core Product Promise

A coaching assistant that tracks volleyball rotations, substitutions, and match score in real time on an iPad held courtside. It is NOT an official scorekeeper -- it helps coaches make better rotation and substitution decisions during live play.

## Target User

Club and high-school volleyball coaches who manage multiple teams/rosters and need quick, reliable rotation tracking without paperwork.

## Design Principles

1. **Offline-first** -- the app must work with zero network connectivity. Matches happen in gyms with poor WiFi; the app cannot depend on a server.
2. **iPad landscape first** -- primary target is an iPad held horizontally on a coaching clipboard. Desktop and phone are secondary.
3. **No typing during live play** -- all in-match actions are taps. Score a point: one tap. Substitute a player: three taps maximum.
4. **Coaching assistant, not official score** -- the app is a decision-support tool. It does not replace the official scorer or libero tracker sheet.
5. **Forgiveness over prevention** -- allow corrections and undo rather than blocking coaches with modal confirmations.

## Scope Boundaries (Out of Scope)

The following are explicitly excluded from the product:

- **Video recording or playback**
- **AI/ML features** (auto-suggestions, computer vision)
- **Payments or subscriptions**
- **In-app messaging or chat**
- **Real-time multiplayer / shared scoring**
- **Stat tracking beyond rotation and score** (kills, digs, etc. are future)
- **Official scoring integration** (e.g., electronic scoresheet submission)

## Functional Requirements

### Club & Team Management
- Create clubs, seasons, teams
- Manage rosters with player positions and jersey numbers
- Import rosters from CSV

### Lineup Management
- Save reusable lineup templates
- Build starting lineups for a match (6 starters + libero designation)
- Validate lineups against ruleset constraints

### Live Match
- Track score (our point / opponent point with single tap)
- Track rotations automatically on side-out
- Track substitutions with three-tap flow (position, player out, player in)
- Track libero replacements (separate from sub count)
- Track timeouts
- Support undo for the last N actions
- Add text notes at any point in the match

### Rules Enforcement
- Configurable ruleset per match (USAV, NFHS, AAU)
- Configurable strictness (from no enforcement to strict validation)
- Warn or block on illegal substitutions depending on strictness

### Data Persistence
- Autosave after every event
- Recover match state after app crash or refresh
- Export/import match data as JSON backup
