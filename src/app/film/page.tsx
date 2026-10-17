'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/stores/app-store';
import { useFilmStore } from '@/stores/film-store';
import type { FilmSession, FilmClip, ClipTag, Match, Player } from '@/domain/types';
import FilmReviewDetail from '@/components/film/FilmReviewDetail';

const TAG_COLORS: Record<ClipTag, string> = {
  highlight: 'bg-green-500/20 text-green-400',
  mistake: 'bg-red-500/20 text-red-400',
  tactical: 'bg-blue-500/20 text-blue-400',
  serve: 'bg-purple-500/20 text-purple-400',
  rally: 'bg-amber-500/20 text-amber-400',
  timeout: 'bg-slate-500/20 text-slate-400',
  custom: 'bg-cyan-500/20 text-cyan-400',
};

function FilmContent() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get('teamId') || '';
  const { matches, players, loadMatchesForTeam, loadPlayersForTeam, setActiveTeam } = useAppStore();
  const { sessions, activeSession, loadSessionsForTeam, createSession, deleteSession, setActiveSession } = useFilmStore();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [filmUrl, setFilmUrl] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (teamId) {
      setActiveTeam(teamId);
      loadMatchesForTeam(teamId);
      loadPlayersForTeam(teamId);
      loadSessionsForTeam(teamId);
    }
  }, [teamId, setActiveTeam, loadMatchesForTeam, loadPlayersForTeam, loadSessionsForTeam]);

  const handleCreate = async () => {
    if (!selectedMatchId || !filmUrl.trim() || !teamId) return;
    const match = matches.find((m) => m.id === selectedMatchId);
    await createSession({
      teamId,
      matchId: selectedMatchId,
      filmUrl: filmUrl.trim(),
      title: title.trim() || `Film Review - ${match?.opponentName || 'Unknown'}`,
    });
    setSelectedMatchId('');
    setFilmUrl('');
    setTitle('');
    setShowCreate(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this film session and all its clips?')) {
      await deleteSession(id);
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

  if (activeSession) {
    const match = matches.find((m) => m.id === activeSession.matchId);
    return (
      <FilmReviewDetail
        session={activeSession}
        match={match}
        players={players}
        onBack={() => setActiveSession(null)}
      />
    );
  }

  return (
    <main className="flex flex-col p-6 max-w-4xl mx-auto w-full">
      <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 text-sm">
        {'<'} Back to Dashboard
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Film Review</h1>
          <p className="text-sm text-slate-400 mt-0.5">Review match film and bookmark key moments</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 hover:bg-blue-500 px-4 py-2.5 rounded-xl text-sm font-medium touch-manipulation active:scale-95 transition-transform"
        >
          + New Session
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">New Film Session</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Match</label>
                <select
                  value={selectedMatchId}
                  onChange={(e) => setSelectedMatchId(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm min-h-[44px]"
                >
                  <option value="">Select a match...</option>
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      vs {m.opponentName} — {new Date(m.createdAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Film URL</label>
                <input
                  type="url"
                  value={filmUrl}
                  onChange={(e) => setFilmUrl(e.target.value)}
                  placeholder="https://www.hudl.com/video/..."
                  className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Title (optional)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Pool Play Game 1 Review"
                  className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
                />
              </div>
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
                disabled={!selectedMatchId || !filmUrl.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-3 rounded-xl font-medium text-sm"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session List */}
      {sessions.length === 0 ? (
        <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">🎬</div>
          <h3 className="text-lg font-semibold text-slate-300 mb-1">No Film Sessions</h3>
          <p className="text-sm text-slate-500">Create a session to review match film and bookmark key moments.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            const match = matches.find((m) => m.id === session.matchId);
            return (
              <div
                key={session.id}
                className="bg-slate-800 rounded-xl border border-slate-700/50 hover:border-slate-600/50 transition-all overflow-hidden"
              >
                <button
                  onClick={() => setActiveSession(session.id)}
                  className="w-full text-left p-4 flex items-center gap-3 touch-manipulation min-h-[64px]"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center text-lg flex-shrink-0">
                    🎥
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">{session.title}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {match && (
                        <span className="text-xs text-slate-400">vs {match.opponentName}</span>
                      )}
                      <span className="text-xs text-slate-500">
                        {new Date(session.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <span className="text-slate-500 text-sm flex-shrink-0">{'>'}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default function FilmPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading...</div>}>
      <FilmContent />
    </Suspense>
  );
}
