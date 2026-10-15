'use client';

import { useState } from 'react';
import { Player, PlayerMatchStats, SetState } from '@/domain/types';
import { getPlayerPlusMinus, getHittingPercentage } from '@/domain/event-sourcing';
import { exportMatchStatsCSV, downloadStatsCSV, importHudlBoxScore } from '@/lib/hudl-stats';

interface StatsExportPanelProps {
  players: Player[];
  sets: SetState[];
  currentSetIndex: number;
  opponentName: string;
  onClose: () => void;
}

export default function StatsExportPanel({
  players,
  sets,
  currentSetIndex,
  opponentName,
  onClose,
}: StatsExportPanelProps) {
  const [viewSet, setViewSet] = useState(currentSetIndex);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const currentSet = sets[viewSet];
  if (!currentSet) return null;

  const statsEntries = Object.values(currentSet.playerStats)
    .map((stats) => ({
      player: players.find((p) => p.id === stats.playerId),
      stats,
    }))
    .filter((e) => e.player)
    .sort((a, b) => {
      const aTotal = a.stats.kills + a.stats.aces + a.stats.blocks;
      const bTotal = b.stats.kills + b.stats.aces + b.stats.blocks;
      return bTotal - aTotal;
    });

  const handleExport = () => {
    const allSetStats = sets.map((s) => s.playerStats);
    const csv = exportMatchStatsCSV(
      players,
      allSetStats,
      opponentName,
      new Date().toISOString().slice(0, 10)
    );
    downloadStatsCSV(csv, opponentName);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = importHudlBoxScore(reader.result as string, players);
        const count = Object.keys(imported).length;
        setImportMsg(`Imported stats for ${count} player${count !== 1 ? 's' : ''}`);
      } catch (err) {
        setImportMsg(`Import failed: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Match Stats</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Set selector */}
        <div className="flex gap-2 mb-4">
          {sets.map((s, i) => (
            <button
              key={i}
              onClick={() => setViewSet(i)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewSet === i
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Set {s.setNumber}
            </button>
          ))}
        </div>

        {/* Stats table */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="pb-2 pr-2">#</th>
                <th className="pb-2 pr-2">Player</th>
                <th className="pb-2 px-1 text-center">K</th>
                <th className="pb-2 px-1 text-center">E</th>
                <th className="pb-2 px-1 text-center">Hit%</th>
                <th className="pb-2 px-1 text-center">A</th>
                <th className="pb-2 px-1 text-center">SE</th>
                <th className="pb-2 px-1 text-center">D</th>
                <th className="pb-2 px-1 text-center">B</th>
                <th className="pb-2 px-1 text-center">AS</th>
                <th className="pb-2 px-1 text-center">+/-</th>
              </tr>
            </thead>
            <tbody>
              {statsEntries.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-4 text-center text-slate-500">
                    No stats recorded yet
                  </td>
                </tr>
              )}
              {statsEntries.map(({ player, stats }) => {
                if (!player) return null;
                const pm = getPlayerPlusMinus(stats);
                const hitPct = getHittingPercentage(stats);
                return (
                  <tr key={stats.playerId} className="border-b border-slate-700/50">
                    <td className="py-2 pr-2 font-bold">{player.jerseyNumber}</td>
                    <td className="py-2 pr-2">{player.displayName}</td>
                    <td className="py-2 px-1 text-center">{stats.kills}</td>
                    <td className="py-2 px-1 text-center">{stats.attackErrors}</td>
                    <td className="py-2 px-1 text-center">
                      {hitPct !== null ? hitPct.toFixed(3) : '-'}
                    </td>
                    <td className="py-2 px-1 text-center">{stats.aces}</td>
                    <td className="py-2 px-1 text-center">{stats.serviceErrors}</td>
                    <td className="py-2 px-1 text-center">{stats.digs}</td>
                    <td className="py-2 px-1 text-center">{stats.blocks}</td>
                    <td className="py-2 px-1 text-center">{stats.assists}</td>
                    <td className={`py-2 px-1 text-center font-medium ${
                      pm > 0 ? 'text-green-400' : pm < 0 ? 'text-red-400' : 'text-slate-400'
                    }`}>
                      {pm > 0 ? `+${pm}` : pm}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Export/Import */}
        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={handleExport}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium touch-manipulation"
          >
            Export CSV (Hudl-compatible)
          </button>
          <label className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium touch-manipulation cursor-pointer">
            Import Hudl CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>

        {importMsg && (
          <div className={`text-sm mb-4 ${importMsg.includes('failed') ? 'text-red-400' : 'text-green-400'}`}>
            {importMsg}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-medium touch-manipulation"
        >
          Close
        </button>
      </div>
    </div>
  );
}
