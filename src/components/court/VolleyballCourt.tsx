'use client';

import { RotationPosition, Player } from '@/domain/types';
import { getFrontRow, getBackRow } from '@/domain/rotation-engine';

interface CourtProps {
  positions: RotationPosition[];
  players: Player[];
  activeLiberoId?: string;
  onPlayerTap?: (playerId: string) => void;
  selectedPlayerId?: string;
}

function PlayerBadge({
  player,
  position,
  isLibero,
  isSelected,
  onTap,
}: {
  player: Player | undefined;
  position: number;
  isLibero: boolean;
  isSelected: boolean;
  onTap?: () => void;
}) {
  if (!player) return null;

  return (
    <button
      onClick={onTap}
      className={`
        flex flex-col items-center justify-center rounded-lg p-2 min-w-[72px] min-h-[72px]
        transition-all touch-manipulation
        ${isLibero ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white'}
        ${isSelected ? 'ring-4 ring-yellow-400 scale-110' : ''}
        ${onTap ? 'active:scale-95 cursor-pointer' : ''}
      `}
      aria-label={`Position ${position}: ${player.displayName} #${player.jerseyNumber}`}
    >
      <span className="text-2xl font-bold leading-none">{player.jerseyNumber}</span>
      <span className="text-xs mt-1 truncate max-w-[64px]">{player.displayName}</span>
      <span className="text-[10px] opacity-70">P{position}</span>
    </button>
  );
}

export default function VolleyballCourt({
  positions,
  players,
  activeLiberoId,
  onPlayerTap,
  selectedPlayerId,
}: CourtProps) {
  const frontRow = getFrontRow(positions);
  const backRow = getBackRow(positions);

  const getPlayer = (playerId: string) => players.find((p) => p.id === playerId);

  const positionLayout: Record<number, string> = {
    4: 'col-start-1',
    3: 'col-start-2',
    2: 'col-start-3',
    5: 'col-start-1',
    6: 'col-start-2',
    1: 'col-start-3',
  };

  return (
    <div className="relative bg-amber-700 border-4 border-white rounded-xl p-4 w-full max-w-lg mx-auto">
      {/* Net */}
      <div className="absolute top-1/2 left-0 right-0 h-1 bg-white opacity-50 -translate-y-1/2" />

      {/* Front Row Label */}
      <div className="text-center text-xs text-white/60 mb-2 font-semibold uppercase tracking-wider">
        Front Row (Net)
      </div>

      {/* Front Row: Positions 4, 3, 2 */}
      <div className="grid grid-cols-3 gap-3 mb-6 justify-items-center">
        {[4, 3, 2].map((pos) => {
          const rp = frontRow.find((p) => p.position === pos);
          if (!rp) return <div key={pos} />;
          const player = getPlayer(rp.playerId);
          return (
            <div key={pos} className={positionLayout[pos]}>
              <PlayerBadge
                player={player}
                position={pos}
                isLibero={rp.playerId === activeLiberoId}
                isSelected={rp.playerId === selectedPlayerId}
                onTap={onPlayerTap ? () => onPlayerTap(rp.playerId) : undefined}
              />
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-white/30 my-2" />

      {/* Back Row Label */}
      <div className="text-center text-xs text-white/60 mt-2 mb-2 font-semibold uppercase tracking-wider">
        Back Row (Service)
      </div>

      {/* Back Row: Positions 5, 6, 1 */}
      <div className="grid grid-cols-3 gap-3 justify-items-center">
        {[5, 6, 1].map((pos) => {
          const rp = backRow.find((p) => p.position === pos);
          if (!rp) return <div key={pos} />;
          const player = getPlayer(rp.playerId);
          return (
            <div key={pos} className={positionLayout[pos]}>
              <PlayerBadge
                player={player}
                position={pos}
                isLibero={rp.playerId === activeLiberoId}
                isSelected={rp.playerId === selectedPlayerId}
                onTap={onPlayerTap ? () => onPlayerTap(rp.playerId) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
