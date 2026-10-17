'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/stores/app-store';
import { Player, PlayerMatchStats, RotationPosition, SystemType, MatchState } from '@/domain/types';
import VolleyballCourt from '@/components/court/VolleyballCourt';
import { suggestLineups, type LineupSuggestion } from '@/domain/lineup-suggestion';
import { matchEventRepo } from '@/db/database';
import { rebuildState } from '@/domain/event-sourcing';

const SYSTEMS: SystemType[] = ['5-1', '6-2', '4-2', 'Custom', 'Blank'];

export default function LineupPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading...</div>}>
      <LineupContent />
    </Suspense>
  );
}

function LineupContent() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get('teamId') || '';
  const {
    players,
    matches,
    lineups,
    loadPlayersForTeam,
    loadMatchesForTeam,
    loadLineupsForTeam,
    createLineup,
    updateLineup,
    deleteLineup,
    setActiveTeam,
  } = useAppStore();

  const [showBuilder, setShowBuilder] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lineupName, setLineupName] = useState('');
  const [systemType, setSystemType] = useState<SystemType>('5-1');
  const [positions, setPositions] = useState<RotationPosition[]>([]);
  const [selectedLiberos, setSelectedLiberos] = useState<string[]>([]);
  const [editingLineupId, setEditingLineupId] = useState<string | null>(null);
  const [allStats, setAllStats] = useState<PlayerMatchStats[]>([]);
  const [suggestions, setSuggestions] = useState<LineupSuggestion[]>([]);

  useEffect(() => {
    if (teamId) {
      setActiveTeam(teamId);
      loadPlayersForTeam(teamId);
      loadMatchesForTeam(teamId);
      loadLineupsForTeam(teamId);
    }
  }, [teamId, setActiveTeam, loadPlayersForTeam, loadMatchesForTeam, loadLineupsForTeam]);

  useEffect(() => {
    async function loadStats() {
      const stats: PlayerMatchStats[] = [];
      for (const m of matches) {
        const events = await matchEventRepo.getByMatch(m.id);
        if (events.length === 0) continue;
        const state = rebuildState(events);
        if (!state) continue;
        for (const setState of state.sets) {
          for (const ps of Object.values(setState.playerStats)) {
            stats.push(ps);
          }
        }
      }
      setAllStats(stats);
    }
    if (matches.length > 0) loadStats();
  }, [matches]);

  const handleShowSuggestions = () => {
    const results = suggestLineups(players, allStats, lineups, systemType);
    setSuggestions(results);
    setShowSuggestions(true);
  };

  const handleApplySuggestion = (suggestion: LineupSuggestion) => {
    setPositions(suggestion.positions);
    setSelectedLiberos(suggestion.liberoIds);
    setSystemType(suggestion.systemType);
    setShowSuggestions(false);
    setShowBuilder(true);
    if (!lineupName) setLineupName(`Suggested ${suggestion.systemType}`);
  };

  const availablePlayers = players.filter(
    (p) => !positions.some((pos) => pos.playerId === p.id)
  );

  const handleAssignPosition = (position: 1 | 2 | 3 | 4 | 5 | 6, playerId: string) => {
    const existing = positions.find((p) => p.position === position);
    if (existing) {
      setPositions(positions.map((p) => (p.position === position ? { ...p, playerId } : p)));
    } else {
      setPositions([...positions, { position, playerId }]);
    }
  };

  const handleRemovePosition = (position: number) => {
    setPositions(positions.filter((p) => p.position !== position));
  };

  const handleSave = async () => {
    if (!lineupName.trim() || positions.length !== 6 || !teamId) return;

    if (editingLineupId) {
      const existing = lineups.find((l) => l.id === editingLineupId);
      if (existing) {
        await updateLineup({
          ...existing,
          name: lineupName.trim(),
          systemType,
          officialRotationOrder: positions,
          selectedLiberoIds: selectedLiberos,
        });
      }
    } else {
      await createLineup({
        teamId,
        name: lineupName.trim(),
        systemType,
        officialRotationOrder: positions,
        selectedLiberoIds: selectedLiberos,
        tacticalOverlays: [],
        notes: '',
        isTemplate: false,
      });
    }

    resetBuilder();
  };

  const handleEdit = (lineupId: string) => {
    const lineup = lineups.find((l) => l.id === lineupId);
    if (!lineup) return;
    setEditingLineupId(lineupId);
    setLineupName(lineup.name);
    setSystemType(lineup.systemType);
    setPositions([...lineup.officialRotationOrder]);
    setSelectedLiberos([...lineup.selectedLiberoIds]);
    setShowBuilder(true);
  };

  const handleDuplicate = async (lineupId: string) => {
    const lineup = lineups.find((l) => l.id === lineupId);
    if (!lineup || !teamId) return;
    await createLineup({
      teamId,
      name: `${lineup.name} (Copy)`,
      systemType: lineup.systemType,
      officialRotationOrder: [...lineup.officialRotationOrder],
      selectedLiberoIds: [...lineup.selectedLiberoIds],
      tacticalOverlays: [...lineup.tacticalOverlays],
      notes: lineup.notes,
      isTemplate: lineup.isTemplate,
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this lineup?')) {
      await deleteLineup(id);
    }
  };

  const resetBuilder = () => {
    setShowBuilder(false);
    setEditingLineupId(null);
    setLineupName('');
    setSystemType('5-1');
    setPositions([]);
    setSelectedLiberos([]);
  };

  if (!teamId) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 text-sm">
          ← Back
        </Link>
        <p className="text-slate-400 mt-4">Select a team first from the dashboard.</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col p-6 max-w-5xl mx-auto w-full">
      <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 text-sm">
        ← Back to Dashboard
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Lineups</h1>
        <div className="flex gap-2">
          {players.length >= 6 && (
            <button
              onClick={handleShowSuggestions}
              className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-medium text-sm"
            >
              Smart Suggest
            </button>
          )}
          <button
            onClick={() => { resetBuilder(); setShowBuilder(true); }}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium"
          >
            + New Lineup
          </button>
        </div>
      </div>

      {/* Smart Suggestions */}
      {showSuggestions && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Suggested Lineups</h2>
            <button onClick={() => setShowSuggestions(false)} className="text-slate-400 hover:text-white text-sm">
              Dismiss
            </button>
          </div>
          {suggestions.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
              <p className="text-slate-400 text-sm">Not enough players or role coverage for suggestions.</p>
            </div>
          ) : (
            suggestions.map((s, i) => (
              <div key={i} className="bg-slate-800 rounded-xl border border-slate-700/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{s.reasoning[0]}</div>
                  <button
                    onClick={() => handleApplySuggestion(s)}
                    className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-sm font-medium"
                  >
                    Use This
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {s.positions.map((p) => {
                    const player = players.find((pl) => pl.id === p.playerId);
                    return (
                      <span key={p.position} className="text-xs bg-slate-700 px-2 py-1 rounded-lg">
                        P{p.position}: #{player?.jerseyNumber} {player?.displayName}
                      </span>
                    );
                  })}
                  {s.liberoIds.length > 0 && s.liberoIds.map((lid) => {
                    const p = players.find((pl) => pl.id === lid);
                    return (
                      <span key={lid} className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg">
                        L: #{p?.jerseyNumber} {p?.displayName}
                      </span>
                    );
                  })}
                </div>
                {s.reasoning.slice(1).length > 0 && (
                  <div className="text-xs text-slate-400 space-y-0.5">
                    {s.reasoning.slice(1).map((r, j) => (
                      <div key={j}>{r}</div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Saved Lineups */}
      {!showBuilder && (
        <div className="grid gap-3">
          {lineups.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
              <p className="text-slate-400">No lineups saved. Create one to get started.</p>
            </div>
          ) : (
            lineups.map((lineup) => (
              <div
                key={lineup.id}
                className="bg-slate-800 rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">{lineup.name}</div>
                  <div className="text-sm text-slate-400">
                    {lineup.systemType} • {lineup.officialRotationOrder.length} players
                    {lineup.selectedLiberoIds.length > 0 &&
                      ` • ${lineup.selectedLiberoIds.length} libero(s)`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(lineup.id)}
                    className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDuplicate(lineup.id)}
                    className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => handleDelete(lineup.id)}
                    className="bg-red-900/50 hover:bg-red-800 text-red-400 px-3 py-2 rounded-lg text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Lineup Builder */}
      {showBuilder && (
        <div className="bg-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">
            {editingLineupId ? 'Edit Lineup' : 'Build Lineup'}
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Config */}
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Lineup name"
                value={lineupName}
                onChange={(e) => setLineupName(e.target.value)}
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-400"
              />

              <select
                value={systemType}
                onChange={(e) => setSystemType(e.target.value as SystemType)}
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white"
              >
                {SYSTEMS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Position Assignment */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-slate-400">
                  Assign Players to Positions (1 = Server)
                </h3>
                {([1, 2, 3, 4, 5, 6] as const).map((pos) => {
                  const assigned = positions.find((p) => p.position === pos);
                  const player = assigned
                    ? players.find((p) => p.id === assigned.playerId)
                    : null;

                  return (
                    <div key={pos} className="flex items-center gap-3">
                      <span className="w-8 text-sm font-bold text-slate-400">P{pos}</span>
                      {player ? (
                        <div className="flex-1 flex items-center justify-between bg-slate-600 rounded-lg px-3 py-2">
                          <span>
                            #{player.jerseyNumber} {player.displayName}
                          </span>
                          <button
                            onClick={() => handleRemovePosition(pos)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <select
                          value=""
                          onChange={(e) => handleAssignPosition(pos, e.target.value)}
                          className="flex-1 bg-slate-700 rounded-lg px-3 py-2 text-white"
                        >
                          <option value="">Select player...</option>
                          {availablePlayers.map((p) => (
                            <option key={p.id} value={p.id}>
                              #{p.jerseyNumber} {p.displayName} ({p.primaryRole})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Libero Selection */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-2">Libero(s)</h3>
                <div className="flex flex-wrap gap-2">
                  {players
                    .filter(
                      (p) =>
                        p.primaryRole === 'Libero' ||
                        p.coachingTags.includes('Libero eligible')
                    )
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() =>
                          setSelectedLiberos(
                            selectedLiberos.includes(p.id)
                              ? selectedLiberos.filter((id) => id !== p.id)
                              : [...selectedLiberos, p.id]
                          )
                        }
                        className={`px-3 py-2 rounded-lg text-sm ${
                          selectedLiberos.includes(p.id)
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        #{p.jerseyNumber} {p.displayName}
                      </button>
                    ))}
                  {players.filter(
                    (p) =>
                      p.primaryRole === 'Libero' || p.coachingTags.includes('Libero eligible')
                  ).length === 0 && (
                    <span className="text-sm text-slate-500">
                      No players with Libero role or tag
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Court Preview */}
            <div>
              {positions.length === 6 && (
                <VolleyballCourt positions={positions} players={players} />
              )}
              {positions.length < 6 && (
                <div className="bg-slate-700/50 rounded-xl p-8 text-center text-slate-400">
                  Assign all 6 positions to preview the court
                </div>
              )}
            </div>
          </div>

          {/* Save/Cancel */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={resetBuilder}
              className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={positions.length !== 6 || !lineupName.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-3 rounded-lg font-medium"
            >
              {editingLineupId ? 'Update Lineup' : 'Save Lineup'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
