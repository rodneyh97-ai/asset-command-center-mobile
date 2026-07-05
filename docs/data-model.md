# Data Model

All entities are stored in IndexedDB. IDs are UUIDs (v4) generated client-side.

## Club

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Primary key |
| name | string | Club name |
| createdAt | ISO timestamp | Creation date |
| updatedAt | ISO timestamp | Last modification |

## Season

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Primary key |
| clubId | string (UUID) | FK to Club |
| name | string | e.g., "Spring 2026" |
| startDate | ISO date | Season start |
| endDate | ISO date | Season end |
| createdAt | ISO timestamp | |
| updatedAt | ISO timestamp | |

## Team

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Primary key |
| seasonId | string (UUID) | FK to Season |
| name | string | e.g., "16-National" |
| ageGroup | string | Optional age division |
| createdAt | ISO timestamp | |
| updatedAt | ISO timestamp | |

## Player

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Primary key |
| teamId | string (UUID) | FK to Team |
| firstName | string | |
| lastName | string | |
| jerseyNumber | number | Must be unique within team |
| position | PlayerPosition | Primary position |
| secondaryPosition | PlayerPosition? | Optional secondary |
| isLibero | boolean | Whether designated as libero |
| isActive | boolean | Available for selection |
| createdAt | ISO timestamp | |
| updatedAt | ISO timestamp | |

### PlayerPosition (enum)

- `Setter`
- `OutsideHitter`
- `MiddleBlocker`
- `RightSide`
- `Libero`
- `DefensiveSpecialist`

## RulesetProfile

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Primary key |
| name | string | Display name |
| baseRuleset | "USAV" \| "NFHS" \| "AAU" | Which rule system |
| strictness | StrictnessLevel | Enforcement level |
| maxSubstitutions | number | Per set (e.g., 12 for USAV) |
| setsToWin | number | Usually 2 (best of 3) or 3 (best of 5) |
| pointsPerSet | number | Usually 25 |
| pointsDecidingSet | number | Usually 15 |
| mustWinByTwo | boolean | |
| liberoEnabled | boolean | Whether libero rules apply |
| maxLiberos | number | Usually 1-2 |
| createdAt | ISO timestamp | |

### StrictnessLevel (enum)

- `PlanningOnly` -- no runtime enforcement, just lineup building help
- `CoachWarning` -- show warnings but allow override
- `StrictValidation` -- block illegal actions
- `PracticeFlexible` -- relaxed rules for scrimmages

## Lineup

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Primary key |
| teamId | string (UUID) | FK to Team |
| name | string | Template name (e.g., "Lineup A") |
| positions | LineupPosition[6] | Ordered array, index = court position 1-6 |
| liberoId | string (UUID)? | Designated libero for this lineup |
| notes | string | Optional coach notes |
| createdAt | ISO timestamp | |
| updatedAt | ISO timestamp | |

### LineupPosition

| Field | Type | Description |
|-------|------|-------------|
| courtPosition | 1-6 | Serving order position |
| playerId | string (UUID) | FK to Player |

## Match

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Primary key |
| teamId | string (UUID) | FK to Team |
| rulesetProfileId | string (UUID) | FK to RulesetProfile |
| opponentName | string | |
| date | ISO date | Match date |
| location | string? | Optional venue |
| startingLineupId | string (UUID) | FK to Lineup used at start |
| status | "scheduled" \| "live" \| "completed" | |
| createdAt | ISO timestamp | |
| updatedAt | ISO timestamp | |

Match state (score, current rotation, substitution counts) is derived from the event log, not stored directly.

## MatchEvent

The core of the event-sourcing system. See [Event Sourcing](event-sourcing.md) for full details.

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Primary key |
| matchId | string (UUID) | FK to Match |
| type | MatchEventType | Event discriminator |
| setNumber | number | Which set (1-based) |
| timestamp | ISO timestamp | When the event occurred |
| payload | object | Type-specific data (varies by event type) |
| undone | boolean | Soft-delete flag for undo |
| sequence | number | Monotonic order within match |
