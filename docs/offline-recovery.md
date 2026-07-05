# Offline & Recovery

## Storage Architecture

All application data is stored in IndexedDB using the `idb` library for a Promise-based API. There is no server dependency for core functionality.

### IndexedDB Schema

```
Database: "volleyball-rotation-manager"

Object Stores:
  clubs          -> keyPath: "id"
  seasons        -> keyPath: "id", index: clubId
  teams          -> keyPath: "id", index: seasonId
  players        -> keyPath: "id", index: teamId
  rulesetProfiles -> keyPath: "id"
  lineups        -> keyPath: "id", index: teamId
  matches        -> keyPath: "id", index: [teamId, status]
  matchEvents    -> keyPath: "id", index: [matchId, sequence]
```

## Autosave Strategy

- **Every event triggers a write.** When a match event is dispatched, it is immediately persisted to the `matchEvents` store before the UI re-renders.
- **Write-ahead pattern:** The event is written to IndexedDB first, then the in-memory state is updated. If the app crashes between write and render, the event is still safe.
- **Batch metadata updates:** Match-level metadata (status, updatedAt) is written after event persistence as a secondary operation.

## Recovery After Refresh or Crash

1. On app load, query `matches` store for any match with `status: "live"`.
2. If found, load all `matchEvents` for that match from IndexedDB.
3. Run the event reducer to rebuild `MatchState`.
4. Display the Live Match Dashboard with the reconstructed state.
5. No user interaction needed -- recovery is automatic and transparent.

### Edge Cases

- **Multiple live matches:** Should not occur (UI prevents starting a new match while one is live). If detected, show a selection screen.
- **Corrupted event:** If a single event fails to parse, skip it and log a warning. Show a notification that state may be approximate.
- **Empty event log with live status:** Treat as abandoned match. Offer to end it or restart.

## Export / Import Backup

### JSON Export

Coaches can export any match (or all data) as a JSON file:

```typescript
interface ExportPayload {
  version: 1;
  exportedAt: string; // ISO timestamp
  clubs: Club[];
  seasons: Season[];
  teams: Team[];
  players: Player[];
  lineups: Lineup[];
  matches: Match[];
  matchEvents: MatchEvent[];
}
```

Export is triggered from Settings or from a specific match's detail screen.

### JSON Import

- Import validates the schema version and entity structure.
- Duplicate IDs are handled with a "skip" or "overwrite" choice.
- Import is transactional -- if any entity fails validation, the entire import is rolled back.

## CSV Roster Import / Export

### Import Format

```csv
JerseyNumber,FirstName,LastName,Position,IsLibero
7,Sarah,Johnson,OutsideHitter,false
12,Emma,Williams,Setter,false
3,Olivia,Brown,Libero,true
```

- First row is a header (required).
- Position must match the `PlayerPosition` enum values.
- IsLibero is a boolean string ("true"/"false").
- Extra columns are ignored.

### Export Format

Same CSV format as import. Allows round-tripping between devices or sharing with assistant coaches.

## Future: Supabase Sync Preparation

The architecture is designed to support optional cloud sync in a future version:

### Sync-Ready Design Decisions

1. **UUIDs as primary keys** -- no auto-increment IDs that would conflict across devices.
2. **Timestamps on all entities** -- `createdAt` and `updatedAt` enable last-write-wins or conflict detection.
3. **Event log is append-only** -- sync only needs to merge new events, not reconcile mutations.
4. **Soft deletes via `undone` flag** -- no hard deletes that would complicate sync.

### Planned Sync Architecture (not yet implemented)

- Supabase Postgres as the remote store
- Row-level security scoped to authenticated user
- Sync on reconnect: push local events with sequence > last synced, pull remote events
- Conflict resolution: events are ordered by timestamp; ties broken by device ID
- Offline queue: buffer writes when disconnected, flush when connectivity returns

### Migration Path

When sync is added:
1. Existing IndexedDB data becomes the "local replica."
2. First sync uploads all local data to Supabase.
3. Subsequent syncs are incremental (events since last sync timestamp).
4. App continues to work fully offline; sync is opportunistic.
