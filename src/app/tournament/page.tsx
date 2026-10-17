'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/stores/app-store';
import { useTournamentStore } from '@/stores/tournament-store';
import type { TournamentFormat, Tournament, TournamentMatch, MatchState } from '@/domain/types';
import { matchEventRepo } from '@/db/database';
import { rebuildState } from '@/domain/event-sourcing';
import TournamentDetail from '@/components/tournament/TournamentDetail';

function TournamentContent() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get('teamId') || '';
  const { players, matches, loadPlayersForTeam, loadMatchesForTeam, setActiveTeam } = useAppStore();
  const {
    tournaments,
    activeTournament,
    tournamentMatches,
    loadTournamentsForTeam,
    createTournament,
    setActiveTournament,
    deleteTournament,
  } = useTournamentStore();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [format, setFormat] = useState<TournamentFormat>('pool-play');
  const [poolName, setPoolName] = useState('');

  useEffect(() => {
    if (teamId) {
      setActiveTeam(teamId);
      loadPlayersForTeam(teamId);
      loadMatchesForTeam(teamId);
      loadTournamentsForTeam(teamId);
    }
  }, [teamId, setActiveTeam, loadPlayersForTeam, loadMatchesForTeam, loadTournamentsForTeam]);

  const handleCreate = async () => {
    if (!name.trim() || !startDate || !teamId) return;
    await createTournament({
      teamId,
      name: name.trim(),
      location: location.trim(),
      startDate,
      endDate: endDate || startDate,
      format,
      poolName: poolName.trim() || undefined,
    });
    setName('');
    setLocation('');
    setStartDate('');
    setEndDate('');
    setFormat('pool-play');
    setPoolName('');
    setShowCreate(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this tournament and all its matches?')) {
      await deleteTournament(id);
    }
  };

  if (!teamId) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 text-sm">
          {'<'} Back
        </Link>
        <p className="text-slate-400 mt-4">Select a team first from the dashboard.</p>
      </main>
    );
  }

  if (activeTournament) {
    return (
      <TournamentDetail
        tournament={activeTournament}
        players={players}
        teamMatches={matches}
        onBack={() => setActiveTournament(null)}
      />
    );
  }

  const upcoming = tournaments.filter((t) => t.status === 'upcoming');
  const inProgress = tournaments.filter((t) => t.status === 'in-progress');
  const completed = tournaments.filter((t) => t.status === 'completed');

  return (
    <main className="flex flex-col p-6 max-w-4xl mx-auto w-full">
      <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 text-sm">
        {'<'} Back to Dashboard
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tournaments</h1>
          <p className="text-sm text-slate-400 mt-0.5">Track pool play, brackets, and cross-match stats</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 hover:bg-blue-500 px-4 py-2.5 rounded-xl text-sm font-medium touch-manipulation active:scale-95 transition-transform"
        >
          + New Tournament
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">New Tournament</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Tournament Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Spring Classic 2024"
                  className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Sports Arena, City"
                  className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm min-h-[44px]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Format</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'pool-play', label: 'Pool Play' },
                    { value: 'bracket', label: 'Bracket' },
                    { value: 'pool-to-bracket', label: 'Pool → Bracket' },
                  ] as const).map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFormat(f.value)}
                      className={`py-2.5 rounded-lg text-sm font-medium touch-manipulation transition-colors ${
                        format === f.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              {(format === 'pool-play' || format === 'pool-to-bracket') && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Pool Name (optional)</label>
                  <input
                    type="text"
                    value={poolName}
                    onChange={(e) => setPoolName(e.target.value)}
                    placeholder="e.g. Pool A"
                    className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || !startDate}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-3 rounded-xl font-medium text-sm"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tournament Lists */}
      {tournaments.length === 0 ? (
        <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">🏆</div>
          <h3 className="text-lg font-semibold text-slate-300 mb-1">No Tournaments Yet</h3>
          <p className="text-sm text-slate-500">Create a tournament to track pool play, brackets, and stats across matches.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {inProgress.length > 0 && (
            <TournamentSection title="In Progress" tournaments={inProgress} onSelect={(id) => setActiveTournament(id)} onDelete={handleDelete} />
          )}
          {upcoming.length > 0 && (
            <TournamentSection title="Upcoming" tournaments={upcoming} onSelect={(id) => setActiveTournament(id)} onDelete={handleDelete} />
          )}
          {completed.length > 0 && (
            <TournamentSection title="Completed" tournaments={completed} onSelect={(id) => setActiveTournament(id)} onDelete={handleDelete} />
          )}
        </div>
      )}
    </main>
  );
}

function TournamentSection({
  title,
  tournaments,
  onSelect,
  onDelete,
}: {
  title: string;
  tournaments: Tournament[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const formatLabel: Record<TournamentFormat, string> = {
    'pool-play': 'Pool Play',
    'bracket': 'Bracket',
    'pool-to-bracket': 'Pool → Bracket',
  };

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">{title}</h2>
      <div className="space-y-2">
        {tournaments.map((t) => (
          <div
            key={t.id}
            className="bg-slate-800 rounded-xl border border-slate-700/50 hover:border-slate-600/50 transition-all overflow-hidden"
          >
            <button
              onClick={() => onSelect(t.id)}
              className="w-full text-left p-4 flex items-center gap-3 touch-manipulation min-h-[64px]"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                t.status === 'in-progress' ? 'bg-green-500/15' : t.status === 'completed' ? 'bg-slate-700' : 'bg-blue-500/15'
              }`}>
                {t.status === 'in-progress' ? '🔴' : t.status === 'completed' ? '✅' : '📅'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">{t.name}</div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-xs text-slate-400">
                    {new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {t.endDate !== t.startDate && ` - ${new Date(t.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </span>
                  <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">
                    {formatLabel[t.format]}
                  </span>
                  {t.poolName && (
                    <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                      {t.poolName}
                    </span>
                  )}
                  {t.location && (
                    <span className="text-xs text-slate-500">{t.location}</span>
                  )}
                </div>
              </div>
              <span className="text-slate-500 text-sm flex-shrink-0">{'>'}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TournamentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading...</div>}>
      <TournamentContent />
    </Suspense>
  );
}
