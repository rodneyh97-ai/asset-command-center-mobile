'use client';

import { useState } from 'react';
import { Player, MatchEvent, SetState } from '@/domain/types';
import { getPlayerPlusMinus, getHittingPercentage } from '@/domain/event-sourcing';
import {
  generateMatchHighlights,
  formatHighlightForSocial,
  shareToSocial,
  MatchHighlightSummary,
} from '@/lib/highlight-summary';

interface HighlightSummaryProps {
  players: Player[];
  events: MatchEvent[];
  sets: SetState[];
  teamName: string;
  opponentName: string;
  filmUrl?: string;
  onClose: () => void;
}

export default function HighlightSummary({
  players,
  events,
  sets,
  teamName,
  opponentName,
  filmUrl,
  onClose,
}: HighlightSummaryProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filmInput, setFilmInput] = useState(filmUrl || '');
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  const summary = generateMatchHighlights(
    players, events, sets, teamName, opponentName, filmInput || undefined
  );

  const result = summary.setsWon > summary.setsLost ? 'WIN' : 'LOSS';
  const resultColor = summary.setsWon > summary.setsLost ? 'text-green-400' : 'text-red-400';

  const handleShareAll = async () => {
    const text = formatHighlightForSocial(summary);
    const shared = await shareToSocial(text, `${teamName} vs ${opponentName}`);
    if (shared) {
      setCopiedId('all');
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSharePlayer = async (playerId: string) => {
    const text = formatHighlightForSocial(summary, playerId);
    const shared = await shareToSocial(text);
    if (shared) {
      setCopiedId(playerId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Match Highlights</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Match result */}
        <div className="bg-slate-900 rounded-xl p-4 mb-4 text-center">
          <div className="text-sm text-slate-400">{summary.matchDate}</div>
          <div className="text-lg font-bold mt-1">
            {teamName} vs {opponentName}
          </div>
          <div className={`text-2xl font-bold mt-1 ${resultColor}`}>
            {result} | {summary.setsWon}-{summary.setsLost}
          </div>
          <div className="text-sm text-slate-400 mt-1">
            {summary.setScores.map((s, i) => `Set ${i + 1}: ${s.our}-${s.opp}`).join('  |  ')}
          </div>
        </div>

        {/* Film URL */}
        <div className="mb-4">
          <label className="text-xs text-slate-400 block mb-1">Hudl Film URL (optional)</label>
          <input
            type="url"
            value={filmInput}
            onChange={(e) => setFilmInput(e.target.value)}
            placeholder="https://www.hudl.com/video/..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Share all button */}
        <button
          onClick={handleShareAll}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium mb-4 touch-manipulation transition-colors"
        >
          {copiedId === 'all' ? 'Copied to clipboard!' : 'Share Full Match Summary'}
        </button>

        {/* Player highlights */}
        <div className="space-y-2">
          {summary.playerHighlights.map((ph) => {
            const isMVP = summary.mvpPlayerId === ph.player.id;
            const pm = getPlayerPlusMinus(ph.totalStats);
            const hitPct = getHittingPercentage(ph.totalStats);
            const isExpanded = expandedPlayer === ph.player.id;

            return (
              <div
                key={ph.player.id}
                className={`bg-slate-900 rounded-xl overflow-hidden ${
                  isMVP ? 'ring-2 ring-yellow-500' : ''
                }`}
              >
                {/* Player header row */}
                <button
                  onClick={() => setExpandedPlayer(isExpanded ? null : ph.player.id)}
                  className="w-full flex items-center gap-3 p-3 text-left touch-manipulation"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center">
                    <span className="text-lg font-bold">{ph.player.jerseyNumber}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{ph.player.displayName}</span>
                      {isMVP && (
                        <span className="bg-yellow-600 text-yellow-100 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          MVP
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{ph.player.primaryRole}</div>
                  </div>
                  <div className="flex gap-3 text-xs text-slate-300">
                    <span>{ph.totalStats.kills}K</span>
                    <span>{ph.totalStats.aces}A</span>
                    <span>{ph.totalStats.blocks}B</span>
                    <span className={pm >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {pm >= 0 ? '+' : ''}{pm}
                    </span>
                  </div>
                  <span className="text-slate-500 text-sm ml-2">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-slate-800">
                    {/* Full stat line */}
                    <div className="grid grid-cols-4 gap-2 mt-3 text-center text-xs">
                      <div>
                        <div className="text-slate-500">Kills</div>
                        <div className="font-bold text-lg">{ph.totalStats.kills}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Aces</div>
                        <div className="font-bold text-lg">{ph.totalStats.aces}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Blocks</div>
                        <div className="font-bold text-lg">{ph.totalStats.blocks}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Assists</div>
                        <div className="font-bold text-lg">{ph.totalStats.assists}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Digs</div>
                        <div className="font-bold text-lg">{ph.totalStats.digs}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Hit %</div>
                        <div className="font-bold text-lg">
                          {hitPct !== null ? `${(hitPct * 100).toFixed(1)}%` : '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Errors</div>
                        <div className="font-bold text-lg text-red-400">
                          {ph.totalStats.attackErrors + ph.totalStats.serviceErrors}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">+/-</div>
                        <div className={`font-bold text-lg ${pm >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {pm >= 0 ? '+' : ''}{pm}
                        </div>
                      </div>
                    </div>

                    {/* Key plays timeline */}
                    {ph.keyPlays.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs text-slate-500 font-medium mb-1">Key Plays (timestamps for film review)</div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {ph.keyPlays.map((play, i) => (
                            <div key={i} className="text-xs text-slate-300 flex gap-2">
                              <span className="text-slate-500 font-mono w-12">{play.gameTime}</span>
                              <span className="text-green-400">{play.category}</span>
                              <span className="text-slate-500">Set {play.setNumber}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Hudl link */}
                    {ph.player.highlightReelUrl && (
                      <a
                        href={ph.player.highlightReelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-xs text-blue-400 hover:text-blue-300"
                      >
                        View Hudl Highlight Reel →
                      </a>
                    )}

                    {/* Share this player */}
                    <button
                      onClick={() => handleSharePlayer(ph.player.id)}
                      className="w-full mt-3 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium touch-manipulation transition-colors"
                    >
                      {copiedId === ph.player.id
                        ? 'Copied!'
                        : `Share #${ph.player.jerseyNumber}'s Highlights`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {summary.playerHighlights.length === 0 && (
            <div className="text-center text-slate-500 py-8">
              No player stats recorded for this match yet.
            </div>
          )}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-full mt-4 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-medium touch-manipulation"
        >
          Close
        </button>
      </div>
    </div>
  );
}
