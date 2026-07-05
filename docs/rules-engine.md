# Rules Engine

The rules engine validates lineup construction and live-match actions against configurable volleyball rulesets.

## Supported Rulesets

### USAV (USA Volleyball)

- 12 substitutions per team per set
- Substitution is player-for-player (a player who leaves can only re-enter for the same player who replaced them)
- Libero replacements do not count as substitutions
- Libero may only play back-row positions (4, 5, 6 in rotation)
- Libero cannot serve (except in some USAV divisions -- configurable)
- Libero cannot attack above net height
- Sets to 25 (deciding set to 15), win by 2

### NFHS (National Federation of State High School Associations)

- 18 substitutions per team per set
- Substitution is player-for-player (same re-entry rule as USAV)
- Libero may serve in one rotation position
- Sets to 25 (deciding set to 25 in some states -- configurable)
- Allows one libero per team

### AAU (Amateur Athletic Union)

- 12 substitutions per team per set (same as USAV in most tournaments)
- Rules generally follow USAV with minor tournament-specific variations
- Configurable point totals per set

## Strictness Levels

Each match uses a `RulesetProfile` that pairs a base ruleset with a strictness level:

| Level | Behavior |
|-------|----------|
| **Planning Only** | Rules inform lineup builder suggestions. No enforcement during live match. |
| **Coach Warning** | Show a warning toast when an action would violate rules. Allow the coach to proceed anyway. |
| **Strict Validation** | Block illegal actions entirely. Show explanation of why the action is not allowed. |
| **Practice / Flexible** | All substitutions allowed freely. No sub count limits. Useful for scrimmages and practice sets. |

## Substitution Logic

### Core Rules (all rulesets)

1. A starter who is replaced may only re-enter the set for the player who replaced them.
2. A substitute who enters may only be replaced by the starter they replaced.
3. This creates a "substitution pair" tracked per set.
4. Once a player has used both entries (start -> out -> back in), they cannot enter again that set.

### Substitution Tracking

The engine maintains per-set state:
- `subsUsed: number` -- count toward the set limit
- `subPairs: Map<playerId, playerId>` -- who replaced whom
- `entryCount: Map<playerId, number>` -- how many times each player has entered (max 2)

### Validation Flow

```
canSubstitute(playerOut, playerIn, currentState) -> {
  allowed: boolean;
  reason?: string;  // human-readable explanation if blocked
  warning?: string; // shown in CoachWarning mode even if allowed
}
```

## Libero Rules

### Replacement (not a substitution)

- Libero enters for any back-row player between rallies
- Libero must leave before rotating to the front row
- Replacements are unlimited and do not count toward sub limits
- There must be a completed rally between two libero replacements (one rally separation rule)

### Libero Tracking

The engine tracks:
- `liberoOnCourt: boolean`
- `liberoReplacedPlayer: playerId` -- who the libero is in for
- `lastLiberoAction: 'in' | 'out'` -- to enforce one-rally separation
- `ralliesSinceLastLiberoAction: number`

### Libero Serving (NFHS only by default)

When enabled, the libero may serve in exactly one rotation position per set. The engine tracks which position the libero first served in and blocks serving in other positions.

## Rotation Validation

On side-out (when receiving team wins rally and gains serve):
1. Team rotates one position clockwise
2. Engine verifies the libero is not in a front-row position after rotation
3. If libero would rotate to front row, engine prompts for libero-out replacement before the next serve
