'use client';

import { MatchEvent, Player } from '@/domain/types';

interface MatchHistoryProps {
  events: MatchEvent[];
  players: Player[];
  onClose: () => void;
}

function formatEventDescription(event: MatchEvent, players: Player[]): string {
  const getPlayerName = (id: string) => {
    const p = players.find((pl) => pl.id === id);
    return p ? `#${p.jerseyNumber} ${p.displayName}` : id;
  };

  switch (event.eventType) {
    case 'MatchCreated':
      return 'Match started';
    case 'SetStarted':
      return `Set ${event.payload.setNumber} started`;
    case 'OurPoint':
      return 'Our point scored';
    case 'OpponentPoint':
      return 'Opponent point scored';
    case 'TimeoutTaken':
      return `Timeout taken (${event.payload.team})`;
    case 'SubstitutionConfirmed':
      return `Sub: ${getPlayerName(event.payload.playerOutId as string)} → ${getPlayerName(event.payload.playerInId as string)}`;
    case 'LiberoReplacement': {
      const dir = event.payload.isEntering ? 'entered' : 'exited';
      return `Libero ${getPlayerName(event.payload.liberoId as string)} ${dir}`;
    }
    case 'PlayerAvailabilityChanged':
      return `${getPlayerName(event.payload.playerId as string)} status → ${event.payload.status}`;
    case 'CorrectionApplied':
      return `Correction: ${event.auditNote || 'No note'}`;
    case 'NoteAdded':
      return `Note: ${event.payload.note}`;
    case 'SetEnded':
      return `Set ${event.payload.setNumber} ended`;
    case 'MatchEnded':
      return 'Match ended';
    default:
      return event.eventType;
  }
}

export default function MatchHistory({ events, players, onClose }: MatchHistoryProps) {
  const activeEvents = events.filter((e) => !e.undone);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Match Event History</h2>

        <div className="space-y-1">
          {activeEvents
            .slice()
            .reverse()
            .map((event) => (
              <div
                key={event.id}
                className={`text-sm p-2 rounded ${
                  event.eventType === 'CorrectionApplied'
                    ? 'bg-amber-900/20 border-l-2 border-amber-500'
                    : 'bg-slate-700/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">
                    {formatEventDescription(event, players)}
                  </span>
                  <span className="text-xs text-slate-500 ml-2 shrink-0">
                    {new Date(event.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
                {event.auditNote && (
                  <div className="text-xs text-amber-400 mt-1">
                    Audit: {event.auditNote}
                  </div>
                )}
              </div>
            ))}
        </div>

        {events.some((e) => e.undone) && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <h3 className="text-sm font-medium text-slate-500 mb-2">Undone Events</h3>
            <div className="space-y-1">
              {events
                .filter((e) => e.undone)
                .reverse()
                .map((event) => (
                  <div key={event.id} className="text-xs text-slate-500 p-2 bg-slate-700/20 rounded line-through">
                    {formatEventDescription(event, players)}
                  </div>
                ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-medium mt-4"
        >
          Close
        </button>
      </div>
    </div>
  );
}
