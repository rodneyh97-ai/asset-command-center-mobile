'use client';

import { useState } from 'react';
import type { Drill } from '@/domain/types';

const intensityConfig: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Low' },
  medium: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Medium' },
  high: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'High' },
};

const skillAreaConfig: Record<string, { bg: string; text: string; icon: string }> = {
  serving: { bg: 'bg-blue-500/15', text: 'text-blue-400', icon: '\u{1F3D0}' },
  'serve-receive': { bg: 'bg-purple-500/15', text: 'text-purple-400', icon: '\u{1F91B}' },
  attacking: { bg: 'bg-red-500/15', text: 'text-red-400', icon: '\u{1F4A5}' },
  blocking: { bg: 'bg-orange-500/15', text: 'text-orange-400', icon: '\u{1F6E1}\u{FE0F}' },
  setting: { bg: 'bg-teal-500/15', text: 'text-teal-400', icon: '\u{1F44C}' },
  defense: { bg: 'bg-green-500/15', text: 'text-green-400', icon: '\u{1F9CE}' },
  transition: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', icon: '\u{1F504}' },
  rotation: { bg: 'bg-pink-500/15', text: 'text-pink-400', icon: '\u{1F503}' },
};

const skillAreaLabels: Record<string, string> = {
  serving: 'Serving',
  'serve-receive': 'Serve Receive',
  attacking: 'Attacking',
  blocking: 'Blocking',
  setting: 'Setting',
  defense: 'Defense',
  transition: 'Transition',
  rotation: 'Rotation',
};

interface DrillCardProps {
  drill: Drill;
}

export default function DrillCard({ drill }: DrillCardProps) {
  const [expanded, setExpanded] = useState(false);
  const skillCfg = skillAreaConfig[drill.skillArea] || { bg: 'bg-slate-700', text: 'text-slate-300', icon: '\u{1F3AF}' };
  const intCfg = intensityConfig[drill.intensity] || intensityConfig.medium;

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700/50 transition-all hover:border-slate-600/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-center gap-3 touch-manipulation min-h-[64px]"
      >
        {/* Skill area icon */}
        <div className={`w-10 h-10 rounded-xl ${skillCfg.bg} flex items-center justify-center text-lg flex-shrink-0`}>
          {skillCfg.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white truncate">{drill.name}</div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${skillCfg.bg} ${skillCfg.text}`}>
              {skillAreaLabels[drill.skillArea] || drill.skillArea}
            </span>
            <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">
              {drill.defaultDurationMinutes} min
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${intCfg.bg} ${intCfg.text}`}>
              {intCfg.label}
            </span>
            <span className="text-xs text-slate-500">
              {drill.minPlayers}-{drill.maxPlayers} players
            </span>
          </div>
          {!expanded && drill.purpose && (
            <p className="text-sm text-slate-400 mt-1.5 line-clamp-1">{drill.purpose}</p>
          )}
        </div>

        <span className="text-slate-500 text-sm flex-shrink-0 transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          {'▼'}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50 pt-4">
          {drill.purpose && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Purpose</h4>
              <p className="text-sm text-slate-300 leading-relaxed">{drill.purpose}</p>
            </div>
          )}

          {drill.targetRoles.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Target Roles</h4>
              <div className="flex flex-wrap gap-1.5">
                {drill.targetRoles.map((role) => (
                  <span key={role} className="text-xs bg-slate-700/80 text-slate-300 px-2.5 py-1 rounded-full">
                    {role}
                  </span>
                ))}
              </div>
            </div>
          )}

          {drill.setup && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Setup</h4>
              <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">{drill.setup}</p>
            </div>
          )}

          {drill.execution && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Execution</h4>
              <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">{drill.execution}</p>
            </div>
          )}

          {drill.progressions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Progressions</h4>
              <div className="space-y-1.5">
                {drill.progressions.map((prog, i) => (
                  <div key={i} className="flex gap-2.5 text-sm text-slate-300">
                    <span className="text-blue-400/60 font-mono text-xs w-5 flex-shrink-0 pt-0.5 text-right">{i + 1}.</span>
                    <span>{prog}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {drill.successMeasurement && (
            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-1">Success Measurement</h4>
              <p className="text-sm text-slate-300 leading-relaxed">{drill.successMeasurement}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-slate-500 pt-1 border-t border-slate-700/30">
            <span className="flex items-center gap-1">
              <span className="text-slate-600">{'\u{1F465}'}</span>
              {drill.minPlayers}-{drill.maxPlayers} players
            </span>
            {drill.defaultReps && (
              <span className="flex items-center gap-1">
                <span className="text-slate-600">{'\u{1F504}'}</span>
                {drill.defaultReps} reps
              </span>
            )}
            {drill.isCustom && (
              <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">Custom</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
