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

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-slate-600/60', text: 'text-slate-300', label: 'Draft' },
  active: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'In Progress' },
  completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Completed' },
};

const tabConfig: Record<Tab, { icon: string; label: string }> = {
  plans: { icon: '\u{1F4CB}', label: 'Plans' },
  players: { icon: '\u{1F3D0}', label: 'Players' },
  drills: { icon: '\u{1F3AF}', label: 'Drills' },
};

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

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [plans],
  );

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

  if (!teamId) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 text-sm flex items-center gap-1 min-h-[44px]">
          <span className="text-lg">{'‹'}</span> Back to Dashboard
        </Link>
        <div className="mt-12 text-center">
          <div className="text-5xl mb-4 opacity-40">{'\u{1F3D0}'}</div>
          <p className="text-slate-400 text-lg">Select a team from the dashboard to get started.</p>
        </div>
      </main>
    );
  }

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

  const drillCountLabel = drillFilter === 'all'
    ? `${filteredDrills.length} drills`
    : `${filteredDrills.length} ${skillAreaLabels[drillFilter as SkillArea] || ''} drills`;

  return (
    <main className="flex flex-col p-4 md:p-6 max-w-4xl mx-auto w-full min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-blue-400 hover:text-blue-300 text-sm touch-manipulation min-h-[44px] flex items-center gap-1"
          >
            <span className="text-lg">{'‹'}</span> Back
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Practice</h1>
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
            className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all touch-manipulation min-h-[44px] flex items-center justify-center gap-2 ${
              activeTab === tab
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            <span>{tabConfig[tab].icon}</span>
            <span>{tabConfig[tab].label}</span>
          </button>
        ))}
      </div>

      {/* Tab: Plans */}
      {activeTab === 'plans' && (
        <div>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl text-lg font-bold text-white mb-5 touch-manipulation min-h-[56px] flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-transform"
          >
            <span className="text-xl">+</span>
            <span>Generate Practice Plan</span>
          </button>

          {sortedPlans.length === 0 ? (
            <div className="bg-slate-800/30 border border-dashed border-slate-700 rounded-xl p-10 text-center">
              <div className="text-5xl mb-3 opacity-30">{'\u{1F4CB}'}</div>
              <p className="text-slate-400 text-lg mb-1">No practice plans yet</p>
              <p className="text-slate-500 text-sm">Generate your first plan to get data-driven practice sessions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedPlans.map((plan) => {
                const completion = planCompletion(plan);
                const cfg = statusConfig[plan.status] || statusConfig.draft;
                const drillCount = plan.warmup.length + plan.mainBlock.length + plan.cooldown.length;
                return (
                  <button
                    key={plan.id}
                    onClick={() => setActivePlanId(plan.id)}
                    className="w-full text-left bg-slate-800 hover:bg-slate-750 rounded-xl p-4 transition-all touch-manipulation min-h-[56px] border border-slate-700/50 hover:border-slate-600/50 active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-white">{plan.name}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-400 mb-3">
                      <span>{new Date(plan.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      <span className="text-slate-600">{'·'}</span>
                      <span>{plan.durationMinutes} min</span>
                      <span className="text-slate-600">{'·'}</span>
                      <span>{drillCount} drills</span>
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            completion === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${completion}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 w-10 text-right font-medium">{completion}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Players */}
      {activeTab === 'players' && (
        <div>
          {players.length > 0 && (
            <p className="text-sm text-slate-500 mb-3">{players.length} players on roster</p>
          )}
          <div className="space-y-3">
            {players.length === 0 ? (
              <div className="bg-slate-800/30 border border-dashed border-slate-700 rounded-xl p-10 text-center">
                <div className="text-5xl mb-3 opacity-30">{'\u{1F3D0}'}</div>
                <p className="text-slate-400 text-lg mb-1">No players on this team</p>
                <p className="text-slate-500 text-sm">Add players from the team roster to track development</p>
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
        </div>
      )}

      {/* Tab: Drills */}
      {activeTab === 'drills' && (
        <div>
          {/* Search */}
          <div className="relative mb-3">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">
              {'\u{1F50D}'}
            </span>
            <input
              type="text"
              value={drillSearch}
              onChange={(e) => setDrillSearch(e.target.value)}
              placeholder="Search drills..."
              className="w-full bg-slate-800 border border-slate-700/50 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-slate-500 min-h-[44px] focus:border-blue-500/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Skill area filter pills */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-3 -mx-4 px-4 scrollbar-hide">
            <button
              onClick={() => setDrillFilter('all')}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium touch-manipulation min-h-[36px] transition-all ${
                drillFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-800 text-slate-400 border border-slate-700/50 hover:bg-slate-700'
              }`}
            >
              All
            </button>
            {allSkillAreas.map((area) => (
              <button
                key={area}
                onClick={() => setDrillFilter(area)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium touch-manipulation min-h-[36px] transition-all ${
                  drillFilter === area
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-slate-800 text-slate-400 border border-slate-700/50 hover:bg-slate-700'
                }`}
              >
                {skillAreaLabels[area]}
              </button>
            ))}
          </div>

          {/* Count label */}
          <p className="text-sm text-slate-500 mb-3">{drillCountLabel}</p>

          {/* Drill list */}
          {filteredDrills.length === 0 ? (
            <div className="bg-slate-800/30 border border-dashed border-slate-700 rounded-xl p-10 text-center">
              <div className="text-5xl mb-3 opacity-30">{'\u{1F3AF}'}</div>
              <p className="text-slate-400 text-lg mb-1">No drills found</p>
              <p className="text-slate-500 text-sm">Try a different search or filter</p>
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowGenerateModal(false)}>
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700/50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">{'\u{1F4CB}'}</div>
              <h2 className="text-xl font-bold text-white">New Practice Plan</h2>
              <p className="text-sm text-slate-400 mt-1">AI-generated based on player development needs</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Duration</label>
                <div className="flex gap-2">
                  {([60, 90, 120] as PracticeDuration[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setGenDuration(d)}
                      className={`flex-1 py-3 rounded-xl font-medium touch-manipulation min-h-[44px] transition-all ${
                        genDuration === d
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 ring-2 ring-blue-400/30'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <div className="text-lg font-bold">{d}</div>
                      <div className="text-xs opacity-70">minutes</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                <input
                  type="date"
                  value={genDate}
                  onChange={(e) => setGenDate(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600/50 rounded-xl px-4 py-3 text-white min-h-[44px] focus:border-blue-500/50 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-3.5 rounded-xl font-medium touch-manipulation min-h-[44px] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGeneratePlan}
                disabled={isGenerating}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-40 disabled:hover:from-blue-600 disabled:hover:to-blue-500 py-3.5 rounded-xl font-bold touch-manipulation min-h-[44px] transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    Generating...
                  </span>
                ) : 'Generate'}
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
    <Suspense fallback={
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin inline-block w-8 h-8 border-3 border-slate-600 border-t-blue-500 rounded-full mb-3" />
          <p className="text-slate-400">Loading practice data...</p>
        </div>
      </div>
    }>
      <PracticeContent />
    </Suspense>
  );
}
