'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/stores/app-store';
import { useRecruitingStore } from '@/stores/recruiting-store';
import { playerRepo } from '@/db/database';
import type { Player } from '@/domain/types';
import RecruitingProfileDetail from '@/components/recruiting/RecruitingProfileDetail';

function RecruitingContent() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get('teamId') || '';
  const { setActiveTeam } = useAppStore();
  const { profiles, activeProfile, loadProfilesForTeam, createProfile, deleteProfile, setActiveProfile } = useRecruitingStore();

  const [players, setPlayers] = useState<Player[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [gradYear, setGradYear] = useState(String(new Date().getFullYear() + 1));

  useEffect(() => {
    if (teamId) {
      setActiveTeam(teamId);
      loadProfilesForTeam(teamId);
      playerRepo.getByTeam(teamId).then(setPlayers);
    }
  }, [teamId, setActiveTeam, loadProfilesForTeam]);

  const playersWithoutProfile = players.filter(
    (p) => !profiles.some((pr) => pr.playerId === p.id)
  );

  const getPlayerName = (playerId: string) => {
    const p = players.find((pl) => pl.id === playerId);
    return p ? p.displayName : 'Unknown';
  };

  const handleCreate = async () => {
    if (!selectedPlayerId || !teamId) return;
    const profile = await createProfile(teamId, selectedPlayerId, {
      graduationYear: Number(gradYear) || new Date().getFullYear() + 1,
    });
    setSelectedPlayerId('');
    setGradYear(String(new Date().getFullYear() + 1));
    setShowCreate(false);
    setActiveProfile(profile);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this recruiting profile?')) {
      await deleteProfile(id);
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

  if (activeProfile) {
    return (
      <RecruitingProfileDetail
        profile={activeProfile}
        playerName={getPlayerName(activeProfile.playerId)}
        onBack={() => setActiveProfile(null)}
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
          <h1 className="text-2xl font-bold">College Recruiting</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage player recruiting profiles</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          disabled={playersWithoutProfile.length === 0}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-4 py-2.5 rounded-xl text-sm font-medium touch-manipulation active:scale-95 transition-transform"
        >
          + New Profile
        </button>
      </div>

      {/* Privacy Notice */}
      <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 mb-6">
        <p className="text-sm text-amber-400 font-medium mb-1">Privacy-First for Minor Athletes</p>
        <p className="text-xs text-amber-400/70">
          All profiles are private by default. Guardian approval is required before any profile can be shared with college coaches. No data leaves this device without explicit consent.
        </p>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">New Recruiting Profile</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Player</label>
                <select
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm min-h-[44px]"
                >
                  <option value="">Select a player...</option>
                  {playersWithoutProfile.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.jerseyNumber} {p.displayName} ({p.primaryRole})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Graduation Year</label>
                <input
                  type="number"
                  value={gradYear}
                  onChange={(e) => setGradYear(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm min-h-[44px]"
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
                disabled={!selectedPlayerId}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-3 rounded-xl font-medium text-sm"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile List */}
      {profiles.length === 0 ? (
        <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">🎓</div>
          <h3 className="text-lg font-semibold text-slate-300 mb-1">No Recruiting Profiles</h3>
          <p className="text-sm text-slate-500">Create a profile for players interested in college recruiting.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="bg-slate-800 rounded-xl border border-slate-700/50 hover:border-slate-600/50 transition-all overflow-hidden"
            >
              <div className="flex items-center">
                <button
                  onClick={() => setActiveProfile(profile)}
                  className="flex-1 text-left p-4 flex items-center gap-3 touch-manipulation min-h-[64px]"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center text-lg flex-shrink-0">
                    🎓
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">{getPlayerName(profile.playerId)}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400">Class of {profile.graduationYear}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        profile.visibility === 'private'
                          ? 'bg-slate-600/60 text-slate-300'
                          : profile.visibility === 'guardian-approved'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {profile.visibility === 'private' ? 'Private' : profile.visibility === 'guardian-approved' ? 'Guardian' : 'Public'}
                      </span>
                      {profile.interestedSchools.length > 0 && (
                        <span className="text-xs text-slate-500">
                          {profile.interestedSchools.length} schools
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-slate-500 text-sm flex-shrink-0">{'>'}</span>
                </button>
                <button
                  onClick={() => handleDelete(profile.id)}
                  className="text-red-400 hover:text-red-300 text-xs px-3 py-2 flex-shrink-0"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export default function RecruitingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading...</div>}>
      <RecruitingContent />
    </Suspense>
  );
}
