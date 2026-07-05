'use client';

import { useState } from 'react';
import { Player, RotationPosition } from '@/domain/types';
import { getBackRow } from '@/domain/rotation-engine';

interface LiberoPanelProps {
  courtPlayers: RotationPosition[];
  players: Player[];
  liberoIds: string[];
  activeLiberoId?: string;
  liberoReplacedPlayerId?: string;
  onLiberoIn: (liberoId: string, replacedPlayerId: string) => void;
  onLiberoOut: (liberoId: string, replacedPlayerId: string) => void;
  onClose: () => void;
}

export default function LiberoPanel({
  courtPlayers,
  players,
  liberoIds,
  activeLiberoId,
  liberoReplacedPlayerId,
  onLiberoIn,
  onLiberoOut,
  onClose,
}: LiberoPanelProps) {
  const [selectedLiberoId, setSelectedLiberoId] = useState<string | null>(null);
  const [selectedReplacedId, setSelectedReplacedId] = useState<string | null>(null);

  const getPlayer = (id: string) => players.find((p) => p.id === id);
  const backRow = getBackRow(courtPlayers);

  const isLiberoOnCourt = !!activeLiberoId;

  const handleLiberoIn = () => {
    if (selectedLiberoId && selectedReplacedId) {
      onLiberoIn(selectedLiberoId, selectedReplacedId);
    }
  };

  const handleLiberoOut = () => {
    if (activeLiberoId && liberoReplacedPlayerId) {
      onLiberoOut(activeLiberoId, liberoReplacedPlayerId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Libero Movement</h2>
        <p className="text-xs text-slate-400 mb-4">
          Libero replacements do not count as substitutions.
        </p>

        {isLiberoOnCourt ? (
          <div className="space-y-4">
            <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-4">
              <div className="text-sm text-emerald-400 mb-1">Libero on court</div>
              <div className="font-bold">
                #{getPlayer(activeLiberoId!)?.jerseyNumber}{' '}
                {getPlayer(activeLiberoId!)?.displayName}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                Replaced: #{getPlayer(liberoReplacedPlayerId!)?.jerseyNumber}{' '}
                {getPlayer(liberoReplacedPlayerId!)?.displayName}
              </div>
            </div>
            <button
              onClick={handleLiberoOut}
              className="w-full bg-amber-600 hover:bg-amber-500 py-4 rounded-lg font-medium touch-manipulation"
            >
              Remove Libero (Return #{getPlayer(liberoReplacedPlayerId!)?.jerseyNumber})
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Select which libero */}
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2">Select Libero</h3>
              <div className="flex gap-2">
                {liberoIds.map((id) => {
                  const player = getPlayer(id);
                  if (!player) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedLiberoId(id)}
                      className={`flex-1 p-3 rounded-lg text-center touch-manipulation ${
                        selectedLiberoId === id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      <div className="font-bold">#{player.jerseyNumber}</div>
                      <div className="text-sm">{player.displayName}</div>
                    </button>
                  );
                })}
                {liberoIds.length === 0 && (
                  <p className="text-slate-500 text-sm">No liberos designated</p>
                )}
              </div>
            </div>

            {/* Select back-row player to replace */}
            {selectedLiberoId && (
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-2">
                  Replace which back-row player?
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {backRow.map((rp) => {
                    const player = getPlayer(rp.playerId);
                    if (!player) return null;
                    if (liberoIds.includes(rp.playerId)) return null;
                    return (
                      <button
                        key={rp.playerId}
                        onClick={() => setSelectedReplacedId(rp.playerId)}
                        className={`p-3 rounded-lg text-center touch-manipulation ${
                          selectedReplacedId === rp.playerId
                            ? 'bg-blue-600 text-white'
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
            )}

            {selectedLiberoId && selectedReplacedId && (
              <button
                onClick={handleLiberoIn}
                className="w-full bg-emerald-600 hover:bg-emerald-500 py-4 rounded-lg font-medium touch-manipulation"
              >
                Send Libero In
              </button>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-medium mt-4 touch-manipulation"
        >
          Close
        </button>
      </div>
    </div>
  );
}
