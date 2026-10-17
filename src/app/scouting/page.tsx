'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/stores/app-store';
import { useScoutingStore } from '@/stores/scouting-store';
import ScoutingReportDetail from '@/components/scouting/ScoutingReportDetail';

function ScoutingContent() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get('teamId') || '';
  const { setActiveTeam } = useAppStore();
  const { reports, activeReport, loadReportsForTeam, createReport, deleteReport, setActiveReport } = useScoutingStore();

  const [showCreate, setShowCreate] = useState(false);
  const [opponentName, setOpponentName] = useState('');
  const [matchDate, setMatchDate] = useState('');

  useEffect(() => {
    if (teamId) {
      setActiveTeam(teamId);
      loadReportsForTeam(teamId);
    }
  }, [teamId, setActiveTeam, loadReportsForTeam]);

  const handleCreate = async () => {
    if (!opponentName.trim() || !teamId) return;
    const report = await createReport({
      teamId,
      opponentName: opponentName.trim(),
      matchDate: matchDate || undefined,
    });
    setOpponentName('');
    setMatchDate('');
    setShowCreate(false);
    setActiveReport(report.id);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this scouting report?')) {
      await deleteReport(id);
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

  if (activeReport) {
    return <ScoutingReportDetail report={activeReport} onBack={() => setActiveReport(null)} />;
  }

  return (
    <main className="flex flex-col p-6 max-w-4xl mx-auto w-full">
      <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 text-sm">
        {'<'} Back to Dashboard
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Scouting Reports</h1>
          <p className="text-sm text-slate-400 mt-0.5">Prepare for opponents with detailed scouting</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 hover:bg-blue-500 px-4 py-2.5 rounded-xl text-sm font-medium touch-manipulation active:scale-95 transition-transform"
        >
          + New Report
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">New Scouting Report</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Opponent Name</label>
                <input
                  type="text"
                  value={opponentName}
                  onChange={(e) => setOpponentName(e.target.value)}
                  placeholder="e.g. Rival Academy"
                  className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Match Date (optional)</label>
                <input
                  type="date"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
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
                disabled={!opponentName.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-3 rounded-xl font-medium text-sm"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report List */}
      {reports.length === 0 ? (
        <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="text-lg font-semibold text-slate-300 mb-1">No Scouting Reports</h3>
          <p className="text-sm text-slate-500">Create a report to prepare for your next opponent.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <div
              key={report.id}
              className="bg-slate-800 rounded-xl border border-slate-700/50 hover:border-slate-600/50 transition-all overflow-hidden"
            >
              <div className="flex items-center">
                <button
                  onClick={() => setActiveReport(report.id)}
                  className="flex-1 text-left p-4 flex items-center gap-3 touch-manipulation min-h-[64px]"
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center text-lg flex-shrink-0">
                    🔍
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">vs {report.opponentName}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        report.status === 'complete'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-slate-600/60 text-slate-300'
                      }`}>
                        {report.status === 'complete' ? 'Complete' : 'Draft'}
                      </span>
                      {report.matchDate && (
                        <span className="text-xs text-slate-400">
                          {new Date(report.matchDate).toLocaleDateString()}
                        </span>
                      )}
                      <span className="text-xs text-slate-500">
                        {report.keyPlayers.length} key players
                      </span>
                    </div>
                  </div>
                  <span className="text-slate-500 text-sm flex-shrink-0">{'>'}</span>
                </button>
                <button
                  onClick={() => handleDelete(report.id)}
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

export default function ScoutingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading...</div>}>
      <ScoutingContent />
    </Suspense>
  );
}
