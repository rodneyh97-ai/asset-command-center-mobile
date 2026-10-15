import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  PracticePlan,
  PracticeDuration,
  PracticeResult,
  PlayerDevelopmentPlan,
  TeamPracticePriority,
  CoachObservation,
  DrillStatus,
  Player,
  Drill,
  ImprovementSnapshot,
  SkillArea,
} from '@/domain/types';
import {
  devPlanRepo,
  practicePlanRepo,
  practiceResultRepo,
  coachObservationRepo,
  customDrillRepo,
  improvementSnapshotRepo,
} from '@/db/database';
import { generatePracticePlan } from '@/domain/practice-plan-generator';
import { generateTeamPriorities, reassessAfterNewData } from '@/domain/recommendation-engine';
import { DRILL_LIBRARY } from '@/domain/drill-library';

interface PracticeStore {
  // State
  currentPlan: PracticePlan | null;
  plans: PracticePlan[];
  devPlans: PlayerDevelopmentPlan[];
  priorities: TeamPracticePriority[];
  observations: CoachObservation[];
  improvementSnapshots: (ImprovementSnapshot & { id: string; teamId: string })[];
  isLoaded: boolean;

  // Actions
  loadTeamData(teamId: string): Promise<void>;
  generatePlan(teamId: string, duration: PracticeDuration, date: string): Promise<PracticePlan>;
  savePlan(plan: PracticePlan): Promise<void>;
  updateDrillStatus(
    planId: string,
    drillId: string,
    orderIndex: number,
    status: DrillStatus,
    feedback?: string,
  ): void;
  addObservation(teamId: string, playerId: string, skillArea: SkillArea, text: string): Promise<void>;
  completePractice(planId: string, notes: string): Promise<void>;
  regenerateDevPlans(
    teamId: string,
    players: Player[],
    matchData: { matchIds: string[] },
  ): Promise<void>;
  deletePlan(planId: string): Promise<void>;
  reset(): void;
}

