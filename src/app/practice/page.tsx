'use client';

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/stores/app-store';
import { usePracticeStore } from '@/stores/practice-store';
import { DRILL_LIBRARY, getDrillsBySkillArea } from '@/domain/drill-library';
import type {
  SkillArea,
  PracticePlan,
  PracticeDuration,
  DrillStatus,
  Drill,
  CoachObservation,
} from '@/domain/types';
import PracticePlanView from '@/components/practice/PracticePlanView';
import PlayerDevCard from '@/components/practice/PlayerDevCard';
import DrillCard from '@/components/practice/DrillCard';

type Tab = 'plans' | 'players' | 'drills';

const skillAreaLabels: Record<SkillArea, string> = {
  serving: 'Serving',
  'serve-receive': 'Serve Receive',
  attacking: 'Attacking',
  blocking: 'Blocking',
  setting: 'Setting',
  defense: 'Defense',
  transition: 'Transition',
  rotation: 'Rotation',
};

const allSkillAreas: SkillArea[] = [
  'serving',
  'serve-receive',
  'attacking',
  'blocking',
  'setting',
  'defense',
  'transition',
  'rotation',
];

const statusBadge: Record<string, string> = {
  draft: 'bg-slate-600 text-slate-300',
  active: 'bg-blue-900/50 text-blue-400',
  completed: 'bg-green-900/50 text-green-400',
};

/**
 * Compute a simple trend from a player's dev plan data.
 * If more weaknesses than strengths, declining. If equal, stable. Otherwise improving.
 */
function computeTrend(
  devPlan: { strengths: unknown[]; weaknesses: unknown[] } | undefined,
): 'improving' | 'declining' | 'stable' {
  if (!devPlan) return 'stable';
  if (devPlan.strengths.length > devPlan.weaknesses.length) return 'improving';
  if (devPlan.weaknesses.length > devPlan.strengths.length) return 'declining';
  return 'stable';
}

