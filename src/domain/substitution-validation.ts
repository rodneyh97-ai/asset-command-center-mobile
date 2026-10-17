import type { SetState, RulesetProfile, SubstitutionRecord, RotationPosition } from './types';

export interface SubValidationResult {
  allowed: boolean;
  warnings: string[];
  errors: string[];
}

export function validateSubstitution(
  setState: SetState,
  playerOutId: string,
  playerInId: string,
  ruleset: RulesetProfile | undefined,
): SubValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!ruleset) {
    return { allowed: true, warnings: ['No ruleset selected — validation skipped'], errors: [] };
  }

  if (ruleset.strictnessLevel === 'Practice / flexible') {
    return { allowed: true, warnings: [], errors: [] };
  }

  // Check substitution limit
  if (setState.substitutionCount >= ruleset.substitutionLimit) {
    errors.push(`Substitution limit reached (${ruleset.substitutionLimit})`);
  }

  // Check re-entry rules
  if (ruleset.reentryBehavior === 'none') {
    const wasOnCourt = setState.substitutionHistory.some(
      (s) => s.playerOutId === playerInId || s.playerInId === playerInId,
    );
    if (wasOnCourt) {
      errors.push('Re-entry not allowed under this ruleset');
    }
  } else if (ruleset.reentryBehavior === 'same-position') {
    const reentryViolation = checkSamePositionReentry(
      setState.substitutionHistory,
      setState.courtPlayers,
      playerOutId,
      playerInId,
    );
    if (reentryViolation) {
      errors.push(reentryViolation);
    }
  }

  const isStrict = ruleset.strictnessLevel === 'Strict validation';
  const allowed = isStrict ? errors.length === 0 : true;
  if (!isStrict && errors.length > 0) {
    warnings.push(...errors.splice(0));
  }

  return { allowed, warnings, errors };
}

function checkSamePositionReentry(
  history: SubstitutionRecord[],
  courtPlayers: RotationPosition[],
  playerOutId: string,
  playerInId: string,
): string | null {
  // In same-position re-entry (USAV/NFHS/AAU/NCAA):
  // A player who has been substituted out may only re-enter for the player who replaced them,
  // and they must return to the same position.

  // Find the position playerOut currently occupies
  const outPosition = courtPlayers.find((p) => p.playerId === playerOutId)?.position;
  if (!outPosition) return null;

  // Check if playerIn was previously subbed out of this set
  const playerInSubHistory = history.filter(
    (s) => s.playerOutId === playerInId,
  );

  if (playerInSubHistory.length === 0) {
    // playerIn has never been on court this set, or was never subbed out — OK
    return null;
  }

  // playerIn was previously subbed out. They can only re-enter for the player who replaced them,
  // at the same position they left from.
  const lastSubOut = playerInSubHistory[playerInSubHistory.length - 1];

  // The player who replaced playerIn when they left
  const replacedBy = lastSubOut.playerInId;

  // playerIn must re-enter for the same player who replaced them
  if (playerOutId !== replacedBy) {
    return `#${playerInId} can only re-enter for the player who replaced them`;
  }

  // Must return to same position
  if (outPosition !== lastSubOut.position) {
    return `#${playerInId} must return to position ${lastSubOut.position} (currently at ${outPosition})`;
  }

  return null;
}

export function getSetPointInfo(
  ourScore: number,
  opponentScore: number,
  targetScore: number,
  winByTwo: boolean,
): { team: 'us' | 'opponent'; type: 'set-point' | 'match-point' } | null {
  const usAtSetPoint = ourScore >= targetScore - 1 && (!winByTwo || ourScore >= opponentScore);
  const themAtSetPoint = opponentScore >= targetScore - 1 && (!winByTwo || opponentScore >= ourScore);

  if (usAtSetPoint && ourScore > opponentScore) return { team: 'us', type: 'set-point' };
  if (themAtSetPoint && opponentScore > ourScore) return { team: 'opponent', type: 'set-point' };
  return null;
}
