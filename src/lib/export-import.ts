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

function truncateStrings(obj: Record<string, unknown>, maxLen = 1000): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (typeof value === 'string') {
      result[key] = value.slice(0, maxLen);
    } else if (Array.isArray(value)) {
      result[key] = value.slice(0, 100).map((v) =>
        typeof v === 'string' ? v.slice(0, maxLen) : v
      );
    } else {
      result[key] = value;
    }
  }
  return result;
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
      const sanitized = truncateStrings(item as Record<string, unknown>);
      await tx.store.put(sanitized as any);
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

const MAX_BACKUP_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_ARRAY_LENGTH = 10_000;

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && Object.getPrototypeOf(val) === Object.prototype;
}

function sanitizeArray(arr: unknown): unknown[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, MAX_ARRAY_LENGTH).filter((item) => {
    if (!isPlainObject(item)) return false;
    // Block prototype pollution keys
    if ('__proto__' in item || 'constructor' in item || 'prototype' in item) return false;
    // Require 'id' field as string
    if (typeof item.id !== 'string' || item.id.length === 0 || item.id.length > 100) return false;
    return true;
  });
}

function validateBackupStructure(data: unknown): BackupData {
  if (!isPlainObject(data)) throw new Error('Invalid backup: not an object');
  if (data.version !== 1) throw new Error('Unsupported backup version');
  if ('__proto__' in data) throw new Error('Invalid backup: forbidden key');

  return {
    version: 1,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
    clubs: sanitizeArray(data.clubs) as Club[],
    seasons: sanitizeArray(data.seasons) as Season[],
    teams: sanitizeArray(data.teams) as Team[],
    players: sanitizeArray(data.players) as Player[],
    rulesets: sanitizeArray(data.rulesets) as RulesetProfile[],
    lineups: sanitizeArray(data.lineups) as Lineup[],
    matches: sanitizeArray(data.matches) as Match[],
    matchEvents: sanitizeArray(data.matchEvents) as MatchEvent[],
  };
}

export function readBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_BACKUP_SIZE) {
      reject(new Error(`Backup file too large (max ${MAX_BACKUP_SIZE / 1024 / 1024}MB)`));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        const data = validateBackupStructure(raw);
        resolve(data);
      } catch (e) {
        reject(new Error('Failed to parse backup: ' + (e as Error).message));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
