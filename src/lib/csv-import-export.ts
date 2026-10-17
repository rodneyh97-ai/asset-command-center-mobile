import type { Player, PlayerRole, PlayerMatchStats } from '@/domain/types';
import { v4 as uuidv4 } from 'uuid';

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

const VALID_ROLES: PlayerRole[] = [
  'Setter', 'Outside Hitter', 'Middle Blocker', 'Right Side', 'Libero', 'Defensive Specialist',
];

export function exportRosterCsv(players: Player[]): string {
  const headers = ['Jersey Number', 'First Name', 'Last Name', 'Display Name', 'Primary Role', 'Secondary Roles', 'Availability', 'Notes'];
  const rows = players.map((p) => [
    String(p.jerseyNumber),
    escapeCsvField(p.firstName),
    escapeCsvField(p.lastName),
    escapeCsvField(p.displayName),
    p.primaryRole,
    p.secondaryRoles.join('; '),
    p.availabilityStatus,
    escapeCsvField(p.notes),
  ].join(','));
  return [headers.join(','), ...rows].join('\n');
}

export function importRosterCsv(csv: string, teamId: string): { players: Player[]; errors: string[] } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { players: [], errors: ['File must have a header row and at least one data row'] };

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
  const errors: string[] = [];
  const players: Player[] = [];
  const now = new Date().toISOString();

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length < 3) {
      errors.push(`Row ${i + 1}: not enough fields`);
      continue;
    }

    const get = (name: string) => {
      const idx = header.indexOf(name);
      return idx >= 0 && idx < fields.length ? fields[idx] : '';
    };

    const jerseyNum = parseInt(get('jerseynumber') || get('number') || get('jersey') || fields[0], 10);
    if (isNaN(jerseyNum)) {
      errors.push(`Row ${i + 1}: invalid jersey number`);
      continue;
    }

    const firstName = get('firstname') || get('first') || fields[1] || '';
    const lastName = get('lastname') || get('last') || fields[2] || '';
    if (!firstName && !lastName) {
      errors.push(`Row ${i + 1}: missing name`);
      continue;
    }

    const displayName = get('displayname') || get('display') || `${firstName} ${lastName}`.trim();
    const roleStr = get('primaryrole') || get('role') || get('position') || '';
    const primaryRole: PlayerRole = VALID_ROLES.find(
      (r) => r.toLowerCase() === roleStr.toLowerCase()
    ) || 'Outside Hitter';

    players.push({
      id: uuidv4(),
      teamId,
      firstName: firstName.slice(0, 100),
      lastName: lastName.slice(0, 100),
      displayName: displayName.slice(0, 100),
      jerseyNumber: jerseyNum,
      primaryRole,
      secondaryRoles: [],
      coachingTags: [],
      availabilityStatus: 'Available',
      notes: (get('notes') || '').slice(0, 1000),
      createdAt: now,
      updatedAt: now,
    });
  }

  return { players, errors };
}

export function exportStatsCsv(
  players: Player[],
  stats: Record<string, PlayerMatchStats>,
): string {
  const headers = [
    'Jersey', 'Name', 'Role', 'Kills', 'Attack Errors', 'Aces', 'Service Errors',
    'Digs', 'Blocks', 'Assists', 'Reception Errors', 'BHE', 'Points On Court', 'Points Against',
  ];

  const rows = players.map((p) => {
    const s = stats[p.id];
    if (!s) return `${p.jerseyNumber},${escapeCsvField(p.displayName)},${p.primaryRole},0,0,0,0,0,0,0,0,0,0,0`;
    return [
      String(p.jerseyNumber),
      escapeCsvField(p.displayName),
      p.primaryRole,
      s.kills, s.attackErrors, s.aces, s.serviceErrors,
      s.digs, s.blocks, s.assists, s.receptionErrors, s.ballHandlingErrors,
      s.pointsOnCourt, s.pointsAgainstOnCourt,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
