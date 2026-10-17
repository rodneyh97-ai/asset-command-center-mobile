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
  devPlans: {
    key: string;
    value: PlayerDevelopmentPlan;
    indexes: { 'by-team': string; 'by-player': string };
  };
  practicePlans: {
    key: string;
    value: PracticePlan;
    indexes: { 'by-team': string };
  };
  practiceResults: {
    key: string;
    value: PracticeResult;
    indexes: { 'by-team': string; 'by-plan': string };
  };
  coachObservations: {
    key: string;
    value: CoachObservation;
    indexes: { 'by-team': string; 'by-player': string };
  };
  customDrills: {
    key: string;
    value: Drill;
    indexes: { 'by-skill': string };
  };
  improvementSnapshots: {
    key: string;
    value: ImprovementSnapshot & { id: string; teamId: string };
    indexes: { 'by-player': string; 'by-team': string };
  };
  tournaments: {
    key: string;
    value: Tournament;
    indexes: { 'by-team': string };
  };
  tournamentMatches: {
    key: string;
    value: TournamentMatch;
    indexes: { 'by-tournament': string };
  };
  filmClips: {
    key: string;
    value: FilmClip;
    indexes: { 'by-match': string; 'by-player': string };
  };
  filmSessions: {
    key: string;
    value: FilmSession;
    indexes: { 'by-team': string; 'by-match': string };
  };
}

let dbInstance: IDBPDatabase<VolleyballDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<VolleyballDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<VolleyballDB>('volleyball-rotation-app', 4, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
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
      }

      if (oldVersion < 2) {
        const devPlanStore = db.createObjectStore('devPlans', { keyPath: 'id' });
        devPlanStore.createIndex('by-team', 'teamId');
        devPlanStore.createIndex('by-player', 'playerId');

        const practicePlanStore = db.createObjectStore('practicePlans', { keyPath: 'id' });
        practicePlanStore.createIndex('by-team', 'teamId');

        const practiceResultStore = db.createObjectStore('practiceResults', { keyPath: 'id' });
        practiceResultStore.createIndex('by-team', 'teamId');
        practiceResultStore.createIndex('by-plan', 'practicePlanId');

        const observationStore = db.createObjectStore('coachObservations', { keyPath: 'id' });
        observationStore.createIndex('by-team', 'teamId');
        observationStore.createIndex('by-player', 'playerId');

        const drillStore = db.createObjectStore('customDrills', { keyPath: 'id' });
        drillStore.createIndex('by-skill', 'skillArea');

        const snapshotStore = db.createObjectStore('improvementSnapshots', { keyPath: 'id' });
        snapshotStore.createIndex('by-player', 'playerId');
        snapshotStore.createIndex('by-team', 'teamId');
      }

      if (oldVersion < 3) {
        const tournamentStore = db.createObjectStore('tournaments', { keyPath: 'id' });
        tournamentStore.createIndex('by-team', 'teamId');

        const tournamentMatchStore = db.createObjectStore('tournamentMatches', { keyPath: 'id' });
        tournamentMatchStore.createIndex('by-tournament', 'tournamentId');
      }

      if (oldVersion < 4) {
        const filmClipStore = db.createObjectStore('filmClips', { keyPath: 'id' });
        filmClipStore.createIndex('by-match', 'matchId');
        filmClipStore.createIndex('by-player', 'playerId');

        const filmSessionStore = db.createObjectStore('filmSessions', { keyPath: 'id' });
        filmSessionStore.createIndex('by-team', 'teamId');
        filmSessionStore.createIndex('by-match', 'matchId');
      }
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

export const devPlanRepo = {
  async getByTeam(teamId: string): Promise<PlayerDevelopmentPlan[]> {
    const db = await getDB();
    return db.getAllFromIndex('devPlans', 'by-team', teamId);
  },
  async getByPlayer(playerId: string): Promise<PlayerDevelopmentPlan[]> {
    const db = await getDB();
    return db.getAllFromIndex('devPlans', 'by-player', playerId);
  },
  async get(id: string): Promise<PlayerDevelopmentPlan | undefined> {
    const db = await getDB();
    return db.get('devPlans', id);
  },
  async put(plan: PlayerDevelopmentPlan): Promise<void> {
    const db = await getDB();
    await db.put('devPlans', plan);
  },
  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('devPlans', id);
  },
};

export const practicePlanRepo = {
  async getByTeam(teamId: string): Promise<PracticePlan[]> {
    const db = await getDB();
    return db.getAllFromIndex('practicePlans', 'by-team', teamId);
  },
  async get(id: string): Promise<PracticePlan | undefined> {
    const db = await getDB();
    return db.get('practicePlans', id);
  },
  async put(plan: PracticePlan): Promise<void> {
    const db = await getDB();
    await db.put('practicePlans', plan);
  },
  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('practicePlans', id);
  },
};

