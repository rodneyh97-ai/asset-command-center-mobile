'use client';

import { useState } from 'react';
import type { Drill } from '@/domain/types';

const intensityColors: Record<string, string> = {
  low: 'bg-green-900/50 text-green-400',
  medium: 'bg-yellow-900/50 text-yellow-400',
  high: 'bg-red-900/50 text-red-400',
};

const skillAreaColors: Record<string, string> = {
  serving: 'bg-blue-900/50 text-blue-400',
  'serve-receive': 'bg-purple-900/50 text-purple-400',
  attacking: 'bg-red-900/50 text-red-400',
  blocking: 'bg-orange-900/50 text-orange-400',
  setting: 'bg-teal-900/50 text-teal-400',
  defense: 'bg-green-900/50 text-green-400',
  transition: 'bg-yellow-900/50 text-yellow-400',
  rotation: 'bg-pink-900/50 text-pink-400',
};

interface DrillCardProps {
  drill: Drill;
}

export default function DrillCard({ drill }: DrillCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-center gap-3 touch-manipulation min-h-[56px]"
      >
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white truncate">{drill.name}</div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${skillAreaColors[drill.skillArea] || 'bg-slate-700 text-slate-300'}`}
            >
              {drill.skillArea}
            </span>
            <span className="text-xs text-slate-400">{drill.defaultDurationMinutes} min</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${intensityColors[drill.intensity] || 'bg-slate-700 text-slate-300'}`}
            >
              {drill.intensity}
            </span>
          </div>
          {!expanded && drill.purpose && (
            <p className="text-sm text-slate-400 mt-1 line-clamp-1">{drill.purpose}</p>
          )}
          {!expanded && drill.targetRoles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {drill.targetRoles.map((role) => (
                <span key={role} className="text-xs text-slate-500">
                  {role}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="text-slate-500 text-lg flex-shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-700 pt-3">
          {drill.purpose && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Purpose</h4>
              <p className="text-sm text-slate-300">{drill.purpose}</p>
            </div>
          )}

          {drill.targetRoles.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Target Roles</h4>
              <div className="flex flex-wrap gap-1">
                {drill.targetRoles.map((role) => (
                  <span key={role} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                    {role}
                  </span>
                ))}
              </div>
            </div>
          )}

          {drill.setup && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Setup</h4>
              <p className="text-sm text-slate-300 whitespace-pre-line">{drill.setup}</p>
            </div>
          )}

          {drill.execution && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Execution</h4>
              <p className="text-sm text-slate-300 whitespace-pre-line">{drill.execution}</p>
            </div>
          )}

          {drill.progressions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Progressions</h4>
              <ol className="list-decimal list-inside space-y-1">
                {drill.progressions.map((prog, i) => (
                  <li key={i} className="text-sm text-slate-300">{prog}</li>
                ))}
              </ol>
            </div>
          )}

          {drill.successMeasurement && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Success Measurement
              </h4>
              <p className="text-sm text-slate-300">{drill.successMeasurement}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-slate-500 pt-1">
            <span>Players: {drill.minPlayers}–{drill.maxPlayers}</span>
            {drill.defaultReps && <span>Reps: {drill.defaultReps}</span>}
            {drill.isCustom && <span className="text-amber-400">Custom drill</span>}
          </div>
        </div>
      )}
    </div>
  );
}
