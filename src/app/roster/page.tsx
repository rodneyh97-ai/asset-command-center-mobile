'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/stores/app-store';
import { Player, PlayerRole, AvailabilityStatus } from '@/domain/types';
import { exportPlayersToCSV, importPlayersFromCSV, downloadCSV } from '@/lib/csv';
import { playerRepo } from '@/db/database';

const ROLES: PlayerRole[] = [
  'Setter',
  'Outside Hitter',
  'Middle Blocker',
  'Right Side',
  'Libero',
  'Defensive Specialist',
];

const STATUSES: AvailabilityStatus[] = [
  'Available',
  'Limited',
  'Emergency only',
  'Out for set',
  'Out for match',
];

export default function RosterPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading...</div>}>
      <RosterContent />
    </Suspense>
  );
}

function RosterContent() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get('teamId') || '';
  const {
    players,
    loadPlayersForTeam,
    createPlayer,
    updatePlayer,
    deletePlayer,
    setActiveTeam,
  } = useAppStore();

  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    jerseyNumber: 0,
    primaryRole: 'Outside Hitter' as PlayerRole,
    notes: '',
  });

  useEffect(() => {
    if (teamId) {
      setActiveTeam(teamId);
      loadPlayersForTeam(teamId);
    }
  }, [teamId, setActiveTeam, loadPlayersForTeam]);

  const handleAdd = async () => {
    if (!form.firstName.trim() || !teamId) return;
    await createPlayer({
      teamId,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      displayName: form.displayName.trim() || form.firstName.trim(),
      jerseyNumber: form.jerseyNumber,
      primaryRole: form.primaryRole,
      secondaryRoles: [],
      coachingTags: [],
      availabilityStatus: 'Available',
      notes: form.notes,
    });
    resetForm();
    setShowAddPlayer(false);
  };

  const handleUpdate = async () => {
    if (!editingPlayer) return;
    await updatePlayer({
      ...editingPlayer,
      firstName: form.firstName,
      lastName: form.lastName,
      displayName: form.displayName || form.firstName,
      jerseyNumber: form.jerseyNumber,
      primaryRole: form.primaryRole,
      notes: form.notes,
    });
    setEditingPlayer(null);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Remove this player from the roster?')) {
      await deletePlayer(id);
    }
  };

  const startEdit = (player: Player) => {
    setEditingPlayer(player);
    setForm({
      firstName: player.firstName,
      lastName: player.lastName,
      displayName: player.displayName,
      jerseyNumber: player.jerseyNumber,
      primaryRole: player.primaryRole,
      notes: player.notes,
    });
  };

  const resetForm = () => {
    setForm({
      firstName: '',
      lastName: '',
      displayName: '',
      jerseyNumber: 0,
      primaryRole: 'Outside Hitter',
      notes: '',
    });
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
    <main className="flex flex-col p-6 max-w-4xl mx-auto w-full">
      <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 text-sm">
        ← Back to Dashboard
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Roster</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const csv = exportPlayersToCSV(players);
              downloadCSV(csv, `roster-${new Date().toISOString().slice(0, 10)}.csv`);
            }}
            className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm font-medium"
          >
            CSV Export
          </button>
          <label className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer">
            CSV Import
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !teamId) return;
                const text = await file.text();
                const imported = importPlayersFromCSV(text, teamId);
                for (const p of imported) {
                  await playerRepo.put(p);
                }
                loadPlayersForTeam(teamId);
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={() => { resetForm(); setShowAddPlayer(true); }}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium"
          >
            + Add Player
          </button>
        </div>
      </div>

      {/* Player List */}
      {players.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
          <p className="text-slate-400">No players yet. Add players to build your roster.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {players
            .sort((a, b) => a.jerseyNumber - b.jerseyNumber)
            .map((player) => (
              <div
                key={player.id}
                className="bg-slate-800 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-slate-700 rounded-lg w-12 h-12 flex items-center justify-center text-lg font-bold">
                    {player.jerseyNumber}
                  </div>
                  <div>
                    <div className="font-medium">
                      {player.firstName} {player.lastName}
                    </div>
                    <div className="text-sm text-slate-400">{player.primaryRole}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      player.availabilityStatus === 'Available'
                        ? 'bg-green-900/50 text-green-400'
                        : player.availabilityStatus === 'Limited'
                        ? 'bg-yellow-900/50 text-yellow-400'
                        : 'bg-red-900/50 text-red-400'
                    }`}
                  >
                    {player.availabilityStatus}
                  </span>
                  <button
                    onClick={() => startEdit(player)}
                    className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(player.id)}
                    className="bg-red-900/50 hover:bg-red-800 text-red-400 px-3 py-2 rounded-lg text-sm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddPlayer || editingPlayer) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingPlayer ? 'Edit Player' : 'Add Player'}
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="First name"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  className="bg-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-400"
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Last name"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className="bg-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-400"
                />
              </div>
              <input
                type="text"
                placeholder="Display name (optional)"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-400"
              />
              <input
                type="number"
                placeholder="Jersey number"
                value={form.jerseyNumber || ''}
                onChange={(e) => setForm({ ...form, jerseyNumber: Number(e.target.value) })}
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-400"
              />
              <select
                value={form.primaryRole}
                onChange={(e) => setForm({ ...form, primaryRole: e.target.value as PlayerRole })}
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-400 resize-none"
                rows={2}
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowAddPlayer(false);
                  setEditingPlayer(null);
                  resetForm();
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={editingPlayer ? handleUpdate : handleAdd}
                className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-medium"
              >
                {editingPlayer ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
