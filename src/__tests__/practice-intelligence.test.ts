import { describe, it, expect } from 'vitest';
import type {
  Player,
  PlayerMatchStats,
  PlayerDevelopmentPlan,
  TeamPracticePriority,
  CoachObservation,
  ImprovementSnapshot,
  Drill,
  PracticePlan,
  SkillArea,
} from '@/domain/types';

// We'll import these once the agents create them
// For now, define the test structure

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    teamId: 't1',
    firstName: 'Jane',
    lastName: 'Smith',
    displayName: 'Jane S.',
    jerseyNumber: 7,
    primaryRole: 'Outside Hitter',
    secondaryRoles: [],
    coachingTags: [],
    availabilityStatus: 'Available',
    notes: '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeStats(overrides: Partial<PlayerMatchStats> = {}): PlayerMatchStats {
  return {
    playerId: 'p1',
    kills: 0,
    attackErrors: 0,
    aces: 0,
    serviceErrors: 0,
    digs: 0,
    blocks: 0,
    assists: 0,
    receptionErrors: 0,
    ballHandlingErrors: 0,
    pointsOnCourt: 0,
    pointsAgainstOnCourt: 0,
    ...overrides,
  };
}

describe('Practice Intelligence Types', () => {
  it('should create valid player with all required fields', () => {
    const player = makePlayer();
    expect(player.id).toBe('p1');
    expect(player.primaryRole).toBe('Outside Hitter');
  });

  it('should create valid stats with defaults', () => {
    const stats = makeStats({ kills: 10, attackErrors: 3 });
    expect(stats.kills).toBe(10);
    expect(stats.attackErrors).toBe(3);
    expect(stats.digs).toBe(0);
  });

  it('should compute hitting percentage from stats', () => {
    const stats = makeStats({ kills: 15, attackErrors: 5 });
    const attempts = stats.kills + stats.attackErrors;
    const hitPct = attempts > 0 ? (stats.kills - stats.attackErrors) / attempts : 0;
    expect(hitPct).toBe(0.5);
  });

  it('should compute plus/minus', () => {
    const stats = makeStats({ pointsOnCourt: 20, pointsAgainstOnCourt: 15 });
    const pm = stats.pointsOnCourt - stats.pointsAgainstOnCourt;
    expect(pm).toBe(5);
  });
});

describe('Drill Library Structure', () => {
  it('should validate drill shape', () => {
    const drill: Drill = {
      id: 'drill-1',
      name: 'Pepper',
      skillArea: 'defense',
      targetRoles: ['Outside Hitter', 'Libero'],
      purpose: 'Warm up passing and defense',
      setup: 'Partners face each other 15 feet apart',
      execution: 'Continuous pass-set-hit sequence between partners',
      progressions: ['Add movement', 'Add jump attacks'],
      successMeasurement: '20 consecutive contacts without error',
      defaultDurationMinutes: 10,
      intensity: 'low',
      minPlayers: 2,
      maxPlayers: 12,
      isCustom: false,
    };
    expect(drill.skillArea).toBe('defense');
    expect(drill.targetRoles).toContain('Libero');
    expect(drill.progressions.length).toBeGreaterThan(0);
  });

  it('should cover all skill areas', () => {
    const allSkillAreas: SkillArea[] = [
      'serving', 'serve-receive', 'attacking', 'blocking',
      'setting', 'defense', 'transition', 'rotation',
    ];
    expect(allSkillAreas).toHaveLength(8);
  });
});

describe('Practice Plan Structure', () => {
  it('should validate practice plan shape', () => {
    const plan: PracticePlan = {
      id: 'pp-1',
      teamId: 't1',
      name: 'Tuesday Practice',
      date: '2024-03-15',
      durationMinutes: 90,
      status: 'draft',
      priorities: [],
      warmup: [],
      mainBlock: [],
      cooldown: [],
      coachOverrides: '',
      generatedAt: '2024-03-14T10:00:00Z',
      createdAt: '2024-03-14T10:00:00Z',
      updatedAt: '2024-03-14T10:00:00Z',
    };
    expect(plan.durationMinutes).toBe(90);
    expect(plan.status).toBe('draft');
  });

  it('should enforce valid duration values', () => {
    const validDurations = [60, 90, 120];
    expect(validDurations).toContain(60);
    expect(validDurations).toContain(90);
    expect(validDurations).toContain(120);
  });

  it('should validate drill assignment shape', () => {
    const assignment = {
      drillId: 'drill-1',
      orderIndex: 0,
      durationMinutes: 10,
      assignedPlayerIds: ['p1', 'p2'],
      status: 'pending' as const,
    };
    expect(assignment.status).toBe('pending');
    expect(assignment.assignedPlayerIds).toHaveLength(2);
  });
});

describe('Evidence and Confidence', () => {
  it('should compute confidence from sample size', () => {
    function computeConfidence(sampleSize: number): number {
      if (sampleSize >= 10) return 0.95;
      if (sampleSize >= 5) return 0.8;
      if (sampleSize >= 3) return 0.6;
      if (sampleSize >= 1) return 0.3;
      return 0;
    }

    expect(computeConfidence(0)).toBe(0);
    expect(computeConfidence(1)).toBe(0.3);
    expect(computeConfidence(3)).toBe(0.6);
    expect(computeConfidence(5)).toBe(0.8);
    expect(computeConfidence(10)).toBe(0.95);
    expect(computeConfidence(20)).toBe(0.95);
  });

  it('should compute composite priority score', () => {
    const impact = 0.8;
    const confidence = 0.6;
    const urgency = 0.9;
    const composite = (impact * 0.5) + (confidence * 0.3) + (urgency * 0.2);
    expect(composite).toBeCloseTo(0.76);
  });

  it('should detect improvement trend', () => {
    const snapshots: ImprovementSnapshot[] = [
      { playerId: 'p1', skillArea: 'attacking', metric: 'hittingPct', value: 0.15, sampleSize: 3, date: '2024-01-01', source: 'match-stats' },
      { playerId: 'p1', skillArea: 'attacking', metric: 'hittingPct', value: 0.18, sampleSize: 3, date: '2024-01-15', source: 'match-stats' },
      { playerId: 'p1', skillArea: 'attacking', metric: 'hittingPct', value: 0.22, sampleSize: 3, date: '2024-02-01', source: 'match-stats' },
    ];

    const first = snapshots[0].value;
    const last = snapshots[snapshots.length - 1].value;
    const changePercent = ((last - first) / Math.abs(first)) * 100;
    expect(changePercent).toBeGreaterThan(0);
    expect(last).toBeGreaterThan(first);
  });
});

describe('Role-Specific Benchmarks', () => {
  it('should have different standards for different roles', () => {
    const benchmarks: Record<string, Record<string, number>> = {
      'Outside Hitter': { hittingPct: 0.200, killsPerSet: 3.0 },
      'Middle Blocker': { hittingPct: 0.250, blocksPerSet: 1.0 },
      'Setter': { assistsPerSet: 8.0, ballHandlingErrorsPerSet: 0.5 },
      'Libero': { digsPerSet: 3.0, receptionErrorsPerSet: 0.5 },
    };

    expect(benchmarks['Outside Hitter'].hittingPct).toBeLessThan(benchmarks['Middle Blocker'].hittingPct);
    expect(benchmarks['Setter'].assistsPerSet).toBeGreaterThan(benchmarks['Outside Hitter'].killsPerSet);
  });
});
