import { v4 as uuidv4 } from 'uuid';
import type {
  Player,
  PlayerRole,
  PlayerMatchStats,
  PlayerDevelopmentPlan,
  PlayerWeakness,
  TeamPracticePriority,
  CoachObservation,
  ImprovementSnapshot,
  EvidenceRecord,
  SkillArea,
} from '@/domain/types';
import { matchEventRepo, matchRepo, improvementSnapshotRepo } from '@/db/database';

// ── Role-specific benchmarks ──

const BENCHMARKS: Record<PlayerRole, Record<string, number>> = {
  'Outside Hitter': {
    hittingPct: 0.200,
    killsPerSet: 3.0,
    digsPerSet: 2.0,
    receptionErrorRate: 0.10,
    aceRate: 0.08,
    serviceErrorRate: 0.12,
  },
  'Middle Blocker': {
    hittingPct: 0.250,
    blocksPerSet: 1.0,
    killsPerSet: 2.0,
    serviceErrorRate: 0.12,
    aceRate: 0.06,
  },
  'Right Side': {
    hittingPct: 0.220,
    killsPerSet: 2.5,
    blocksPerSet: 0.8,
    serviceErrorRate: 0.12,
    aceRate: 0.07,
  },
  Setter: {
    assistsPerSet: 8.0,
    ballHandlingErrorRate: 0.03,
    aceRate: 0.08,
    serviceErrorRate: 0.10,
    digsPerSet: 1.5,
  },
  Libero: {
    digsPerSet: 3.0,
    receptionErrorRate: 0.08,
  },
  'Defensive Specialist': {
    digsPerSet: 2.5,
    receptionErrorRate: 0.10,
    serviceErrorRate: 0.12,
    aceRate: 0.06,
  },
};

const METRIC_TO_SKILL: Record<string, SkillArea> = {
  hittingPct: 'attacking',
  killsPerSet: 'attacking',
  blocksPerSet: 'blocking',
  digsPerSet: 'defense',
  receptionErrorRate: 'serve-receive',
  aceRate: 'serving',
  serviceErrorRate: 'serving',
  assistsPerSet: 'setting',
  ballHandlingErrorRate: 'setting',
};

function computeConfidence(sampleSize: number): number {
  if (sampleSize >= 10) return 0.95;
  if (sampleSize >= 5) return 0.8;
  if (sampleSize >= 3) return 0.6;
  if (sampleSize >= 1) return 0.3;
  return 0;
}

function describeWeakness(metric: string, current: number, benchmark: number): string {
  const gap = Math.abs(current - benchmark);
  const isRateMetric = metric.includes('Rate') || metric.includes('Pct');
  const formatted = isRateMetric
    ? `${(current * 100).toFixed(1)}% vs target ${(benchmark * 100).toFixed(1)}%`
    : `${current.toFixed(2)} vs target ${benchmark.toFixed(2)}`;

  const labels: Record<string, string> = {
    hittingPct: 'Hitting percentage',
    killsPerSet: 'Kills per set',
    blocksPerSet: 'Blocks per set',
    digsPerSet: 'Digs per set',
    receptionErrorRate: 'Reception error rate',
    aceRate: 'Ace rate',
    serviceErrorRate: 'Service error rate',
    assistsPerSet: 'Assists per set',
    ballHandlingErrorRate: 'Ball handling error rate',
  };

  return `${labels[metric] || metric} is ${formatted}`;
}

interface StatsAggregation {
  totalKills: number;
  totalAttackErrors: number;
  totalAces: number;
  totalServiceErrors: number;
  totalDigs: number;
  totalBlocks: number;
  totalAssists: number;
  totalReceptionErrors: number;
  totalBallHandlingErrors: number;
  totalPointsOnCourt: number;
  totalPointsAgainst: number;
  setsPlayed: number;
  matchCount: number;
}

function aggregateStats(allStats: PlayerMatchStats[]): StatsAggregation {
  const agg: StatsAggregation = {
    totalKills: 0,
    totalAttackErrors: 0,
    totalAces: 0,
    totalServiceErrors: 0,
    totalDigs: 0,
    totalBlocks: 0,
    totalAssists: 0,
    totalReceptionErrors: 0,
    totalBallHandlingErrors: 0,
    totalPointsOnCourt: 0,
    totalPointsAgainst: 0,
    setsPlayed: 0,
    matchCount: allStats.length,
  };

  for (const s of allStats) {
    agg.totalKills += s.kills;
    agg.totalAttackErrors += s.attackErrors;
    agg.totalAces += s.aces;
    agg.totalServiceErrors += s.serviceErrors;
    agg.totalDigs += s.digs;
    agg.totalBlocks += s.blocks;
    agg.totalAssists += s.assists;
    agg.totalReceptionErrors += s.receptionErrors;
    agg.totalBallHandlingErrors += s.ballHandlingErrors;
    agg.totalPointsOnCourt += s.pointsOnCourt;
    agg.totalPointsAgainst += s.pointsAgainstOnCourt;
    agg.setsPlayed += 1;
  }

  return agg;
}

