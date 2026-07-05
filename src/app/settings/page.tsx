'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { exportBackup, importBackup, downloadBackupFile, readBackupFile } from '@/lib/export-import';

export default function SettingsPage() {
  const [status, setStatus] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
