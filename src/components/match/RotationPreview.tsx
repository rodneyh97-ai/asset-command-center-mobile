'use client';

import { Player, RotationPosition } from '@/domain/types';
import { getNextRotations, getCurrentServer, getFrontRow, getBackRow } from '@/domain/rotation-engine';

interface RotationPreviewProps {
  currentPositions: RotationPosition[];
  players: Player[];
  onClose: () => void;
}

export default function RotationPreview({
  currentPositions,
  players,
  onClose,
}: RotationPreviewProps) {
  const nextRotations = getNextRotations(currentPositions, 3);
  const getPlayer = (id: string) => players.find((p) => p.id === id);

  const renderRotation = (positions: RotationPosition[], label: string) => {
    const front = getFrontRow(positions);
    const back = getBackRow(positions);
    const server = getCurrentServer(positions);
    const serverPlayer = server ? getPlayer(server) : null;

    return (
      <div className="bg-slate-700/50 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-300">{label}</span>
          <span className="text-xs text-yellow-400">
            Server: #{serverPlayer?.jerseyNumber} {serverPlayer?.displayName}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-slate-500 mb-1">Front Row</div>
            {front.map((rp) => {
              const p = getPlayer(rp.playerId);
              return (
                <div key={rp.position} className="text-slate-300">
                  P{rp.position}: #{p?.jerseyNumber} {p?.displayName}
                </div>
              );
            })}
          </div>
          <div>
            <div className="text-slate-500 mb-1">Back Row</div>
            {back.map((rp) => {
              const p = getPlayer(rp.playerId);
              return (
                <div key={rp.position} className="text-slate-300">
                  P{rp.position}: #{p?.jerseyNumber} {p?.displayName}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Rotation Preview</h2>

        <div className="space-y-3">
          {renderRotation(currentPositions, 'Current Rotation')}
          {nextRotations.map((rotation, i) => (
            <div key={i}>{renderRotation(rotation, `Next ${i + 1}`)}</div>
          ))}
        </div>

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