function computeMetrics(agg: StatsAggregation): Record<string, number> {
  const sets = Math.max(agg.setsPlayed, 1);
  const totalAttacks = agg.totalKills + agg.totalAttackErrors;
  const totalServes = agg.totalAces + agg.totalServiceErrors;
  const totalReceptions = agg.totalReceptionErrors + agg.totalDigs;

  return {
    hittingPct: totalAttacks > 0 ? (agg.totalKills - agg.totalAttackErrors) / totalAttacks : 0,
    killsPerSet: agg.totalKills / sets,
    blocksPerSet: agg.totalBlocks / sets,
    digsPerSet: agg.totalDigs / sets,
    assistsPerSet: agg.totalAssists / sets,
    aceRate: totalServes > 0 ? agg.totalAces / totalServes : 0,
    serviceErrorRate: totalServes > 0 ? agg.totalServiceErrors / totalServes : 0,
    receptionErrorRate: totalReceptions > 0 ? agg.totalReceptionErrors / totalReceptions : 0,
    ballHandlingErrorRate:
      agg.totalAssists + agg.totalBallHandlingErrors > 0
        ? agg.totalBallHandlingErrors / (agg.totalAssists + agg.totalBallHandlingErrors)
        : 0,
  };
}

export function analyzePlayerPerformance(
  player: Player,
  matchStats: PlayerMatchStats[],
  observations: CoachObservation[],
): { strengths: PlayerDevelopmentPlan['strengths']; weaknesses: PlayerWeakness[] } {
  const benchmarks = BENCHMARKS[player.primaryRole] || {};
  const agg = aggregateStats(matchStats);
  const metrics = computeMetrics(agg);
  const sampleSize = agg.matchCount;
  const confidence = computeConfidence(sampleSize);
  const now = new Date().toISOString();

  const strengths: PlayerDevelopmentPlan['strengths'] = [];
  const weaknesses: PlayerWeakness[] = [];

  for (const [metric, benchmark] of Object.entries(benchmarks)) {
    const value = metrics[metric];
    if (value === undefined) continue;

    const isErrorMetric = metric.includes('Error');
    const isAboveBenchmark = isErrorMetric ? value < benchmark : value > benchmark;
    const skillArea = METRIC_TO_SKILL[metric] || 'rotation';

    const evidence: EvidenceRecord[] =
      sampleSize > 0
        ? [
            {
              source: 'match-stats',
              value,
              sampleSize,
              timestamp: now,
            },
          ]
        : [];

    if (isAboveBenchmark && sampleSize > 0) {
      strengths.push({ skillArea, metric, value, evidence });
    } else if (!isAboveBenchmark && sampleSize > 0) {
      weaknesses.push({
        playerId: player.id,
        skillArea,
        metric,
        currentValue: value,
        benchmarkValue: benchmark,
        evidence,
        confidence,
        description: describeWeakness(metric, value, benchmark),
      });
    }
  }

  // Incorporate coach observations as evidence
  const playerObs = observations.filter((o) => o.playerId === player.id);
  for (const obs of playerObs) {
    const existing = weaknesses.find((w) => w.skillArea === obs.skillArea);
    if (existing) {
      existing.evidence.push({
        source: 'coach-observation',
        value: obs.rating ?? 0,
        sampleSize: 1,
        timestamp: obs.createdAt,
      });
      existing.confidence = Math.min(1, existing.confidence + 0.1);
    }
  }

  return { strengths, weaknesses };
}

function generateRecommendations(weaknesses: PlayerWeakness[], role: PlayerRole): string[] {
  const recs: string[] = [];

  for (const w of weaknesses.slice(0, 3)) {
    const area = w.skillArea;
    switch (area) {
      case 'attacking':
        recs.push(`Focus attacking drills on ${w.metric} improvement (current: ${w.currentValue.toFixed(3)}, target: ${w.benchmarkValue.toFixed(3)})`);
        break;
      case 'serving':
        if (w.metric === 'serviceErrorRate') {
          recs.push('Increase serve consistency through targeted repetition drills');
        } else {
          recs.push('Work on serving technique to improve ace rate');
        }
        break;
      case 'serve-receive':
        recs.push('Prioritize reception drills with varied serve types');
        break;
      case 'blocking':
        recs.push('Add blocking footwork and timing drills to practice');
        break;
      case 'setting':
        recs.push('Include setting accuracy drills with target zones');
        break;
      case 'defense':
        recs.push('Incorporate defensive positioning and dig technique work');
        break;
      default:
        recs.push(`Address ${area} skill gaps through targeted drill work`);
    }
  }

  return recs;
}

