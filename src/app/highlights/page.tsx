'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/stores/app-store';
import { useHighlightStore } from '@/stores/highlight-store';
import { useFilmStore } from '@/stores/film-store';
import HighlightReelDetail from '@/components/highlight/HighlightReelDetail';
import type { HighlightReel, FilmClip } from '@/domain/types';

function HighlightsContent() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get('teamId') || '';
  const { matches, players, loadMatchesForTeam, loadPlayersForTeam, setActiveTeam } = useAppStore();
  const { reels, activeReel, loadReelsForTeam, setActiveReel, createReel, deleteReel, generatePlayerReel } = useHighlightStore();
  const { clips, loadClipsForMatch } = useFilmStore();

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [matchClips, setMatchClips] = useState<FilmClip[]>([]);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [showAutoGen, setShowAutoGen] = useState(false);
  const [allClips, setAllClips] = useState<FilmClip[]>([]);

  useEffect(() => {
    if (teamId) {
      setActiveTeam(teamId);
      loadMatchesForTeam(teamId);
      loadPlayersForTeam(teamId);
      loadReelsForTeam(teamId);
    }
  }, [teamId, setActiveTeam, loadMatchesForTeam, loadPlayersForTeam, loadReelsForTeam]);

  useEffect(() => {
    if (selectedMatchId) {
      loadClipsForMatch(selectedMatchId);
    }
  }, [selectedMatchId, loadClipsForMatch]);

  useEffect(() => {
    setMatchClips(clips);
  }, [clips]);

  useEffect(() => {
    async function loadAll() {
      if (!teamId || matches.length === 0) return;
      const { filmClipRepo } = await import('@/db/database');
      const all: FilmClip[] = [];
      for (const m of matches) {
        const mc = await filmClipRepo.getByMatch(m.id);
        all.push(...mc);
      }
      setAllClips(all);
    }
    loadAll();
  }, [teamId, matches]);

  const handleCreate = async () => {
    if (!title.trim() || !teamId) return;
    await createReel({
      teamId,
      title: title.trim(),
      description: description.trim(),
      clipIds: selectedClipIds,
      matchId: selectedMatchId || undefined,
      playerId: selectedPlayerId || undefined,
    });
    setTitle('');
    setDescription('');
    setSelectedMatchId('');
    setSelectedPlayerId('');
    setSelectedClipIds([]);
    setShowCreate(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this highlight reel?')) {
      await deleteReel(id);
    }
  };

  const handleAutoGenPlayer = async (playerId: string) => {
    const player = players.find((p) => p.id === playerId);
    if (!player || !teamId) return;
    await generatePlayerReel(teamId, playerId, `#${player.jerseyNumber} ${player.displayName}`);
    setShowAutoGen(false);
  };

  const toggleClipSelection = (clipId: string) => {
    setSelectedClipIds((prev) =>
      prev.includes(clipId) ? prev.filter((id) => id !== clipId) : [...prev, clipId]
    );
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

  if (activeReel) {
    const match = matches.find((m) => m.id === activeReel.matchId);
    return (
      <HighlightReelDetail
        reel={activeReel}
        match={match}
        players={players}
        allClips={allClips}
        onBack={() => setActiveReel(null)}
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
          <h1 className="text-2xl font-bold">Highlight Reels</h1>
          <p className="text-sm text-slate-400 mt-0.5">Build and share highlight compilations</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAutoGen(true)}
            className="bg-purple-600 hover:bg-purple-500 px-4 py-2.5 rounded-xl text-sm font-medium touch-manipulation active:scale-95 transition-transform"
          >
            Auto-Generate
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2.5 rounded-xl text-sm font-medium touch-manipulation active:scale-95 transition-transform"
          >
            + New Reel
          </button>
        </div>
      </div>

      {/* Auto-generate modal */}
      {showAutoGen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Auto-Generate Player Reel</h2>
            <p className="text-sm text-slate-400 mb-4">
              Select a player to automatically create a highlight reel from their tagged film clips.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleAutoGenPlayer(p.id)}
                  className="w-full text-left bg-slate-700 hover:bg-slate-600 rounded-xl p-3 flex items-center gap-3 transition-colors"
                >
                  <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center font-bold text-sm">
                    {p.jerseyNumber}
                  </div>
                  <div>
                    <div className="font-medium">{p.displayName}</div>
                    <div className="text-xs text-slate-400">{p.primaryRole}</div>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAutoGen(false)}
              className="w-full mt-4 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-medium text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">New Highlight Reel</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Best Kills - Pool Play"
                  className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this reel about?"
                  rows={2}
                  className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Match (optional — filters clips)</label>
                <select
                  value={selectedMatchId}
                  onChange={(e) => setSelectedMatchId(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm min-h-[44px]"
                >
                  <option value="">All matches</option>
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      vs {m.opponentName} — {new Date(m.createdAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Player focus (optional)</label>
                <select
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm min-h-[44px]"
                >
                  <option value="">No specific player</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.jerseyNumber} {p.displayName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clip selection */}
              {matchClips.length > 0 && selectedMatchId && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Select Clips ({selectedClipIds.length} selected)
                  </label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {matchClips.map((clip) => (
                      <button
                        key={clip.id}
                        onClick={() => toggleClipSelection(clip.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedClipIds.includes(clip.id)
                            ? 'bg-blue-600/30 border border-blue-500/50'
                            : 'bg-slate-700 hover:bg-slate-600'
                        }`}
                      >
                        <span className="font-mono text-xs text-blue-400">
                          {Math.floor(clip.startSeconds / 60)}:{String(Math.floor(clip.startSeconds % 60)).padStart(2, '0')}
                        </span>{' '}
                        {clip.label}
                      </button>
                    ))}
                  </div>
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
                disabled={!title.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-3 rounded-xl font-medium text-sm"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reel list */}
      {reels.length === 0 ? (
        <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">🎞️</div>
          <h3 className="text-lg font-semibold text-slate-300 mb-1">No Highlight Reels</h3>
          <p className="text-sm text-slate-500">Create a reel or auto-generate one from player clips.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reels.map((reel) => {
            const match = matches.find((m) => m.id === reel.matchId);
            const player = reel.playerId ? players.find((p) => p.id === reel.playerId) : null;
            return (
              <div
                key={reel.id}
                className="bg-slate-800 rounded-xl border border-slate-700/50 hover:border-slate-600/50 transition-all overflow-hidden"
              >
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveReel(reel.id)}
                    className="flex-1 text-left p-4 flex items-center gap-3 touch-manipulation min-h-[64px]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-yellow-500/15 flex items-center justify-center text-lg flex-shrink-0">
                      🎞️
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate">{reel.title}</div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">{reel.clipIds.length} clips</span>
                        {match && <span className="text-xs text-slate-400">vs {match.opponentName}</span>}
                        {player && (
                          <span className="text-xs text-slate-400">
                            #{player.jerseyNumber} {player.displayName}
                          </span>
                        )}
                        {reel.isAutoGenerated && (
                          <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">Auto</span>
                        )}
                      </div>
                    </div>
                    <span className="text-slate-500 text-sm flex-shrink-0">{'>'}</span>
                  </button>
                  <button
                    onClick={() => handleDelete(reel.id)}
                    className="text-red-400 hover:text-red-300 text-xs px-3 py-2 flex-shrink-0"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default function HighlightsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading...</div>}>
      <HighlightsContent />
    </Suspense>
  );
}