export const practiceResultRepo = {
  async getByTeam(teamId: string): Promise<PracticeResult[]> {
    const db = await getDB();
    return db.getAllFromIndex('practiceResults', 'by-team', teamId);
  },
  async getByPlan(planId: string): Promise<PracticeResult[]> {
    const db = await getDB();
    return db.getAllFromIndex('practiceResults', 'by-plan', planId);
  },
  async put(result: PracticeResult): Promise<void> {
    const db = await getDB();
    await db.put('practiceResults', result);
  },
};

export const coachObservationRepo = {
  async getByTeam(teamId: string): Promise<CoachObservation[]> {
    const db = await getDB();
    return db.getAllFromIndex('coachObservations', 'by-team', teamId);
  },
  async getByPlayer(playerId: string): Promise<CoachObservation[]> {
    const db = await getDB();
    return db.getAllFromIndex('coachObservations', 'by-player', playerId);
  },
  async put(obs: CoachObservation): Promise<void> {
    const db = await getDB();
    await db.put('coachObservations', obs);
  },
  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('coachObservations', id);
  },
};

export const customDrillRepo = {
  async getAll(): Promise<Drill[]> {
    const db = await getDB();
    return db.getAll('customDrills');
  },
  async getBySkill(skillArea: string): Promise<Drill[]> {
    const db = await getDB();
    return db.getAllFromIndex('customDrills', 'by-skill', skillArea);
  },
  async put(drill: Drill): Promise<void> {
    const db = await getDB();
    await db.put('customDrills', drill);
  },
  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('customDrills', id);
  },
};

export const improvementSnapshotRepo = {
  async getByPlayer(playerId: string): Promise<(ImprovementSnapshot & { id: string; teamId: string })[]> {
    const db = await getDB();
    return db.getAllFromIndex('improvementSnapshots', 'by-player', playerId);
  },
  async getByTeam(teamId: string): Promise<(ImprovementSnapshot & { id: string; teamId: string })[]> {
    const db = await getDB();
    return db.getAllFromIndex('improvementSnapshots', 'by-team', teamId);
  },
  async put(snapshot: ImprovementSnapshot & { id: string; teamId: string }): Promise<void> {
    const db = await getDB();
    await db.put('improvementSnapshots', snapshot);
  },
};

export const tournamentRepo = {
  async getByTeam(teamId: string): Promise<Tournament[]> {
    const db = await getDB();
    return db.getAllFromIndex('tournaments', 'by-team', teamId);
  },
  async get(id: string): Promise<Tournament | undefined> {
    const db = await getDB();
    return db.get('tournaments', id);
  },
  async put(tournament: Tournament): Promise<void> {
    const db = await getDB();
    await db.put('tournaments', tournament);
  },
  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('tournaments', id);
  },
};

export const tournamentMatchRepo = {
  async getByTournament(tournamentId: string): Promise<TournamentMatch[]> {
    const db = await getDB();
    return db.getAllFromIndex('tournamentMatches', 'by-tournament', tournamentId);
  },
  async get(id: string): Promise<TournamentMatch | undefined> {
    const db = await getDB();
    return db.get('tournamentMatches', id);
  },
  async put(match: TournamentMatch): Promise<void> {
    const db = await getDB();
    await db.put('tournamentMatches', match);
  },
  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('tournamentMatches', id);
  },
};

export const filmClipRepo = {
  async getByMatch(matchId: string): Promise<FilmClip[]> {
    const db = await getDB();
    return db.getAllFromIndex('filmClips', 'by-match', matchId);
  },
  async getByPlayer(playerId: string): Promise<FilmClip[]> {
    const db = await getDB();
    return db.getAllFromIndex('filmClips', 'by-player', playerId);
  },
  async get(id: string): Promise<FilmClip | undefined> {
    const db = await getDB();
    return db.get('filmClips', id);
  },
  async put(clip: FilmClip): Promise<void> {
    const db = await getDB();
    await db.put('filmClips', clip);
  },
  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('filmClips', id);
  },
};

export const filmSessionRepo = {
  async getByTeam(teamId: string): Promise<FilmSession[]> {
    const db = await getDB();
    return db.getAllFromIndex('filmSessions', 'by-team', teamId);
  },
  async getByMatch(matchId: string): Promise<FilmSession[]> {
    const db = await getDB();
    return db.getAllFromIndex('filmSessions', 'by-match', matchId);
  },
  async get(id: string): Promise<FilmSession | undefined> {
    const db = await getDB();
    return db.get('filmSessions', id);
  },
  async put(session: FilmSession): Promise<void> {
    const db = await getDB();
    await db.put('filmSessions', session);
  },
  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('filmSessions', id);
  },
};
