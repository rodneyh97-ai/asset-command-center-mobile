'use client';

import { useState } from 'react';
import { Player, RotationPosition } from '@/domain/types';
import { getFrontRow, getBackRow, getNextRotations } from '@/domain/rotation-engine';

interface SubstitutionPanelProps {
  courtPlayers: RotationPosition[];
  benchPlayerIds: string[];
  players: Player[];
  substitutionCount: number;
  onConfirm: (playerOutId: string, playerInId: string) => void;
  onClose: () => void;
}

export default function SubstitutionPanel({
  courtPlayers,
  benchPlayerIds,
  players,
  substitutionCount,
  onConfirm,
  onClose,
}: SubstitutionPanelProps) {
  const [playerOutId, setPlayerOutId] = useState<string | null>(null);
  const [playerInId, setPlayerInId] = useState<string | null>(null);

  const getPlayer = (id: string) => players.find((p) => p.id === id);
  const playerOut = playerOutId ? getPlayer(playerOutId) : null;
  const playerIn = playerInId ? getPlayer(playerInId) : null;

  const outPosition = playerOutId
    ? courtPlayers.find((p) => p.playerId === playerOutId)?.position
    : null;

  const isInFrontRow = outPosition ? outPosition >= 2 && outPosition <= 4 : false;

  const previewPositions = playerOutId && playerInId
    ? courtPlayers.map((p) =>
        p.playerId === playerOutId ? { ...p, playerId: playerInId } : p
      )
    : null;

  const nextRotations = previewPositions ? getNextRotations(previewPositions, 3) : [];

  const handleConfirm = () => {
    if (playerOutId && playerInId) {
      onConfirm(playerOutId, playerInId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Substitution</h2>
          <span className="text-sm text-slate-400">Subs used: {substitutionCount}</span>
        </div>

        {/* Step 1: Select player OUT */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-slate-400 mb-2">
            {!playerOutId ? '1. Tap a court player to remove' : '✓ Removing from court'}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {courtPlayers.map((rp) => {
              const player = getPlayer(rp.playerId);
              if (!player) return null;
              const isSelected = rp.playerId === playerOutId;
              return (
                <button
                  key={rp.playerId}
                  onClick={() => { setPlayerOutId(rp.playerId); setPlayerInId(null); }}
                  className={`p-3 rounded-lg text-left transition-colors touch-manipulation ${
                    isSelected
                      ? 'bg-red-600/30 border-2 border-red-500'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  <div className="font-bold">#{player.jerseyNumber}</div>
                  <div className="text-sm">{player.displayName}</div>
                  <div className="text-xs text-slate-400">P{rp.position}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Select player IN */}
        {playerOutId && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-slate-400 mb-2">
              {!playerInId ? '2. Tap a bench player to bring in' : '✓ Entering court'}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {benchPlayerIds.map((id) => {
                const player = getPlayer(id);
                if (!player) return null;
                const isSelected = id === playerInId;
                return (
                  <button
                    key={id}
                    onClick={() => setPlayerInId(id)}
                    className={`p-3 rounded-lg text-left transition-colors touch-manipulation ${
                      isSelected
                        ? 'bg-green-600/30 border-2 border-green-500'
                        : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    <div className="font-bold">#{player.jerseyNumber}</div>
                    <div className="text-sm">{player.displayName}</div>
                    <div className="text-xs text-slate-400">{player.primaryRole}</div>
                  </button>
                );
              })}
              {benchPlayerIds.length === 0 && (
                <p className="text-slate-500 text-sm col-span-3">No bench players available</p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {playerOutId && playerInId && (
          <div className="mb-4 bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Preview</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-red-400">OUT: #{playerOut?.jerseyNumber} {playerOut?.displayName}</span>
                <span className="text-slate-400">Position {outPosition}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-400">IN: #{playerIn?.jerseyNumber} {playerIn?.displayName}</span>
                <span className="text-slate-400">{isInFrontRow ? 'Front Row' : 'Back Row'}</span>
              </div>
              {outPosition === 2 && (
                <div className="text-yellow-400 text-xs">
                  Incoming player will serve next rotation
                </div>
              )}
              <div className="text-xs text-slate-400 mt-2">
                Sub count after: {substitutionCount + 1}
              </div>

              {/* Next 3 rotations preview */}
              {nextRotations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-600">
                  <div className="text-xs text-slate-400 mb-1">Next rotations after sub:</div>
                  {nextRotations.map((rot, i) => {
                    const server = rot.find((p) => p.position === 1);
                    const serverPlayer = server ? getPlayer(server.playerId) : null;
                    return (
                      <div key={i} className="text-xs text-slate-300">
                        R{i + 1}: Server #{serverPlayer?.jerseyNumber} {serverPlayer?.displayName}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-medium touch-manipulation"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!playerOutId || !playerInId}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-3 rounded-lg font-medium touch-manipulation"
          >
            Confirm Sub
          </button>
        </div>
      </div>
    </div>
  );
}
