'use client';

import { useState } from 'react';
import { RotationPosition, Player, StatCategory } from '@/domain/types';

interface StatRecorderProps {
  courtPlayers: RotationPosition[];
  players: Player[];
  onRecordStat: (playerId: string, category: StatCategory) => void;
}

const STAT_BUTTONS: { label: string; category: StatCategory; color: string }[] = [
  { label: 'K', category: 'kill', color: 'bg-green-700 hover:bg-green-600' },
  { label: 'E', category: 'attackError', color: 'bg-red-700 hover:bg-red-600' },
  { label: 'A', category: 'ace', color: 'bg-green-700 hover:bg-green-600' },
  { label: 'SE', category: 'serviceError', color: 'bg-red-700 hover:bg-red-600' },
  { label: 'D', category: 'dig', color: 'bg-blue-700 hover:bg-blue-600' },
  { label: 'B', category: 'block', color: 'bg-green-700 hover:bg-green-600' },
  { label: 'AS', category: 'assist', color: 'bg-green-700 hover:bg-green-600' },
  { label: 'RE', category: 'receptionError', color: 'bg-red-700 hover:bg-red-600' },
  { label: 'BHE', category: 'ballHandlingError', color: 'bg-red-700 hover:bg-red-600' },
];

export default function StatRecorder({
  courtPlayers,
  players,
  onRecordStat,
}: StatRecorderProps) {
  const [activeStat, setActiveStat] = useState<StatCategory | null>(null);

  const getPlayer = (id: string) => players.find((p) => p.id === id);

  const handleStatTap = (category: StatCategory) => {
    setActiveStat(activeStat === category ? null : category);
  };

  const handlePlayerTap = (playerId: string) => {
    if (activeStat) {
      onRecordStat(playerId, activeStat);
      setActiveStat(null);
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Quick Stats</h3>
        {activeStat && (
          <button
            onClick={() => setActiveStat(null)}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Stat type buttons */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {STAT_BUTTONS.map(({ label, category, color }) => (
          <button
            key={category}
            onClick={() => handleStatTap(category)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-bold text-white touch-manipulation transition-all ${
              activeStat === category
                ? 'ring-2 ring-yellow-400 scale-105 ' + color
                : color
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Player picker */}
      {activeStat && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-700">
          <span className="text-xs text-slate-400 w-full mb-1">
            Tap player for {STAT_BUTTONS.find((s) => s.category === activeStat)?.label}:
          </span>
          {courtPlayers.map((rp) => {
            const player = getPlayer(rp.playerId);
            if (!player) return null;
            return (
              <button
                key={rp.playerId}
                onClick={() => handlePlayerTap(rp.playerId)}
                className="bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white px-3 py-2 rounded-lg text-sm font-bold touch-manipulation transition-colors"
              >
                #{player.jerseyNumber}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
