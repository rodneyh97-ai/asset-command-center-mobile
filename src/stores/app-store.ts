import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  Club,
  Season,
  Team,
  Player,
  Lineup,
  Match,
  RulesetProfile,
} from '@/domain/types';
import {
  clubRepo,
  seasonRepo,
  teamRepo,
  playerRepo,
  lineupRepo,
  matchRepo,
  rulesetRepo,
} from '@/db/database';

interface AppStore {
  clubs: Club[];
  seasons: Season[];
  teams: Team[];
  players: Player[];
  lineups: Lineup[];
  matches: Match[];
  rulesets: RulesetProfile[];
  activeClubId: string | null;
  activeSeasonId: string | null;
  activeTeamId: string | null;
  isLoading: boolean;

  loadClubs(): Promise<void>;
  createClub(name: string): Promise<Club>;
  loadSeasonsForClub(clubId: string): Promise<void>;
  createSeason(clubId: string, name: string, year: number, ageGroup: string): Promise<Season>;
  loadTeamsForSeason(seasonId: string): Promise<void>;
  createTeam(seasonId: string, name: string, coachNames: string[]): Promise<Team>;
  setActiveClub(clubId: string): void;
  setActiveSeason(seasonId: string): void;
  setActiveTeam(teamId: string): void;
  loadPlayersForTeam(teamId: string): Promise<void>;
  createPlayer(player: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>): Promise<Player>;
  updatePlayer(player: Player): Promise<void>;
  deletePlayer(id: string): Promise<void>;
  loadLineupsForTeam(teamId: string): Promise<void>;
  createLineup(lineup: Omit<Lineup, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lineup>;
  updateLineup(lineup: Lineup): Promise<void>;
  deleteLineup(id: string): Promise<void>;
  loadMatchesForTeam(teamId: string): Promise<void>;
  createMatch(match: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>): Promise<Match>;
  updateMatch(match: Match): Promise<void>;
  loadRulesets(): Promise<void>;
  seedDefaultRulesets(): Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  clubs: [],
  seasons: [],
  teams: [],
  players: [],
  lineups: [],
  matches: [],
  rulesets: [],
  activeClubId: null,
  activeSeasonId: null,
  activeTeamId: null,
  isLoading: false,

  async loadClubs() {
    set({ isLoading: true });
    const clubs = await clubRepo.getAll();
    set({ clubs, isLoading: false });
  },

  async createClub(name: string) {
    const club: Club = {
      id: uuidv4(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await clubRepo.put(club);
    set({ clubs: [...get().clubs, club] });
    return club;
  },

  async loadSeasonsForClub(clubId: string) {
    const seasons = await seasonRepo.getByClub(clubId);
    set({ seasons });
  },

  async createSeason(clubId, name, year, ageGroup) {
    const season: Season = { id: uuidv4(), clubId, name, year, ageGroup, notes: '' };
    await seasonRepo.put(season);
    set({ seasons: [...get().seasons, season] });
    return season;
  },

  async loadTeamsForSeason(seasonId: string) {
    const teams = await teamRepo.getBySeason(seasonId);
    set({ teams });
  },

  async createTeam(seasonId, name, coachNames) {
    const team: Team = {
      id: uuidv4(),
      seasonId,
      name,
      coachNames,
      defaultSystem: '5-1',
    };
    await teamRepo.put(team);
    set({ teams: [...get().teams, team] });
    return team;
  },

  setActiveClub(clubId) {
    set({ activeClubId: clubId });
  },
  setActiveSeason(seasonId) {
    set({ activeSeasonId: seasonId });
  },
  setActiveTeam(teamId) {
    set({ activeTeamId: teamId });
  },

  async loadPlayersForTeam(teamId: string) {
    const players = await playerRepo.getByTeam(teamId);
    set({ players });
  },

  async createPlayer(playerData) {
    const now = new Date().toISOString();
    const player: Player = { ...playerData, id: uuidv4(), createdAt: now, updatedAt: now };
    await playerRepo.put(player);
    set({ players: [...get().players, player] });
    return player;
  },

  async updatePlayer(player: Player) {
    const updated = { ...player, updatedAt: new Date().toISOString() };
    await playerRepo.put(updated);
    set({ players: get().players.map((p) => (p.id === updated.id ? updated : p)) });
  },

  async deletePlayer(id: string) {
    await playerRepo.delete(id);
    set({ players: get().players.filter((p) => p.id !== id) });
  },

  async loadLineupsForTeam(teamId: string) {
    const lineups = await lineupRepo.getByTeam(teamId);
    set({ lineups });
  },

  async createLineup(lineupData) {
    const now = new Date().toISOString();
    const lineup: Lineup = { ...lineupData, id: uuidv4(), createdAt: now, updatedAt: now };
    await lineupRepo.put(lineup);
    set({ lineups: [...get().lineups, lineup] });
    return lineup;
  },

  async updateLineup(lineup: Lineup) {
    const updated = { ...lineup, updatedAt: new Date().toISOString() };
    await lineupRepo.put(updated);
    set({ lineups: get().lineups.map((l) => (l.id === updated.id ? updated : l)) });
  },

  async deleteLineup(id: string) {
    await lineupRepo.delete(id);
    set({ lineups: get().lineups.filter((l) => l.id !== id) });
  },

  async loadMatchesForTeam(teamId: string) {
    const matches = await matchRepo.getByTeam(teamId);
    set({ matches });
  },

  async createMatch(matchData) {
    const now = new Date().toISOString();
    const match: Match = { ...matchData, id: uuidv4(), createdAt: now, updatedAt: now };
    await matchRepo.put(match);
    set({ matches: [...get().matches, match] });
    return match;
  },

  async updateMatch(match: Match) {
    const updated = { ...match, updatedAt: new Date().toISOString() };
    await matchRepo.put(updated);
    set({ matches: get().matches.map((m) => (m.id === updated.id ? updated : m)) });
  },

  async loadRulesets() {
    const rulesets = await rulesetRepo.getAll();
    set({ rulesets });
  },

  async seedDefaultRulesets() {
    const existing = await rulesetRepo.getAll();
    if (existing.length > 0) {
      set({ rulesets: existing });
      return;
    }

    const defaults: RulesetProfile[] = [
      {
        id: uuidv4(),
        name: 'USAV 2025-2027',
        governingBody: 'USAV',
        version: '2025-2027',
        substitutionLimit: 12,
        reentryBehavior: 'same-position',
        liberoCountAllowed: 2,
        liberoServingRule: 'one-position',
        timeoutCount: 2,
        setTargetScore: 25,
        decidingSetTargetScore: 15,
        winByTwo: true,
        sideSwitchBehavior: 'after-set',
        strictnessLevel: 'Coach warning',
        customOverrides: {},
      },
      {
        id: uuidv4(),
        name: 'NFHS 2026-2027',
        governingBody: 'NFHS',
        version: '2026-2027',
        substitutionLimit: 18,
        reentryBehavior: 'same-position',
        liberoCountAllowed: 1,
        liberoServingRule: 'one-position',
        timeoutCount: 2,
        setTargetScore: 25,
        decidingSetTargetScore: 25,
        winByTwo: true,
        sideSwitchBehavior: 'after-set',
        strictnessLevel: 'Coach warning',
        customOverrides: {},
      },
      {
        id: uuidv4(),
        name: 'Practice / Flexible',
        governingBody: 'Custom',
        version: '1.0',
        substitutionLimit: 999,
        reentryBehavior: 'unrestricted',
        liberoCountAllowed: 2,
        liberoServingRule: 'unrestricted',
        timeoutCount: 99,
        setTargetScore: 25,
        decidingSetTargetScore: 15,
        winByTwo: true,
        sideSwitchBehavior: 'none',
        strictnessLevel: 'Practice / flexible',
        customOverrides: {},
      },
    ];

    for (const ruleset of defaults) {
      await rulesetRepo.put(ruleset);
    }
    set({ rulesets: defaults });
  },
}));
