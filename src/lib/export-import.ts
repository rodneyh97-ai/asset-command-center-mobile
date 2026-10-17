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
  PlayerDevelopmentPlan,
  PracticePlan,
  PracticeResult,
  CoachObservation,
  Drill,
  ImprovementSnapshot,
  Tournament,
  TournamentMatch,
  FilmClip,
  FilmSession,
  HighlightReel,
  ScoutingReport,
  RecruitingProfile,
} from '@/domain/types';

export interface BackupData {
  version: 1 | 2 | 3;
  exportedAt: string;
  clubs: Club[];
  seasons: Season[];
  teams: Team[];
  players: Player[];
  rulesets: RulesetProfile[];
  lineups: Lineup[];
  matches: Match[];
  matchEvents: MatchEvent[];
  devPlans?: PlayerDevelopmentPlan[];
  practicePlans?: PracticePlan[];
  practiceResults?: PracticeResult[];
  coachObservations?: CoachObservation[];
  customDrills?: Drill[];
  improvementSnapshots?: (ImprovementSnapshot & { id: string; teamId: string })[];
  tournaments?: Tournament[];
  tournamentMatches?: TournamentMatch[];
  filmClips?: FilmClip[];
  filmSessions?: FilmSession[];
  highlightReels?: HighlightReel[];
  scoutingReports?: ScoutingReport[];
  recruitingProfiles?: RecruitingProfile[];
}

export async function exportBackup(): Promise<BackupData> {
  const db = await getDB();
  const [clubs, seasons, teams, players, rulesets, lineups, matches, matchEvents,
    devPlans, practicePlans, practiceResults, coachObservations, customDrills, improvementSnapshots,
    tournaments, tournamentMatches, filmClips, filmSessions, highlightReels, scoutingReports, recruitingProfiles] =
    await Promise.all([
      db.getAll('clubs'),
      db.getAll('seasons'),
      db.getAll('teams'),
      db.getAll('players'),
      db.getAll('rulesets'),
      db.getAll('lineups'),
      db.getAll('matches'),
      db.getAll('matchEvents'),
      db.getAll('devPlans'),
      db.getAll('practicePlans'),
      db.getAll('practiceResults'),
      db.getAll('coachObservations'),
      db.getAll('customDrills'),
      db.getAll('improvementSnapshots'),
      db.getAll('tournaments'),
      db.getAll('tournamentMatches'),
      db.getAll('filmClips'),
      db.getAll('filmSessions'),
      db.getAll('highlightReels'),
      db.getAll('scoutingReports'),
      db.getAll('recruitingProfiles'),
    ]);

  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    clubs,
    seasons,
    teams,
    players,
    rulesets,
    lineups,
    matches,
    matchEvents,
    devPlans,
    practicePlans,
    practiceResults,
    coachObservations,
    customDrills,
    improvementSnapshots,
    tournaments,
    tournamentMatches,
    filmClips,
    filmSessions,
    highlightReels,
    scoutingReports,
    recruitingProfiles,
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
  if (data.version !== 1 && data.version !== 2 && data.version !== 3) throw new Error('Unsupported backup version');

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
    { name: 'devPlans' as const, items: data.devPlans || [] },
    { name: 'practicePlans' as const, items: data.practicePlans || [] },
    { name: 'practiceResults' as const, items: data.practiceResults || [] },
    { name: 'coachObservations' as const, items: data.coachObservations || [] },
    { name: 'customDrills' as const, items: data.customDrills || [] },
    { name: 'improvementSnapshots' as const, items: data.improvementSnapshots || [] },
    { name: 'tournaments' as const, items: data.tournaments || [] },
    { name: 'tournamentMatches' as const, items: data.tournamentMatches || [] },
    { name: 'filmClips' as const, items: data.filmClips || [] },
    { name: 'filmSessions' as const, items: data.filmSessions || [] },
    { name: 'highlightReels' as const, items: data.highlightReels || [] },
    { name: 'scoutingReports' as const, items: data.scoutingReports || [] },
    { name: 'recruitingProfiles' as const, items: data.recruitingProfiles || [] },
  ] as const;

  for (const { name, items } of stores) {
    if (!items || items.length === 0) continue;
    const tx = db.transaction(name, 'readwrite');
    for (const item of items) {
      const sanitized = truncateStrings(item as unknown as Record<string, unknown>);
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
    if (Object.prototype.hasOwnProperty.call(item, '__proto__') ||
        Object.prototype.hasOwnProperty.call(item, 'constructor') ||
        Object.prototype.hasOwnProperty.call(item, 'prototype')) return false;
    if (typeof item.id !== 'string' || item.id.length === 0 || item.id.length > 100) return false;
    return true;
  });
}

function validateBackupStructure(data: unknown): BackupData {
  if (!isPlainObject(data)) throw new Error('Invalid backup: not an object');
  if (data.version !== 1 && data.version !== 2 && data.version !== 3) throw new Error('Unsupported backup version');
  if ('__proto__' in data) throw new Error('Invalid backup: forbidden key');

  const version = data.version as 1 | 2 | 3;

  return {
    version,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
    clubs: sanitizeArray(data.clubs) as Club[],
    seasons: sanitizeArray(data.seasons) as Season[],
    teams: sanitizeArray(data.teams) as Team[],
    players: sanitizeArray(data.players) as Player[],
    rulesets: sanitizeArray(data.rulesets) as RulesetProfile[],
    lineups: sanitizeArray(data.lineups) as Lineup[],
    matches: sanitizeArray(data.matches) as Match[],
    matchEvents: sanitizeArray(data.matchEvents) as MatchEvent[],
    devPlans: sanitizeArray(data.devPlans) as PlayerDevelopmentPlan[],
    practicePlans: sanitizeArray(data.practicePlans) as PracticePlan[],
    practiceResults: sanitizeArray(data.practiceResults) as PracticeResult[],
    coachObservations: sanitizeArray(data.coachObservations) as CoachObservation[],
    customDrills: sanitizeArray(data.customDrills) as Drill[],
    improvementSnapshots: sanitizeArray(data.improvementSnapshots) as (ImprovementSnapshot & { id: string; teamId: string })[],
    tournaments: sanitizeArray(data.tournaments) as Tournament[],
    tournamentMatches: sanitizeArray(data.tournamentMatches) as TournamentMatch[],
    filmClips: sanitizeArray(data.filmClips) as FilmClip[],
    filmSessions: sanitizeArray(data.filmSessions) as FilmSession[],
    highlightReels: sanitizeArray(data.highlightReels) as HighlightReel[],
    scoutingReports: sanitizeArray(data.scoutingReports) as ScoutingReport[],
    recruitingProfiles: sanitizeArray(data.recruitingProfiles) as RecruitingProfile[],
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
