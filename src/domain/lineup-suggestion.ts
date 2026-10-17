import type {
  Player,
  PlayerRole,
  PlayerMatchStats,
  RotationPosition,
  SystemType,
  Lineup,
} from '@/domain/types';

export interface LineupSuggestion {
  positions: RotationPosition[];
  liberoIds: string[];
  systemType: SystemType;
  score: number;
  reasoning: string[];
}

interface PlayerRating {
  playerId: string;
  role: PlayerRole;
  offensiveScore: number;
  defensiveScore: number;
  servingScore: number;
  overallScore: number;
  setsPlayed: number;
}

function ratePlayer(player: Player, allStats: PlayerMatchStats[]): PlayerRating {
  const stats = allStats.filter((s) => s.playerId === player.id);
  const sets = Math.max(stats.length, 1);

  let totalKills = 0, totalErrors = 0, totalAces = 0, totalSvcErrors = 0;
  let totalDigs = 0, totalBlocks = 0, totalAssists = 0;
  let totalRecErrors = 0, totalBHErrors = 0;
  let totalPtsFor = 0, totalPtsAgainst = 0;

  for (const s of stats) {
    totalKills += s.kills;
    totalErrors += s.attackErrors;
    totalAces += s.aces;
    totalSvcErrors += s.serviceErrors;
    totalDigs += s.digs;
    totalBlocks += s.blocks;
    totalAssists += s.assists;
    totalRecErrors += s.receptionErrors;
    totalBHErrors += s.ballHandlingErrors;
    totalPtsFor += s.pointsOnCourt;
    totalPtsAgainst += s.pointsAgainstOnCourt;
  }

  const totalAttempts = totalKills + totalErrors;
  const hitPct = totalAttempts > 0 ? (totalKills - totalErrors) / totalAttempts : 0;

  const offensiveScore = (hitPct * 40) + (totalKills / sets * 5) + (totalAssists / sets * 3);
  const defensiveScore = (totalDigs / sets * 8) + (totalBlocks / sets * 10) - (totalRecErrors / sets * 5);
  const totalServes = totalAces + totalSvcErrors;
  const servingScore = totalServes > 0
    ? (totalAces / totalServes * 50) - (totalSvcErrors / totalServes * 30)
    : 0;

  const plusMinus = totalPtsFor - totalPtsAgainst;
  const overallScore = offensiveScore + defensiveScore + servingScore + (plusMinus / sets * 2);

  return {
    playerId: player.id,
    role: player.primaryRole,
    offensiveScore,
    defensiveScore,
    servingScore,
    overallScore: stats.length === 0 ? 0 : overallScore,
    setsPlayed: stats.length,
  };
}

const SYSTEM_ROLE_TEMPLATE: Record<SystemType, PlayerRole[]> = {
  '5-1': ['Setter', 'Outside Hitter', 'Middle Blocker', 'Right Side', 'Outside Hitter', 'Middle Blocker'],
  '6-2': ['Setter', 'Outside Hitter', 'Middle Blocker', 'Setter', 'Outside Hitter', 'Middle Blocker'],
  '4-2': ['Setter', 'Outside Hitter', 'Middle Blocker', 'Setter', 'Outside Hitter', 'Middle Blocker'],
  'Custom': [],
  'Blank': [],
};

function findBestAssignment(
  neededRoles: PlayerRole[],
  candidates: { player: Player; rating: PlayerRating }[],
): { positions: RotationPosition[]; usedIds: Set<string>; score: number; reasoning: string[] } {
  const positions: RotationPosition[] = [];
  const usedIds = new Set<string>();
  let totalScore = 0;
  const reasoning: string[] = [];

  for (let i = 0; i < neededRoles.length; i++) {
    const role = neededRoles[i];
    const pos = (i + 1) as 1 | 2 | 3 | 4 | 5 | 6;

    const eligible = candidates
      .filter((c) => !usedIds.has(c.player.id))
      .filter((c) =>
        c.player.primaryRole === role ||
        c.player.secondaryRoles.includes(role)
      )
      .sort((a, b) => b.rating.overallScore - a.rating.overallScore);

    if (eligible.length > 0) {
      const best = eligible[0];
      positions.push({ position: pos, playerId: best.player.id });
      usedIds.add(best.player.id);
      totalScore += best.rating.overallScore;
      if (best.player.primaryRole !== role) {
        reasoning.push(`#${best.player.jerseyNumber} ${best.player.displayName} playing ${role} (secondary role)`);
      }
    } else {
      const fallback = candidates
        .filter((c) => !usedIds.has(c.player.id))
        .sort((a, b) => b.rating.overallScore - a.rating.overallScore);

      if (fallback.length > 0) {
        const best = fallback[0];
        positions.push({ position: pos, playerId: best.player.id });
        usedIds.add(best.player.id);
        totalScore += best.rating.overallScore * 0.7;
        reasoning.push(`#${best.player.jerseyNumber} ${best.player.displayName} at P${pos} (no ${role} available)`);
      }
    }
  }

  return { positions, usedIds, score: totalScore, reasoning };
}

