'use client';

import { useEffect, useState, useMemo } from 'react';
import type {
  Player,
  PlayerMatchStats,
  PlayerDevelopmentPlan,
  MatchState,
  CoachObservation,
  ImprovementSnapshot,
  SkillArea,
} from '@/domain/types';
import { matchEventRepo, coachObservationRepo, improvementSnapshotRepo } from '@/db/database';
import { rebuildState } from '@/domain/event-sourcing';
import { analyzePlayerPerformance, getImprovementTrend } from '@/domain/recommendation-engine';

interface Props {
  player: Player;
  matchIds: string[];
  onBack: () => void;
}

type TabId = 'stats' | 'development' | 'observations';

export default function PlayerProfile({ player, matchIds, onBack }: Props) {
  const [tab, setTab] = useState<TabId>('stats');
  const [matchStates, setMatchStates] = useState<MatchState[]>([]);
  const [observations, setObservations] = useState<CoachObservation[]>([]);
  const [snapshots, setSnapshots] = useState<(ImprovementSnapshot & { id: string; teamId: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const states: MatchState[] = [];
      for (const mid of matchIds) {
        const events = await matchEventRepo.getByMatch(mid);
        if (events.length > 0) {
          const state = rebuildState(events);
          if (state) states.push(state);
        }
      }
      const obs = await coachObservationRepo.getByPlayer(player.id);
      const snaps = await improvementSnapshotRepo.getByPlayer(player.id);
      setMatchStates(states);
      setObservations(obs);
      setSnapshots(snaps);
      setLoading(false);
    }
    load();
  }, [matchIds, player.id]);

  const aggregatedStats = useMemo(() => {
    let kills = 0, attackErrors = 0, aces = 0, serviceErrors = 0;
    let digs = 0, blocks = 0, assists = 0, recErrors = 0, bhErrors = 0;
    let ptsFor = 0, ptsAgainst = 0, setsPlayed = 0;
    const matchesPlayed = new Set<string>();

    for (const ms of matchStates) {
      let playedInMatch = false;
      for (const setState of ms.sets) {
        const ps = setState.playerStats[player.id];
        if (!ps) continue;
        playedInMatch = true;
        setsPlayed++;
        kills += ps.kills;
        attackErrors += ps.attackErrors;
        aces += ps.aces;
        serviceErrors += ps.serviceErrors;
        digs += ps.digs;
        blocks += ps.blocks;
        assists += ps.assists;
        recErrors += ps.receptionErrors;
        bhErrors += ps.ballHandlingErrors;
        ptsFor += ps.pointsOnCourt;
        ptsAgainst += ps.pointsAgainstOnCourt;
      }
      if (playedInMatch) matchesPlayed.add(ms.matchId);
    }

    const sets = Math.max(setsPlayed, 1);
    const totalAttempts = kills + attackErrors;
    const hitPct = totalAttempts > 0 ? (kills - attackErrors) / totalAttempts : 0;
    const totalServes = aces + serviceErrors;
    const totalReceptions = recErrors + digs;

    return {
      matchesPlayed: matchesPlayed.size,
      setsPlayed,
      kills, attackErrors, aces, serviceErrors, digs, blocks, assists,
      recErrors, bhErrors, ptsFor, ptsAgainst,
      killsPerSet: kills / sets,
      digsPerSet: digs / sets,
      blocksPerSet: blocks / sets,
      assistsPerSet: assists / sets,
      hitPct,
      aceRate: totalServes > 0 ? aces / totalServes : 0,
      serviceErrorRate: totalServes > 0 ? serviceErrors / totalServes : 0,
      receptionErrorRate: totalReceptions > 0 ? recErrors / totalReceptions : 0,
      bhErrorRate: (assists + bhErrors) > 0 ? bhErrors / (assists + bhErrors) : 0,
      plusMinus: ptsFor - ptsAgainst,
    };
  }, [matchStates, player.id]);

  const devPlan = useMemo(() => {
    const matchStats = matchStates.flatMap((ms) => {
      const perSetStats: { matchId: string; matchDate: string; opponentName: string; stats: PlayerMatchStats }[] = [];
      for (const setState of ms.sets) {
        const ps = setState.playerStats[player.id];
        if (ps) {
          perSetStats.push({
            matchId: ms.matchId,
            matchDate: '',
            opponentName: '',
            stats: ps,
          });
        }
      }
      return perSetStats;
    });
    const playerObs = observations.filter((o) => o.playerId === player.id);
    return analyzePlayerPerformance(player, matchStats, playerObs, snapshots);
  }, [matchStates, player, observations, snapshots]);

  if (loading) {
    return <div className="p-6 text-slate-400">Loading player data...</div>;
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'stats', label: 'Stats' },
    { id: 'development', label: 'Development' },
    { id: 'observations', label: 'Notes' },
  ];

  return (
    <div className="flex flex-col p-6 max-w-4xl mx-auto w-full">
      <button onClick={onBack} className="text-blue-400 hover:text-blue-300 mb-4 text-sm text-left">
        {'<'} Back to Roster
      </button>

      {/* Header */}
      <div className="bg-slate-800 rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="bg-slate-700 rounded-xl w-16 h-16 flex items-center justify-center text-2xl font-bold">
            {player.jerseyNumber}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{player.firstName} {player.lastName}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-sm text-slate-300">{player.primaryRole}</span>
              {player.secondaryRoles.map((r) => (
                <span key={r} className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full">{r}</span>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
              <span>{aggregatedStats.matchesPlayed} matches</span>
              <span>{aggregatedStats.setsPlayed} sets</span>
              <span className={aggregatedStats.plusMinus >= 0 ? 'text-green-400' : 'text-red-400'}>
                {aggregatedStats.plusMinus >= 0 ? '+' : ''}{aggregatedStats.plusMinus} +/-
              </span>
            </div>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${
            player.availabilityStatus === 'Available'
              ? 'bg-green-900/50 text-green-400'
              : player.availabilityStatus === 'Limited'
              ? 'bg-yellow-900/50 text-yellow-400'
              : 'bg-red-900/50 text-red-400'
          }`}>
            {player.availabilityStatus}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-800/50 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stats' && <StatsTab stats={aggregatedStats} role={player.primaryRole} />}
      {tab === 'development' && <DevelopmentTab devPlan={devPlan} snapshots={snapshots} player={player} />}
      {tab === 'observations' && <ObservationsTab observations={observations} player={player} />}
    </div>
  );
}

function StatRow({ label, value, perSet, highlight }: { label: string; value: number | string; perSet?: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${highlight ? 'bg-slate-700/50' : ''}`}>
      <span className="text-sm text-slate-300">{label}</span>
      <div className="text-right">
        <span className="font-semibold text-white">{value}</span>
        {perSet && <span className="text-xs text-slate-400 ml-2">{perSet}</span>}
      </div>
    </div>
  );
}

function StatsTab({ stats, role }: { stats: ReturnType<typeof Object>; role: string }) {
  const s = stats as any;

  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Hit %" value={`${(s.hitPct * 100).toFixed(1)}%`} color={s.hitPct >= 0.2 ? 'green' : s.hitPct >= 0.1 ? 'yellow' : 'red'} />
        <MetricCard label="Kills/Set" value={s.killsPerSet.toFixed(1)} color={s.killsPerSet >= 3 ? 'green' : s.killsPerSet >= 2 ? 'yellow' : 'red'} />
        <MetricCard label="+/-" value={`${s.plusMinus >= 0 ? '+' : ''}${s.plusMinus}`} color={s.plusMinus >= 0 ? 'green' : 'red'} />
      </div>

      {/* Offense */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Offense</h3>
        <StatRow label="Kills" value={s.kills} perSet={`${s.killsPerSet.toFixed(1)}/set`} highlight />
        <StatRow label="Attack Errors" value={s.attackErrors} />
        <StatRow label="Hitting %" value={`${(s.hitPct * 100).toFixed(1)}%`} highlight />
        <StatRow label="Assists" value={s.assists} perSet={`${s.assistsPerSet.toFixed(1)}/set`} />
      </div>

      {/* Serving */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Serving</h3>
        <StatRow label="Aces" value={s.aces} highlight />
        <StatRow label="Service Errors" value={s.serviceErrors} />
        <StatRow label="Ace Rate" value={`${(s.aceRate * 100).toFixed(1)}%`} highlight />
        <StatRow label="Error Rate" value={`${(s.serviceErrorRate * 100).toFixed(1)}%`} />
      </div>

      {/* Defense */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Defense</h3>
        <StatRow label="Digs" value={s.digs} perSet={`${s.digsPerSet.toFixed(1)}/set`} highlight />
        <StatRow label="Blocks" value={s.blocks} perSet={`${s.blocksPerSet.toFixed(1)}/set`} />
        <StatRow label="Reception Errors" value={s.recErrors} />
        <StatRow label="Rec Error Rate" value={`${(s.receptionErrorRate * 100).toFixed(1)}%`} highlight />
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: 'green' | 'yellow' | 'red' }) {
  const colorMap = {
    green: 'bg-green-500/15 text-green-400 border-green-500/30',
    yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    red: 'bg-red-500/15 text-red-400 border-red-500/30',
  };

  return (
    <div className={`rounded-xl border p-3 text-center ${colorMap[color]}`}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}

function DevelopmentTab({
  devPlan,
  snapshots,
  player,
}: {
  devPlan: PlayerDevelopmentPlan;
  snapshots: (ImprovementSnapshot & { id: string; teamId: string })[];
  player: Player;
}) {
  if (devPlan.strengths.length === 0 && devPlan.weaknesses.length === 0) {
    return (
      <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center">
        <div className="text-3xl mb-2">📊</div>
        <h3 className="text-lg font-semibold text-slate-300 mb-1">No Data Yet</h3>
        <p className="text-sm text-slate-500">
          {devPlan.recommendations[0] || 'Record matches to generate a development plan.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Strengths */}
      {devPlan.strengths.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wide mb-3">Strengths</h3>
          <div className="space-y-2">
            {devPlan.strengths.map((s, i) => (
              <div key={i} className="flex items-center justify-between bg-green-500/10 rounded-lg p-3">
                <div>
                  <span className="text-sm font-medium text-white capitalize">{s.skillArea}</span>
                  <span className="text-xs text-slate-400 ml-2">{s.metric}</span>
                </div>
                <span className="text-sm font-semibold text-green-400">
                  {s.metric.includes('Rate') || s.metric.includes('Pct')
                    ? `${(s.value * 100).toFixed(1)}%`
                    : s.value.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weaknesses */}
      {devPlan.weaknesses.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wide mb-3">Areas to Improve</h3>
          <div className="space-y-2">
            {devPlan.weaknesses.map((w, i) => {
              const trendData = getImprovementTrend(
                snapshots.filter((s) => s.skillArea === w.skillArea),
                w.metric,
              ) as { trend: string; changePercent: number };

              return (
                <div key={i} className="bg-amber-500/10 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white capitalize">{w.skillArea}</span>
                    <div className="flex items-center gap-2">
                      {trendData.trend !== 'stable' && (
                        <span className={`text-xs ${trendData.trend === 'improving' ? 'text-green-400' : 'text-red-400'}`}>
                          {trendData.trend === 'improving' ? '↑' : '↓'} {Math.abs(trendData.changePercent)}%
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        conf: {Math.round(w.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">{w.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {devPlan.recommendations.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-3">Recommendations</h3>
          <div className="space-y-2">
            {devPlan.recommendations.map((r, i) => (
              <div key={i} className="text-sm text-slate-300 bg-slate-700/50 rounded-lg p-3">
                {r}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ObservationsTab({ observations, player }: { observations: CoachObservation[]; player: Player }) {
  const playerObs = observations
    .filter((o) => o.playerId === player.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (playerObs.length === 0) {
    return (
      <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center">
        <div className="text-3xl mb-2">📝</div>
        <h3 className="text-lg font-semibold text-slate-300 mb-1">No Observations</h3>
        <p className="text-sm text-slate-500">Coach observations will appear here when added from practice sessions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {playerObs.map((obs) => (
        <div key={obs.id} className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full capitalize">
              {obs.skillArea}
            </span>
            <span className="text-xs text-slate-500">
              {new Date(obs.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-slate-300">{obs.observation}</p>
          {obs.rating !== undefined && (
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={`w-4 h-4 rounded-full text-xs flex items-center justify-center ${
                    n <= obs.rating! ? 'bg-yellow-500 text-yellow-900' : 'bg-slate-700 text-slate-500'
                  }`}
                >
                  {n}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
