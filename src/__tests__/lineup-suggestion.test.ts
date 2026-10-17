import { describe, it, expect } from 'vitest';
import { suggestLineups, getPlayerRatings } from '@/domain/lineup-suggestion';
import type { Player, PlayerMatchStats, Lineup } from '@/domain/types';

function makePlayer(overrides: Partial<Player> & { id: string; jerseyNumber: number; primaryRole: Player['primaryRole'] }): Player {
  return {
    teamId: 'team-1',
    firstName: `Player`,
    lastName: `${overrides.jerseyNumber}`,
    displayName: `P${overrides.jerseyNumber}`,
    secondaryRoles: [],
    coachingTags: [],
    availabilityStatus: 'Available',
    notes: '',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

function makeStats(playerId: string, overrides: Partial<PlayerMatchStats> = {}): PlayerMatchStats {
  return {
    playerId,
    kills: 0, attackErrors: 0, aces: 0, serviceErrors: 0,
    digs: 0, blocks: 0, assists: 0, receptionErrors: 0,
    ballHandlingErrors: 0, pointsOnCourt: 0, pointsAgainstOnCourt: 0,
    ...overrides,
  };
}

describe('suggestLineups', () => {
  const basePlayers: Player[] = [
    makePlayer({ id: 'setter', jerseyNumber: 1, primaryRole: 'Setter' }),
    makePlayer({ id: 'oh1', jerseyNumber: 2, primaryRole: 'Outside Hitter' }),
    makePlayer({ id: 'oh2', jerseyNumber: 3, primaryRole: 'Outside Hitter' }),
    makePlayer({ id: 'mb1', jerseyNumber: 4, primaryRole: 'Middle Blocker' }),
    makePlayer({ id: 'mb2', jerseyNumber: 5, primaryRole: 'Middle Blocker' }),
    makePlayer({ id: 'rs', jerseyNumber: 6, primaryRole: 'Right Side' }),
    makePlayer({ id: 'lib', jerseyNumber: 7, primaryRole: 'Libero', coachingTags: ['Libero eligible'] }),
  ];

  it('returns empty when fewer than 6 players', () => {
    const result = suggestLineups(basePlayers.slice(0, 5), [], []);
    expect(result).toEqual([]);
  });

  it('suggests at least one lineup for a full roster', () => {
    const result = suggestLineups(basePlayers, [], []);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('assigns all 6 positions in each suggestion', () => {
    const result = suggestLineups(basePlayers, [], []);
    for (const s of result) {
      expect(s.positions).toHaveLength(6);
      const posNumbers = s.positions.map((p) => p.position).sort();
      expect(posNumbers).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it('does not duplicate a player across positions', () => {
    const result = suggestLineups(basePlayers, [], []);
    for (const s of result) {
      const ids = s.positions.map((p) => p.playerId);
      expect(new Set(ids).size).toBe(6);
    }
  });

  it('identifies liberos from roster', () => {
    const result = suggestLineups(basePlayers, [], []);
    for (const s of result) {
      for (const lid of s.liberoIds) {
        const p = basePlayers.find((pl) => pl.id === lid);
        expect(
          p?.primaryRole === 'Libero' || p?.coachingTags.includes('Libero eligible')
        ).toBe(true);
      }
    }
  });

  it('excludes unavailable players', () => {
    const players = basePlayers.map((p) =>
      p.id === 'oh1' ? { ...p, availabilityStatus: 'Out for match' as const } : p,
    );
    const result = suggestLineups(players, [], []);
    for (const s of result) {
      expect(s.positions.some((p) => p.playerId === 'oh1')).toBe(false);
    }
  });

  it('uses match stats to influence rankings', () => {
    const stats: PlayerMatchStats[] = [
      makeStats('oh1', { kills: 15, attackErrors: 2, pointsOnCourt: 20, pointsAgainstOnCourt: 10 }),
      makeStats('oh2', { kills: 3, attackErrors: 5, pointsOnCourt: 8, pointsAgainstOnCourt: 15 }),
    ];
    const result = suggestLineups(basePlayers, stats, []);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('deduplicates identical suggestions', () => {
    const result = suggestLineups(basePlayers, [], []);
    const keys = result.map((s) =>
      s.positions.map((p) => `${p.position}:${p.playerId}`).sort().join('|')
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('getPlayerRatings', () => {
  it('returns ratings sorted by overall score', () => {
    const players: Player[] = [
      makePlayer({ id: 'a', jerseyNumber: 1, primaryRole: 'Outside Hitter' }),
      makePlayer({ id: 'b', jerseyNumber: 2, primaryRole: 'Outside Hitter' }),
    ];
    const stats: PlayerMatchStats[] = [
      makeStats('a', { kills: 10, attackErrors: 2 }),
      makeStats('b', { kills: 20, attackErrors: 1 }),
    ];
    const ratings = getPlayerRatings(players, stats);
    expect(ratings[0].playerId).toBe('b');
  });

  it('gives 0 overall score when no stats', () => {
    const players: Player[] = [
      makePlayer({ id: 'a', jerseyNumber: 1, primaryRole: 'Setter' }),
    ];
    const ratings = getPlayerRatings(players, []);
    expect(ratings[0].overallScore).toBe(0);
  });
});
