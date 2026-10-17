'use client';

import { useEffect, useState } from 'react';
import { useFilmStore } from '@/stores/film-store';
import type { FilmSession, FilmClip, ClipTag, Match, Player, MatchEvent } from '@/domain/types';
import { matchEventRepo } from '@/db/database';

interface Props {
  session: FilmSession;
  match?: Match;
  players: Player[];
  onBack: () => void;
}

const TAGS: { value: ClipTag; label: string; color: string }[] = [
  { value: 'highlight', label: 'Highlight', color: 'bg-green-600' },
  { value: 'mistake', label: 'Mistake', color: 'bg-red-600' },
  { value: 'tactical', label: 'Tactical', color: 'bg-blue-600' },
  { value: 'serve', label: 'Serve', color: 'bg-purple-600' },
  { value: 'rally', label: 'Rally', color: 'bg-amber-600' },
  { value: 'timeout', label: 'Timeout', color: 'bg-slate-600' },
  { value: 'custom', label: 'Custom', color: 'bg-cyan-600' },
];

const TAG_COLORS: Record<ClipTag, string> = {
  highlight: 'bg-green-500/20 text-green-400',
  mistake: 'bg-red-500/20 text-red-400',
  tactical: 'bg-blue-500/20 text-blue-400',
  serve: 'bg-purple-500/20 text-purple-400',
  rally: 'bg-amber-500/20 text-amber-400',
  timeout: 'bg-slate-500/20 text-slate-400',
  custom: 'bg-cyan-500/20 text-cyan-400',
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type TabId = 'clips' | 'timeline';

export default function FilmReviewDetail({ session, match, players, onBack }: Props) {
  const { clips, loadClipsForMatch, addClip, updateClip, deleteClip } = useFilmStore();
  const [tab, setTab] = useState<TabId>('clips');
  const [showAddClip, setShowAddClip] = useState(false);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);

  // Clip form
  const [clipStart, setClipStart] = useState('');
  const [clipEnd, setClipEnd] = useState('');
  const [clipTag, setClipTag] = useState<ClipTag>('highlight');
  const [clipLabel, setClipLabel] = useState('');
  const [clipPlayerId, setClipPlayerId] = useState('');
  const [clipSetNum, setClipSetNum] = useState(1);
  const [clipScore, setClipScore] = useState('');
  const [clipNotes, setClipNotes] = useState('');

  useEffect(() => {
    loadClipsForMatch(session.matchId);
    async function loadEvents() {
      const events = await matchEventRepo.getByMatch(session.matchId);
      setMatchEvents(events.filter((e) => !e.undone));
    }
    loadEvents();
  }, [session.matchId, loadClipsForMatch]);

  const parseTimeToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
    if (parts.length === 1) return parts[0] || 0;
    return 0;
  };

  const handleAddClip = async () => {
    if (!clipLabel.trim() || !clipStart) return;
    await addClip({
      matchId: session.matchId,
      filmUrl: session.filmUrl,
      startSeconds: parseTimeToSeconds(clipStart),
      endSeconds: clipEnd ? parseTimeToSeconds(clipEnd) : undefined,
      tag: clipTag,
      label: clipLabel.trim(),
      playerId: clipPlayerId || undefined,
      setNumber: clipSetNum,
      score: clipScore,
      notes: clipNotes,
    });
    resetClipForm();
    setShowAddClip(false);
  };

  const resetClipForm = () => {
    setClipStart('');
    setClipEnd('');
    setClipTag('highlight');
    setClipLabel('');
    setClipPlayerId('');
    setClipSetNum(1);
    setClipScore('');
    setClipNotes('');
  };

  const handleDeleteClip = async (id: string) => {
    if (confirm('Delete this clip bookmark?')) {
      await deleteClip(id);
    }
  };

  const playerName = (id?: string) => {
    if (!id) return '';
    const p = players.find((pl) => pl.id === id);
    return p ? `#${p.jerseyNumber} ${p.displayName}` : '';
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'clips', label: `Clips (${clips.length})` },
    { id: 'timeline', label: 'Match Timeline' },
  ];

  return (
    <div className="flex flex-col p-6 max-w-4xl mx-auto w-full">
      <button onClick={onBack} className="text-blue-400 hover:text-blue-300 mb-4 text-sm text-left">
        {'<'} Back to Film Sessions
      </button>

      {/* Header */}
      <div className="bg-slate-800 rounded-2xl p-5 mb-4">
        <h1 className="text-xl font-bold">{session.title}</h1>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-400">
          {match && <span>vs {match.opponentName}</span>}
          <span>{new Date(session.createdAt).toLocaleDateString()}</span>
        </div>
        <a
          href={session.filmUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 text-sm text-blue-400 hover:text-blue-300"
        >
          Open Film Link →
        </a>
      </div>

      {/* Actions */}
      <button
        onClick={() => { resetClipForm(); setShowAddClip(true); }}
        className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-medium text-sm mb-4 touch-manipulation active:scale-[0.98] transition-transform"
      >
        + Bookmark Clip
      </button>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-800/50 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Add Clip Modal */}
      {showAddClip && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Bookmark Clip</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Start Time (m:ss)</label>
                  <input
                    type="text"
                    value={clipStart}
                    onChange={(e) => setClipStart(e.target.value)}
                    placeholder="e.g. 12:30"
                    className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">End Time (optional)</label>
                  <input
                    type="text"
                    value={clipEnd}
                    onChange={(e) => setClipEnd(e.target.value)}
                    placeholder="e.g. 12:45"
                    className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Label</label>
                <input
                  type="text"
                  value={clipLabel}
                  onChange={(e) => setClipLabel(e.target.value)}
                  placeholder="e.g. Great kill by #7"
                  className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Tag</label>
                <div className="flex flex-wrap gap-2">
                  {TAGS.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setClipTag(t.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        clipTag === t.value ? `${t.color} text-white` : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Player (optional)</label>
                <select
                  value={clipPlayerId}
                  onChange={(e) => setClipPlayerId(e.target.value)}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Set #</label>
                  <input
                    type="number"
                    value={clipSetNum}
                    onChange={(e) => setClipSetNum(Number(e.target.value))}
                    min={1}
                    max={5}
                    className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Score at moment</label>
                  <input
                    type="text"
                    value={clipScore}
                    onChange={(e) => setClipScore(e.target.value)}
                    placeholder="e.g. 15-12"
                    className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Notes</label>
                <textarea
                  value={clipNotes}
                  onChange={(e) => setClipNotes(e.target.value)}
                  placeholder="Coaching notes..."
                  rows={2}
                  className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowAddClip(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAddClip}
                disabled={!clipLabel.trim() || !clipStart}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-3 rounded-xl font-medium text-sm"
              >
                Save Clip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clips Tab */}
      {tab === 'clips' && (
        <div className="space-y-2">
          {clips.length === 0 ? (
            <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center">
              <div className="text-3xl mb-2">📎</div>
              <h3 className="text-lg font-semibold text-slate-300 mb-1">No Clips Yet</h3>
              <p className="text-sm text-slate-500">Bookmark key moments from the film for quick reference.</p>
            </div>
          ) : (
            clips.map((clip) => (
              <div key={clip.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-blue-400">
                        {formatTime(clip.startSeconds)}
                        {clip.endSeconds != null && ` - ${formatTime(clip.endSeconds)}`}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TAG_COLORS[clip.tag]}`}>
                        {clip.tag}
                      </span>
                      <span className="text-xs text-slate-500">Set {clip.setNumber}</span>
                    </div>
                    <div className="font-medium text-white">{clip.label}</div>
                    {clip.playerId && (
                      <div className="text-xs text-slate-400 mt-0.5">{playerName(clip.playerId)}</div>
                    )}
                    {clip.score && (
                      <div className="text-xs text-slate-500 mt-0.5">Score: {clip.score}</div>
                    )}
                    {clip.notes && (
                      <div className="text-xs text-slate-400 mt-1 bg-slate-700/50 rounded-lg p-2">{clip.notes}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteClip(clip.id)}
                    className="text-red-400 hover:text-red-300 text-sm flex-shrink-0"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Timeline Tab */}
      {tab === 'timeline' && (
        <div className="space-y-1">
          {matchEvents.length === 0 ? (
            <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center">
              <div className="text-3xl mb-2">📋</div>
              <h3 className="text-lg font-semibold text-slate-300 mb-1">No Match Events</h3>
              <p className="text-sm text-slate-500">Match events will appear here after playing a match.</p>
            </div>
          ) : (
            matchEvents.map((event) => {
              const time = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const hasLinkedClip = clips.some((c) => c.eventId === event.id);

              return (
                <div
                  key={event.id}
                  className={`flex items-center gap-3 py-2 px-3 rounded-lg text-sm ${
                    hasLinkedClip ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-slate-800/50'
                  }`}
                >
                  <span className="text-xs text-slate-500 font-mono w-20 flex-shrink-0">{time}</span>
                  <span className="text-slate-300 flex-1">
                    {formatEventLabel(event, players)}
                  </span>
                  {hasLinkedClip && (
                    <span className="text-xs text-blue-400">📎</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function formatEventLabel(event: MatchEvent, players: Player[]): string {
  const p = event.payload;
  switch (event.eventType) {
    case 'SetStarted':
      return `Set ${p.setNumber} started`;
    case 'SetEnded':
      return `Set ${p.setNumber} ended (${p.ourScore}-${p.opponentScore})`;
    case 'OurPoint':
      return `Our point${p.stat ? ` (${p.stat})` : ''}`;
    case 'OpponentPoint':
      return `Opponent point`;
    case 'SubstitutionConfirmed': {
      const inP = players.find((pl) => pl.id === p.playerInId);
      const outP = players.find((pl) => pl.id === p.playerOutId);
      return `Sub: ${inP?.displayName || '?'} in for ${outP?.displayName || '?'}`;
    }
    case 'TimeoutTaken':
      return `Timeout (${p.team})`;
    case 'StatRecorded': {
      const player = players.find((pl) => pl.id === p.playerId);
      return `${p.category}: ${player?.displayName || '?'}`;
    }
    case 'MatchCreated':
      return 'Match created';
    case 'MatchEnded':
      return 'Match ended';
    default:
      return event.eventType;
  }
}
