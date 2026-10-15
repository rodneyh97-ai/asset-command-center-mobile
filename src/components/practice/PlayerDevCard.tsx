'use client';

import { useState } from 'react';
import type {
  Player,
  PlayerDevelopmentPlan,
  PlayerWeakness,
  CoachObservation,
  SkillArea,
  EvidenceRecord,
  ImprovementSnapshot,
} from '@/domain/types';

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

const roleColors: Record<string, string> = {
  'Setter': 'from-blue-600 to-blue-500',
  'Outside Hitter': 'from-red-600 to-red-500',
  'Middle Blocker': 'from-orange-600 to-orange-500',
  'Right Side': 'from-purple-600 to-purple-500',
  'Libero': 'from-emerald-600 to-emerald-500',
  'Defensive Specialist': 'from-teal-600 to-teal-500',
  'Opposite': 'from-pink-600 to-pink-500',
};

function TrendBadge({ trend }: { trend: 'improving' | 'declining' | 'stable' | undefined }) {
  if (trend === 'improving') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">
        <span>{'↑'}</span> Improving
      </span>
    );
  }
  if (trend === 'declining') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full">
        <span>{'↓'}</span> Needs attention
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-slate-500/15 text-slate-400 px-2 py-0.5 rounded-full">
      <span>{'→'}</span> Stable
    </span>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-slate-500';
  const label = pct >= 80 ? 'High' : pct >= 60 ? 'Medium' : 'Low';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 w-12 text-right">{label}</span>
    </div>
  );
}

interface PlayerDevCardProps {
  player: Player;
  devPlan?: PlayerDevelopmentPlan;
  observations?: CoachObservation[];
  trend?: 'improving' | 'declining' | 'stable';
  improvementSnapshots?: ImprovementSnapshot[];
  onAddObservation?: (playerId: string, skillArea: SkillArea, text: string) => void;
}

