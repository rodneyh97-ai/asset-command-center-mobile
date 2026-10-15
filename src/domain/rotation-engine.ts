import { RotationPosition, ServingTeam, SetState } from './types';

export function rotateClockwise(positions: RotationPosition[]): RotationPosition[] {
  return positions.map((rp) => ({
    playerId: rp.playerId,
    position: rp.position === 1 ? 6 : ((rp.position - 1) as RotationPosition['position']),
  }));
}

export function getPlayerAtPosition(
  positions: RotationPosition[],
  position: number
): string | undefined {
  return positions.find((p) => p.position === position)?.playerId;
}

export function getCurrentServer(positions: RotationPosition[]): string | undefined {
  return getPlayerAtPosition(positions, 1);
}

export function getNextServer(positions: RotationPosition[]): string | undefined {
  return getPlayerAtPosition(positions, 2);
}

export function getFrontRow(positions: RotationPosition[]): RotationPosition[] {
  return positions.filter((p) => p.position >= 2 && p.position <= 4);
}

export function getBackRow(positions: RotationPosition[]): RotationPosition[] {
  return positions.filter((p) => p.position === 1 || p.position === 5 || p.position === 6);
}

export function getRotationNumber(
  currentPositions: RotationPosition[],
  originalPositions: RotationPosition[]
): number {
  const currentServer = getCurrentServer(currentPositions);
  for (let i = 0; i < 6; i++) {
    const rotated = applyRotations(originalPositions, i);
    if (getCurrentServer(rotated) === currentServer) {
      return i + 1;
    }
  }
  return 1;
}

export function applyRotations(positions: RotationPosition[], count: number): RotationPosition[] {
  let result = [...positions.map((p) => ({ ...p }))];
  for (let i = 0; i < count; i++) {
    result = rotateClockwise(result);
  }
  return result;
}

export interface AutoLiberoSwap {
  liberoId: string;
  replacedPlayerId: string;
  isEntering: boolean;
}

export interface RallyResult {
  setState: SetState;
  rotated: boolean;
  autoLiberoSwap?: AutoLiberoSwap;
}

export function processOurPoint(state: SetState): RallyResult {
  if (state.servingTeam === 'us') {
    return {
      setState: {
        ...state,
        ourScore: state.ourScore + 1,
      },
      rotated: false,
    };
  }

  const rotatedPositions = rotateClockwise(state.courtPlayers);
  return {
    setState: {
      ...state,
      ourScore: state.ourScore + 1,
      servingTeam: 'us',
      courtPlayers: rotatedPositions,
      currentRotation: ((state.currentRotation % 6) + 1),
    },
    rotated: true,
  };
}

export function processOpponentPoint(state: SetState): RallyResult {
  if (state.servingTeam === 'opponent') {
    return {
      setState: {
        ...state,
        opponentScore: state.opponentScore + 1,
      },
      rotated: false,
    };
  }

  return {
    setState: {
      ...state,
      opponentScore: state.opponentScore + 1,
      servingTeam: 'opponent',
    },
    rotated: false,
  };
}

export function getNextRotations(
  currentPositions: RotationPosition[],
  count: number = 3
): RotationPosition[][] {
  const rotations: RotationPosition[][] = [];
  let positions = currentPositions;
  for (let i = 0; i < count; i++) {
    positions = rotateClockwise(positions);
    rotations.push(positions);
  }
  return rotations;
}

/**
 * Determines if an automatic libero swap should occur based on the current state.
 *
 * Rules:
 * - If the libero is on court and now occupies a front-row position (2, 3, 4),
 *   the libero must exit and the original player returns.
 * - If the libero is NOT on court and a target player (typically a middle blocker)
 *   is in a back-row position (1, 5, 6), the libero enters for that player.
 */
export function getAutoLiberoSwap(
  state: SetState,
  liberoIds: string[]
): AutoLiberoSwap | null {
  if (!state.liberoAutoSwapEnabled || liberoIds.length === 0) return null;
  if (state.liberoTargetPlayerIds.length === 0) return null;

  // Priority 1: Libero needs to EXIT (they are in a front-row position)
  if (state.activeLiberoId && state.liberoReplacedPlayerId) {
    const liberoPos = state.courtPlayers.find(
      (p) => p.playerId === state.activeLiberoId
    );
    if (liberoPos && liberoPos.position >= 2 && liberoPos.position <= 4) {
      return {
        liberoId: state.activeLiberoId,
        replacedPlayerId: state.liberoReplacedPlayerId,
        isEntering: false,
      };
    }
  }

  // Priority 2: Libero needs to ENTER (a target player is in the back row)
  if (!state.activeLiberoId) {
    const liberoId = liberoIds[0];
    for (const targetId of state.liberoTargetPlayerIds) {
      const targetPos = state.courtPlayers.find((p) => p.playerId === targetId);
      if (
        targetPos &&
        (targetPos.position === 1 ||
          targetPos.position === 5 ||
          targetPos.position === 6)
      ) {
        return {
          liberoId,
          replacedPlayerId: targetId,
          isEntering: true,
        };
      }
    }
  }

  return null;
}
