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

export interface RallyResult {
  setState: SetState;
  rotated: boolean;
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
