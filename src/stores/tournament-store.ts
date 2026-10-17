import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  Tournament,
  TournamentMatch,
  TournamentFormat,
  TournamentStatus,
  TournamentStandings,
  CrossMatchStats,
  PlayerMatchStats,
  MatchState,
} from '@/domain/types';
import { tournamentRepo, tournamentMatchRepo, matchEventRepo } from '@/db/database';
import { rebuildState } from '@/domain/event-sourcing';

interface TournamentStore {
  tournaments: Tournament[];
  activeTournament: Tournament | null;
  tournamentMatches: TournamentMatch[];

  loadTournamentsForTeam(teamId: string): Promise<void>;
  createTournament(data: {
    teamId: string;
    name: string;
    location: string;
    startDate: string;
    endDate: string;
    format: TournamentFormat;
    poolName?: string;
    notes?: string;
  }): Promise<Tournament>;
  updateTournament(tournament: Tournament): Promise<void>;
  deleteTournament(id: string): Promise<void>;
  setActiveTournament(id: string | null): Promise<void>;

  loadMatchesForTournament(tournamentId: string): Promise<void>;
  addTournamentMatch(data: {
    tournamentId: string;
    opponentName: string;
    scheduledTime?: string;
    courtNumber?: string;
    phase: 'pool' | 'bracket';
    bracketRound?: string;
  }): Promise<TournamentMatch>;
  updateTournamentMatch(match: TournamentMatch): Promise<void>;
  deleteTournamentMatch(id: string): Promise<void>;
  linkMatchToTournament(tournamentMatchId: string, matchId: string): Promise<void>;
  recordResult(tournamentMatchId: string, setsWon: number, setsLost: number): Promise<void>;

  getPoolStandings(): TournamentStandings[];
  getCrossMatchStats(matchStates: MatchState[]): CrossMatchStats[];
}

