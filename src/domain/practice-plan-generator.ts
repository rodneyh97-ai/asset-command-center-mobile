import { v4 as uuidv4 } from 'uuid';
import type {
  PracticePlan,
  PracticeDuration,
  PracticeDrillAssignment,
  TeamPracticePriority,
  Drill,
  DrillIntensity,
  Player,
  PlayerRole,
  SkillArea,
} from '@/domain/types';
import { DRILL_LIBRARY, getDrillsBySkillArea } from '@/domain/drill-library';

// ── Time budget helpers ──

interface TimeBudget {
  warmup: number;
  mainBlock: number;
  cooldown: number;
}

function computeTimeBudget(duration: PracticeDuration): TimeBudget {
  // warmup ~12%, mainBlock ~78%, cooldown ~10%
  const warmup = Math.round(duration * 0.12);
  const cooldown = Math.round(duration * 0.10);
  const mainBlock = duration - warmup - cooldown;
  return { warmup, mainBlock, cooldown };
}

// ── Drill selection ──

const INTENSITY_ORDER: Record<DrillIntensity, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function recentDrillIds(existingPlans: PracticePlan[]): Set<string> {
  const recent = existingPlans
    .slice()
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    .slice(0, 2);

  const ids = new Set<string>();
  for (const plan of recent) {
    for (const d of [...plan.warmup, ...plan.mainBlock, ...plan.cooldown]) {
      ids.add(d.drillId);
    }
  }
  return ids;
}

function rolesPresent(players: Player[]): Set<PlayerRole> {
  const roles = new Set<PlayerRole>();
  for (const p of players) {
    if (p.availabilityStatus !== 'Out for set' && p.availabilityStatus !== 'Out for match') {
      roles.add(p.primaryRole);
      for (const r of p.secondaryRoles) roles.add(r);
    }
  }
  return roles;
}

function drillMatchesRoles(drill: Drill, available: Set<PlayerRole>): boolean {
  if (drill.targetRoles.length === 0) return true;
  return drill.targetRoles.some((r) => available.has(r));
}

function drillFitsPlayerCount(drill: Drill, playerCount: number): boolean {
  return playerCount >= drill.minPlayers && playerCount <= drill.maxPlayers;
}

/**
 * Score a drill for how well it fits a set of priorities.
 * Higher is better.
 */
function scoreDrill(drill: Drill, priorities: TeamPracticePriority[]): number {
  let score = 0;
  for (const p of priorities) {
    if (drill.skillArea === p.skillArea) {
      score += p.compositeScore;
    }
  }
  return score;
}

/**
 * Build a pool of eligible drills from both the built-in library and any
 * custom drills the coach has created, filtering out drills that were used
 * in the most recent 2 practices or that don't match available roles/player
 * count.
 */
function buildCandidatePool(
  priorities: TeamPracticePriority[],
  availablePlayers: Player[],
  customDrills: Drill[],
  existingPlans: PracticePlan[],
): Drill[] {
  const recent = recentDrillIds(existingPlans);
  const roles = rolesPresent(availablePlayers);
  const playerCount = availablePlayers.filter(
    (p) => p.availabilityStatus !== 'Out for set' && p.availabilityStatus !== 'Out for match',
  ).length;

  const skillAreas = new Set(priorities.map((p) => p.skillArea));

  // Gather drills from library + custom that match any priority skill area
  const allDrills: Drill[] = [];
  for (const area of skillAreas) {
    allDrills.push(...getDrillsBySkillArea(area));
  }
  for (const d of customDrills) {
    if (skillAreas.has(d.skillArea)) {
      allDrills.push(d);
    }
  }
  // Also include low-intensity drills from the full library for warmup/cooldown
  for (const d of DRILL_LIBRARY) {
    if (d.intensity === 'low' && !allDrills.some((x) => x.id === d.id)) {
      allDrills.push(d);
    }
  }

  // De-duplicate by id
  const seen = new Set<string>();
  const unique: Drill[] = [];
  for (const d of allDrills) {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      unique.push(d);
    }
  }

  return unique.filter(
    (d) =>
      !recent.has(d.id) &&
      drillMatchesRoles(d, roles) &&
      drillFitsPlayerCount(d, playerCount),
  );
}

