'use client';

import { useState } from 'react';
import { Player, AvailabilityStatus, PlayerAvailabilityEntry } from '@/domain/types';

interface PlayerStatusPanelProps {
  players: Player[];
  courtPlayerIds: string[];
  benchPlayerIds: string[];
  currentAvailability: PlayerAvailabilityEntry[];
  onStatusChange: (playerId: string, status: AvailabilityStatus, reason?: string) => void;
  onClose: () => void;
}

const STATUSES: AvailabilityStatus[] = [
  'Available',
  'Limited',
  'Emergency only',
  'Out for set',
  'Out for match',
];

const STATUS_COLORS: Record<AvailabilityStatus, string> = {
  Available: 'bg-green-900/50 text-green-400',
  Limited: 'bg-yellow-900/50 text-yellow-400',
  'Emergency only': 'bg-orange-900/50 text-orange-400',
  'Out for set': 'bg-red-900/50 text-red-400',
  'Out for match': 'bg-red-900/80 text-red-300',
};

export default function PlayerStatusPanel({
  players,
  courtPlayerIds,
  benchPlayerIds,
  currentAvailability,
  onStatusChange,
  onClose,
}: PlayerStatusPanelProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<AvailabilityStatus>('Available');
  const [reason, setReason] = useState('');

  const allPlayerIds = [...courtPlayerIds, ...benchPlayerIds];
  const relevantPlayers = players.filter((p) => allPlayerIds.includes(p.id));

  const getAvailability = (playerId: string): AvailabilityStatus => {
    const entry = currentAvailability.find((a) => a.playerId === playerId);
    return (entry?.status as AvailabilityStatus) || 'Available';
  };

  const handleConfirm = () => {
    if (!selectedPlayerId) return;
    onStatusChange(selectedPlayerId, selectedStatus, reason || undefined);
    setSelectedPlayerId(null);
    setReason('');
  };

  const isOnCourt = (id: string) => courtPlayerIds.includes(id);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Player Status</h2>

        {!selectedPlayerId ? (
          <div className="space-y-2">
            {relevantPlayers.map((player) => {
              const status = getAvailability(player.id);
              return (
                <button
                  key={player.id}
                  onClick={() => {
                    setSelectedPlayerId(player.id);
                    setSelectedStatus(status);
                  }}
                  className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg p-3 flex items-center justify-between touch-manipulation"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold">#{player.jerseyNumber}</span>
                    <span>{player.displayName}</span>
                    {isOnCourt(player.id) && (
                      <span className="text-xs bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded">
                        On Court
                      </span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[status]}`}>
                    {status}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-slate-400">
              Setting status for:{' '}
              <span className="text-white font-medium">
                #{players.find((p) => p.id === selectedPlayerId)?.jerseyNumber}{' '}
                {players.find((p) => p.id === selectedPlayerId)?.displayName}
              </span>
              {isOnCourt(selectedPlayerId) && (
                <span className="ml-2 text-yellow-400">(currently on court)</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={`p-3 rounded-lg text-left touch-manipulation ${
                    selectedStatus === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {(selectedStatus === 'Out for set' || selectedStatus === 'Out for match') && (
              <input
                type="text"
                placeholder="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-400"
              />
            )}

            {isOnCourt(selectedPlayerId) &&
              (selectedStatus === 'Out for set' || selectedStatus === 'Out for match') && (
                <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 text-sm text-yellow-400">
                  Warning: This player is on the court. You will need to substitute them out manually.
                </div>
              )}

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedPlayerId(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-medium"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-medium"
              >
                Set Status
              </button>
            </div>
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