export const useTournamentStore = create<TournamentStore>((set, get) => ({
  tournaments: [],
  activeTournament: null,
  tournamentMatches: [],

  async loadTournamentsForTeam(teamId: string) {
    const tournaments = await tournamentRepo.getByTeam(teamId);
    set({ tournaments });
  },

  async createTournament(data) {
    const now = new Date().toISOString();
    const tournament: Tournament = {
      id: uuidv4(),
      teamId: data.teamId,
      name: data.name,
      location: data.location,
      startDate: data.startDate,
      endDate: data.endDate,
      format: data.format,
      status: 'upcoming',
      poolName: data.poolName,
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now,
    };
    await tournamentRepo.put(tournament);
    set({ tournaments: [...get().tournaments, tournament] });
    return tournament;
  },

  async updateTournament(tournament) {
    const updated = { ...tournament, updatedAt: new Date().toISOString() };
    await tournamentRepo.put(updated);
    set({
      tournaments: get().tournaments.map((t) => (t.id === updated.id ? updated : t)),
      activeTournament: get().activeTournament?.id === updated.id ? updated : get().activeTournament,
    });
  },

  async deleteTournament(id) {
    await tournamentRepo.delete(id);
    const matches = await tournamentMatchRepo.getByTournament(id);
    for (const m of matches) {
      await tournamentMatchRepo.delete(m.id);
    }
    set({
      tournaments: get().tournaments.filter((t) => t.id !== id),
      activeTournament: get().activeTournament?.id === id ? null : get().activeTournament,
      tournamentMatches: get().activeTournament?.id === id ? [] : get().tournamentMatches,
    });
  },

  async setActiveTournament(id) {
    if (!id) {
      set({ activeTournament: null, tournamentMatches: [] });
      return;
    }
    const tournament = get().tournaments.find((t) => t.id === id) || (await tournamentRepo.get(id));
    if (tournament) {
      const matches = await tournamentMatchRepo.getByTournament(id);
      set({ activeTournament: tournament, tournamentMatches: matches });
    }
  },

  async loadMatchesForTournament(tournamentId) {
    const matches = await tournamentMatchRepo.getByTournament(tournamentId);
    set({ tournamentMatches: matches });
  },

  async addTournamentMatch(data) {
    const match: TournamentMatch = {
      id: uuidv4(),
      tournamentId: data.tournamentId,
      opponentName: data.opponentName,
      scheduledTime: data.scheduledTime,
      courtNumber: data.courtNumber,
      phase: data.phase,
      bracketRound: data.bracketRound,
      setsWon: 0,
      setsLost: 0,
      result: 'pending',
      notes: '',
    };
    await tournamentMatchRepo.put(match);
    set({ tournamentMatches: [...get().tournamentMatches, match] });
    return match;
  },

  async updateTournamentMatch(match) {
    await tournamentMatchRepo.put(match);
    set({ tournamentMatches: get().tournamentMatches.map((m) => (m.id === match.id ? match : m)) });
  },

  async deleteTournamentMatch(id) {
    await tournamentMatchRepo.delete(id);
    set({ tournamentMatches: get().tournamentMatches.filter((m) => m.id !== id) });
  },

  async linkMatchToTournament(tournamentMatchId, matchId) {
    const tm = get().tournamentMatches.find((m) => m.id === tournamentMatchId);
    if (!tm) return;
    const updated = { ...tm, matchId };
    await tournamentMatchRepo.put(updated);
    set({ tournamentMatches: get().tournamentMatches.map((m) => (m.id === updated.id ? updated : m)) });
  },

  async recordResult(tournamentMatchId, setsWon, setsLost) {
    const tm = get().tournamentMatches.find((m) => m.id === tournamentMatchId);
    if (!tm) return;
    const result = setsWon > setsLost ? 'win' : setsLost > setsWon ? 'loss' : 'pending';
    const updated: TournamentMatch = { ...tm, setsWon, setsLost, result };
    await tournamentMatchRepo.put(updated);
    set({ tournamentMatches: get().tournamentMatches.map((m) => (m.id === updated.id ? updated : m)) });
  },

  getPoolStandings(): TournamentStandings[] {
    const matches = get().tournamentMatches.filter((m) => m.phase === 'pool');
    const opponentMap = new Map<string, TournamentStandings>();

    // Our team's record
    let ourWins = 0, ourLosses = 0, ourSetsWon = 0, ourSetsLost = 0;

    for (const m of matches) {
      if (m.result === 'pending') continue;

      if (m.result === 'win') { ourWins++; } else { ourLosses++; }
      ourSetsWon += m.setsWon;
      ourSetsLost += m.setsLost;

      if (!opponentMap.has(m.opponentName)) {
        opponentMap.set(m.opponentName, {
          teamName: m.opponentName,
          isUs: false,
          wins: 0, losses: 0, setsWon: 0, setsLost: 0, pointsFor: 0, pointsAgainst: 0,
        });
      }
      const opp = opponentMap.get(m.opponentName)!;
      if (m.result === 'win') { opp.losses++; } else { opp.wins++; }
      opp.setsWon += m.setsLost;
      opp.setsLost += m.setsWon;
    }

    const standings: TournamentStandings[] = [
      {
        teamName: 'Us',
        isUs: true,
        wins: ourWins,
        losses: ourLosses,
        setsWon: ourSetsWon,
        setsLost: ourSetsLost,
        pointsFor: 0,
        pointsAgainst: 0,
      },
      ...opponentMap.values(),
    ];

    standings.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aSetDiff = a.setsWon - a.setsLost;
      const bSetDiff = b.setsWon - b.setsLost;
      return bSetDiff - aSetDiff;
    });

    return standings;
  },

  getCrossMatchStats(matchStates: MatchState[]): CrossMatchStats[] {
    const statsMap = new Map<string, CrossMatchStats>();

    for (const ms of matchStates) {
      for (const setState of ms.sets) {
        for (const [playerId, ps] of Object.entries(setState.playerStats)) {
          if (!statsMap.has(playerId)) {
            statsMap.set(playerId, {
              playerId,
              matchCount: 0,
              totalKills: 0, totalAttackErrors: 0,
              totalAces: 0, totalServiceErrors: 0,
              totalDigs: 0, totalBlocks: 0, totalAssists: 0,
              totalReceptionErrors: 0, totalBallHandlingErrors: 0,
              totalPointsOnCourt: 0, totalPointsAgainstOnCourt: 0,
            });
          }
          const agg = statsMap.get(playerId)!;
          agg.totalKills += ps.kills;
          agg.totalAttackErrors += ps.attackErrors;
          agg.totalAces += ps.aces;
          agg.totalServiceErrors += ps.serviceErrors;
          agg.totalDigs += ps.digs;
          agg.totalBlocks += ps.blocks;
          agg.totalAssists += ps.assists;
          agg.totalReceptionErrors += ps.receptionErrors;
          agg.totalBallHandlingErrors += ps.ballHandlingErrors;
          agg.totalPointsOnCourt += ps.pointsOnCourt;
          agg.totalPointsAgainstOnCourt += ps.pointsAgainstOnCourt;
        }
      }
    }

    // Count matches per player
    for (const ms of matchStates) {
      const playersInMatch = new Set<string>();
      for (const setState of ms.sets) {
        for (const playerId of Object.keys(setState.playerStats)) {
          playersInMatch.add(playerId);
        }
      }
      for (const pid of playersInMatch) {
        const agg = statsMap.get(pid);
        if (agg) agg.matchCount++;
      }
    }

    return [...statsMap.values()].sort((a, b) => b.totalKills - a.totalKills);
  },
}));
