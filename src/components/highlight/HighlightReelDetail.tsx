'use client';

import { useEffect, useState } from 'react';
import { useHighlightStore } from '@/stores/highlight-store';
import { useFilmStore } from '@/stores/film-store';
import { formatReelForSharing, shareReel } from '@/lib/highlight-reel-share';
import type { HighlightReel, FilmClip, ClipTag, Match, Player } from '@/domain/types';

interface Props {
  reel: HighlightReel;
  match?: Match;
  players: Player[];
  allClips: FilmClip[];
  onBack: () => void;
}

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

export default function HighlightReelDetail({ reel, match, players, allClips, onBack }: Props) {
  const { reelClips, setActiveReel, removeClipFromReel, addClipToReel, reorderClips, updateReel } = useHighlightStore();
  const [copied, setCopied] = useState(false);
  const [showAddClip, setShowAddClip] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(reel.title);
  const [editDesc, setEditDesc] = useState(reel.description);

  useEffect(() => {
    setActiveReel(reel.id);
  }, [reel.id, setActiveReel]);

  const availableClips = allClips.filter((c) => !reel.clipIds.includes(c.id));

  const handleShare = async () => {
    const text = formatReelForSharing(reel, reelClips, players, match);
    const shared = await shareReel(text, reel.title);
    if (shared) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...reel.clipIds];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderClips(reel.id, newOrder);
  };

  const handleMoveDown = (index: number) => {
    if (index >= reel.clipIds.length - 1) return;
    const newOrder = [...reel.clipIds];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderClips(reel.id, newOrder);
  };

  const handleSaveEdit = async () => {
    await updateReel({ ...reel, title: editTitle.trim(), description: editDesc.trim() });
    setEditing(false);
  };

  const playerName = (id?: string) => {
    if (!id) return '';
    const p = players.find((pl) => pl.id === id);
    return p ? `#${p.jerseyNumber} ${p.displayName}` : '';
  };

  const totalDuration = reelClips.reduce((acc, c) => {
    if (c.endSeconds != null) return acc + (c.endSeconds - c.startSeconds);
    return acc + 10;
  }, 0);

  return (
    <div className="flex flex-col p-6 max-w-4xl mx-auto w-full">
      <button onClick={onBack} className="text-blue-400 hover:text-blue-300 mb-4 text-sm text-left">
        {'<'} Back to Highlight Reels
      </button>

      {/* Header */}
      <div className="bg-slate-800 rounded-2xl p-5 mb-4">
        {editing ? (
          <div className="space-y-3">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white font-bold text-xl"
            />
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={2}
              className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm">
                Cancel
              </button>
              <button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm">
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold">{reel.title}</h1>
                {reel.description && <p className="text-sm text-slate-400 mt-1">{reel.description}</p>}
              </div>
              <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-white text-sm">
                Edit
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
              {match && <span>vs {match.opponentName}</span>}
              {reel.playerId && <span>{playerName(reel.playerId)}</span>}
              <span>{reelClips.length} clips</span>
              <span>~{formatTime(totalDuration)} total</span>
              {reel.isAutoGenerated && (
                <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">Auto-generated</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleShare}
          className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-medium text-sm touch-manipulation"
        >
          {copied ? 'Copied!' : 'Share Reel'}
        </button>
        <button
          onClick={() => setShowAddClip(true)}
          className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-medium text-sm touch-manipulation"
        >
          + Add Clips
        </button>
      </div>

      {/* Add clip picker */}
      {showAddClip && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add Clips to Reel</h2>
            {availableClips.length === 0 ? (
              <p className="text-slate-400 text-sm">All available clips are already in this reel.</p>
            ) : (
              <div className="space-y-2">
                {availableClips.map((clip) => (
                  <button
                    key={clip.id}
                    onClick={() => addClipToReel(reel.id, clip.id)}
                    className="w-full text-left bg-slate-700 hover:bg-slate-600 rounded-xl p-3 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-blue-400">{formatTime(clip.startSeconds)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TAG_COLORS[clip.tag]}`}>{clip.tag}</span>
                    </div>
                    <div className="text-sm font-medium mt-1">{clip.label}</div>
                    {clip.playerId && <div className="text-xs text-slate-400">{playerName(clip.playerId)}</div>}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowAddClip(false)}
              className="w-full mt-4 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-medium text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Clip list */}
      {reelClips.length === 0 ? (
        <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-2">🎞️</div>
          <h3 className="text-lg font-semibold text-slate-300 mb-1">Empty Reel</h3>
          <p className="text-sm text-slate-500">Add clips from your film sessions to build this reel.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reelClips.map((clip, index) => (
            <div key={clip.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
              <div className="flex items-start gap-3">
                {/* Reorder controls */}
                <div className="flex flex-col gap-1 flex-shrink-0 pt-1">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="text-slate-500 hover:text-white disabled:opacity-20 text-xs leading-none"
                  >
                    ▲
                  </button>
                  <span className="text-xs text-slate-600 text-center">{index + 1}</span>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index >= reelClips.length - 1}
                    className="text-slate-500 hover:text-white disabled:opacity-20 text-xs leading-none"
                  >
                    ▼
                  </button>
                </div>

                {/* Clip info */}
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

                {/* Remove */}
                <button
                  onClick={() => removeClipFromReel(reel.id, clip.id)}
                  className="text-red-400 hover:text-red-300 text-sm flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
