import { Player, PlayerRole } from '@/domain/types';
import { v4 as uuidv4 } from 'uuid';

const CSV_HEADERS = [
  'jerseyNumber',
  'firstName',
  'lastName',
  'displayName',
  'primaryRole',
  'secondaryRoles',
  'coachingTags',
  'availabilityStatus',
  'notes',
];

export function exportPlayersToCSV(players: Player[]): string {
  const rows = [CSV_HEADERS.join(',')];

  for (const p of players) {
    const row = [
      p.jerseyNumber,
      escapeCsvField(p.firstName),
      escapeCsvField(p.lastName),
      escapeCsvField(p.displayName),
      escapeCsvField(p.primaryRole),
      escapeCsvField(p.secondaryRoles.join(';')),
      escapeCsvField(p.coachingTags.join(';')),
      escapeCsvField(p.availabilityStatus),
      escapeCsvField(p.notes),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

const MAX_FIELD_LENGTH = 200;
const MAX_ROWS = 100;

export function importPlayersFromCSV(csv: string, teamId: string): Player[] {
  if (csv.length > 500_000) throw new Error('CSV file too large (max 500KB)');

  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const players: Player[] = [];

  const rowLimit = Math.min(lines.length, MAX_ROWS + 1);
  for (let i = 1; i < rowLimit; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length < 4) continue;

    const get = (field: string) => {
      const idx = headers.indexOf(field);
      const raw = idx >= 0 ? values[idx]?.trim() || '' : '';
      return raw.slice(0, MAX_FIELD_LENGTH);
    };

    const now = new Date().toISOString();
    const firstName = get('firstName');
    const lastName = get('lastName');

    if (!firstName) continue;

    players.push({
      id: uuidv4(),
      teamId,
      firstName,
      lastName,
      displayName: get('displayName') || firstName,
      jerseyNumber: parseInt(get('jerseyNumber')) || 0,
      primaryRole: (get('primaryRole') as PlayerRole) || 'Outside Hitter',
      secondaryRoles: get('secondaryRoles')
        ? (get('secondaryRoles').split(';').filter(Boolean) as PlayerRole[])
        : [],
      coachingTags: get('coachingTags') ? get('coachingTags').split(';').filter(Boolean) : [],
      availabilityStatus: (get('availabilityStatus') as any) || 'Available',
      notes: get('notes') || '',
      createdAt: now,
      updatedAt: now,
    });
  }

  return players;
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsvField(value: string | number): string {
  let str = String(value);
  // Prevent CSV formula injection: prefix dangerous first chars with a single quote
  if (str.length > 0 && /^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
