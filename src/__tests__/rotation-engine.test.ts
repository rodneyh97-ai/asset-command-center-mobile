import { describe, it, expect } from 'vitest';
import {
  rotateClockwise,
  getCurrentServer,
  getNextServer,
  getFrontRow,
  getBackRow,
  processOurPoint,
  processOpponentPoint,
  applyRotations,
  getNextRotations,
} from '@/domain/rotation-engine';
import { RotationPosition, SetState } from '@/domain/types';

function makePositions(): RotationPosition[] {
  return [
    { position: 1, playerId: 'p1' },
    { position: 2, playerId: 'p2' },
    { position: 3, playerId: 'p3' },
    { position: 4, playerId: 'p4' },
    { position: 5, playerId: 'p5' },
    { position: 6, playerId: 'p6' },
  ];
}

function makeSetState(overrides: Partial<SetState> = {}): SetState {
  return {
    setNumber: 1,
    ourScore: 0,
    opponentScore: 0,
    servingTeam: 'us',
    currentRotation: 1,
    courtPlayers: makePositions(),
    benchPlayerIds: ['b1', 'b2'],
    substitutionCount: 0,
    timeoutsUsed: { us: 0, opponent: 0 },
    ...overrides,
  };
}

describe('Rotation Engine', () => {
  describe('rotateClockwise', () => {
    it('moves all players one position clockwise', () => {
      const positions = makePositions();
      const rotated = rotateClockwise(positions);

      // After clockwise rotation: position N gets the player who was at position N+1
      // Player at pos 1 moves to pos 6, player at pos 2 moves to pos 1, etc.
      expect(rotated.find((p) => p.playerId === 'p1')?.position).toBe(6);
      expect(rotated.find((p) => p.playerId === 'p2')?.position).toBe(1);
      expect(rotated.find((p) => p.playerId === 'p3')?.position).toBe(2);
      expect(rotated.find((p) => p.playerId === 'p4')?.position).toBe(3);
      expect(rotated.find((p) => p.playerId === 'p5')?.position).toBe(4);
      expect(rotated.find((p) => p.playerId === 'p6')?.position).toBe(5);
    });

    it('six rotations return all players to original positions', () => {
      const original = makePositions();
      const rotated = applyRotations(original, 6);

      for (const pos of original) {
        const found = rotated.find((r) => r.playerId === pos.playerId);
        expect(found?.position).toBe(pos.position);
      }
    });
  });

  describe('getCurrentServer and getNextServer', () => {
    it('returns player at position 1 as current server', () => {
      const positions = makePositions();
      expect(getCurrentServer(positions)).toBe('p1');
    });

    it('returns player at position 2 as next server', () => {
      const positions = makePositions();
      expect(getNextServer(positions)).toBe('p2');
    });

    it('updates current server after rotation', () => {
      const positions = makePositions();
      const rotated = rotateClockwise(positions);
      expect(getCurrentServer(rotated)).toBe('p2');
    });
  });

  describe('getFrontRow and getBackRow', () => {
    it('front row is positions 2, 3, 4', () => {
      const positions = makePositions();
      const front = getFrontRow(positions);
      expect(front.map((p) => p.position).sort()).toEqual([2, 3, 4]);
    });

    it('back row is positions 1, 5, 6', () => {
      const positions = makePositions();
      const back = getBackRow(positions);
      expect(back.map((p) => p.position).sort()).toEqual([1, 5, 6]);
    });
  });

  describe('processOurPoint', () => {
    it('serving team wins rally: score increases, no rotation', () => {
      const state = makeSetState({ servingTeam: 'us', ourScore: 5 });
      const result = processOurPoint(state);

      expect(result.setState.ourScore).toBe(6);
      expect(result.rotated).toBe(false);
      expect(result.setState.servingTeam).toBe('us');
      expect(getCurrentServer(result.setState.courtPlayers)).toBe('p1');
    });

    it('receiving team wins rally (side-out): score increases, rotates once, becomes serving', () => {
      const state = makeSetState({ servingTeam: 'opponent', ourScore: 10 });
      const result = processOurPoint(state);

      expect(result.setState.ourScore).toBe(11);
      expect(result.rotated).toBe(true);
      expect(result.setState.servingTeam).toBe('us');
      // After rotation, p2 should be at position 1 (new server)
      expect(getCurrentServer(result.setState.courtPlayers)).toBe('p2');
    });
  });

  describe('processOpponentPoint', () => {
    it('opponent already serving: their score increases, no rotation for us', () => {
      const state = makeSetState({ servingTeam: 'opponent', opponentScore: 7 });
      const result = processOpponentPoint(state);

      expect(result.setState.opponentScore).toBe(8);
      expect(result.rotated).toBe(false);
      expect(result.setState.servingTeam).toBe('opponent');
      expect(getCurrentServer(result.setState.courtPlayers)).toBe('p1');
    });

    it('we are serving, opponent wins: their score increases, they become serving, we do NOT rotate', () => {
      const state = makeSetState({ servingTeam: 'us', opponentScore: 3 });
      const result = processOpponentPoint(state);

      expect(result.setState.opponentScore).toBe(4);
      expect(result.rotated).toBe(false);
      expect(result.setState.servingTeam).toBe('opponent');
      // Our rotation stays the same - no rotation on side-out when opponent scores
      expect(getCurrentServer(result.setState.courtPlayers)).toBe('p1');
    });
  });

  describe('getNextRotations', () => {
    it('returns the correct number of future rotations', () => {
      const positions = makePositions();
      const next = getNextRotations(positions, 3);
      expect(next.length).toBe(3);
    });

    it('each rotation is one step further', () => {
      const positions = makePositions();
      const next = getNextRotations(positions, 3);

      expect(getCurrentServer(next[0])).toBe('p2');
      expect(getCurrentServer(next[1])).toBe('p3');
      expect(getCurrentServer(next[2])).toBe('p4');
    });
  });
});
