'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useMatchStore } from '@/stores/match-store';
import { Player, AvailabilityStatus, RulesetProfile } from '@/domain/types';
import { getCurrentServer, getNextServer } from '@/domain/rotation-engine';
import { getSetPointInfo } from '@/domain/substitution-validation';
import VolleyballCourt from '@/components/court/VolleyballCourt';
import SubstitutionPanel from './SubstitutionPanel';
import LiberoPanel from './LiberoPanel';
import PlayerStatusPanel from './PlayerStatusPanel';
import RotationPreview from './RotationPreview';
import CorrectMatchState from './CorrectMatchState';
import MatchHistory from './MatchHistory';
import StatRecorder from './StatRecorder';
import StatsExportPanel from './StatsExportPanel';
import HighlightSummary from './HighlightSummary';

interface LiveMatchDashboardProps {
  players: Player[];
  opponentName: string;
  teamName?: string;
  liberoIds?: string[];
  ruleset?: RulesetProfile;
  setsToWin?: number;
}

type ActivePanel = null | 'substitute' | 'libero' | 'playerStatus' | 'rotationPreview' | 'correct' | 'history' | 'stats' | 'highlights';

export default function LiveMatchDashboard({
  players,
  opponentName,
  teamName,
  liberoIds = [],
  ruleset,
  setsToWin = 3,
}: LiveMatchDashboardProps) {
  const {
    state,
    scoreOurPoint,
    scoreOpponentPoint,
    takeTimeout,
    confirmSubstitution,
    liberoReplacement,
    changePlayerAvailability,
    applyCorrection,
    undo,
    redo,
    canUndo,
    canRedo,
    getCurrentSet,
    endSet,
    endMatch,
    recordStat,
  } = useMatchStore();

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [ourFlash, setOurFlash] = useState(false);
  const [theirFlash, setTheirFlash] = useState(false);
  const currentSet = getCurrentSet();

  const handleOurPoint = useCallback(() => {
    scoreOurPoint();
    setOurFlash(true);
    setTimeout(() => setOurFlash(false), 250);
  }, [scoreOurPoint]);

  const handleTheirPoint = useCallback(() => {
    scoreOpponentPoint();
    setTheirFlash(true);
    setTimeout(() => setTheirFlash(false), 250);
  }, [scoreOpponentPoint]);

  if (!state || !currentSet) {
    return <div className="p-8 text-center text-slate-400">No active match.</div>;
  }

  const currentServer = getCurrentServer(currentSet.courtPlayers);
  const nextServer = getNextServer(currentSet.courtPlayers);
  const serverPlayer = players.find((p) => p.id === currentServer);
  const nextServerPlayer = players.find((p) => p.id === nextServer);

  const displayTeamName = teamName || 'Us';

  // Compute set history from completed sets
  const completedSets = state.sets.filter((_, i) => i < state.currentSetIndex);
  const setsWon = completedSets.filter((s) => s.ourScore > s.opponentScore).length;
  const setsLost = completedSets.filter((s) => s.opponentScore > s.ourScore).length;

  // Ruleset-aware set/match point detection
  const isDecidingSet = setsWon === setsToWin - 1 || setsLost === setsToWin - 1;
  const targetScore = ruleset
    ? (isDecidingSet ? ruleset.decidingSetTargetScore : ruleset.setTargetScore)
    : 25;
  const winByTwo = ruleset?.winByTwo ?? true;
  const setPointInfo = getSetPointInfo(currentSet.ourScore, currentSet.opponentScore, targetScore, winByTwo);
  const isMatchPointForUs = setPointInfo?.team === 'us' && setsWon === setsToWin - 1;
  const isMatchPointForThem = setPointInfo?.team === 'opponent' && setsLost === setsToWin - 1;
  const matchPointStatus = isMatchPointForUs ? 'us' : isMatchPointForThem ? 'opponent' : null;
  const setPointStatus = !matchPointStatus ? setPointInfo?.team ?? null : null;

  // Find active libero info for the status bar
  const activeLiberoPlayer = currentSet.activeLiberoId
    ? players.find((p) => p.id === currentSet.activeLiberoId)
    : null;
  const replacedPlayer = currentSet.liberoReplacedPlayerId
    ? players.find((p) => p.id === currentSet.liberoReplacedPlayerId)
    : null;
  const liberoPlayers = players.filter((p) => liberoIds.includes(p.id));

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-4 p-4 h-full">
        {/* Left: Scoreboard & Controls */}
        <div className="flex flex-col gap-4 lg:w-1/3">
          {/* Set History */}
          {completedSets.length > 0 && (
            <div className="bg-slate-800 rounded-xl px-4 py-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">Sets: {setsWon}-{setsLost}</span>
              <div className="flex gap-2 text-xs text-slate-400">
                {completedSets.map((s, i) => (
                  <span key={i} className={s.ourScore > s.opponentScore ? 'text-green-400' : 'text-red-400'}>
                    {s.ourScore}-{s.opponentScore}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Score */}
          <div className="bg-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Set {currentSet.setNumber}</span>
              {/* Rotation number badge */}
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-700 text-white font-bold text-lg">
                {currentSet.currentRotation}
              </div>
            </div>

            {/* Match/Set point indicator */}
            {matchPointStatus && (
              <div className={`text-center text-sm font-bold mb-2 py-1.5 rounded-lg animate-pulse ${
                matchPointStatus === 'us' ? 'bg-green-700/50 text-green-300 border border-green-500/30' : 'bg-red-700/50 text-red-300 border border-red-500/30'
              }`}>
                MATCH POINT {matchPointStatus === 'us' ? displayTeamName.toUpperCase() : opponentName.toUpperCase()}
              </div>
            )}
            {setPointStatus && (
              <div className={`text-center text-xs font-semibold mb-2 py-1 rounded ${
                setPointStatus === 'us' ? 'bg-blue-700/40 text-blue-300' : 'bg-amber-700/40 text-amber-300'
              }`}>
                SET POINT {setPointStatus === 'us' ? displayTeamName.toUpperCase() : opponentName.toUpperCase()}
              </div>
            )}

            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <div className={`text-5xl font-bold text-white ${ourFlash ? 'score-flash' : ''}`}>
                  {currentSet.ourScore}
                </div>
                <div className="text-sm text-slate-300 mt-1">{displayTeamName}</div>
                {currentSet.servingTeam === 'us' && (
                  <div className="text-xs text-yellow-400 mt-1">● Serving</div>
                )}
              </div>
              <div className="text-2xl text-slate-500">—</div>
              <div className="text-center">
                <div className={`text-5xl font-bold text-white ${theirFlash ? 'score-flash' : ''}`}>
                  {currentSet.opponentScore}
                </div>
                <div className="text-sm text-slate-300 mt-1">{opponentName}</div>
                {currentSet.servingTeam === 'opponent' && (
                  <div className="text-xs text-yellow-400 mt-1">● Serving</div>
                )}
              </div>
            </div>
          </div>

          {/* Server Info */}
          <div className="bg-slate-800 rounded-xl p-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Server:</span>
              <span className="text-white font-medium">
                {serverPlayer ? `#${serverPlayer.jerseyNumber} ${serverPlayer.displayName}` : '—'}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-400">Next:</span>
              <span className="text-slate-300">
                {nextServerPlayer
                  ? `#${nextServerPlayer.jerseyNumber} ${nextServerPlayer.displayName}`
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-400">Subs used:</span>
              <span className="text-slate-300">{currentSet.substitutionCount}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-400">Timeouts:</span>
              <span className="text-slate-300">
                {displayTeamName}: {currentSet.timeoutsUsed.us} | {opponentName}: {currentSet.timeoutsUsed.opponent}
              </span>
            </div>
          </div>

          {/* Libero Status Bar */}
          <div className="bg-slate-800 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-3 h-3 rounded-full ${activeLiberoPlayer ? 'bg-green-400' : 'bg-slate-500'}`} />
              <span className="text-sm font-medium text-slate-300">Libero</span>
              {activeLiberoPlayer ? (
                <span className="text-sm text-emerald-300 ml-auto">
                  #{activeLiberoPlayer.jerseyNumber} {activeLiberoPlayer.displayName} ON
                  {replacedPlayer && (
                    <span className="text-slate-400"> (for #{replacedPlayer.jerseyNumber})</span>
                  )}
                </span>
              ) : (
                <span className="text-sm text-slate-500 ml-auto">
                  {liberoPlayers.length > 0
                    ? `${liberoPlayers.map((p) => `#${p.jerseyNumber}`).join(', ')} on bench`
                    : 'None designated'}
                </span>
              )}
            </div>
          </div>

          {/* Primary Actions - larger on iPad */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleOurPoint}
              className="bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-bold py-6 lg:py-8 rounded-xl text-lg lg:text-2xl touch-manipulation transition-colors"
            >
              {displayTeamName} Point
            </button>
            <button
              onClick={handleTheirPoint}
              className="bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold py-6 lg:py-8 rounded-xl text-lg lg:text-2xl touch-manipulation transition-colors"
            >
              Their Point
            </button>
          </div>

          {/* Quick Stat Recording */}
          <StatRecorder
            courtPlayers={currentSet.courtPlayers}
            players={players}
            onRecordStat={recordStat}
          />

          {/* Secondary Actions */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => takeTimeout('us')}
              className="bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg text-sm font-medium touch-manipulation"
            >
              Timeout
            </button>
            <button
              onClick={() => setActivePanel('substitute')}
              className="bg-blue-700 hover:bg-blue-600 text-white py-3 rounded-lg text-sm font-medium touch-manipulation"
            >
              Substitute
            </button>
            <button
              onClick={() => setActivePanel('libero')}
              className="bg-emerald-700 hover:bg-emerald-600 text-white py-3 rounded-lg text-sm font-medium touch-manipulation"
            >
              Libero
            </button>
          </div>

          {/* Tertiary Actions */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => setActivePanel('stats')}
              className="bg-indigo-700 hover:bg-indigo-600 text-white py-2 rounded-lg text-xs font-medium touch-manipulation"
            >
              Stats
            </button>
            <button
              onClick={() => setActivePanel('playerStatus')}
              className="bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-xs font-medium touch-manipulation"
            >
              Status
            </button>
            <button
              onClick={() => setActivePanel('rotationPreview')}
              className="bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-xs font-medium touch-manipulation"
            >
              Rotations
            </button>
            <button
              onClick={() => setActivePanel('correct')}
              className="bg-amber-800 hover:bg-amber-700 text-white py-2 rounded-lg text-xs font-medium touch-manipulation"
            >
              Correct
            </button>
          </div>

          {/* Match Controls */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setActivePanel('history')}
              className="bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-xs font-medium touch-manipulation"
            >
              History
            </button>
            <button
              onClick={() => setActivePanel('highlights')}
              className="bg-purple-700 hover:bg-purple-600 text-white py-2 rounded-lg text-xs font-medium touch-manipulation"
            >
              Highlights
            </button>
            <button
              onClick={() => {
                if (confirm('End this set?')) endSet();
              }}
              className="bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-xs font-medium touch-manipulation"
            >
              End Set
            </button>
          </div>

          {/* Undo/Redo - less prominent, at the bottom */}
          <div className="grid grid-cols-2 gap-2 opacity-70">
            <button
              onClick={undo}
              disabled={!canUndo()}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded-lg text-xs font-medium touch-manipulation border border-slate-600"
            >
              ← Undo
            </button>
            <button
              onClick={redo}
              disabled={!canRedo()}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded-lg text-xs font-medium touch-manipulation border border-slate-600"
            >
              Redo →
            </button>
          </div>
        </div>

        {/* Right: Court */}
        <div className="flex-1 flex flex-col gap-4">
          <VolleyballCourt
            positions={currentSet.courtPlayers}
            players={players}
            activeLiberoId={currentSet.activeLiberoId}
          />

          {/* Bench */}
          <div className="bg-slate-800 rounded-xl p-3">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Bench</h3>
            <div className="flex flex-wrap gap-2">
              {currentSet.benchPlayerIds.map((id) => {
                const player = players.find((p) => p.id === id);
                if (!player) return null;
                const availability = currentSet.playerAvailability.find((a) => a.playerId === id);
                const isOut =
                  availability?.status === 'Out for set' ||
                  availability?.status === 'Out for match';
                return (
                  <div
                    key={id}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      isOut
                        ? 'bg-red-900/30 text-red-300 line-through'
                        : 'bg-slate-700 text-white'
                    }`}
                  >
                    <span className="font-bold">#{player.jerseyNumber}</span>{' '}
                    <span className="text-slate-300">{player.displayName}</span>
                    {availability && availability.status !== 'Available' && (
                      <span className="ml-1 text-xs text-yellow-400">
                        ({availability.status})
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event Log */}
          <div className="bg-slate-800 rounded-xl p-3 max-h-32 overflow-y-auto">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Recent Actions</h3>
            <div className="space-y-1">
              {state.eventLog
                .filter((e) => !e.undone)
                .slice(-5)
                .reverse()
                .map((event) => (
                  <div key={event.id} className="text-xs text-slate-300">
                    <span className="text-slate-500">
                      {new Date(event.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>{' '}
                    {event.eventType}
                    {event.auditNote && (
                      <span className="text-amber-400 ml-1">({event.auditNote})</span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Panels */}
      {activePanel === 'substitute' && (
        <SubstitutionPanel
          courtPlayers={currentSet.courtPlayers}
          benchPlayerIds={currentSet.benchPlayerIds.filter((id) => {
            const a = currentSet.playerAvailability.find((p) => p.playerId === id);
            return !a || (a.status !== 'Out for set' && a.status !== 'Out for match');
          })}
          players={players}
          substitutionCount={currentSet.substitutionCount}
          playerStats={currentSet.playerStats}
          ruleset={ruleset}
          substitutionHistory={currentSet.substitutionHistory}
          onConfirm={(outId, inId) => {
            confirmSubstitution(outId, inId);
            setActivePanel(null);
          }}
          onClose={() => setActivePanel(null)}
        />
      )}

      {activePanel === 'libero' && (
        <LiberoPanel
          courtPlayers={currentSet.courtPlayers}
          players={players}
          liberoIds={liberoIds}
          activeLiberoId={currentSet.activeLiberoId}
          liberoReplacedPlayerId={currentSet.liberoReplacedPlayerId}
          onLiberoIn={(lId, rId) => {
            liberoReplacement(lId, rId, true);
            setActivePanel(null);
          }}
          onLiberoOut={(lId, rId) => {
            liberoReplacement(lId, rId, false);
            setActivePanel(null);
          }}
          onClose={() => setActivePanel(null)}
        />
      )}

      {activePanel === 'playerStatus' && (
        <PlayerStatusPanel
          players={players}
          courtPlayerIds={currentSet.courtPlayers.map((p) => p.playerId)}
          benchPlayerIds={currentSet.benchPlayerIds}
          currentAvailability={currentSet.playerAvailability}
          onStatusChange={(playerId, status, reason) => {
            changePlayerAvailability(playerId, status, reason);
          }}
          onClose={() => setActivePanel(null)}
        />
      )}

      {activePanel === 'rotationPreview' && (
        <RotationPreview
          currentPositions={currentSet.courtPlayers}
          players={players}
          onClose={() => setActivePanel(null)}
        />
      )}

      {activePanel === 'correct' && (
        <CorrectMatchState
          currentOurScore={currentSet.ourScore}
          currentOpponentScore={currentSet.opponentScore}
          currentServingTeam={currentSet.servingTeam}
          currentRotation={currentSet.currentRotation}
          currentSubCount={currentSet.substitutionCount}
          onApply={(corrections, note) => {
            applyCorrection(corrections, note);
            setActivePanel(null);
          }}
          onClose={() => setActivePanel(null)}
        />
      )}

      {activePanel === 'history' && (
        <MatchHistory
          events={state.eventLog}
          players={players}
          onClose={() => setActivePanel(null)}
        />
      )}

      {activePanel === 'stats' && (
        <StatsExportPanel
          players={players}
          sets={state.sets}
          currentSetIndex={state.currentSetIndex}
          opponentName={opponentName}
          onClose={() => setActivePanel(null)}
        />
      )}

      {activePanel === 'highlights' && (
        <HighlightSummary
          players={players}
          events={state.eventLog}
          sets={state.sets}
          teamName={displayTeamName}
          opponentName={opponentName}
          onClose={() => setActivePanel(null)}
        />
      )}
    </>
  );
}
