'use client';

import { RotationPosition, Player, PlayerRole } from '@/domain/types';
import { getFrontRow, getBackRow } from '@/domain/rotation-engine';

interface CourtProps {
  positions: RotationPosition[];
  players: Player[];
  activeLiberoId?: string;
  onPlayerTap?: (playerId: string) => void;
  selectedPlayerId?: string;
}

const ROLE_COLORS: Record<PlayerRole, string> = {
  'Setter': 'bg-purple-600',
  'Outside Hitter': 'bg-blue-600',
  'Middle Blocker': 'bg-orange-600',
  'Right Side': 'bg-red-600',
  'Libero': 'bg-emerald-500',
  'Defensive Specialist': 'bg-teal-600',
};

const ROLE_ABBREVIATIONS: Record<PlayerRole, string> = {
  'Setter': 'S',
  'Outside Hitter': 'OH',
  'Middle Blocker': 'MB',
  'Right Side': 'RS',
  'Libero': 'L',
  'Defensive Specialist': 'DS',
};

function getRoleBgColor(player: Player, isLibero: boolean): string {
  if (isLibero) return 'bg-emerald-500';
  return ROLE_COLORS[player.primaryRole] ?? 'bg-slate-600';
}

function PlayerBadge({
  player,
  position,
  isLibero,
  isSelected,
  isServing,
  onTap,
}: {
  player: Player | undefined;
  position: number;
  isLibero: boolean;
  isSelected: boolean;
  isServing: boolean;
  onTap?: () => void;
}) {
  if (!player) return null;

  const bgColor = getRoleBgColor(player, isLibero);
  const roleAbbr = ROLE_ABBREVIATIONS[player.primaryRole] ?? '';

  return (
    <button
      onClick={onTap}
      className={`
        relative flex flex-col items-center justify-center rounded-lg p-2 min-w-[80px] min-h-[80px]
        transition-all touch-manipulation
        ${bgColor} text-white
        ${isSelected ? 'ring-4 ring-yellow-400 scale-110' : ''}
        ${onTap ? 'active:scale-95 cursor-pointer' : ''}
      `}
      aria-label={`Position ${position}: ${player.displayName} #${player.jerseyNumber}${isServing ? ' (Serving)' : ''}`}
    >
      {isServing && (
        <span className="absolute -top-2 -right-2 text-yellow-300 text-lg" aria-label="Serving">
          ▶
        </span>
      )}
      <span className="text-3xl font-bold leading-none">{player.jerseyNumber}</span>
      <span className="text-xs mt-1 truncate max-w-[72px]">{player.displayName}</span>
      <span className="text-[10px] opacity-70">P{position}</span>
      {roleAbbr && (
        <span className="text-[10px] font-semibold opacity-80 mt-0.5">{roleAbbr}</span>
      )}
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

  // Position 1 is the serving position
  const servingPlayerId = positions.find((p) => p.position === 1)?.playerId;

  const positionLayout: Record<number, string> = {
    4: 'col-start-1',
    3: 'col-start-2',
    2: 'col-start-3',
    5: 'col-start-1',
    6: 'col-start-2',
    1: 'col-start-3',
  };

  return (
    <div className="relative bg-gradient-to-b from-blue-800 to-blue-900 border-4 border-white rounded-xl p-4 w-full max-w-lg mx-auto overflow-hidden">
      {/* Court side lines */}
      <div className="absolute inset-4 border-2 border-white/40 rounded-lg pointer-events-none" />

      {/* Center line (net) */}
      <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-white/70 -translate-y-1/2 pointer-events-none" />

      {/* 3-meter attack line - front row side */}
      <div className="absolute top-[38%] left-4 right-4 border-t-2 border-dashed border-white/40 pointer-events-none" />

      {/* 3-meter attack line - back row side */}
      <div className="absolute top-[62%] left-4 right-4 border-t-2 border-dashed border-white/40 pointer-events-none" />

      {/* Front Row Label */}
      <div className="relative text-center text-xs text-white/60 mb-2 font-semibold uppercase tracking-wider">
        Front Row (Net)
      </div>

      {/* Front Row: Positions 4, 3, 2 */}
      <div className="relative grid grid-cols-3 gap-3 mb-6 justify-items-center">
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
                isServing={rp.playerId === servingPlayerId}
                onTap={onPlayerTap ? () => onPlayerTap(rp.playerId) : undefined}
              />
            </div>
          );
        })}
      </div>

      {/* Back Row Label */}
      <div className="relative text-center text-xs text-white/60 mt-2 mb-2 font-semibold uppercase tracking-wider">
        Back Row (Service)
      </div>

      {/* Back Row: Positions 5, 6, 1 */}
      <div className="relative grid grid-cols-3 gap-3 justify-items-center">
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
                isServing={rp.playerId === servingPlayerId}
                onTap={onPlayerTap ? () => onPlayerTap(rp.playerId) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