function selectDrillsForBlock(
  candidates: Drill[],
  targetIntensity: DrillIntensity[],
  budgetMinutes: number,
  priorities: TeamPracticePriority[],
  usedIds: Set<string>,
): PracticeDrillAssignment[] {
  // Filter to matching intensity levels, then score by priority match
  const eligible = candidates
    .filter((d) => targetIntensity.includes(d.intensity) && !usedIds.has(d.id))
    .map((d) => ({ drill: d, score: scoreDrill(d, priorities) }))
    .sort((a, b) => b.score - a.score || a.drill.defaultDurationMinutes - b.drill.defaultDurationMinutes);

  const assignments: PracticeDrillAssignment[] = [];
  let remaining = budgetMinutes;
  let orderIndex = 0;

  for (const { drill } of eligible) {
    if (remaining <= 0) break;
    const duration = Math.min(drill.defaultDurationMinutes, remaining);
    if (duration < 3) break; // don't add extremely short segments

    assignments.push({
      drillId: drill.id,
      orderIndex,
      durationMinutes: duration,
      reps: drill.defaultReps,
      assignedPlayerIds: [],
      targetMetric: drill.successMeasurement || undefined,
      targetValue: undefined,
      status: 'pending',
    });

    usedIds.add(drill.id);
    remaining -= duration;
    orderIndex++;
  }

  return assignments;
}

function assignPlayersToBlock(
  assignments: PracticeDrillAssignment[],
  drillMap: Map<string, Drill>,
  players: Player[],
): PracticeDrillAssignment[] {
  const available = players.filter(
    (p) => p.availabilityStatus !== 'Out for set' && p.availabilityStatus !== 'Out for match',
  );

  return assignments.map((a) => {
    const drill = drillMap.get(a.drillId);
    if (!drill) return a;

    let assignees: Player[];
    if (drill.targetRoles.length > 0) {
      // Prefer players whose primary role matches, then secondary
      const primary = available.filter((p) => drill.targetRoles.includes(p.primaryRole));
      const secondary = available.filter(
        (p) => !drill.targetRoles.includes(p.primaryRole) && p.secondaryRoles.some((r) => drill.targetRoles.includes(r)),
      );
      assignees = [...primary, ...secondary];
    } else {
      assignees = available;
    }

    // Respect min/max player constraints
    assignees = assignees.slice(0, drill.maxPlayers);

    return {
      ...a,
      assignedPlayerIds: assignees.map((p) => p.id),
    };
  });
}

function setMeasurableTargets(
  assignments: PracticeDrillAssignment[],
  drillMap: Map<string, Drill>,
): PracticeDrillAssignment[] {
  return assignments.map((a) => {
    const drill = drillMap.get(a.drillId);
    if (!drill) return a;

    // Generate sensible default targets based on drill type
    if (drill.skillArea === 'serving' && drill.defaultReps) {
      return {
        ...a,
        targetMetric: `Serve ${drill.defaultReps} balls, target 80% in-zone`,
        targetValue: 80,
      };
    }
    if (drill.skillArea === 'serve-receive' && drill.defaultReps) {
      return {
        ...a,
        targetMetric: `Receive ${drill.defaultReps} serves, target 75% to setter zone`,
        targetValue: 75,
      };
    }
    if (drill.skillArea === 'attacking') {
      return {
        ...a,
        targetMetric: 'Target 40% kill rate during drill',
        targetValue: 40,
      };
    }
    if (drill.skillArea === 'blocking') {
      return {
        ...a,
        targetMetric: 'Target 3+ touches per rotation',
        targetValue: 3,
      };
    }
    if (drill.skillArea === 'setting') {
      return {
        ...a,
        targetMetric: 'Target 85% hittable sets',
        targetValue: 85,
      };
    }
    if (drill.skillArea === 'defense') {
      return {
        ...a,
        targetMetric: 'Target 70% dig success rate',
        targetValue: 70,
      };
    }
    return a;
  });
}

// ── Public API ──

