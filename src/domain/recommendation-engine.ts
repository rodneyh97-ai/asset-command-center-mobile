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
import { matchEventRepo } from '@/db/database';
import { DRILL_LIBRARY } from './drill-library';

// ── Role-Specific Benchmarks ──
// Realistic competitive volleyball standards.

interface RoleBenchmark {
  metric: string;
  skillArea: SkillArea;
  /** Minimum acceptable value. Below (or above for error metrics) triggers a weakness. */
  threshold: number;
  /** 'higher' = higher is better, 'lower' = lower is better (error rates). */
  direction: 'higher' | 'lower';
  /** How important this metric is for the role (0-1). */
  roleWeight: number;
  label: string;
}

const ROLE_BENCHMARKS: Record<PlayerRole, RoleBenchmark[]> = {
  'Outside Hitter': [
    { metric: 'hittingPct', skillArea: 'attacking', threshold: 0.200, direction: 'higher', roleWeight: 1.0, label: 'Hitting percentage' },
    { metric: 'killsPerSet', skillArea: 'attacking', threshold: 3.0, direction: 'higher', roleWeight: 0.9, label: 'Kills per set' },
    { metric: 'receptionErrorRate', skillArea: 'serve-receive', threshold: 0.10, direction: 'lower', roleWeight: 0.8, label: 'Reception error rate' },
    { metric: 'digsPerSet', skillArea: 'defense', threshold: 2.0, direction: 'higher', roleWeight: 0.6, label: 'Digs per set' },
    { metric: 'serviceErrorRate', skillArea: 'serving', threshold: 0.12, direction: 'lower', roleWeight: 0.5, label: 'Service error rate' },
    { metric: 'aceRate', skillArea: 'serving', threshold: 0.08, direction: 'higher', roleWeight: 0.4, label: 'Ace rate' },
    { metric: 'blocksPerSet', skillArea: 'blocking', threshold: 0.5, direction: 'higher', roleWeight: 0.5, label: 'Blocks per set' },
  ],
  'Middle Blocker': [
    { metric: 'hittingPct', skillArea: 'attacking', threshold: 0.250, direction: 'higher', roleWeight: 1.0, label: 'Hitting percentage (middles should be efficient)' },
    { metric: 'blocksPerSet', skillArea: 'blocking', threshold: 1.0, direction: 'higher', roleWeight: 1.0, label: 'Blocks per set' },
    { metric: 'killsPerSet', skillArea: 'attacking', threshold: 2.0, direction: 'higher', roleWeight: 0.8, label: 'Kills per set' },
    { metric: 'serviceErrorRate', skillArea: 'serving', threshold: 0.12, direction: 'lower', roleWeight: 0.4, label: 'Service error rate' },
    { metric: 'aceRate', skillArea: 'serving', threshold: 0.06, direction: 'higher', roleWeight: 0.3, label: 'Ace rate' },
  ],
  'Right Side': [
    { metric: 'hittingPct', skillArea: 'attacking', threshold: 0.220, direction: 'higher', roleWeight: 0.9, label: 'Hitting percentage' },
    { metric: 'blocksPerSet', skillArea: 'blocking', threshold: 0.8, direction: 'higher', roleWeight: 0.9, label: 'Blocks per set' },
    { metric: 'killsPerSet', skillArea: 'attacking', threshold: 2.5, direction: 'higher', roleWeight: 0.8, label: 'Kills per set' },
    { metric: 'serviceErrorRate', skillArea: 'serving', threshold: 0.12, direction: 'lower', roleWeight: 0.5, label: 'Service error rate' },
    { metric: 'digsPerSet', skillArea: 'defense', threshold: 1.5, direction: 'higher', roleWeight: 0.5, label: 'Digs per set' },
    { metric: 'aceRate', skillArea: 'serving', threshold: 0.07, direction: 'higher', roleWeight: 0.4, label: 'Ace rate' },
  ],
  Setter: [
    { metric: 'assistsPerSet', skillArea: 'setting', threshold: 8.0, direction: 'higher', roleWeight: 1.0, label: 'Assists per set' },
    { metric: 'ballHandlingErrorRate', skillArea: 'setting', threshold: 0.03, direction: 'lower', roleWeight: 1.0, label: 'Ball handling error rate' },
    { metric: 'serviceErrorRate', skillArea: 'serving', threshold: 0.10, direction: 'lower', roleWeight: 0.5, label: 'Service error rate' },
    { metric: 'aceRate', skillArea: 'serving', threshold: 0.08, direction: 'higher', roleWeight: 0.4, label: 'Ace rate' },
    { metric: 'digsPerSet', skillArea: 'defense', threshold: 1.5, direction: 'higher', roleWeight: 0.5, label: 'Digs per set' },
    { metric: 'blocksPerSet', skillArea: 'blocking', threshold: 0.5, direction: 'higher', roleWeight: 0.5, label: 'Blocks per set' },
  ],
  Libero: [
    { metric: 'digsPerSet', skillArea: 'defense', threshold: 3.0, direction: 'higher', roleWeight: 1.0, label: 'Digs per set' },
    { metric: 'receptionErrorRate', skillArea: 'serve-receive', threshold: 0.08, direction: 'lower', roleWeight: 1.0, label: 'Reception error rate (liberos must be reliable)' },
  ],
  'Defensive Specialist': [
    { metric: 'digsPerSet', skillArea: 'defense', threshold: 2.5, direction: 'higher', roleWeight: 1.0, label: 'Digs per set' },
    { metric: 'receptionErrorRate', skillArea: 'serve-receive', threshold: 0.10, direction: 'lower', roleWeight: 0.9, label: 'Reception error rate' },
    { metric: 'serviceErrorRate', skillArea: 'serving', threshold: 0.12, direction: 'lower', roleWeight: 0.5, label: 'Service error rate' },
    { metric: 'aceRate', skillArea: 'serving', threshold: 0.06, direction: 'higher', roleWeight: 0.4, label: 'Ace rate' },
  ],
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

// ── Internal Helpers ──

function computeConfidence(sampleSize: number): number {
  if (sampleSize >= 10) return 0.95;
  if (sampleSize >= 5) return 0.8;
  if (sampleSize >= 3) return 0.6;
  if (sampleSize >= 1) return 0.3;
  return 0;
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

function computeMetricsFromSingle(stats: PlayerMatchStats): Record<string, number> {
  return computeMetrics(aggregateStats([stats]));
}

function formatMetricValue(metric: string, value: number): string {
  const isRateMetric = metric.includes('Rate') || metric.includes('Pct');
  return isRateMetric
    ? `${(value * 100).toFixed(1)}%`
    : value.toFixed(2);
}

function describeWeakness(metric: string, current: number, benchmark: number, label: string): string {
  return `${label}: current ${formatMetricValue(metric, current)} vs target ${formatMetricValue(metric, benchmark)}`;
}

function isBelowBenchmark(value: number, b: RoleBenchmark): boolean {
  return b.direction === 'higher' ? value < b.threshold : value > b.threshold;
}

function computeSeverity(value: number, b: RoleBenchmark): number {
  if (b.direction === 'higher') {
    if (value >= b.threshold) return 0;
    return Math.min(1, (b.threshold - value) / Math.max(b.threshold, 0.001));
  }
  if (value <= b.threshold) return 0;
  return Math.min(1, (value - b.threshold) / Math.max(b.threshold, 0.001));
}

/** Pick up to 3 recommended drill names for a skill area and role. */
function recommendDrills(skillArea: SkillArea, role: PlayerRole): string[] {
  return DRILL_LIBRARY
    .filter((d) => d.skillArea === skillArea && d.targetRoles.includes(role))
    .slice(0, 3)
    .map((d) => `${d.name} (${d.id})`);
}

// ── Primary API Functions (per spec) ──

/**
 * Analyze a player's performance across matches, observations, and snapshots.
 * Returns a full PlayerDevelopmentPlan with evidence-backed strengths, weaknesses,
 * and drill recommendations.
 *
 * Never invents weaknesses without data. If there is insufficient evidence
 * (< 1 match and no observations), says so.
 */
export function analyzePlayerPerformance(
  player: Player,
  matchStats: { matchId: string; matchDate: string; opponentName: string; stats: PlayerMatchStats }[],
  observations: CoachObservation[],
  snapshots: ImprovementSnapshot[],
): PlayerDevelopmentPlan {
  const now = new Date().toISOString();
  const role = player.primaryRole;
  const benchmarks = ROLE_BENCHMARKS[role] ?? [];

  // Insufficient data guard
  if (matchStats.length === 0 && observations.length === 0) {
    return {
      id: `devplan-${player.id}-${Date.now()}`,
      teamId: player.teamId,
      playerId: player.id,
      generatedAt: now,
      strengths: [],
      weaknesses: [],
      recommendations: [
        'Insufficient data to generate a development plan. Record at least one match to begin analysis.',
      ],
      coachNotes: '',
      updatedAt: now,
    };
  }

  const allStatArrays = matchStats.map((m) => m.stats);
  const agg = aggregateStats(allStatArrays);
  const metrics = computeMetrics(agg);
  const confidence = computeConfidence(agg.matchCount);

  const strengths: PlayerDevelopmentPlan['strengths'] = [];
  const weaknesses: PlayerWeakness[] = [];
  const recommendations: string[] = [];

  for (const benchmark of benchmarks) {
    const value = metrics[benchmark.metric];
    if (value === undefined) continue;

    // Build per-match evidence records
    const evidenceRecords: EvidenceRecord[] = matchStats.map((m) => {
      const singleMetrics = computeMetricsFromSingle(m.stats);
      return {
        source: 'match-stats' as const,
        matchId: m.matchId,
        matchDate: m.matchDate,
        opponentName: m.opponentName,
        value: singleMetrics[benchmark.metric] ?? 0,
        sampleSize: 1,
        timestamp: m.matchDate,
      };
    });

    if (isBelowBenchmark(value, benchmark)) {
      const severity = computeSeverity(value, benchmark);
      const drills = recommendDrills(benchmark.skillArea, role);

      weaknesses.push({
        playerId: player.id,
        skillArea: benchmark.skillArea,
        metric: benchmark.metric,
        currentValue: Math.round(value * 1000) / 1000,
        benchmarkValue: benchmark.threshold,
        evidence: evidenceRecords,
        confidence,
        description: describeWeakness(benchmark.metric, value, benchmark.threshold, benchmark.label),
      });

      if (drills.length > 0) {
        recommendations.push(
          `[${benchmark.skillArea}] ${player.displayName} needs work on ${benchmark.label.toLowerCase()} (severity: ${Math.round(severity * 100)}%). Recommended drills: ${drills.join(', ')}`,
        );
      }
    } else if (agg.matchCount > 0) {
      strengths.push({
        skillArea: benchmark.skillArea,
        metric: benchmark.metric,
        value: Math.round(value * 1000) / 1000,
        evidence: evidenceRecords,
      });
    }
  }

  // Incorporate coach observations as additional evidence
  const playerObs = observations.filter((o) => o.playerId === player.id);
  for (const obs of playerObs) {
    const evidenceRecord: EvidenceRecord = {
      source: 'coach-observation',
      value: obs.rating ?? 0,
      sampleSize: 1,
      timestamp: obs.createdAt,
    };

    const existingWeakness = weaknesses.find((w) => w.skillArea === obs.skillArea);
    if (existingWeakness) {
      existingWeakness.evidence.push(evidenceRecord);
      existingWeakness.confidence = Math.min(1, existingWeakness.confidence + 0.1);
    } else if (obs.rating !== undefined && obs.rating < 3) {
      // Coach rated below 3/5 — flag as a weakness with low confidence
      const drills = recommendDrills(obs.skillArea, role);
      weaknesses.push({
        playerId: player.id,
        skillArea: obs.skillArea,
        metric: 'coach-rating',
        currentValue: obs.rating,
        benchmarkValue: 3,
        evidence: [evidenceRecord],
        confidence: 0.3,
        description: `Coach observation: "${obs.observation}" (rated ${obs.rating}/5)`,
      });
      if (drills.length > 0) {
        recommendations.push(
          `[${obs.skillArea}] Coach flagged concern for ${player.displayName}: "${obs.observation}". Drills: ${drills.join(', ')}`,
        );
      }
    }
  }

  // Incorporate improvement snapshots into recommendations
  const weaknessAreas = new Set(weaknesses.map((w) => w.skillArea));
  for (const area of weaknessAreas) {
    const areaSnapshots = snapshots.filter(
      (s) => s.playerId === player.id && s.skillArea === area,
    );
    if (areaSnapshots.length >= 2) {
      const sorted = [...areaSnapshots].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      const first = sorted[0].value;
      const last = sorted[sorted.length - 1].value;
      if (last > first) {
        recommendations.push(
          `[${area}] ${player.displayName} is showing improvement (${first.toFixed(2)} -> ${last.toFixed(2)}). Continue current drills.`,
        );
      }
    }
  }

  return {
    id: `devplan-${player.id}-${Date.now()}`,
    teamId: player.teamId,
    playerId: player.id,
    generatedAt: now,
    strengths,
    weaknesses,
    recommendations,
    coachNotes: '',
    updatedAt: now,
  };
}

/**
 * Aggregate individual weaknesses into team practice priorities.
 * Rank by composite score = (impactScore * 0.5) + (confidenceScore * 0.3) + (urgencyScore * 0.2).
 */
export function generateTeamPriorities(
  players: Player[],
  devPlans: PlayerDevelopmentPlan[],
  recentMatches: { matchId: string; setsWon: number; setsLost: number }[],
): TeamPracticePriority[];

/**
 * Backward-compatible overload: (devPlans, observations, players).
 * Used by the practice store.
 */
export function generateTeamPriorities(
  devPlans: PlayerDevelopmentPlan[],
  observations: CoachObservation[],
  players: Player[],
): TeamPracticePriority[];

export function generateTeamPriorities(
  arg1: Player[] | PlayerDevelopmentPlan[],
  arg2: PlayerDevelopmentPlan[] | CoachObservation[],
  arg3: { matchId: string; setsWon: number; setsLost: number }[] | Player[],
): TeamPracticePriority[] {
  // Distinguish overloads: if arg3 items have 'setsWon', it's the new signature
  const isNewSignature =
    Array.isArray(arg3) &&
    arg3.length > 0 &&
    typeof (arg3[0] as { setsWon?: unknown }).setsWon === 'number';

  if (isNewSignature) {
    return generateTeamPrioritiesNew(
      arg1 as Player[],
      arg2 as PlayerDevelopmentPlan[],
      arg3 as { matchId: string; setsWon: number; setsLost: number }[],
    );
  }

  // Backward-compatible path: (devPlans, observations, players)
  return generateTeamPrioritiesLegacy(
    arg1 as PlayerDevelopmentPlan[],
    arg2 as CoachObservation[],
    arg3 as Player[],
  );
}

function generateTeamPrioritiesNew(
  players: Player[],
  devPlans: PlayerDevelopmentPlan[],
  recentMatches: { matchId: string; setsWon: number; setsLost: number }[],
): TeamPracticePriority[] {
  // Compute urgency from recent W/L
  const totalSetsWon = recentMatches.reduce((sum, m) => sum + m.setsWon, 0);
  const totalSetsLost = recentMatches.reduce((sum, m) => sum + m.setsLost, 0);
  const totalSets = totalSetsWon + totalSetsLost;
  const winRatio = totalSets > 0 ? totalSetsWon / totalSets : 0.5;
  const urgencyBase = 1.0 - winRatio;

  return buildPrioritiesFromPlans(devPlans, players, urgencyBase);
}

function generateTeamPrioritiesLegacy(
  devPlans: PlayerDevelopmentPlan[],
  observations: CoachObservation[],
  players: Player[],
): TeamPracticePriority[] {
  // Build the area map, then add observations
  const priorities = buildPrioritiesFromPlans(devPlans, players, 0.5);

  // Fold in observations that aren't already covered
  for (const obs of observations) {
    const existing = priorities.find((p) => p.skillArea === obs.skillArea);
    if (existing) {
      if (!existing.affectedPlayerIds.includes(obs.playerId)) {
        existing.affectedPlayerIds.push(obs.playerId);
      }
      existing.evidence.push({
        source: 'coach-observation',
        value: obs.rating ?? 0,
        sampleSize: 1,
        timestamp: obs.createdAt,
      });
    } else {
      priorities.push({
        skillArea: obs.skillArea,
        reason: `1 player needs work in ${obs.skillArea}`,
        impactScore: 0.2,
        confidenceScore: 0.3,
        urgencyScore: 0.3,
        compositeScore: 0.2 * 0.5 + 0.3 * 0.3 + 0.3 * 0.2,
        affectedPlayerIds: [obs.playerId],
        evidence: [{
          source: 'coach-observation',
          value: obs.rating ?? 0,
          sampleSize: 1,
          timestamp: obs.createdAt,
        }],
      });
    }
  }

  return priorities.sort((a, b) => b.compositeScore - a.compositeScore);
}

function buildPrioritiesFromPlans(
  devPlans: PlayerDevelopmentPlan[],
  players: Player[],
  urgencyBase: number,
): TeamPracticePriority[] {
  const areaMap = new Map<
    SkillArea,
    {
      affectedPlayerIds: Set<string>;
      totalSeverity: number;
      totalConfidence: number;
      weaknessCount: number;
      evidence: EvidenceRecord[];
      descriptions: string[];
    }
  >();

  for (const plan of devPlans) {
    for (const weakness of plan.weaknesses) {
      let entry = areaMap.get(weakness.skillArea);
      if (!entry) {
        entry = {
          affectedPlayerIds: new Set(),
          totalSeverity: 0,
          totalConfidence: 0,
          weaknessCount: 0,
          evidence: [],
          descriptions: [],
        };
        areaMap.set(weakness.skillArea, entry);
      }

      entry.affectedPlayerIds.add(weakness.playerId);
      entry.totalConfidence += weakness.confidence;
      entry.weaknessCount += 1;
      entry.evidence.push(...weakness.evidence);
      entry.descriptions.push(weakness.description);

      // Compute severity weighted by role importance
      const player = players.find((p) => p.id === weakness.playerId);
      const roleBenchmarks = player ? (ROLE_BENCHMARKS[player.primaryRole] ?? []) : [];
      const roleBenchmark = roleBenchmarks.find((b) => b.metric === weakness.metric);
      const roleWeight = roleBenchmark?.roleWeight ?? 0.5;

      const severity = roleBenchmark
        ? computeSeverity(weakness.currentValue, roleBenchmark)
        : Math.min(1, Math.abs(weakness.currentValue - weakness.benchmarkValue) * 2);

      entry.totalSeverity += severity * roleWeight;
    }
  }

  const totalPlayers = Math.max(players.length, 1);
  const priorities: TeamPracticePriority[] = [];

  for (const [skillArea, entry] of areaMap) {
    const playerCount = entry.affectedPlayerIds.size;

    const avgSeverity =
      entry.weaknessCount > 0 ? entry.totalSeverity / entry.weaknessCount : 0;
    const teamBreadth = Math.min(1, playerCount / totalPlayers);
    const impactScore = Math.min(1, avgSeverity * 0.6 + teamBreadth * 0.4);

    const confidenceScore =
      entry.weaknessCount > 0
        ? Math.min(1, entry.totalConfidence / entry.weaknessCount)
        : 0;

    const urgencyScore = Math.min(1, urgencyBase * 0.7 + teamBreadth * 0.3);

    const compositeScore =
      impactScore * 0.5 + confidenceScore * 0.3 + urgencyScore * 0.2;

    const reason =
      `${playerCount} player${playerCount !== 1 ? 's' : ''} need${playerCount === 1 ? 's' : ''} work in ${skillArea}`;

    priorities.push({
      skillArea,
      reason,
      impactScore: Math.round(impactScore * 1000) / 1000,
      confidenceScore: Math.round(confidenceScore * 1000) / 1000,
      urgencyScore: Math.round(urgencyScore * 1000) / 1000,
      compositeScore: Math.round(compositeScore * 1000) / 1000,
      affectedPlayerIds: [...entry.affectedPlayerIds],
      evidence: entry.evidence.slice(0, 10),
    });
  }

  return priorities.sort((a, b) => b.compositeScore - a.compositeScore);
}

/**
 * Take an existing development plan and new match data, return an updated plan.
 * Adds new evidence records, recalculates confidence scores, and marks improvements.
 */
export function reassessAfterNewData(
  existingPlan: PlayerDevelopmentPlan,
  newStats: PlayerMatchStats,
  matchInfo: { matchId: string; matchDate: string; opponentName: string },
): PlayerDevelopmentPlan;

/**
 * Backward-compatible overload for practice store:
 * (teamId, players, existingDevPlans, observations, matchData) => Promise<PlayerDevelopmentPlan[]>
 */
export function reassessAfterNewData(
  teamId: string,
  players: Player[],
  existingDevPlans: PlayerDevelopmentPlan[],
  observations: CoachObservation[],
  matchData: { matchIds: string[] },
): Promise<PlayerDevelopmentPlan[]>;

export function reassessAfterNewData(
  arg1: PlayerDevelopmentPlan | string,
  arg2?: PlayerMatchStats | Player[],
  arg3?: { matchId: string; matchDate: string; opponentName: string } | PlayerDevelopmentPlan[],
  arg4?: CoachObservation[],
  arg5?: { matchIds: string[] },
): PlayerDevelopmentPlan | Promise<PlayerDevelopmentPlan[]> {
  if (typeof arg1 === 'string') {
    // Legacy overload
    return reassessAfterNewDataLegacy(
      arg1,
      arg2 as Player[],
      arg3 as PlayerDevelopmentPlan[],
      arg4 as CoachObservation[],
      arg5 as { matchIds: string[] },
    );
  }
  // New signature
  return reassessAfterNewDataNew(
    arg1 as PlayerDevelopmentPlan,
    arg2 as PlayerMatchStats,
    arg3 as { matchId: string; matchDate: string; opponentName: string },
  );
}

function reassessAfterNewDataNew(
  existingPlan: PlayerDevelopmentPlan,
  newStats: PlayerMatchStats,
  matchInfo: { matchId: string; matchDate: string; opponentName: string },
): PlayerDevelopmentPlan {
  const now = new Date().toISOString();
  const plan: PlayerDevelopmentPlan = JSON.parse(JSON.stringify(existingPlan));
  plan.updatedAt = now;

  // Count existing unique matches for confidence
  const existingMatchIds = new Set<string>();
  for (const w of plan.weaknesses) {
    for (const e of w.evidence) {
      if (e.matchId) existingMatchIds.add(e.matchId);
    }
  }
  for (const s of plan.strengths) {
    for (const e of s.evidence) {
      if (e.matchId) existingMatchIds.add(e.matchId);
    }
  }
  existingMatchIds.add(matchInfo.matchId);
  const newConfidence = computeConfidence(existingMatchIds.size);

  const newMetrics = computeMetricsFromSingle(newStats);

  // Update each weakness with new evidence
  const resolved: number[] = [];
  for (let i = 0; i < plan.weaknesses.length; i++) {
    const weakness = plan.weaknesses[i];
    const newValue = newMetrics[weakness.metric];
    if (newValue === undefined) continue;

    weakness.evidence.push({
      source: 'match-stats',
      matchId: matchInfo.matchId,
      matchDate: matchInfo.matchDate,
      opponentName: matchInfo.opponentName,
      value: newValue,
      sampleSize: 1,
      timestamp: matchInfo.matchDate,
    });

    // Recalculate average from match evidence only
    const matchEvidence = weakness.evidence.filter((e) => e.source === 'match-stats');
    const avg = matchEvidence.reduce((sum, e) => sum + e.value, 0) / matchEvidence.length;

    weakness.currentValue = Math.round(avg * 1000) / 1000;
    weakness.confidence = newConfidence;
    weakness.description = `${weakness.metric}: current ${formatMetricValue(weakness.metric, avg)} vs target ${formatMetricValue(weakness.metric, weakness.benchmarkValue)} (${matchEvidence.length} match samples)`;

    // Check if now meets benchmark
    const isErrorMetric = weakness.metric.includes('Error') || weakness.metric.includes('Rate');
    const meetsBenchmark = isErrorMetric
      ? weakness.currentValue <= weakness.benchmarkValue
      : weakness.currentValue >= weakness.benchmarkValue;

    if (meetsBenchmark) {
      resolved.push(i);
      plan.strengths.push({
        skillArea: weakness.skillArea,
        metric: weakness.metric,
        value: weakness.currentValue,
        evidence: weakness.evidence,
      });
    }
  }

  // Remove resolved weaknesses in reverse order
  for (let i = resolved.length - 1; i >= 0; i--) {
    plan.weaknesses.splice(resolved[i], 1);
  }

  // Update existing strengths with new evidence
  for (const strength of plan.strengths) {
    const newValue = newMetrics[strength.metric];
    if (newValue === undefined) continue;

    strength.evidence.push({
      source: 'match-stats',
      matchId: matchInfo.matchId,
      matchDate: matchInfo.matchDate,
      opponentName: matchInfo.opponentName,
      value: newValue,
      sampleSize: 1,
      timestamp: matchInfo.matchDate,
    });

    const matchEvidence = strength.evidence.filter((e) => e.source === 'match-stats');
    strength.value =
      Math.round(
        (matchEvidence.reduce((sum, e) => sum + e.value, 0) / matchEvidence.length) * 1000,
      ) / 1000;
  }

  return plan;
}

async function reassessAfterNewDataLegacy(
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
    const benchmarks = ROLE_BENCHMARKS[player.primaryRole] ?? [];
    const agg = aggregateStats(matchStats);
    const metrics = computeMetrics(agg);
    const sampleSize = agg.matchCount;
    const confidence = computeConfidence(sampleSize);

    const strengths: PlayerDevelopmentPlan['strengths'] = [];
    const weaknesses: PlayerWeakness[] = [];

    for (const benchmark of benchmarks) {
      const value = metrics[benchmark.metric];
      if (value === undefined) continue;

      const evidence: EvidenceRecord[] =
        sampleSize > 0
          ? [{ source: 'match-stats', value, sampleSize, timestamp: now }]
          : [];

      if (sampleSize > 0 && !isBelowBenchmark(value, benchmark)) {
        strengths.push({ skillArea: benchmark.skillArea, metric: benchmark.metric, value, evidence });
      } else if (sampleSize > 0) {
        weaknesses.push({
          playerId: player.id,
          skillArea: benchmark.skillArea,
          metric: benchmark.metric,
          currentValue: value,
          benchmarkValue: benchmark.threshold,
          evidence,
          confidence,
          description: describeWeakness(benchmark.metric, value, benchmark.threshold, benchmark.label),
        });
      }
    }

    // Incorporate coach observations
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

    // Generate recommendations
    const recommendations: string[] = [];
    for (const w of weaknesses.slice(0, 3)) {
      const drills = recommendDrills(w.skillArea, player.primaryRole);
      if (drills.length > 0) {
        recommendations.push(
          `Focus on ${w.skillArea}: ${w.description}. Drills: ${drills.join(', ')}`,
        );
      } else {
        recommendations.push(`Address ${w.skillArea} skill gaps through targeted drill work`);
      }
    }

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

/**
 * Compute the improvement trend for a specific metric across snapshots.
 */
export function getImprovementTrend(
  snapshots: ImprovementSnapshot[],
  metric: string,
): { trend: 'improving' | 'declining' | 'stable'; changePercent: number };

/**
 * Backward-compatible overload: (playerId, snapshots) => trend string.
 */
export function getImprovementTrend(
  playerId: string,
  snapshots: ImprovementSnapshot[],
): 'improving' | 'declining' | 'stable';

export function getImprovementTrend(
  arg1: ImprovementSnapshot[] | string,
  arg2: string | ImprovementSnapshot[],
): { trend: 'improving' | 'declining' | 'stable'; changePercent: number } | 'improving' | 'declining' | 'stable' {
  if (typeof arg1 === 'string') {
    // Legacy overload: (playerId, snapshots)
    return getImprovementTrendLegacy(arg1, arg2 as ImprovementSnapshot[]);
  }
  // New signature: (snapshots, metric)
  return getImprovementTrendNew(arg1 as ImprovementSnapshot[], arg2 as string);
}

function getImprovementTrendNew(
  snapshots: ImprovementSnapshot[],
  metric: string,
): { trend: 'improving' | 'declining' | 'stable'; changePercent: number } {
  const relevant = snapshots
    .filter((s) => s.metric === metric)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (relevant.length < 2) {
    return { trend: 'stable', changePercent: 0 };
  }

  const first = relevant[0].value;
  const last = relevant[relevant.length - 1].value;

  if (first === 0) {
    if (last > 0) return { trend: 'improving', changePercent: 100 };
    if (last < 0) return { trend: 'declining', changePercent: -100 };
    return { trend: 'stable', changePercent: 0 };
  }

  const changePercent = Math.round(((last - first) / Math.abs(first)) * 1000) / 10;

  if (Math.abs(changePercent) < 5) {
    return { trend: 'stable', changePercent };
  }

  return {
    trend: changePercent > 0 ? 'improving' : 'declining',
    changePercent,
  };
}

function getImprovementTrendLegacy(
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
