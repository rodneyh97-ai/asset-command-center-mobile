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

function sourceLabel(source: string): string {
  switch (source) {
    case 'match-stats':
      return 'From match data';
    case 'hudl-import':
      return 'From match data';
    case 'coach-observation':
      return 'Coach observation';
    default:
      return source;
  }
}

function sourceBadge(source: string): string {
  switch (source) {
    case 'match-stats':
      return 'bg-blue-900/50 text-blue-400';
    case 'hudl-import':
      return 'bg-blue-900/50 text-blue-400';
    case 'coach-observation':
      return 'bg-amber-900/50 text-amber-400';
    default:
      return 'bg-slate-700 text-slate-300';
  }
}

function TrendIndicator({ trend }: { trend: 'improving' | 'declining' | 'stable' | undefined }) {
  if (trend === 'improving') {
    return <span className="text-green-400 text-sm font-bold" title="Improving">{'↑'}</span>;
  }
  if (trend === 'declining') {
    return <span className="text-red-400 text-sm font-bold" title="Declining">{'↓'}</span>;
  }
  return <span className="text-slate-500 text-sm font-bold" title="Stable">{'→'}</span>;
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-slate-400 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
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

  const handleSubmitObs = () => {
    if (!obsText.trim() || !onAddObservation) return;
    onAddObservation(player.id, obsSkillArea, obsText.trim());
    setObsText('');
    setShowObsForm(false);
  };

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-center gap-3 touch-manipulation min-h-[56px]"
      >
        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
          {player.jerseyNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">{player.displayName}</span>
            <TrendIndicator trend={trend} />
          </div>
          <div className="text-xs text-slate-400">{player.primaryRole}</div>
          {!expanded && (
            <div className="flex flex-wrap gap-1 mt-1">
              {strengths.slice(0, 2).map((s, i) => (
                <span key={i} className="text-xs bg-green-900/40 text-green-400 px-1.5 py-0.5 rounded">
                  {skillAreaLabels[s.skillArea] || s.skillArea}
                </span>
              ))}
              {weaknesses.slice(0, 2).map((w, i) => (
                <span key={i} className="text-xs bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded">
                  {skillAreaLabels[w.skillArea] || w.skillArea}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="text-slate-500 text-lg flex-shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-700 pt-3">
          {/* Strengths */}
          {strengths.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-2">Strengths</h4>
              <div className="space-y-2">
                {strengths.map((s, i) => (
                  <div key={i} className="bg-green-900/20 rounded-lg p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-300 font-medium">
                        {skillAreaLabels[s.skillArea] || s.skillArea}
                      </span>
                      <span className="text-xs text-green-400">{s.metric}: {s.value}</span>
                    </div>
                    {s.evidence.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.evidence.slice(0, 2).map((ev, j) => (
                          <span key={j} className={`text-xs px-1.5 py-0.5 rounded ${sourceBadge(ev.source)}`}>
                            {sourceLabel(ev.source)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weaknesses */}
          {weaknesses.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2">Areas to Improve</h4>
              <div className="space-y-2">
                {weaknesses.map((w, i) => (
                  <div key={i} className="bg-red-900/20 rounded-lg p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-red-300 font-medium">
                        {skillAreaLabels[w.skillArea] || w.skillArea}
                      </span>
                      <span className="text-xs text-red-400">
                        {w.metric}: {w.currentValue} (target: {w.benchmarkValue})
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{w.description}</p>
                    <div className="mt-1">
                      <ConfidenceBar confidence={w.confidence} />
                    </div>
                    {w.evidence.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {w.evidence.slice(0, 2).map((ev, j) => (
                          <span key={j} className={`text-xs px-1.5 py-0.5 rounded ${sourceBadge(ev.source)}`}>
                            {sourceLabel(ev.source)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Improvement trend chart (simple bar visualization) */}
          {improvementSnapshots.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Improvement Trend
              </h4>
              <div className="flex items-end gap-1 h-16">
                {improvementSnapshots.slice(-10).map((snap, i) => {
                  const maxVal = Math.max(...improvementSnapshots.map((s) => s.value), 1);
                  const heightPct = (snap.value / maxVal) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div
                        className="w-full bg-blue-500/60 rounded-t"
                        style={{ height: `${Math.max(heightPct, 4)}%` }}
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
          )}

          {/* Recommendations */}
          {devPlan && devPlan.recommendations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Recommendations
                <span className="ml-2 text-xs font-normal text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded">
                  Suggested
                </span>
              </h4>
              <ul className="space-y-1">
                {devPlan.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-slate-300 flex gap-2">
                    <span className="text-slate-500 flex-shrink-0">-</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Coach observations */}
          {observations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Coach Observations
              </h4>
              <div className="space-y-1.5">
                {observations.slice(0, 5).map((obs) => (
                  <div key={obs.id} className="bg-slate-700/50 rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded">
                        Coach observation
                      </span>
                      <span className="text-xs text-slate-500">
                        {skillAreaLabels[obs.skillArea] || obs.skillArea}
                      </span>
                      <span className="text-xs text-slate-600">
                        {new Date(obs.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">{obs.observation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coach notes */}
          {devPlan?.coachNotes && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Coach Notes</h4>
              <p className="text-sm text-slate-300">{devPlan.coachNotes}</p>
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
                  className="w-full py-2.5 text-sm text-blue-400 bg-slate-700/50 hover:bg-slate-700 rounded-lg touch-manipulation min-h-[44px]"
                >
                  + Add Observation
                </button>
              ) : (
                <div className="bg-slate-700/50 rounded-lg p-3 space-y-2">
                  <select
                    value={obsSkillArea}
                    onChange={(e) => setObsSkillArea(e.target.value as SkillArea)}
                    className="w-full bg-slate-700 rounded-lg px-3 py-2.5 text-white text-sm min-h-[44px]"
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
                    className="w-full bg-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-400 min-h-[64px] resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowObsForm(false)}
                      className="flex-1 py-2.5 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm min-h-[44px]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitObs}
                      disabled={!obsText.trim()}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg text-sm font-medium min-h-[44px]"
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
