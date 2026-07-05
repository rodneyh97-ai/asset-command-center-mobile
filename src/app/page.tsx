'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/app-store';
import Link from 'next/link';

export default function Home() {
  const { clubs, matches, loadClubs, loadRulesets, seedDefaultRulesets, createClub } = useAppStore();
  const [newClubName, setNewClubName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadClubs();
    seedDefaultRulesets();
  }, [loadClubs, seedDefaultRulesets]);

  const handleCreateClub = async () => {
    if (!newClubName.trim()) return;
    await createClub(newClubName.trim());
    setNewClubName('');
    setShowCreate(false);
  };

  return (
    <main className="flex flex-col p-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Volleyball Rotation</h1>
          <p className="text-slate-400 mt-1">Match management and rotation tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            Offline Ready
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <button
          onClick={() => setShowCreate(true)}
          className="bg-slate-800 hover:bg-slate-700 rounded-xl p-4 text-left transition-colors touch-manipulation"
        >
          <div className="text-2xl mb-2">🏐</div>
          <div className="font-medium">New Club</div>
          <div className="text-sm text-slate-400">Create a club</div>
        </button>
        <Link
          href="/roster"
          className="bg-slate-800 hover:bg-slate-700 rounded-xl p-4 text-left transition-colors touch-manipulation"
        >
          <div className="text-2xl mb-2">👥</div>
          <div className="font-medium">Roster</div>
          <div className="text-sm text-slate-400">Manage players</div>
        </Link>
        <Link
          href="/lineup"
          className="bg-slate-800 hover:bg-slate-700 rounded-xl p-4 text-left transition-colors touch-manipulation"
        >
          <div className="text-2xl mb-2">📋</div>
          <div className="font-medium">Lineups</div>
          <div className="text-sm text-slate-400">Build rotations</div>
        </Link>
        <Link
          href="/match"
          className="bg-slate-800 hover:bg-slate-700 rounded-xl p-4 text-left transition-colors touch-manipulation"
        >
          <div className="text-2xl mb-2">🎯</div>
          <div className="font-medium">Live Match</div>
          <div className="text-sm text-slate-400">Start or resume</div>
        </Link>
      </div>

      {/* Create Club Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Club</h2>
            <input
              type="text"
              placeholder="Club name"
              value={newClubName}
              onChange={(e) => setNewClubName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateClub()}
              className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-400 mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateClub}
                className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clubs List */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Your Clubs</h2>
        {clubs.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
            <p className="text-slate-400">No clubs yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {clubs.map((club) => (
              <Link
                key={club.id}
                href={`/club/${club.id}`}
                className="bg-slate-800 hover:bg-slate-700 rounded-xl p-4 flex items-center justify-between transition-colors"
              >
                <div>
                  <div className="font-medium">{club.name}</div>
                  <div className="text-sm text-slate-400">
                    Created {new Date(club.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className="text-slate-500">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
