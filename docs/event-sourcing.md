# Event Sourcing

All match state is derived from an append-only event log. No mutable "current score" or "current rotation" is stored -- these are computed by replaying events through a reducer.

## Why Event Sourcing

1. **Undo/redo** -- marking an event as `undone: true` and re-reducing gives instant undo with no data loss.
2. **Crash recovery** -- events are persisted to IndexedDB after each action. On reload, replay the log to restore exact state.
3. **Audit trail** -- every action is timestamped and preserved. Coaches can review the full history of a match.
4. **Derived views** -- the same event log can produce different views (scoreboard, rotation diagram, substitution summary).

## Event Types

### MatchCreated
Payload: `{ lineupId, rulesetProfileId, opponentName }`
Emitted when a match is started.

### SetStarted
Payload: `{ setNumber, servingTeam: 'us' | 'opponent', startingRotation: playerId[6] }`
Emitted at the beginning of each set.

### OurPoint
Payload: `{ newScore: { us, opponent } }`
One tap on the "+" button for our team.

### OpponentPoint
Payload: `{ newScore: { us, opponent } }`
One tap on the "+" button for opponent.

### TimeoutTaken
Payload: `{ team: 'us' | 'opponent', timeoutsRemaining: number }`

### SubstitutionConfirmed
Payload: `{ playerOutId, playerInId, courtPosition: 1-6 }`
A legal substitution that counts toward the set limit.

### LiberoReplacement
Payload: `{ liberoId, replacedPlayerId, direction: 'in' | 'out', courtPosition: 1-6 }`
Libero entering or leaving the court (does not count as substitution).

### PlayerAvailabilityChanged
Payload: `{ playerId, available: boolean, reason?: string }`
Mark a player as injured/unavailable mid-match.

### CorrectionApplied
Payload: `{ correctedEventId, description: string }`
Manual correction with explanation (e.g., "wrong team scored").

### NoteAdded
Payload: `{ text: string }`
Free-text coaching note anchored to a point in the match timeline.

### SetEnded
Payload: `{ setNumber, finalScore: { us, opponent }, winner: 'us' | 'opponent' }`

### MatchEnded
Payload: `{ finalSetScores: Array<{ us, opponent }>, winner: 'us' | 'opponent' }`

## Event Structure

```typescript
interface MatchEvent {
  id: string;
  matchId: string;
  type: MatchEventType;
  setNumber: number;
  timestamp: string; // ISO 8601
  payload: Record<string, unknown>;
  undone: boolean;
  sequence: number;
}
```

## Reducer

```typescript
function reduceMatchState(events: MatchEvent[]): MatchState {
  return events
    .filter(e => !e.undone)
    .sort((a, b) => a.sequence - b.sequence)
    .reduce(matchReducer, initialMatchState);
}
```

The `MatchState` includes:
- Current set number and scores (all sets)
- Current rotation (array of 6 player IDs in court positions)
- Substitution count and pairs for the current set
- Libero state (on/off court, replaced player)
- Timeout counts
- Serving team indicator

## Undo / Redo

- **Undo:** Set `undone: true` on the most recent non-undone event. Re-run reducer.
- **Redo:** Set `undone: false` on the most recently undone event. Re-run reducer.
- Multiple undos are supported (stack-based).
- Undone events remain in storage for audit purposes.

## Autosave and Recovery

- After each event is appended, the full event array is persisted to IndexedDB.
- On app load, if a match has status `"live"` and events exist, the reducer rebuilds state automatically.
- No user action needed to recover -- the match dashboard simply resumes where it left off.

## Performance Considerations

- For a typical match (~200-400 events), reducing the full log takes <10ms.
- If performance becomes an issue with very long matches, a snapshot mechanism can be introduced (store derived state at checkpoints and only replay events after the snapshot).
