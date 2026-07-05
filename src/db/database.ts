import { openDB, DBSchema, IDBPDatabase } from 'idb';
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

interface VolleyballDB extends DBSchema {
  clubs: { key: string; value: Club };
  seasons: { key: string; value: Season; indexes: { 'by-club': string } };
  teams: { key: string; value: Team; indexes: { 'by-season': string } };
  players: { key: string; value: Player; indexes: { 'by-team': string } };
  rulesets: { key: string; value: RulesetProfile };
  lineups: { key: string; value: Lineup; indexes: { 'by-team': string } };
  matches: { key: string; value: Match; indexes: { 'by-team': string } };
  matchEvents: {
    key: string;
    value: MatchEvent;
    indexes: { 'by-match': string; 'by-match-timestamp': [string, string] };
  };
}

let dbInstance: IDBPDatabase<VolleyballDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<VolleyballDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<VolleyballDB>('volleyball-rotation-app', 1, {
    upgrade(db) {
      db.createObjectStore('clubs', { keyPath: 'id' });

      const seasonStore = db.createObjectStore('seasons', { keyPath: 'id' });
      seasonStore.createIndex('by-club', 'clubId');

      const teamStore = db.createObjectStore('teams', { keyPath: 'id' });
      teamStore.createIndex('by-season', 'seasonId');

      const playerStore = db.createObjectStore('players', { keyPath: 'id' });
      playerStore.createIndex('by-team', 'teamId');

      db.createObjectStore('rulesets', { keyPath: 'id' });

      const lineupStore = db.createObjectStore('lineups', { keyPath: 'id' });
      lineupStore.createIndex('by-team', 'teamId');

      const matchStore = db.createObjectStore('matches', { keyPath: 'id' });
      matchStore.createIndex('by-team', 'teamId');

      const eventStore = db.createObjectStore('matchEvents', { keyPath: 'id' });
      eventStore.createIndex('by-match', 'matchId');
      eventStore.createIndex('by-match-timestamp', ['matchId', 'timestamp']);
    },
  });

  return dbInstance;
}

export const clubRepo = {
  async getAll(): Promise<Club[]> {
    const db = await getDB();
    return db.getAll('clubs');
  },
  async get(id: string): Promise<Club | undefined> {
    const db = await getDB();
    return db.get('clubs', id);
  },
  async put(club: Club): Promise<void> {
    const db = await getDB();
    await db.put('clubs', club);
  },
  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('clubs', id);
  },
};

export const seasonRepo = {
  async getByClub(clubId: string): Promise<Season[]> {
    const db = await getDB();
    return db.getAllFromIndex('seasons', 'by-club', clubId);
  },
  async put(season: Season): Promise<void> {
    const db = await getDB();
    await db.put('seasons', season);
  },
  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('seasons', id);
  },
};

export const teamRepo = {
  async getBySeason(seasonId: string): Promise<Team[]> {
    const db = await getDB();
    return db.getAllFromIndex('teams', 'by-season', seasonId);
  },
  async get(id: string): Promise<Team | undefined> {
    const db = await getDB();
    return db.get('teams', id);
  },
  async put(team: Team): Promise<void> {
    const db = await getDB();
    await db.put('teams', team);
  },
  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('teams', id);
  },
};

export const playerRepo = {
  async getByTeam(teamId: string): Promise<Player[]> {
    const db = await getDB();
    return db.getAllFromIndex('players', 'by-team', teamId);
  },
  async get(id: string): Promise<Player | undefined> {
    const db = await getDB();
    return db.get('players', id);
  },
  async put(player: Player): Promise<void> {
    const db = await getDB();
    await db.put('players', player);
  },
  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('players', id);
  },
};

export const rulesetRepo = {
  async getAll(): Promise<RulesetProfile[]> {
    const db = await getDB();
    return db.getAll('rulesets');
  },
  async get(id: string): Promise<RulesetProfile | undefined> {
    const db = await getDB();
    return db.get('rulesets', id);
  },
  async put(ruleset: RulesetProfile): Promise<void> {
    const db = await getDB();
    await db.put('rulesets', ruleset);
  },
};

export const lineupRepo = {
  async getByTeam(teamId: string): Promise<Lineup[]> {
    const db = await getDB();
    return db.getAllFromIndex('lineups', 'by-team', teamId);
  },
  async get(id: string): Promise<Lineup | undefined> {
    const db = await getDB();
    return db.get('lineups', id);
  },
  async put(lineup: Lineup): Promise<void> {
    const db = await getDB();
    await db.put('lineups', lineup);
  },
  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('lineups', id);
  },
};

export const matchRepo = {
  async getByTeam(teamId: string): Promise<Match[]> {
    const db = await getDB();
    return db.getAllFromIndex('matches', 'by-team', teamId);
  },
  async get(id: string): Promise<Match | undefined> {
    const db = await getDB();
    return db.get('matches', id);
  },
  async put(match: Match): Promise<void> {
    const db = await getDB();
    await db.put('matches', match);
  },
  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('matches', id);
  },
};

export const matchEventRepo = {
  async getByMatch(matchId: string): Promise<MatchEvent[]> {
    const db = await getDB();
    return db.getAllFromIndex('matchEvents', 'by-match', matchId);
  },
  async put(event: MatchEvent): Promise<void> {
    const db = await getDB();
    await db.put('matchEvents', event);
  },
  async putMany(events: MatchEvent[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('matchEvents', 'readwrite');
    for (const event of events) {
      await tx.store.put(event);
    }
    await tx.done;
  },
  async deleteByMatch(matchId: string): Promise<void> {
    const db = await getDB();
    const events = await db.getAllFromIndex('matchEvents', 'by-match', matchId);
    const tx = db.transaction('matchEvents', 'readwrite');
    for (const event of events) {
      await tx.store.delete(event.id);
    }
    await tx.done;
  },
};
