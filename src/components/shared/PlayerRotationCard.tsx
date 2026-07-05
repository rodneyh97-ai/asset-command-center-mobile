'use client';

import { Player, RotationPosition, TacticalOverlay } from '@/domain/types';
import { getFrontRow, getBackRow } from '@/domain/rotation-engine';

interface PlayerRotationCardProps {
  player: Player;
  positions: RotationPosition[];
  rotationNumber: number;
  tacticalOverlay?: TacticalOverlay;
  isServing: boolean;
}

export default function PlayerRotationCard({
  player,
  positions,
  rotationNumber,
  tacticalOverlay,
  isServing,
}: PlayerRotationCardProps) {
  const playerPosition = positions.find((p) => p.playerId === player.id);
  if (!playerPosition) return null;

  const isFrontRow = playerPosition.position >= 2 && playerPosition.position <= 4;

  return (
    <div
      className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm mx-auto"
      role="article"
      aria-label={`Rotation card for ${player.displayName}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-slate-700 rounded-xl w-16 h-16 flex items-center justify-center">
            <span className="text-3xl font-bold">{player.jerseyNumber}</span>
          </div>
          <div>
            <div className="text-xl font-bold">{player.displayName}</div>
            <div className="text-sm text-slate-400">{player.primaryRole}</div>
          </div>
        </div>
        {isServing && (
          <div className="bg-yellow-600 text-white text-xs font-bold px-3 py-1 rounded-full">
            SERVE
          </div>
        )}
      </div>

      {/* Position Info */}
      <div className="bg-slate-700/50 rounded-xl p-4 mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Position</div>
            <div className="text-2xl font-bold">{playerPosition.position}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Row</div>
            <div className="text-2xl font-bold">{isFrontRow ? 'Front' : 'Back'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Rotation</div>
            <div className="text-2xl font-bold">{rotationNumber}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Zone</div>
            <div className="text-2xl font-bold">Z{playerPosition.position}</div>
          </div>
        </div>
      </div>

      {/* Tactical Notes */}
      {tacticalOverlay?.notes && (
        <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-3">
          <div className="text-xs text-blue-400 uppercase tracking-wider mb-1">Assignment</div>
          <div className="text-sm text-blue-200">{tacticalOverlay.notes}</div>
        </div>
      )}
    </div>
  );
}
