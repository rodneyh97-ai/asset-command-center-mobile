'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '@/stores/app-store';
import { useMatchStore } from '@/stores/match-store';
import { ServingTeam } from '@/domain/types';
import { matchEventRepo } from '@/db/database';
import LiveMatchDashboard from '@/components/match/LiveMatchDashboard';

function MatchContent() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get('teamId') || '';
  const {
    players,
    lineups,
    rulesets,
    matches,
    loadPlayersForTeam,
    loadLineupsForTeam,
    loadRulesets,
    loadMatchesForTeam,
    createMatch,
    setActiveTeam,
  } = useAppStore();

  const { state, initMatch, startSet, isLoaded } = useMatchStore();

  const [setupMode, setSetupMode] = useState(true);
  const [selectedLineupId, setSelectedLineupId] = useState('');
  const [selectedRulesetId, setSelectedRulesetId] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [servingFirst, setServingFirst] = useState<ServingTeam>('us');
  const [activeLiberoIds, setActiveLiberoIds] = useState<string[]>([]);

  useEffect(() => {
    if (teamId) {
      setActiveTeam(teamId);
      loadPlayersForTeam(teamId);
      loadLineupsForTeam(teamId);
      loadRulesets();
      loadMatchesForTeam(teamId);
    }
  }, [teamId, setActiveTeam, loadPlayersForTeam, loadLineupsForTeam, loadRulesets, loadMatchesForTeam]);

  useEffect(() => {
    const resumeMatch = async () => {
      if (matches.length > 0) {
        const inProgress = matches.find((m) => m.matchStatus === 'In Progress');
        if (inProgress) {
          const events = await matchEventRepo.getByMatch(inProgress.id);
          if (events.length > 0) {
            initMatch(inProgress.id, events);
            setOpponentName(inProgress.opponentName);
            setSetupMode(false);
          }
        }
      }
    };
    if (matches.length > 0 && !isLoaded) {
      resumeMatch();
    }
  }, [matches, isLoaded, initMatch]);

  const handleStartMatch = async () => {
    if (!selectedLineupId || !opponentName.trim() || !teamId) return;

    const lineup = lineups.find((l) => l.id === selectedLineupId);
    if (!lineup || lineup.officialRotationOrder.length !== 6) return;

    const match = await createMatch({
      teamId,
      opponentName: opponentName.trim(),
      rulesetProfileId: selectedRulesetId,
      lineupId: selectedLineupId,
      matchStatus: 'In Progress',
      currentSetNumber: 1,
    });

    initMatch(match.id);

    const courtPlayerIds = lineup.officialRotationOrder.map((p) => p.playerId);
    const benchPlayerIds = players
      .filter((p) => !courtPlayerIds.includes(p.id) && !lineup.selectedLiberoIds.includes(p.id))
      .map((p) => p.id);

    startSet(1, lineup.officialRotationOrder, benchPlayerIds, servingFirst, lineup.selectedLiberoIds);
    setActiveLiberoIds(lineup.selectedLiberoIds);
    setSetupMode(false);
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

  if (!setupMode && state) {
    return (
      <div className="h-screen flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
          <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">
            ← Dashboard
          </Link>
          <span className="text-sm text-slate-400">Match vs {opponentName}</span>
          <span className="inline-flex items-center gap-1 text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            Live
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          <LiveMatchDashboard players={players} opponentName={opponentName} liberoIds={activeLiberoIds} />
        </div>
      </div>
    );
  }

  return (
    <main className="flex flex-col p-6 max-w-4xl mx-auto w-full">
      <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 text-sm">
        ← Back to Dashboard
      </Link>

      <h1 className="text-3xl font-bold mb-6">Start Match</h1>

      <div className="bg-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Opponent</label>
          <input
            type="text"
            placeholder="Opponent team name"
            value={opponentName}
            onChange={(e) => setOpponentName(e.target.value)}
            className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Lineup</label>
          <select
            value={selectedLineupId}
            onChange={(e) => setSelectedLineupId(e.target.value)}
            className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white"
          >
            <option value="">Select a lineup...</option>
            {lineups.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.systemType})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Ruleset</label>
          <select
            value={selectedRulesetId}
            onChange={(e) => setSelectedRulesetId(e.target.value)}
            className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white"
          >
            <option value="">Select a ruleset...</option>
            {rulesets.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Who serves first?</label>
          <div className="flex gap-3">
            <button
              onClick={() => setServingFirst('us')}
              className={`flex-1 py-3 rounded-lg font-medium ${
                servingFirst === 'us' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
              }`}
            >
              Us
            </button>
            <button
              onClick={() => setServingFirst('opponent')}
              className={`flex-1 py-3 rounded-lg font-medium ${
                servingFirst === 'opponent' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
              }`}
            >
              Opponent
            </button>
          </div>
        </div>

        <button
          onClick={handleStartMatch}
          disabled={!selectedLineupId || !opponentName.trim()}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 py-4 rounded-xl text-lg font-bold mt-4"
        >
          Start Match
        </button>
      </div>
    </main>
  );
}

export default function MatchPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading...</div>}>
      <MatchContent />
    </Suspense>
  );
}
