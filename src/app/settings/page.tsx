'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { exportBackup, importBackup, downloadBackupFile, readBackupFile } from '@/lib/export-import';
import { exportRosterCsv, importRosterCsv, downloadCsv } from '@/lib/csv-import-export';
import { playerRepo } from '@/db/database';

export default function SettingsPage() {
  const [status, setStatus] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvTeamId, setCsvTeamId] = useState('');

  const handleExport = async () => {
    try {
      setStatus('Exporting...');
      const data = await exportBackup();
      downloadBackupFile(data);
      setStatus(`Exported ${data.clubs.length} clubs, ${data.players.length} players, ${data.matches.length} matches.`);
    } catch (e) {
      setStatus('Export failed: ' + (e as Error).message);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setStatus('Reading backup file...');
      const data = await readBackupFile(file);
      const result = await importBackup(data);
      setStatus(`Imported ${result.imported} records successfully. Refresh to see changes.`);
    } catch (err) {
      setStatus('Import failed: ' + (err as Error).message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <main className="flex flex-col p-6 max-w-2xl mx-auto w-full">
      <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 text-sm">
        ← Back to Dashboard
      </Link>

      <h1 className="text-3xl font-bold mb-6">Settings & Data</h1>

      {/* Backup Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Backup & Restore</h2>
        <div className="bg-slate-800 rounded-xl p-4 space-y-4">
          <p className="text-sm text-slate-400">
            Export all data as a JSON backup file. Import to restore data on this or another device.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleExport}
              className="bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-medium touch-manipulation"
            >
              Export Backup
            </button>
            <button
              onClick={handleImportClick}
              disabled={importing}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 py-3 rounded-lg font-medium touch-manipulation"
            >
              Import Backup
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </section>

      {/* CSV Import/Export */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">CSV Import/Export</h2>
        <div className="bg-slate-800 rounded-xl p-4 space-y-4">
          <p className="text-sm text-slate-400">
            Import a roster from CSV (columns: Jersey Number, First Name, Last Name, Role).
            Export all players for a team as CSV.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Team ID (for CSV import)</label>
            <input
              type="text"
              value={csvTeamId}
              onChange={(e) => setCsvTeamId(e.target.value)}
              placeholder="Paste team ID here"
              className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px] mb-3"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={async () => {
                if (!csvTeamId.trim()) { setStatus('Enter a Team ID first.'); return; }
                try {
                  const players = await playerRepo.getByTeam(csvTeamId.trim());
                  if (players.length === 0) { setStatus('No players found for that team.'); return; }
                  const csv = exportRosterCsv(players);
                  downloadCsv(csv, `roster-${new Date().toISOString().slice(0, 10)}.csv`);
                  setStatus(`Exported ${players.length} players to CSV.`);
                } catch (e) { setStatus('Export failed: ' + (e as Error).message); }
              }}
              className="bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-medium touch-manipulation text-sm"
            >
              Export Roster CSV
            </button>
            <button
              onClick={() => csvInputRef.current?.click()}
              disabled={!csvTeamId.trim() || importing}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 py-3 rounded-lg font-medium touch-manipulation text-sm"
            >
              Import Roster CSV
            </button>
          </div>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !csvTeamId.trim()) return;
              try {
                setImporting(true);
                const text = await file.text();
                const { players, errors } = importRosterCsv(text, csvTeamId.trim());
                for (const p of players) await playerRepo.put(p);
                const msg = `Imported ${players.length} players.`;
                setStatus(errors.length > 0 ? `${msg} Warnings: ${errors.join('; ')}` : msg);
              } catch (err) {
                setStatus('CSV import failed: ' + (err as Error).message);
              } finally {
                setImporting(false);
                if (csvInputRef.current) csvInputRef.current.value = '';
              }
            }}
            className="hidden"
          />
        </div>
      </section>

      {/* About Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">About</h2>
        <div className="bg-slate-800 rounded-xl p-4 space-y-2 text-sm text-slate-400">
          <p>Volleyball Rotation App v1.0</p>
          <p>Offline-first. All data stored locally on this device.</p>
          <p>No account or internet required for match management.</p>
        </div>
      </section>

      {/* Status */}
      {status && (
        <div className="bg-slate-800 rounded-xl p-4 text-sm text-slate-300">
          {status}
        </div>
      )}
    </main>
  );
}
