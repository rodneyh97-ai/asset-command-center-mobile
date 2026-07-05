# Test Plan

Testing uses Vitest for unit/integration tests and React Testing Library for component tests. The priority is correctness of rotation logic and match state management.

## Test Categories

### 1. Rotation Logic

| Scenario | Expected |
|----------|----------|
| Side-out causes rotation | All 6 positions shift by one clockwise |
| Scoring team does not rotate | Positions remain unchanged |
| Rotation preserves serving order | After full rotation cycle, back to starting order |
| Rotation with libero on court | Libero auto-removed if rotating to front row |
| Rotation indices wrap correctly | Position 1 -> 6 -> 5 -> ... -> 1 |

### 2. Lineup Validation

| Scenario | Expected |
|----------|----------|
| Valid 6-player lineup | Passes validation |
| Duplicate player in lineup | Rejected with error |
| Player not on roster | Rejected |
| Libero placed in starting 6 (not as libero) | Warning per ruleset |
| Lineup with inactive player | Rejected |

### 3. Substitution Rules

| Scenario | Expected |
|----------|----------|
| Legal substitution within limit | Allowed, sub count increments |
| Substitution exceeds set limit (USAV 12) | Blocked in strict mode, warned in coach mode |
| Re-entry for wrong player | Blocked (must re-enter for same partner) |
| Third entry for same player | Blocked (max 2 entries per set) |
| Substitution in practice/flexible mode | Always allowed regardless of limits |
| Sub pair tracking across multiple subs | Correct pairing maintained |

### 4. Libero Rules

| Scenario | Expected |
|----------|----------|
| Libero enters back row | Allowed, does not count as sub |
| Libero enters front row | Blocked |
| Libero replacement without rally separation | Blocked |
| Libero replacement after one rally | Allowed |
| Libero serving in allowed rotation (NFHS) | Allowed in that one position |
| Libero serving in second rotation | Blocked |
| Libero leaves before front-row rotation | Prompted/auto-triggered |

### 5. Event Sourcing & Recovery

| Scenario | Expected |
|----------|----------|
| Reduce empty event list | Returns initial state |
| Reduce with OurPoint events | Score increments correctly |
| Undo last event | State matches previous state |
| Redo after undo | State matches post-undo state |
| Multiple undos | Stack-based, oldest events unaffected |
| Recovery after simulated crash | Reload produces identical state from persisted events |
| Events with `undone: true` skipped | Reducer ignores them |

### 6. UX Interaction Tests

| Scenario | Expected |
|----------|----------|
| One-tap point scoring | Single tap on "+" increments score and appends event |
| Three-tap substitution | Tap position -> tap player out -> tap player in completes sub |
| No typing required in live match | All live-match actions achievable via tap only |
| Undo button reverts last action | Most recent event marked undone, UI updates |
| Score buttons are large enough | Minimum 56x56px touch target |
| Landscape layout renders correctly | No horizontal scroll, all elements visible |

### 7. Data Persistence

| Scenario | Expected |
|----------|----------|
| Event saved to IndexedDB after action | Verified via mock/spy on DB write |
| Match resumes after page refresh | State rebuilt from stored events |
| Export produces valid JSON | Exported data can be re-imported |
| CSV import parses standard format | Players created with correct fields |
| Corrupt event log handled gracefully | Error boundary shown, data not lost |

## Running Tests

```bash
# Run all tests
npm run test

# Run with coverage
npm run test -- --coverage

# Run specific test file
npm run test -- src/engine/rotation.test.ts

# Watch mode during development
npm run test -- --watch
```

## Coverage Goals

- Rules engine: 95%+ line coverage
- Event reducer: 95%+ line coverage
- UI components: 80%+ for interactive components
- DB layer: 90%+ (critical path for data safety)
