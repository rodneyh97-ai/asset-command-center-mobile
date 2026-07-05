'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/stores/app-store';

export default function ClubPage() {
  const params = useParams();
  const clubId = params.id as string;
  const {
    clubs,
    seasons,
    teams,
    loadClubs,
    loadSeasonsForClub,
    createSeason,
    loadTeamsForSeason,
    createTeam,
    setActiveClub,
    setActiveSeason,
    setActiveTeam,
  } = useAppStore();

  const [showCreateSeason, setShowCreateSeason] = useState(false);
  const [seasonName, setSeasonName] = useState('');
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());
  const [ageGroup, setAgeGroup] = useState('');

  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [coachName, setCoachName] = useState('');
  const [selectedSeasonId, setSelectedSeasonId] = useState('');

  useEffect(() => {
    loadClubs();
    loadSeasonsForClub(clubId);
    setActiveClub(clubId);
  }, [clubId, loadClubs, loadSeasonsForClub, setActiveClub]);

  useEffect(() => {
    if (seasons.length > 0 && !selectedSeasonId) {
      setSelectedSeasonId(seasons[0].id);
      loadTeamsForSeason(seasons[0].id);
    }
  }, [seasons, selectedSeasonId, loadTeamsForSeason]);

  const club = clubs.find((c) => c.id === clubId);

  const handleCreateSeason = async () => {
    if (!seasonName.trim()) return;
    const season = await createSeason(clubId, seasonName.trim(), seasonYear, ageGroup);
    setSelectedSeasonId(season.id);
    setShowCreateSeason(false);
    setSeasonName('');
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim() || !selectedSeasonId) return;
    const team = await createTeam(selectedSeasonId, teamName.trim(), coachName ? [coachName] : []);
    setActiveTeam(team.id);
    setShowCreateTeam(false);
    setTeamName('');
    setCoachName('');
    loadTeamsForSeason(selectedSeasonId);
  };

  const handleSeasonSelect = (seasonId: string) => {
    setSelectedSeasonId(seasonId);
    setActiveSeason(seasonId);
    loadTeamsForSeason(seasonId);
  };

  return (
    <main className="flex flex-col p-6 max-w-4xl mx-auto w-full">
      <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 text-sm">
        ← Back to Dashboard
      </Link>

      <h1 className="text-3xl font-bold mb-6">{club?.name || 'Club'}</h1>

      {/* Seasons */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Seasons</h2>
          <button
            onClick={() => setShowCreateSeason(true)}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium"
          >
            + Season
          </button>
        </div>

        {seasons.length === 0 ? (
          <p className="text-slate-400">No seasons yet.</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {seasons.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSeasonSelect(s.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedSeasonId === s.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {s.name} ({s.year})
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Teams */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Teams</h2>
          <button
            onClick={() => setShowCreateTeam(true)}
            disabled={!selectedSeasonId}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-4 py-2 rounded-lg text-sm font-medium"
          >
            + Team
          </button>
        </div>

        {teams.length === 0 ? (
          <p className="text-slate-400">No teams in this season.</p>
        ) : (
          <div className="grid gap-3">
            {teams.map((team) => (
              <div
                key={team.id}
                className="bg-slate-800 rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">{team.name}</div>
                  <div className="text-sm text-slate-400">
                    {team.coachNames.join(', ') || 'No coach listed'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/roster?teamId=${team.id}`}
                    onClick={() => setActiveTeam(team.id)}
                    className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm"
                  >
                    Roster
                  </Link>
                  <Link
                    href={`/lineup?teamId=${team.id}`}
                    onClick={() => setActiveTeam(team.id)}
                    className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm"
                  >
                    Lineups
                  </Link>
                  <Link
                    href={`/match?teamId=${team.id}`}
                    onClick={() => setActiveTeam(team.id)}
                    className="bg-green-700 hover:bg-green-600 px-3 py-2 rounded-lg text-sm"
                  >
                    Match
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create Season Modal */}
      {showCreateSeason && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Season</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Season name (e.g. Spring 2026)"
                value={seasonName}
                onChange={(e) => setSeasonName(e.target.value)}
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-400"
                autoFocus
              />
              <input
                type="number"
                placeholder="Year"
                value={seasonYear}
                onChange={(e) => setSeasonYear(Number(e.target.value))}
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-400"
              />
              <input
                type="text"
                placeholder="Age group (e.g. 14U, 16U, Adult)"
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-400"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowCreateSeason(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSeason}
                className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateTeam && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Team</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Team name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-400"
                autoFocus
              />
              <input
                type="text"
                placeholder="Head coach name"
                value={coachName}
                onChange={(e) => setCoachName(e.target.value)}
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-400"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowCreateTeam(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTeam}
                className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