export function suggestLineups(
  players: Player[],
  allStats: PlayerMatchStats[],
  existingLineups: Lineup[],
  systemType: SystemType = '5-1',
): LineupSuggestion[] {
  if (players.length < 6) return [];

  const ratings = players
    .filter((p) => p.availabilityStatus === 'Available' || p.availabilityStatus === 'Limited')
    .map((p) => ({ player: p, rating: ratePlayer(p, allStats) }));

  const suggestions: LineupSuggestion[] = [];

  const template = SYSTEM_ROLE_TEMPLATE[systemType];
  if (template.length === 6) {
    const result = findBestAssignment(template, ratings);
    if (result.positions.length === 6) {
      const liberos = ratings
        .filter((r) => !result.usedIds.has(r.player.id))
        .filter((r) => r.player.primaryRole === 'Libero' || r.player.coachingTags.includes('Libero eligible'))
        .sort((a, b) => b.rating.defensiveScore - a.rating.defensiveScore)
        .slice(0, 2)
        .map((r) => r.player.id);

      const reasoning = [
        `Best ${systemType} lineup by overall performance`,
        ...result.reasoning,
      ];
      if (allStats.length === 0) {
        reasoning.push('No match data available — ranked by roster roles only');
      }

      suggestions.push({
        positions: result.positions,
        liberoIds: liberos,
        systemType,
        score: result.score,
        reasoning,
      });
    }
  }

  // Offensive-focused suggestion
  const offensiveRatings = [...ratings].sort((a, b) => b.rating.offensiveScore - a.rating.offensiveScore);
  if (template.length === 6) {
    const offResult = findBestAssignment(template, offensiveRatings);
    if (offResult.positions.length === 6) {
      const liberos = offensiveRatings
        .filter((r) => !offResult.usedIds.has(r.player.id))
        .filter((r) => r.player.primaryRole === 'Libero' || r.player.coachingTags.includes('Libero eligible'))
        .slice(0, 2)
        .map((r) => r.player.id);

      suggestions.push({
        positions: offResult.positions,
        liberoIds: liberos,
        systemType,
        score: offResult.score,
        reasoning: ['Offense-optimized lineup', ...offResult.reasoning],
      });
    }
  }

  // Defensive-focused suggestion
  const defensiveRatings = [...ratings].sort((a, b) => b.rating.defensiveScore - a.rating.defensiveScore);
  if (template.length === 6) {
    const defResult = findBestAssignment(template, defensiveRatings);
    if (defResult.positions.length === 6) {
      const liberos = defensiveRatings
        .filter((r) => !defResult.usedIds.has(r.player.id))
        .filter((r) => r.player.primaryRole === 'Libero' || r.player.coachingTags.includes('Libero eligible'))
        .slice(0, 2)
        .map((r) => r.player.id);

      suggestions.push({
        positions: defResult.positions,
        liberoIds: liberos,
        systemType,
        score: defResult.score,
        reasoning: ['Defense-optimized lineup', ...defResult.reasoning],
      });
    }
  }

  // Deduplicate suggestions with identical position assignments
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    const key = s.positions.map((p) => `${p.position}:${p.playerId}`).sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getPlayerRatings(
  players: Player[],
  allStats: PlayerMatchStats[],
): PlayerRating[] {
  return players
    .map((p) => ratePlayer(p, allStats))
    .sort((a, b) => b.overallScore - a.overallScore);
}
