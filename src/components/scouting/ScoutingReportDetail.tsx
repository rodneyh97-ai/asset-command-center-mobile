'use client';

import { useState } from 'react';
import { useScoutingStore } from '@/stores/scouting-store';
import type { ScoutingReport, OpponentPlayer } from '@/domain/types';

interface Props {
  report: ScoutingReport;
  onBack: () => void;
}

const THREAT_COLORS = {
  low: 'bg-green-500/20 text-green-400',
  medium: 'bg-amber-500/20 text-amber-400',
  high: 'bg-red-500/20 text-red-400',
};

type SectionKey = 'offenseNotes' | 'defenseNotes' | 'servingNotes' | 'serveReceiveNotes' | 'tendencies' | 'gameplan';

const sections: { key: SectionKey; label: string; placeholder: string }[] = [
  { key: 'offenseNotes', label: 'Offense', placeholder: 'Offensive tendencies, quick/slide patterns, go-to hitters...' },
  { key: 'defenseNotes', label: 'Defense', placeholder: 'Defensive system, block schemes, coverage...' },
  { key: 'servingNotes', label: 'Serving', placeholder: 'Serve types, target zones, pressure servers...' },
  { key: 'serveReceiveNotes', label: 'Serve Receive', placeholder: 'Passers, weak receivers, formation...' },
  { key: 'tendencies', label: 'Tendencies', placeholder: 'Patterns under pressure, timeout behavior, setter habits...' },
  { key: 'gameplan', label: 'Game Plan', placeholder: 'Our strategy: serving targets, blocking assignments, matchup priorities...' },
];

export default function ScoutingReportDetail({ report, onBack }: Props) {
  const { updateReport, addKeyPlayer, removeKeyPlayer } = useScoutingStore();
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerNum, setNewPlayerNum] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPos, setNewPlayerPos] = useState('');
  const [newPlayerNotes, setNewPlayerNotes] = useState('');
  const [newPlayerThreat, setNewPlayerThreat] = useState<'low' | 'medium' | 'high'>('medium');
  const [copied, setCopied] = useState(false);

  const handleFieldChange = (key: SectionKey, value: string) => {
    updateReport({ ...report, [key]: value });
  };

  const handleStatusToggle = () => {
    updateReport({ ...report, status: report.status === 'draft' ? 'complete' : 'draft' });
  };

  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) return;
    addKeyPlayer(report.id, {
      number: Number(newPlayerNum) || 0,
      name: newPlayerName.trim(),
      position: newPlayerPos.trim(),
      notes: newPlayerNotes.trim(),
      threatLevel: newPlayerThreat,
    });
    setNewPlayerNum('');
    setNewPlayerName('');
    setNewPlayerPos('');
    setNewPlayerNotes('');
    setNewPlayerThreat('medium');
    setShowAddPlayer(false);
  };

  const handleShare = async () => {
    const lines: string[] = [];
    lines.push(`SCOUTING REPORT: ${report.opponentName}`);
    if (report.matchDate) lines.push(`Date: ${new Date(report.matchDate).toLocaleDateString()}`);
    lines.push('');

    for (const s of sections) {
      const val = report[s.key];
      if (val) {
        lines.push(`${s.label.toUpperCase()}:`);
        lines.push(val);
        lines.push('');
      }
    }

    if (report.keyPlayers.length > 0) {
      lines.push('KEY PLAYERS:');
      for (const p of report.keyPlayers) {
        lines.push(`  #${p.number} ${p.name} (${p.position}) [${p.threatLevel}] — ${p.notes}`);
      }
    }

    const text = lines.join('\n');
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col p-6 max-w-4xl mx-auto w-full">
      <button onClick={onBack} className="text-blue-400 hover:text-blue-300 mb-4 text-sm text-left">
        {'<'} Back to Scouting Reports
      </button>

      {/* Header */}
      <div className="bg-slate-800 rounded-2xl p-5 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">vs {report.opponentName}</h1>
            {report.matchDate && (
              <p className="text-sm text-slate-400 mt-1">
                {new Date(report.matchDate).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            onClick={handleStatusToggle}
            className={`text-xs px-3 py-1.5 rounded-full font-medium ${
              report.status === 'complete'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-slate-600/60 text-slate-300'
            }`}
          >
            {report.status === 'complete' ? 'Complete' : 'Draft'}
          </button>
        </div>
      </div>

      {/* Share button */}
      <button
        onClick={handleShare}
        className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-medium text-sm mb-4 touch-manipulation"
      >
        {copied ? 'Copied to clipboard!' : 'Share Report'}
      </button>

      {/* Sections */}
      <div className="space-y-4 mb-6">
        {sections.map((s) => (
          <div key={s.key} className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
            <label className="block text-sm font-semibold text-white mb-2">{s.label}</label>
            <textarea
              value={report[s.key]}
              onChange={(e) => handleFieldChange(s.key, e.target.value)}
              placeholder={s.placeholder}
              rows={3}
              className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 resize-none"
            />
          </div>
        ))}
      </div>

      {/* Key Players */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Key Players</h2>
          <button
            onClick={() => setShowAddPlayer(true)}
            className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-sm"
          >
            + Add Player
          </button>
        </div>

        {report.keyPlayers.length === 0 ? (
          <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-xl p-6 text-center">
            <p className="text-sm text-slate-500">No key players scouted yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {report.keyPlayers.map((p, i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold">#{p.number}</span>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-slate-400">{p.position}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${THREAT_COLORS[p.threatLevel]}`}>
                        {p.threatLevel}
                      </span>
                    </div>
                    {p.notes && <p className="text-sm text-slate-400">{p.notes}</p>}
                  </div>
                  <button
                    onClick={() => removeKeyPlayer(report.id, i)}
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

      {/* Add Player Modal */}
      {showAddPlayer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Add Key Player</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">#</label>
                  <input
                    type="number"
                    value={newPlayerNum}
                    onChange={(e) => setNewPlayerNum(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm min-h-[44px]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm min-h-[44px]"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Position</label>
                <input
                  type="text"
                  value={newPlayerPos}
                  onChange={(e) => setNewPlayerPos(e.target.value)}
                  placeholder="e.g. Outside Hitter"
                  className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Threat Level</label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setNewPlayerThreat(level)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        newPlayerThreat === level
                          ? THREAT_COLORS[level]
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Notes</label>
                <textarea
                  value={newPlayerNotes}
                  onChange={(e) => setNewPlayerNotes(e.target.value)}
                  placeholder="Tendencies, weaknesses, strengths..."
                  rows={2}
                  className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowAddPlayer(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPlayer}
                disabled={!newPlayerName.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-3 rounded-xl font-medium text-sm"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
