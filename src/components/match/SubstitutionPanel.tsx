'use client';

import { useState, useMemo } from 'react';
import { Player, RotationPosition, PlayerMatchStats, RulesetProfile, SubstitutionRecord } from '@/domain/types';
import { getFrontRow, getBackRow, getNextRotations } from '@/domain/rotation-engine';
import { getPlayerPlusMinus, getHittingPercentage } from '@/domain/event-sourcing';
import { validateSubstitution } from '@/domain/substitution-validation';
import type { SetState } from '@/domain/types';

interface SubstitutionPanelProps {
  courtPlayers: RotationPosition[];
  benchPlayerIds: string[];
  players: Player[];
  substitutionCount: number;
  playerStats?: Record<string, PlayerMatchStats>;
  ruleset?: RulesetProfile;
  substitutionHistory: SubstitutionRecord[];
  onConfirm: (playerOutId: string, playerInId: string) => void;
  onClose: () => void;
}

export default function SubstitutionPanel({
  courtPlayers,
  benchPlayerIds,
  players,
  substitutionCount,
  playerStats,
  ruleset,
  substitutionHistory,
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

  const validation = useMemo(() => {
    if (!playerOutId || !playerInId) return null;
    const mockSetState: Pick<SetState, 'substitutionCount' | 'substitutionHistory' | 'courtPlayers'> = {
      substitutionCount,
      substitutionHistory,
      courtPlayers,
    };
    return validateSubstitution(mockSetState as SetState, playerOutId, playerInId, ruleset);
  }, [playerOutId, playerInId, substitutionCount, substitutionHistory, courtPlayers, ruleset]);

  const handleConfirm = () => {
    if (playerOutId && playerInId && (!validation || validation.allowed)) {
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
                  {playerStats?.[rp.playerId] && (() => {
                    const s = playerStats[rp.playerId];
                    const pm = getPlayerPlusMinus(s);
                    const hitPct = getHittingPercentage(s);
                    return (
                      <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                        <span className={pm >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {pm >= 0 ? '+' : ''}{pm}
                        </span>
                        <span className="text-slate-400">{s.kills}K</span>
                        <span className="text-slate-400">{s.digs}D</span>
                        {hitPct !== null && (
                          <span className="text-slate-400">{hitPct.toFixed(3)}</span>
                        )}
                      </div>
                    );
                  })()}
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
                {ruleset && <span className="ml-2 text-slate-500">(limit: {ruleset.substitutionLimit})</span>}
              </div>

              {/* Validation feedback */}
              {validation && validation.errors.length > 0 && (
                <div className="mt-2 bg-red-900/30 border border-red-500/30 rounded-lg px-3 py-2">
                  {validation.errors.map((err, i) => (
                    <div key={i} className="text-xs text-red-400 flex items-center gap-1.5">
                      <span className="flex-shrink-0">✕</span> {err}
                    </div>
                  ))}
                </div>
              )}
              {validation && validation.warnings.length > 0 && (
                <div className="mt-2 bg-amber-900/30 border border-amber-500/30 rounded-lg px-3 py-2">
                  {validation.warnings.map((w, i) => (
                    <div key={i} className="text-xs text-amber-400 flex items-center gap-1.5">
                      <span className="flex-shrink-0">⚠</span> {w}
                    </div>
                  ))}
                </div>
              )}

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
            disabled={!playerOutId || !playerInId || (validation != null && !validation.allowed)}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-3 rounded-lg font-medium touch-manipulation"
          >
            Confirm Sub
          </button>
        </div>
      </div>
    </div>
  );
}