export function generatePracticePlan(
  teamId: string,
  duration: PracticeDuration,
  priorities: TeamPracticePriority[],
  availablePlayers: Player[],
  customDrills: Drill[],
  existingPlans: PracticePlan[],
): PracticePlan {
  const budget = computeTimeBudget(duration);
  const candidates = buildCandidatePool(priorities, availablePlayers, customDrills, existingPlans);

  // Build a lookup map for all candidate drills
  const drillMap = new Map<string, Drill>();
  for (const d of [...DRILL_LIBRARY, ...customDrills]) {
    drillMap.set(d.id, d);
  }

  const usedIds = new Set<string>();

  // Warmup: low intensity
  let warmup = selectDrillsForBlock(candidates, ['low'], budget.warmup, priorities, usedIds);

  // Main block: ramp from medium to high
  let mainBlock = selectDrillsForBlock(candidates, ['medium', 'high'], budget.mainBlock, priorities, usedIds);

  // Cooldown: low intensity
  let cooldown = selectDrillsForBlock(candidates, ['low'], budget.cooldown, priorities, usedIds);

  // Sort main block for intensity progression: medium first, then high
  mainBlock.sort((a, b) => {
    const da = drillMap.get(a.drillId);
    const db = drillMap.get(b.drillId);
    const ia = da ? INTENSITY_ORDER[da.intensity] : 1;
    const ib = db ? INTENSITY_ORDER[db.intensity] : 1;
    return ia - ib;
  });
  mainBlock = mainBlock.map((d, i) => ({ ...d, orderIndex: i }));

  // Assign players and set measurable targets
  warmup = setMeasurableTargets(assignPlayersToBlock(warmup, drillMap, availablePlayers), drillMap);
  mainBlock = setMeasurableTargets(assignPlayersToBlock(mainBlock, drillMap, availablePlayers), drillMap);
  cooldown = setMeasurableTargets(assignPlayersToBlock(cooldown, drillMap, availablePlayers), drillMap);

  const now = new Date().toISOString();
  const sortedPriorities = [...priorities].sort((a, b) => b.compositeScore - a.compositeScore);

  return {
    id: uuidv4(),
    teamId,
    name: `Practice Plan - ${new Date().toLocaleDateString()}`,
    date: now.split('T')[0],
    durationMinutes: duration,
    status: 'draft',
    priorities: sortedPriorities,
    warmup,
    mainBlock,
    cooldown,
    coachOverrides: '',
    generatedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export function adjustPlanDuration(plan: PracticePlan, newDuration: PracticeDuration): PracticePlan {
  const oldDuration = plan.durationMinutes;
  const ratio = newDuration / oldDuration;
  const now = new Date().toISOString();

  function scaleDrills(drills: PracticeDrillAssignment[]): PracticeDrillAssignment[] {
    return drills.map((d) => ({
      ...d,
      durationMinutes: Math.max(3, Math.round(d.durationMinutes * ratio)),
    }));
  }

  let warmup = scaleDrills(plan.warmup);
  let mainBlock = scaleDrills(plan.mainBlock);
  let cooldown = scaleDrills(plan.cooldown);

  // If time was cut significantly (ratio < 0.75), drop lowest-priority drills from main block
  if (ratio < 0.75 && mainBlock.length > 1) {
    const budget = computeTimeBudget(newDuration);
    let totalMain = mainBlock.reduce((sum, d) => sum + d.durationMinutes, 0);

    // Remove from the end (lowest priority, since mainBlock is ordered by intensity/priority)
    while (totalMain > budget.mainBlock && mainBlock.length > 1) {
      const removed = mainBlock.pop()!;
      totalMain -= removed.durationMinutes;
    }
  }

  // If time was extended significantly (ratio > 1.25), we could add drills,
  // but that requires the candidate pool which we don't have here.
  // Instead we proportionally extend existing drills.

  // Re-index
  warmup = warmup.map((d, i) => ({ ...d, orderIndex: i }));
  mainBlock = mainBlock.map((d, i) => ({ ...d, orderIndex: i }));
  cooldown = cooldown.map((d, i) => ({ ...d, orderIndex: i }));

  return {
    ...plan,
    durationMinutes: newDuration,
    warmup,
    mainBlock,
    cooldown,
    updatedAt: now,
  };
}

export function swapDrill(
  plan: PracticePlan,
  block: 'warmup' | 'mainBlock' | 'cooldown',
  drillIndex: number,
  newDrillId: string,
  allDrills: Drill[],
): PracticePlan {
  const blockDrills = [...plan[block]];
  if (drillIndex < 0 || drillIndex >= blockDrills.length) {
    return plan;
  }

  const newDrill = allDrills.find((d) => d.id === newDrillId);
  if (!newDrill) return plan;

  const existing = blockDrills[drillIndex];

  blockDrills[drillIndex] = {
    ...existing,
    drillId: newDrillId,
    durationMinutes: existing.durationMinutes, // preserve time slot
    reps: newDrill.defaultReps,
    targetMetric: newDrill.successMeasurement || undefined,
    targetValue: undefined,
    status: 'pending',
    coachFeedback: undefined,
    actualReps: undefined,
  };

  return {
    ...plan,
    [block]: blockDrills,
    updatedAt: new Date().toISOString(),
  };
}

export function getTimeAllocation(plan: PracticePlan): {
  warmup: number;
  mainBlock: number;
  cooldown: number;
  total: number;
  remaining: number;
} {
  const warmup = plan.warmup.reduce((sum, d) => sum + d.durationMinutes, 0);
  const mainBlock = plan.mainBlock.reduce((sum, d) => sum + d.durationMinutes, 0);
  const cooldown = plan.cooldown.reduce((sum, d) => sum + d.durationMinutes, 0);
  const total = warmup + mainBlock + cooldown;

  return {
    warmup,
    mainBlock,
    cooldown,
    total,
    remaining: plan.durationMinutes - total,
  };
}
