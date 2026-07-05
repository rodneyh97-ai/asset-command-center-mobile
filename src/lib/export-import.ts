import { getDB } from '@/db/database';
import {
  Club,
  Season,
  Team,
  Player,
  RulesetProfile,
  Lineup,
  Match,
  MatchEvent,
} from '@/domain/types';

export interface BackupData {
  version: 1;
  exportedAt: string;
  clubs: Club[];
  seasons: Season[];
  teams: Team[];
  players: Player[];
  rulesets: RulesetProfile[];
  lineups: Lineup[];
  matches: Match[];
  matchEvents: MatchEvent[];
}

export async function exportBackup(): Promise<BackupData> {
  const db = await getDB();
  const [clubs, seasons, teams, players, rulesets, lineups, matches, matchEvents] =
    await Promise.all([
      db.getAll('clubs'),
      db.getAll('seasons'),
      db.getAll('teams'),
      db.getAll('players'),
      db.getAll('rulesets'),
      db.getAll('lineups'),
      db.getAll('matches'),
      db.getAll('matchEvents'),
    ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    clubs,
    seasons,
    teams,
    players,
    rulesets,
    lineups,
    matches,
    matchEvents,
  };
}

export async function importBackup(data: BackupData): Promise<{ imported: number }> {
  if (data.version !== 1) throw new Error('Unsupported backup version');

  const db = await getDB();
  let count = 0;

  const stores = [
    { name: 'clubs' as const, items: data.clubs },
    { name: 'seasons' as const, items: data.seasons },
    { name: 'teams' as const, items: data.teams },
    { name: 'players' as const, items: data.players },
    { name: 'rulesets' as const, items: data.rulesets },
    { name: 'lineups' as const, items: data.lineups },
    { name: 'matches' as const, items: data.matches },
    { name: 'matchEvents' as const, items: data.matchEvents },
  ] as const;

  for (const { name, items } of stores) {
    if (!items || items.length === 0) continue;
    const tx = db.transaction(name, 'readwrite');
    for (const item of items) {
      await tx.store.put(item as any);
      count++;
    }
    await tx.done;
  }

  return { imported: count };
}

export function downloadBackupFile(data: BackupData) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vb-rotation-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data.version || !data.clubs) {
          reject(new Error('Invalid backup file format'));
          return;
        }
        resolve(data as BackupData);
      } catch {
        reject(new Error('Failed to parse backup file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
