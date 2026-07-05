import { describe, it, expect } from 'vitest';
import { exportPlayersToCSV, importPlayersFromCSV } from '@/lib/csv';
import { Player } from '@/domain/types';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    teamId: 'team-1',
    firstName: 'Jane',
    lastName: 'Smith',
    displayName: 'Jane',
    jerseyNumber: 7,
    primaryRole: 'Setter',
    secondaryRoles: ['Outside Hitter'],
    coachingTags: ['Six-rotation player'],
    availabilityStatus: 'Available',
    notes: '',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('CSV Export/Import', () => {
  it('exports players to valid CSV format', () => {
    const players = [
      makePlayer({ jerseyNumber: 7, firstName: 'Jane', lastName: 'Smith' }),
      makePlayer({ id: 'p2', jerseyNumber: 12, firstName: 'Alex', lastName: 'Lee', displayName: 'Alex' }),
    ];

    const csv = exportPlayersToCSV(players);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('jerseyNumber,firstName,lastName,displayName,primaryRole,secondaryRoles,coachingTags,availabilityStatus,notes');
    expect(lines.length).toBe(3);
    expect(lines[1]).toContain('7');
    expect(lines[1]).toContain('Jane');
    expect(lines[2]).toContain('12');
    expect(lines[2]).toContain('Alex');
  });

  it('handles fields with commas by quoting', () => {
    const players = [
      makePlayer({ notes: 'Good setter, strong serve' }),
    ];

    const csv = exportPlayersToCSV(players);
    expect(csv).toContain('"Good setter, strong serve"');
  });

  it('imports players from CSV correctly', () => {
    const csv = `jerseyNumber,firstName,lastName,displayName,primaryRole,secondaryRoles,coachingTags,availabilityStatus,notes
7,Jane,Smith,Jane,Setter,Outside Hitter,Six-rotation player,Available,
12,Alex,Lee,Alex,Middle Blocker,,,Available,Great blocker`;

    const players = importPlayersFromCSV(csv, 'team-1');

    expect(players.length).toBe(2);
    expect(players[0].firstName).toBe('Jane');
    expect(players[0].jerseyNumber).toBe(7);
    expect(players[0].primaryRole).toBe('Setter');
    expect(players[0].teamId).toBe('team-1');
    expect(players[1].firstName).toBe('Alex');
    expect(players[1].jerseyNumber).toBe(12);
    expect(players[1].notes).toBe('Great blocker');
  });

  it('round-trips: export then import produces same data', () => {
    const original = [
      makePlayer({ jerseyNumber: 3, firstName: 'Sam', lastName: 'Park', primaryRole: 'Libero' }),
      makePlayer({ id: 'p2', jerseyNumber: 9, firstName: 'Pat', lastName: 'Kim', primaryRole: 'Outside Hitter' }),
    ];

    const csv = exportPlayersToCSV(original);
    const imported = importPlayersFromCSV(csv, 'team-1');

    expect(imported.length).toBe(2);
    expect(imported[0].firstName).toBe('Sam');
    expect(imported[0].jerseyNumber).toBe(3);
    expect(imported[0].primaryRole).toBe('Libero');
    expect(imported[1].firstName).toBe('Pat');
    expect(imported[1].jerseyNumber).toBe(9);
  });

  it('skips rows with missing firstName', () => {
    const csv = `jerseyNumber,firstName,lastName,displayName,primaryRole
7,,Smith,Jane,Setter
12,Alex,Lee,Alex,Middle Blocker`;

    const players = importPlayersFromCSV(csv, 'team-1');
    expect(players.length).toBe(1);
    expect(players[0].firstName).toBe('Alex');
  });

  it('handles empty CSV gracefully', () => {
    const players = importPlayersFromCSV('', 'team-1');
    expect(players.length).toBe(0);
  });

  it('handles CSV with only headers', () => {
    const csv = 'jerseyNumber,firstName,lastName,displayName,primaryRole';
    const players = importPlayersFromCSV(csv, 'team-1');
    expect(players.length).toBe(0);
  });
});