export const usePracticeStore = create<PracticeStore>((set, get) => ({
  // Initial state
  currentPlan: null,
  plans: [],
  devPlans: [],
  priorities: [],
  observations: [],
  improvementSnapshots: [],
  isLoaded: false,

  async loadTeamData(teamId: string) {
    const [devPlans, plans, observations, improvementSnapshots] = await Promise.all([
      devPlanRepo.getByTeam(teamId),
      practicePlanRepo.getByTeam(teamId),
      coachObservationRepo.getByTeam(teamId),
      improvementSnapshotRepo.getByTeam(teamId),
    ]);

    // Find the most recent active or draft plan
    const sortedPlans = [...plans].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    const currentPlan = sortedPlans.find((p) => p.status === 'active' || p.status === 'draft') ?? null;

    set({
      devPlans,
      plans: sortedPlans,
      observations,
      improvementSnapshots,
      currentPlan,
      isLoaded: true,
    });
  },

  async generatePlan(teamId: string, duration: PracticeDuration, date: string) {
    const { plans, devPlans, observations } = get();

    // Fetch players and custom drills from IndexedDB
    const { playerRepo } = await import('@/db/database');
    const players = await playerRepo.getByTeam(teamId);
    const customDrills = await customDrillRepo.getAll();

    // Generate team priorities from development plans and observations
    const priorities = generateTeamPriorities(devPlans, observations, players);

    // Generate the practice plan
    const plan = generatePracticePlan(
      teamId,
      duration,
      priorities,
      players,
      customDrills,
      plans,
    );

    // Apply the requested date
    plan.date = date;
    plan.name = `Practice Plan - ${new Date(date).toLocaleDateString()}`;

    // Persist
    await practicePlanRepo.put(plan);

    set({
      currentPlan: plan,
      plans: [plan, ...plans],
      priorities,
    });

    return plan;
  },

  async savePlan(plan: PracticePlan) {
    const updated = { ...plan, updatedAt: new Date().toISOString() };
    await practicePlanRepo.put(updated);

    set({
      currentPlan: get().currentPlan?.id === updated.id ? updated : get().currentPlan,
      plans: get().plans.map((p) => (p.id === updated.id ? updated : p)),
    });
  },

  updateDrillStatus(
    planId: string,
    drillId: string,
    orderIndex: number,
    status: DrillStatus,
    feedback?: string,
  ) {
    const { plans, currentPlan } = get();
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    // Find which block the drill is in
    const blocks = ['warmup', 'mainBlock', 'cooldown'] as const;
    let targetBlock: typeof blocks[number] | null = null;
    let targetIndex = -1;

    for (const block of blocks) {
      const idx = plan[block].findIndex(
        (d) => d.drillId === drillId && d.orderIndex === orderIndex,
      );
      if (idx !== -1) {
        targetBlock = block;
        targetIndex = idx;
        break;
      }
    }

    if (!targetBlock || targetIndex === -1) return;

    const blockDrills = [...plan[targetBlock]];
    blockDrills[targetIndex] = {
      ...blockDrills[targetIndex],
      ...(status != null ? { status } : {}),
      coachFeedback: feedback ?? blockDrills[targetIndex].coachFeedback,
    };

    const updated: PracticePlan = {
      ...plan,
      [targetBlock]: blockDrills,
      updatedAt: new Date().toISOString(),
    };

    // Persist asynchronously -- fire-and-forget for responsiveness
    practicePlanRepo.put(updated);

    set({
      currentPlan: currentPlan?.id === updated.id ? updated : currentPlan,
      plans: plans.map((p) => (p.id === updated.id ? updated : p)),
    });
  },

  async addObservation(teamId: string, playerId: string, skillArea: SkillArea, text: string) {
    const obs: CoachObservation = {
      id: uuidv4(),
      teamId,
      playerId,
      skillArea,
      observation: text,
      createdAt: new Date().toISOString(),
    };

    await coachObservationRepo.put(obs);

    set({ observations: [...get().observations, obs] });
  },

  async completePractice(planId: string, notes: string) {
    const { plans, currentPlan } = get();
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    const now = new Date().toISOString();

    // Mark the plan as completed
    const completedPlan: PracticePlan = {
      ...plan,
      status: 'completed',
      completedAt: now,
      updatedAt: now,
    };
    await practicePlanRepo.put(completedPlan);

    // Save a PracticeResult record
    const allDrills = [...plan.warmup, ...plan.mainBlock, ...plan.cooldown];
    const result: PracticeResult = {
      id: uuidv4(),
      practicePlanId: planId,
      teamId: plan.teamId,
      date: plan.date,
      drillResults: allDrills.map((d) => ({
        drillId: d.drillId,
        status: d.status,
        coachFeedback: d.coachFeedback,
        actualReps: d.actualReps,
      })),
      overallNotes: notes,
      completedAt: now,
    };
    await practiceResultRepo.put(result);

    // Take improvement snapshots for completed drills
    const drillMap = new Map<string, Drill>();
    for (const d of [...DRILL_LIBRARY, ...(await customDrillRepo.getAll())]) {
      drillMap.set(d.id, d);
    }

    const snapshots: (ImprovementSnapshot & { id: string; teamId: string })[] = [];
    for (const da of allDrills) {
      if (da.status !== 'completed') continue;
      const drill = drillMap.get(da.drillId);
      if (!drill) continue;

      for (const playerId of da.assignedPlayerIds) {
        snapshots.push({
          id: uuidv4(),
          teamId: plan.teamId,
          playerId,
          skillArea: drill.skillArea,
          metric: da.targetMetric ?? drill.successMeasurement ?? drill.skillArea,
          value: da.targetValue ?? 0,
          sampleSize: da.actualReps ?? da.reps ?? 1,
          date: plan.date,
          source: 'coach-observation',
        });
      }
    }

    // Persist snapshots
    for (const snap of snapshots) {
      await improvementSnapshotRepo.put(snap);
    }

    set({
      currentPlan: currentPlan?.id === completedPlan.id ? completedPlan : currentPlan,
      plans: plans.map((p) => (p.id === completedPlan.id ? completedPlan : p)),
    });
  },

  async regenerateDevPlans(
    teamId: string,
    players: Player[],
    matchData: { matchIds: string[] },
  ) {
    const { observations, devPlans: existingDevPlans } = get();

    const updatedDevPlans = await reassessAfterNewData(
      teamId,
      players,
      existingDevPlans,
      observations,
      matchData,
    );

    // Persist all updated dev plans
    for (const dp of updatedDevPlans) {
      await devPlanRepo.put(dp);
    }

    set({ devPlans: updatedDevPlans });
  },

  async deletePlan(planId: string) {
    await practicePlanRepo.delete(planId);
    const { plans, currentPlan } = get();

    set({
      plans: plans.filter((p) => p.id !== planId),
      currentPlan: currentPlan?.id === planId ? null : currentPlan,
    });
  },

  reset() {
    set({
      currentPlan: null,
      plans: [],
      devPlans: [],
      priorities: [],
      observations: [],
      isLoaded: false,
    });
  },
}));