export default function PlayerDevCard({
  player,
  devPlan,
  observations = [],
  trend,
  improvementSnapshots = [],
  onAddObservation,
}: PlayerDevCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showObsForm, setShowObsForm] = useState(false);
  const [obsText, setObsText] = useState('');
  const [obsSkillArea, setObsSkillArea] = useState<SkillArea>('serving');

  const strengths = devPlan?.strengths.slice(0, 3) ?? [];
  const weaknesses = devPlan?.weaknesses.slice(0, 3) ?? [];
  const hasData = strengths.length > 0 || weaknesses.length > 0;
  const gradient = roleColors[player.primaryRole] || 'from-slate-600 to-slate-500';

  const handleSubmitObs = () => {
    if (!obsText.trim() || !onAddObservation) return;
    onAddObservation(player.id, obsSkillArea, obsText.trim());
    setObsText('');
    setShowObsForm(false);
  };

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700/50 transition-all hover:border-slate-600/50">
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-center gap-3 touch-manipulation min-h-[64px]"
      >
        <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-md`}>
          {player.jerseyNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-white truncate">{player.displayName}</span>
            <TrendBadge trend={trend} />
          </div>
          <div className="text-xs text-slate-400 font-medium">{player.primaryRole}</div>
          {!expanded && hasData && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {strengths.slice(0, 2).map((s, i) => (
                <span key={i} className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">
                  {skillAreaLabels[s.skillArea] || s.skillArea}
                </span>
              ))}
              {weaknesses.slice(0, 2).map((w, i) => (
                <span key={i} className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full">
                  {skillAreaLabels[w.skillArea] || w.skillArea}
                </span>
              ))}
            </div>
          )}
          {!expanded && !hasData && (
            <p className="text-xs text-slate-500 mt-1">No development data yet</p>
          )}
        </div>
        <span className="text-slate-500 text-sm flex-shrink-0 transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          {'▼'}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50 pt-4">
          {!hasData && (
            <div className="text-center py-4">
              <p className="text-slate-500 text-sm">No match data analyzed yet. Play some matches to see strengths and areas to improve.</p>
            </div>
          )}

          {/* Strengths */}
          {strengths.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-emerald-400 text-sm">{'✅'}</span>
                <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">Strengths</h4>
              </div>
              <div className="space-y-2">
                {strengths.map((s, i) => (
                  <div key={i} className="bg-emerald-500/8 border border-emerald-500/15 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-emerald-300 font-medium">
                        {skillAreaLabels[s.skillArea] || s.skillArea}
                      </span>
                      <span className="text-xs text-emerald-400/70 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        {s.metric}: {typeof s.value === 'number' && s.value < 1 ? `${(s.value * 100).toFixed(0)}%` : s.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weaknesses */}
          {weaknesses.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-amber-400 text-sm">{'\u{1F4C8}'}</span>
                <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Areas to Improve</h4>
              </div>
              <div className="space-y-2">
                {weaknesses.map((w, i) => (
                  <div key={i} className="bg-red-500/5 border border-red-500/15 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-red-300 font-medium">
                        {skillAreaLabels[w.skillArea] || w.skillArea}
                      </span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-red-400/70">
                          {typeof w.currentValue === 'number' && w.currentValue < 1 ? `${(w.currentValue * 100).toFixed(0)}%` : w.currentValue}
                        </span>
                        <span className="text-slate-600">{'→'}</span>
                        <span className="text-emerald-400/70">
                          {typeof w.benchmarkValue === 'number' && w.benchmarkValue < 1 ? `${(w.benchmarkValue * 100).toFixed(0)}%` : w.benchmarkValue}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">{w.description}</p>
                    <ConfidenceBar confidence={w.confidence} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Improvement trend chart */}
          {improvementSnapshots.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-blue-400 text-sm">{'\u{1F4CA}'}</span>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Trend</h4>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-3">
                <div className="flex items-end gap-1.5 h-16">
                  {improvementSnapshots.slice(-10).map((snap, i) => {
                    const maxVal = Math.max(...improvementSnapshots.map((s) => s.value), 1);
                    const heightPct = (snap.value / maxVal) * 100;
                    const isLast = i === improvementSnapshots.slice(-10).length - 1;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className={`w-full rounded-t-sm transition-all ${isLast ? 'bg-blue-500' : 'bg-blue-500/40'}`}
                          style={{ height: `${Math.max(heightPct, 6)}%` }}
                          title={`${snap.metric}: ${snap.value} (${snap.date})`}
                        />
                        <span className="text-[9px] text-slate-500 truncate w-full text-center">
                          {snap.date.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {devPlan && devPlan.recommendations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-amber-400 text-sm">{'\u{1F4A1}'}</span>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Recommendations</h4>
              </div>
              <div className="space-y-1.5">
                {devPlan.recommendations.map((rec, i) => (
                  <div key={i} className="flex gap-2.5 text-sm text-slate-300 bg-slate-700/30 rounded-lg px-3 py-2.5">
                    <span className="text-amber-400/60 flex-shrink-0 mt-0.5">{'●'}</span>
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coach observations */}
          {observations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-slate-400 text-sm">{'\u{1F4DD}'}</span>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Coach Observations ({observations.length})
                </h4>
              </div>
              <div className="space-y-2">
                {observations.slice(0, 5).map((obs) => (
                  <div key={obs.id} className="bg-slate-700/30 border border-slate-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs bg-slate-600/60 text-slate-300 px-2 py-0.5 rounded-full">
                        {skillAreaLabels[obs.skillArea] || obs.skillArea}
                      </span>
                      <span className="text-xs text-slate-600">
                        {new Date(obs.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">{obs.observation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coach notes */}
          {devPlan?.coachNotes && (
            <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-1">Coach Summary</h4>
              <p className="text-sm text-slate-300 leading-relaxed">{devPlan.coachNotes}</p>
            </div>
          )}

          {/* Add Observation */}
          {onAddObservation && (
            <div>
              {!showObsForm ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowObsForm(true);
                  }}
                  className="w-full py-3 text-sm text-blue-400 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 rounded-xl touch-manipulation min-h-[44px] transition-colors font-medium"
                >
                  + Add Observation
                </button>
              ) : (
                <div className="bg-slate-700/30 border border-slate-700/50 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-medium text-white">New Observation</h4>
                  <select
                    value={obsSkillArea}
                    onChange={(e) => setObsSkillArea(e.target.value as SkillArea)}
                    className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm min-h-[44px] focus:border-blue-500/50 focus:outline-none"
                  >
                    {allSkillAreas.map((area) => (
                      <option key={area} value={area}>
                        {skillAreaLabels[area]}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={obsText}
                    onChange={(e) => setObsText(e.target.value)}
                    placeholder="What did you observe?"
                    className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[80px] resize-none focus:border-blue-500/50 focus:outline-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowObsForm(false); setObsText(''); }}
                      className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm min-h-[44px] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitObs}
                      disabled={!obsText.trim()}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg text-sm font-medium min-h-[44px] transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
