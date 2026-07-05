'use client';

import { useState } from 'react';
import { ServingTeam, RotationPosition } from '@/domain/types';

interface CorrectMatchStateProps {
  currentOurScore: number;
  currentOpponentScore: number;
  currentServingTeam: ServingTeam;
  currentRotation: number;
  currentSubCount: number;
  onApply: (corrections: Record<string, unknown>, auditNote: string) => void;
  onClose: () => void;
}

export default function CorrectMatchState({
  currentOurScore,
  currentOpponentScore,
  currentServingTeam,
  currentRotation,
  currentSubCount,
  onApply,
  onClose,
}: CorrectMatchStateProps) {
  const [ourScore, setOurScore] = useState(currentOurScore);
  const [opponentScore, setOpponentScore] = useState(currentOpponentScore);
  const [servingTeam, setServingTeam] = useState<ServingTeam>(currentServingTeam);
  const [rotation, setRotation] = useState(currentRotation);
  const [subCount, setSubCount] = useState(currentSubCount);
  const [auditNote, setAuditNote] = useState('');

  const hasChanges =
    ourScore !== currentOurScore ||
    opponentScore !== currentOpponentScore ||
    servingTeam !== currentServingTeam ||
    rotation !== currentRotation ||
    subCount !== currentSubCount;

  const handleApply = () => {
    if (!auditNote.trim()) return;

    const corrections: Record<string, unknown> = {};
    if (ourScore !== currentOurScore) corrections.ourScore = ourScore;
    if (opponentScore !== currentOpponentScore) corrections.opponentScore = opponentScore;
    if (servingTeam !== currentServingTeam) corrections.servingTeam = servingTeam;
    if (rotation !== currentRotation) corrections.currentRotation = rotation;
    if (subCount !== currentSubCount) corrections.substitutionCount = subCount;

    onApply(corrections, auditNote.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-2">Correct Match State</h2>
        <p className="text-sm text-slate-400 mb-4">
          All corrections are logged in the audit trail.
        </p>

        <div className="space-y-4">
          {/* Scores */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Our Score</label>
              <input
                type="number"
                min={0}
                value={ourScore}
                onChange={(e) => setOurScore(Number(e.target.value))}
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Opponent Score</label>
              <input
                type="number"
                min={0}
                value={opponentScore}
                onChange={(e) => setOpponentScore(Number(e.target.value))}
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white"
              />
            </div>
          </div>

          {/* Serving Team */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Serving Team</label>
            <div className="flex gap-2">
              <button
                onClick={() => setServingTeam('us')}
                className={`flex-1 py-2 rounded-lg ${
                  servingTeam === 'us' ? 'bg-blue-600' : 'bg-slate-700'
                }`}
              >
                Us
              </button>
              <button
                onClick={() => setServingTeam('opponent')}
                className={`flex-1 py-2 rounded-lg ${
                  servingTeam === 'opponent' ? 'bg-blue-600' : 'bg-slate-700'
                }`}
              >
                Opponent
              </button>
            </div>
          </div>

          {/* Rotation */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Rotation Number (1-6)</label>
            <input
              type="number"
              min={1}
              max={6}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white"
            />
          </div>

          {/* Sub Count */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Substitution Count</label>
            <input
              type="number"
              min={0}
              value={subCount}
              onChange={(e) => setSubCount(Number(e.target.value))}
              className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white"
            />
          </div>

          {/* Audit Note (required) */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Reason for correction <span className="text-red-400">*</span>
            </label>
            <textarea
              placeholder="e.g. Score was wrong, missed a rotation, etc."
              value={auditNote}
              onChange={(e) => setAuditNote(e.target.value)}
              className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-400 resize-none"
              rows={2}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!hasChanges || !auditNote.trim()}
            className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 py-3 rounded-lg font-medium"
          >
            Apply Correction
          </button>
        </div>
      </div>
    </div>
  );
}