function PracticeContent() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get('teamId') || '';

  const {
    players,
    teams,
    loadPlayersForTeam,
    setActiveTeam,
  } = useAppStore();

  const {
    plans,
    devPlans,
    observations,
    loadTeamData,
    generatePlan,
    updateDrillStatus,
    addObservation,
    completePractice,
  } = usePracticeStore();

  const [activeTab, setActiveTab] = useState<Tab>('plans');
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genDuration, setGenDuration] = useState<PracticeDuration>(90);
  const [genDate, setGenDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isGenerating, setIsGenerating] = useState(false);

  // Drill library state
  const [drillFilter, setDrillFilter] = useState<SkillArea | 'all'>('all');
  const [drillSearch, setDrillSearch] = useState('');

  const team = teams.find((t) => t.id === teamId);

  useEffect(() => {
    if (teamId) {
      setActiveTeam(teamId);
      loadPlayersForTeam(teamId);
      loadTeamData(teamId);
    }
  }, [teamId, setActiveTeam, loadPlayersForTeam, loadTeamData]);

  // Sort plans by date descending
  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [plans],
  );

  // Filter drills
  const filteredDrills = useMemo(() => {
    let result: Drill[] = drillFilter === 'all' ? DRILL_LIBRARY : getDrillsBySkillArea(drillFilter);
    if (drillSearch.trim()) {
      const q = drillSearch.toLowerCase();
      result = result.filter((d) => d.name.toLowerCase().includes(q));
    }
    return result;
  }, [drillFilter, drillSearch]);

  const handleGeneratePlan = async () => {
    if (!teamId || players.length === 0) return;
    setIsGenerating(true);
    try {
      const plan = await generatePlan(teamId, genDuration, genDate);
      if (plan) {
        setActivePlanId(plan.id);
      }
      setShowGenerateModal(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDrillStatusChange = useCallback(
    (drillId: string, orderIndex: number, status: DrillStatus) => {
      if (activePlanId) {
        updateDrillStatus(activePlanId, drillId, orderIndex, status);
      }
    },
    [activePlanId, updateDrillStatus],
  );

  const handleDrillFeedback = useCallback(
    (drillId: string, orderIndex: number, feedback: string) => {
      if (activePlanId) {
        // Find drill's current status to preserve it while updating feedback
        const plan = plans.find((p) => p.id === activePlanId);
        if (!plan) return;
        const allDrills = [...plan.warmup, ...plan.mainBlock, ...plan.cooldown];
        const drill = allDrills.find((d) => d.drillId === drillId && d.orderIndex === orderIndex);
        if (!drill) return;
        updateDrillStatus(activePlanId, drillId, orderIndex, drill.status, feedback);
      }
    },
    [activePlanId, updateDrillStatus, plans],
  );

  const handleCompletePractice = useCallback(
    (overallNotes: string) => {
      if (activePlanId) {
        completePractice(activePlanId, overallNotes);
        setActivePlanId(null);
      }
    },
    [activePlanId, completePractice],
  );

  const handleAddObservation = useCallback(
    (playerId: string, skillArea: SkillArea, text: string) => {
      if (teamId) {
        addObservation(teamId, playerId, skillArea, text);
      }
    },
    [teamId, addObservation],
  );

  // If no teamId
  if (!teamId) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 text-sm">
          {'←'} Back
        </Link>
        <p className="text-slate-400 mt-4">Select a team first from the dashboard.</p>
      </main>
    );
  }

  // If viewing a specific plan
  const activePlan = activePlanId ? plans.find((p) => p.id === activePlanId) : null;
  if (activePlan) {
    return (
      <div className="h-screen flex flex-col">
        <PracticePlanView
          plan={activePlan}
          drills={DRILL_LIBRARY}
          players={players}
          onUpdateDrillStatus={handleDrillStatusChange}
          onUpdateDrillFeedback={handleDrillFeedback}
          onCompletePractice={handleCompletePractice}
          onBack={() => setActivePlanId(null)}
        />
      </div>
    );
  }

  const planCompletion = (plan: PracticePlan) => {
    const all = [...plan.warmup, ...plan.mainBlock, ...plan.cooldown];
    if (all.length === 0) return 0;
    return Math.round((all.filter((d) => d.status === 'completed').length / all.length) * 100);
  };

  return (
    <main className="flex flex-col p-4 md:p-6 max-w-4xl mx-auto w-full min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-blue-400 hover:text-blue-300 text-sm touch-manipulation min-h-[44px] flex items-center"
          >
            {'←'} Back
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Practice Planner</h1>
            {team && <p className="text-sm text-slate-400">{team.name}</p>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1 mb-6">
        {(['plans', 'players', 'drills'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors touch-manipulation min-h-[44px] ${
              activeTab === tab
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {tab === 'plans' ? 'Plans' : tab === 'players' ? 'Players' : 'Drills'}
          </button>
        ))}
      </div>

      {/* Tab: Plans */}
      {activeTab === 'plans' && (
        <div>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-lg font-bold text-white mb-4 touch-manipulation min-h-[56px]"
          >
            Generate Plan
          </button>

          {sortedPlans.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
              <p className="text-slate-400">
                No practice plans yet. Generate one to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedPlans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setActivePlanId(plan.id)}
                  className="w-full text-left bg-slate-800 hover:bg-slate-700 rounded-xl p-4 transition-colors touch-manipulation min-h-[56px]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">{plan.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${statusBadge[plan.status] || 'bg-slate-700 text-slate-300'}`}
                    >
                      {plan.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <span>{new Date(plan.date).toLocaleDateString()}</span>
                    <span>{plan.durationMinutes} min</span>
                    <span>{planCompletion(plan)}% complete</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Players */}
      {activeTab === 'players' && (
        <div className="space-y-3">
          {players.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
              <p className="text-slate-400">No players on this team yet.</p>
            </div>
          ) : (
            players.map((player) => {
              const devPlan = devPlans.find((d) => d.playerId === player.id);
              const playerObs = observations.filter(
                (o: CoachObservation) => o.playerId === player.id,
              );
              const trend = computeTrend(devPlan);

              return (
                <PlayerDevCard
                  key={player.id}
                  player={player}
                  devPlan={devPlan}
                  observations={playerObs}
                  trend={trend}
                  onAddObservation={handleAddObservation}
                />
              );
            })
          )}
        </div>
      )}

      {/* Tab: Drills */}
      {activeTab === 'drills' && (
        <div>
          {/* Search */}
          <input
            type="text"
            value={drillSearch}
            onChange={(e) => setDrillSearch(e.target.value)}
            placeholder="Search drills..."
            className="w-full bg-slate-800 rounded-lg px-4 py-3 text-white placeholder:text-slate-400 mb-3 min-h-[44px]"
          />

          {/* Skill area filter pills */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-3 -mx-4 px-4 scrollbar-hide">
            <button
              onClick={() => setDrillFilter('all')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm touch-manipulation min-h-[36px] ${
                drillFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              All
            </button>
            {allSkillAreas.map((area) => (
              <button
                key={area}
                onClick={() => setDrillFilter(area)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm touch-manipulation min-h-[36px] ${
                  drillFilter === area
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {skillAreaLabels[area]}
              </button>
            ))}
          </div>

          {/* Drill list */}
          {filteredDrills.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
              <p className="text-slate-400">No drills found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDrills.map((drill) => (
                <DrillCard key={drill.id} drill={drill} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generate Plan Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-white">Generate Practice Plan</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Duration</label>
                <div className="flex gap-2">
                  {([60, 90, 120] as PracticeDuration[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setGenDuration(d)}
                      className={`flex-1 py-3 rounded-lg font-medium touch-manipulation min-h-[44px] ${
                        genDuration === d
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Date</label>
                <input
                  type="date"
                  value={genDate}
                  onChange={(e) => setGenDate(e.target.value)}
                  className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white min-h-[44px]"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-medium touch-manipulation min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleGeneratePlan}
                disabled={isGenerating}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-3 rounded-lg font-medium touch-manipulation min-h-[44px]"
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading...</div>}>
      <PracticeContent />
    </Suspense>
  );
}
