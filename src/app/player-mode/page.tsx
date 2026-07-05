'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/stores/app-store';
import { useMatchStore } from '@/stores/match-store';
import { Player, RotationPosition } from '@/domain/types';
import { getCurrentServer, getNextRotations } from '@/domain/rotation-engine';
import PlayerRotationCard from '@/components/shared/PlayerRotationCard';
import { matchEventRepo } from '@/db/database';

function PlayerModeContent() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get('teamId') || '';
  const { players, matches, loadPlayersForTeam, loadMatchesForTeam, setActiveTeam } = useAppStore();
  const { state, initMatch, getCurrentSet, isLoaded } = useMatchStore();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (teamId) {
      setActiveTeam(teamId);
      loadPlayersForTeam(teamId);
      loadMatchesForTeam(teamId);
    }
  }, [teamId, setActiveTeam, loadPlayersForTeam, loadMatchesForTeam]);

  useEffect(() => {
    const resume = async () => {
      const inProgress = matches.find((m) => m.matchStatus === 'In Progress');
      if (inProgress && !isLoaded) {
        const events = await matchEventRepo.getByMatch(inProgress.id);
        if (events.length > 0) initMatch(inProgress.id, events);
      }
    };
    if (matches.length > 0) resume();
  }, [matches, isLoaded, initMatch]);

  const currentSet = getCurrentSet();

  if (!currentSet) {
    return (
      <main className="p-6 max-w-lg mx-auto text-center">
        <Link href="/" className="text-blue-400 text-sm">← Back</Link>
        <p className="text-slate-400 mt-8 text-lg">No active match. Start a match first.</p>
      </main>
    );
  }

  const courtPlayerIds = currentSet.courtPlayers.map((p) => p.playerId);
  const allMatchPlayers = players.filter(
    (p) => courtPlayerIds.includes(p.id) || currentSet.benchPlayerIds.includes(p.id)
  );

  const currentServer = getCurrentServer(currentSet.courtPlayers);
  const nextRotations = getNextRotations(currentSet.courtPlayers, 3);

  if (selectedPlayerId) {
    const player = players.find((p) => p.id === selectedPlayerId);
    if (!player) return null;

    return (
      <main className="p-6 max-w-sm mx-auto">
        <button
          onClick={() => setSelectedPlayerId(null)}
          className="text-blue-400 text-sm mb-4"
        >
          ← All Players
        </button>

        <PlayerRotationCard
          player={player}
          positions={currentSet.courtPlayers}
          rotationNumber={currentSet.currentRotation}
          isServing={currentServer === player.id}
        />

        {/* Next rotations for this player */}
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-medium text-slate-400">Upcoming Rotations</h3>
          {nextRotations.map((rot, i) => {
            const pp = rot.find((r) => r.playerId === selectedPlayerId);
            if (!pp) return null;
            const isFront = pp.position >= 2 && pp.position <= 4;
            const isNextServer = getCurrentServer(rot) === selectedPlayerId;
            return (
              <div key={i} className="bg-slate-800 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Rotation {currentSet.currentRotation + i + 1 > 6 ? (currentSet.currentRotation + i + 1) % 6 || 6 : currentSet.currentRotation + i + 1}</span>
                  <span className="text-xs text-slate-400 ml-2">
                    Position {pp.position} • {isFront ? 'Front' : 'Back'} Row
                  </span>
                </div>
                {isNextServer && (
                  <span className="text-xs bg-yellow-600 text-white px-2 py-0.5 rounded">SERVE</span>
                )}
              </div>
            );
          })}
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-blue-400 text-sm">← Back</Link>
        <h1 className="text-xl font-bold">Player Mode</h1>
        <div className="text-xs text-slate-400">R{currentSet.currentRotation}</div>
      </div>

      <p className="text-sm text-slate-400 mb-4">Tap your number to see your position.</p>

      <div className="grid grid-cols-3 gap-3">
        {allMatchPlayers
          .sort((a, b) => a.jerseyNumber - b.jerseyNumber)
          .map((player) => {
            const onCourt = courtPlayerIds.includes(player.id);
            return (
              <button
                key={player.id}
                onClick={() => setSelectedPlayerId(player.id)}
                className={`rounded-xl p-4 text-center touch-manipulation transition-colors ${
                  onCourt
                    ? 'bg-slate-700 hover:bg-slate-600'
                    : 'bg-slate-800/50 hover:bg-slate-700 opacity-60'
                }`}
                aria-label={`${player.displayName} number ${player.jerseyNumber}`}
              >
                <div className="text-3xl font-bold">{player.jerseyNumber}</div>
                <div className="text-xs text-slate-400 mt-1 truncate">{player.displayName}</div>
                {!onCourt && <div className="text-[10px] text-slate-500 mt-1">Bench</div>}
              </button>
            );
          })}
      </div>
    </main>
  );
}

export default function PlayerModePage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading...</div>}>
      <PlayerModeContent />
    </Suspense>
  );
}