export function generateTeamPriorities(
  devPlans: PlayerDevelopmentPlan[],
  observations: CoachObservation[],
  players: Player[],
): TeamPracticePriority[] {
  const skillAreaMap = new Map<
    SkillArea,
    { weaknesses: PlayerWeakness[]; affectedPlayerIds: Set<string>; evidence: EvidenceRecord[] }
  >();

  // Aggregate weaknesses across all dev plans
  for (const dp of devPlans) {
    for (const w of dp.weaknesses) {
      let entry = skillAreaMap.get(w.skillArea);
      if (!entry) {
        entry = { weaknesses: [], affectedPlayerIds: new Set(), evidence: [] };
        skillAreaMap.set(w.skillArea, entry);
      }
      entry.weaknesses.push(w);
      entry.affectedPlayerIds.add(w.playerId);
      entry.evidence.push(...w.evidence);
    }
  }

  // Add observations that aren't covered by dev plans
  for (const obs of observations) {
    let entry = skillAreaMap.get(obs.skillArea);
    if (!entry) {
      entry = { weaknesses: [], affectedPlayerIds: new Set(), evidence: [] };
      skillAreaMap.set(obs.skillArea, entry);
    }
    entry.affectedPlayerIds.add(obs.playerId);
    entry.evidence.push({
      source: 'coach-observation',
      value: obs.rating ?? 0,
      sampleSize: 1,
      timestamp: obs.createdAt,
    });
  }

  const totalPlayers = Math.max(players.length, 1);
  const priorities: TeamPracticePriority[] = [];

  for (const [skillArea, data] of skillAreaMap.entries()) {
    const affectedRatio = data.affectedPlayerIds.size / totalPlayers;
    const avgConfidence =
      data.weaknesses.length > 0
        ? data.weaknesses.reduce((sum, w) => sum + w.confidence, 0) / data.weaknesses.length
        : 0.3;

    const impactScore = Math.min(1, affectedRatio * 1.5);
    const urgencyScore = Math.min(
      1,
      data.weaknesses.reduce((max, w) => {
        const gap = Math.abs(w.currentValue - w.benchmarkValue);
        return Math.max(max, gap);
      }, 0) * 2,
    );
    const confidenceScore = avgConfidence;
    const compositeScore = impactScore * 0.5 + confidenceScore * 0.3 + urgencyScore * 0.2;

    const avgGap =
      data.weaknesses.length > 0
        ? data.weaknesses.reduce((sum, w) => sum + Math.abs(w.currentValue - w.benchmarkValue), 0) /
          data.weaknesses.length
        : 0;

    priorities.push({
      skillArea,
      reason: `${data.affectedPlayerIds.size} player${data.affectedPlayerIds.size !== 1 ? 's' : ''} need${data.affectedPlayerIds.size === 1 ? 's' : ''} work in ${skillArea}`,
      impactScore,
      confidenceScore,
      urgencyScore,
      compositeScore,
      affectedPlayerIds: [...data.affectedPlayerIds],
      evidence: data.evidence.slice(0, 10),
    });
  }

  return priorities.sort((a, b) => b.compositeScore - a.compositeScore);
}

export async function reassessAfterNewData(
  teamId: string,
  players: Player[],
  existingDevPlans: PlayerDevelopmentPlan[],
  observations: CoachObservation[],
  matchData: { matchIds: string[] },
): Promise<PlayerDevelopmentPlan[]> {
  // Gather match stats from events
  const playerStatsMap = new Map<string, PlayerMatchStats[]>();

  for (const matchId of matchData.matchIds) {
    const events = await matchEventRepo.getByMatch(matchId);
    for (const event of events) {
      if (event.eventType === 'StatRecorded' && event.payload) {
        const playerId = event.payload.playerId as string;
        if (!playerId) continue;
        if (!playerStatsMap.has(playerId)) {
          playerStatsMap.set(playerId, []);
        }
      }
      if (event.eventType === 'SetEnded' && event.payload?.playerStats) {
        const stats = event.payload.playerStats as Record<string, PlayerMatchStats>;
        for (const [pid, s] of Object.entries(stats)) {
          if (!playerStatsMap.has(pid)) playerStatsMap.set(pid, []);
          playerStatsMap.get(pid)!.push(s);
        }
      }
    }
  }

  const now = new Date().toISOString();
  const updatedPlans: PlayerDevelopmentPlan[] = [];

  for (const player of players) {
    const matchStats = playerStatsMap.get(player.id) ?? [];
    const { strengths, weaknesses } = analyzePlayerPerformance(player, matchStats, observations);
    const recommendations = generateRecommendations(weaknesses, player.primaryRole);

    const existing = existingDevPlans.find((dp) => dp.playerId === player.id);

    updatedPlans.push({
      id: existing?.id ?? uuidv4(),
      teamId,
      playerId: player.id,
      generatedAt: existing?.generatedAt ?? now,
      strengths,
      weaknesses,
      recommendations,
      coachNotes: existing?.coachNotes ?? '',
      updatedAt: now,
    });
  }

  return updatedPlans;
}

export function getImprovementTrend(
  playerId: string,
  snapshots: ImprovementSnapshot[],
): 'improving' | 'declining' | 'stable' {
  const playerSnaps = snapshots
    .filter((s) => s.playerId === playerId)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (playerSnaps.length < 2) return 'stable';

  const recent = playerSnaps.slice(-3);
  let improvements = 0;
  let declines = 0;

  for (let i = 1; i < recent.length; i++) {
    if (recent[i].value > recent[i - 1].value) improvements++;
    else if (recent[i].value < recent[i - 1].value) declines++;
  }

  if (improvements > declines) return 'improving';
  if (declines > improvements) return 'declining';
  return 'stable';
}
