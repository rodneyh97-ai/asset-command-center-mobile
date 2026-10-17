'use client';

import { useState, useEffect } from 'react';
import { useTournamentStore } from '@/stores/tournament-store';
import { matchEventRepo } from '@/db/database';
import { rebuildState } from '@/domain/event-sourcing';
import type {
  Tournament,
  TournamentMatch,
  TournamentStandings,
  CrossMatchStats,
  Player,
  Match,
  MatchState,
  TournamentStatus,
} from '@/domain/types';

interface TournamentDetailProps {
  tournament: Tournament;
  players: Player[];
  teamMatches: Match[];
  onBack: () => void;
}

type Tab = 'schedule' | 'standings' | 'stats';

const formatLabels: Record<string, string> = {
  'pool-play': 'Pool Play',
  'bracket': 'Bracket',
  'pool-to-bracket': 'Pool + Bracket',
};

export default function TournamentDetail({ tournament, players, teamMatches, onBack }: TournamentDetailProps) {
  const {
    tournamentMatches,
    addTournamentMatch,
    updateTournamentMatch,
    deleteTournamentMatch,
    recordResult,
    updateTournament,
    getPoolStandings,
    getCrossMatchStats,
    loadMatchesForTournament,
  } = useTournamentStore();

  const [tab, setTab] = useState<Tab>('schedule');
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [newOpp, setNewOpp] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newCourt, setNewCourt] = useState('');
  const [newPhase, setNewPhase] = useState<'pool' | 'bracket'>('pool');
  const [newBracketRound, setNewBracketRound] = useState('');
  const [matchStates, setMatchStates] = useState<MatchState[]>([]);
  const [editingResult, setEditingResult] = useState<string | null>(null);
  const [editSetsWon, setEditSetsWon] = useState(0);
  const [editSetsLost, setEditSetsLost] = useState(0);

  useEffect(() => {
    loadMatchesForTournament(tournament.id);
  }, [tournament.id, loadMatchesForTournament]);

  useEffect(() => {
    const loadStates = async () => {
      const states: MatchState[] = [];
      for (const tm of tournamentMatches) {
        if (tm.matchId) {
          const events = await matchEventRepo.getByMatch(tm.matchId);
          if (events.length > 0) {
            const rebuilt = rebuildState(events);
            if (rebuilt) states.push(rebuilt);
          }
        }
      }
      setMatchStates(states);
    };
    loadStates();
  }, [tournamentMatches]);

  const handleAddMatch = async () => {
    if (!newOpp.trim()) return;
    await addTournamentMatch({
      tournamentId: tournament.id,
      opponentName: newOpp.trim(),
      scheduledTime: newTime || undefined,
      courtNumber: newCourt.trim() || undefined,
      phase: newPhase,
      bracketRound: newPhase === 'bracket' ? newBracketRound.trim() || undefined : undefined,
    });
    setNewOpp('');
    setNewTime('');
    setNewCourt('');
    setNewBracketRound('');
    setShowAddMatch(false);
  };

  const handleRecordResult = async (matchId: string) => {
    await recordResult(matchId, editSetsWon, editSetsLost);
    setEditingResult(null);

    // Auto-update tournament status
    const allMatches = useTournamentStore.getState().tournamentMatches;
    const hasPlayed = allMatches.some((m) => m.result !== 'pending');
    const allPlayed = allMatches.every((m) => m.result !== 'pending');
    let newStatus: TournamentStatus = tournament.status;
    if (allPlayed && allMatches.length > 0) newStatus = 'completed';
    else if (hasPlayed) newStatus = 'in-progress';
    if (newStatus !== tournament.status) {
      await updateTournament({ ...tournament, status: newStatus });
    }
  };

  const standings = getPoolStandings();
  const crossStats = getCrossMatchStats(matchStates);
  const getPlayer = (id: string) => players.find((p) => p.id === id);

  const poolMatches = tournamentMatches.filter((m) => m.phase === 'pool');
  const bracketMatches = tournamentMatches.filter((m) => m.phase === 'bracket');

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'schedule', label: 'Schedule', icon: '📋' },
    { key: 'standings', label: 'Standings', icon: '🏆' },
    { key: 'stats', label: 'Stats', icon: '📊' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-slate-800/95 backdrop-blur border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={onBack}
            className="text-blue-400 hover:text-blue-300 text-sm touch-manipulation min-h-[44px] flex items-center gap-1"
          >
            <span className="text-lg">{'<'}</span> Tournaments
          </button>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            tournament.status === 'in-progress'
              ? 'bg-green-500/15 text-green-400'
              : tournament.status === 'completed'
                ? 'bg-slate-700 text-slate-400'
                : 'bg-blue-500/15 text-blue-400'
          }`}>
            {tournament.status === 'in-progress' ? 'Live' : tournament.status === 'completed' ? 'Completed' : 'Upcoming'}
          </span>
        </div>

        <h1 className="text-lg font-bold text-white">{tournament.name}</h1>
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
          <span>{new Date(tournament.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          <span className="text-slate-600">{'·'}</span>
          <span>{formatLabels[tournament.format]}</span>
          {tournament.poolName && (
            <>
              <span className="text-slate-600">{'·'}</span>
              <span className="text-blue-400">{tournament.poolName}</span>
            </>
          )}
          {tournament.location && (
            <>
              <span className="text-slate-600">{'·'}</span>
              <span>{tournament.location}</span>
            </>
          )}
        </div>

        {/* Quick record */}
        <div className="flex items-center gap-3 mt-2 text-sm">
          <span className="text-emerald-400 font-medium">
            {tournamentMatches.filter((m) => m.result === 'win').length}W
          </span>
          <span className="text-red-400 font-medium">
            {tournamentMatches.filter((m) => m.result === 'loss').length}L
          </span>
          <span className="text-slate-500">
            {tournamentMatches.filter((m) => m.result === 'pending').length} remaining
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium touch-manipulation transition-colors ${
                tab === t.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700/50 text-slate-400 hover:text-white'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {tab === 'schedule' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Matches ({tournamentMatches.length})
              </h2>
              <button
                onClick={() => setShowAddMatch(true)}
                className="text-sm text-blue-400 hover:text-blue-300 touch-manipulation"
              >
                + Add Match
              </button>
            </div>

            {/* Pool Matches */}
            {poolMatches.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-2">Pool Play</h3>
                <div className="space-y-2">
                  {poolMatches.map((m) => (
                    <MatchRow
                      key={m.id}
                      match={m}
                      onRecordResult={(id) => {
                        setEditingResult(id);
                        setEditSetsWon(m.setsWon);
                        setEditSetsLost(m.setsLost);
                      }}
                      onDelete={(id) => deleteTournamentMatch(id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Bracket Matches */}
            {bracketMatches.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-wide mb-2">Bracket</h3>
                <div className="space-y-2">
                  {bracketMatches.map((m) => (
                    <MatchRow
                      key={m.id}
                      match={m}
                      onRecordResult={(id) => {
                        setEditingResult(id);
                        setEditSetsWon(m.setsWon);
                        setEditSetsLost(m.setsLost);
                      }}
                      onDelete={(id) => deleteTournamentMatch(id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {tournamentMatches.length === 0 && (
              <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center">
                <div className="text-3xl mb-2">📋</div>
                <p className="text-sm text-slate-500">No matches yet. Add your first match to the schedule.</p>
              </div>
            )}
          </div>
        )}

        {tab === 'standings' && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Pool Standings</h2>
            {standings.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No pool play results yet.</p>
            ) : (
              <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700/50">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 uppercase border-b border-slate-700">
                      <th className="text-left p-3">#</th>
                      <th className="text-left p-3">Team</th>
                      <th className="text-center p-3">W</th>
                      <th className="text-center p-3">L</th>
                      <th className="text-center p-3">Sets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, i) => (
                      <tr
                        key={s.teamName}
                        className={`border-b border-slate-700/30 ${s.isUs ? 'bg-blue-500/10' : ''}`}
                      >
                        <td className="p-3 text-slate-500">{i + 1}</td>
                        <td className="p-3 font-medium text-white">
                          {s.teamName}
                          {s.isUs && <span className="ml-1.5 text-xs text-blue-400">(you)</span>}
                        </td>
                        <td className="p-3 text-center text-emerald-400 font-medium">{s.wins}</td>
                        <td className="p-3 text-center text-red-400 font-medium">{s.losses}</td>
                        <td className="p-3 text-center text-slate-300">{s.setsWon}-{s.setsLost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'stats' && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
              Cross-Match Player Stats
            </h2>
            {crossStats.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                Link live matches to this tournament to see aggregated stats.
              </p>
            ) : (
              <div className="space-y-2">
                {crossStats.map((cs) => {
                  const player = getPlayer(cs.playerId);
                  if (!player) return null;
                  const attempts = cs.totalKills + cs.totalAttackErrors;
                  const hitPct = attempts > 0 ? ((cs.totalKills - cs.totalAttackErrors) / attempts) : null;
                  const pm = cs.totalPointsOnCourt - cs.totalPointsAgainstOnCourt;
                  return (
                    <div key={cs.playerId} className="bg-slate-800 rounded-xl border border-slate-700/50 p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-bold text-white">#{player.jerseyNumber}</span>
                        <span className="text-sm text-slate-300">{player.displayName}</span>
                        <span className="text-xs text-slate-500 ml-auto">{cs.matchCount} match{cs.matchCount !== 1 ? 'es' : ''}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <StatCell label="Kills" value={cs.totalKills} color="text-emerald-400" />
                        <StatCell label="Aces" value={cs.totalAces} color="text-blue-400" />
                        <StatCell label="Digs" value={cs.totalDigs} color="text-amber-400" />
                        <StatCell label="Blocks" value={cs.totalBlocks} color="text-orange-400" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center mt-2">
                        <StatCell label="Hit %" value={hitPct !== null ? `${(hitPct * 100).toFixed(0)}%` : '—'} color="text-slate-300" />
                        <StatCell label="Assists" value={cs.totalAssists} color="text-teal-400" />
                        <StatCell
                          label="+/-"
                          value={`${pm >= 0 ? '+' : ''}${pm}`}
                          color={pm >= 0 ? 'text-emerald-400' : 'text-red-400'}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Match Modal */}
      {showAddMatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Add Match</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Opponent</label>
                <input
                  type="text"
                  value={newOpp}
                  onChange={(e) => setNewOpp(e.target.value)}
                  placeholder="Team name"
                  className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Time</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Court</label>
                  <input
                    type="text"
                    value={newCourt}
                    onChange={(e) => setNewCourt(e.target.value)}
                    placeholder="e.g. Court 3"
                    className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
                  />
                </div>
              </div>
              {(tournament.format === 'pool-to-bracket' || tournament.format === 'bracket') && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Phase</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setNewPhase('pool')}
                      className={`py-2.5 rounded-lg text-sm font-medium ${
                        newPhase === 'pool' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      Pool
                    </button>
                    <button
                      onClick={() => setNewPhase('bracket')}
                      className={`py-2.5 rounded-lg text-sm font-medium ${
                        newPhase === 'bracket' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      Bracket
                    </button>
                  </div>
                </div>
              )}
              {newPhase === 'bracket' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Round</label>
                  <input
                    type="text"
                    value={newBracketRound}
                    onChange={(e) => setNewBracketRound(e.target.value)}
                    placeholder="e.g. Quarterfinal, Semifinal, Final"
                    className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowAddMatch(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMatch}
                disabled={!newOpp.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-3 rounded-xl font-medium text-sm"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Result Modal */}
      {editingResult && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">Record Result</h2>
            <div className="flex items-center justify-center gap-6 mb-6">
              <div className="text-center">
                <label className="block text-xs text-slate-400 mb-2">Us</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditSetsWon(Math.max(0, editSetsWon - 1))}
                    className="w-10 h-10 rounded-lg bg-slate-700 text-white text-lg font-bold touch-manipulation"
                  >
                    -
                  </button>
                  <span className="text-3xl font-bold text-white w-8 text-center">{editSetsWon}</span>
                  <button
                    onClick={() => setEditSetsWon(editSetsWon + 1)}
                    className="w-10 h-10 rounded-lg bg-slate-700 text-white text-lg font-bold touch-manipulation"
                  >
                    +
                  </button>
                </div>
              </div>
              <span className="text-2xl text-slate-500 font-bold">—</span>
              <div className="text-center">
                <label className="block text-xs text-slate-400 mb-2">Them</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditSetsLost(Math.max(0, editSetsLost - 1))}
                    className="w-10 h-10 rounded-lg bg-slate-700 text-white text-lg font-bold touch-manipulation"
                  >
                    -
                  </button>
                  <span className="text-3xl font-bold text-white w-8 text-center">{editSetsLost}</span>
                  <button
                    onClick={() => setEditSetsLost(editSetsLost + 1)}
                    className="w-10 h-10 rounded-lg bg-slate-700 text-white text-lg font-bold touch-manipulation"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setEditingResult(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRecordResult(editingResult)}
                className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-medium text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchRow({
  match,
  onRecordResult,
  onDelete,
}: {
  match: TournamentMatch;
  onRecordResult: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`bg-slate-800 rounded-xl border p-4 ${
      match.result === 'win'
        ? 'border-emerald-500/20 bg-emerald-500/5'
        : match.result === 'loss'
          ? 'border-red-500/20 bg-red-500/5'
          : 'border-slate-700/50'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">vs {match.opponentName}</span>
            {match.result !== 'pending' && (
              <span className={`text-sm font-bold ${
                match.result === 'win' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {match.result === 'win' ? 'W' : 'L'} {match.setsWon}-{match.setsLost}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
            {match.scheduledTime && <span>{match.scheduledTime}</span>}
            {match.courtNumber && <span>{match.courtNumber}</span>}
            {match.bracketRound && (
              <span className="text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                {match.bracketRound}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onRecordResult(match.id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium touch-manipulation ${
              match.result === 'pending'
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
          >
            {match.result === 'pending' ? 'Record' : 'Edit'}
          </button>
          <button
            onClick={() => {
              if (confirm('Remove this match?')) onDelete(match.id);
            }}
            className="px-2 py-2 rounded-lg text-xs text-slate-500 hover:text-red-400 touch-manipulation"
          >
            {'✕'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-slate-700/30 rounded-lg py-2 px-1">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-500 uppercase">{label}</div>
    </div>
  );
}
