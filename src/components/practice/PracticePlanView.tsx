'use client';

import { useState, useEffect, useRef } from 'react';
import type {
  PracticePlan,
  PracticeDrillAssignment,
  Drill,
  Player,
  DrillStatus,
} from '@/domain/types';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface DrillRowProps {
  assignment: PracticeDrillAssignment;
  drill: Drill | undefined;
  players: Player[];
  orderLabel: number;
  onStatusChange: (drillId: string, orderIndex: number, status: DrillStatus) => void;
  onFeedback: (drillId: string, orderIndex: number, feedback: string) => void;
}

function DrillRow({ assignment, drill, players, orderLabel, onStatusChange, onFeedback }: DrillRowProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState(assignment.coachFeedback || '');

  const assignedPlayers = players.filter((p) => assignment.assignedPlayerIds.includes(p.id));

  return (
    <div
      className={`rounded-lg p-3 ${
        assignment.status === 'completed'
          ? 'bg-green-900/20 border border-green-800/30'
          : assignment.status === 'skipped'
            ? 'bg-slate-800/50 border border-slate-700/30 opacity-60'
            : 'bg-slate-800 border border-slate-700/30'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Order number */}
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300 flex-shrink-0">
          {orderLabel}
        </div>

        {/* Drill info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white text-sm truncate">
            {drill?.name || `Drill ${assignment.drillId.slice(0, 8)}`}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-400">{assignment.durationMinutes} min</span>
            {assignment.targetMetric && (
              <span className="text-xs text-slate-500">
                Target: {assignment.targetMetric}
                {assignment.targetValue != null && ` ${assignment.targetValue}`}
              </span>
            )}
          </div>
          {assignedPlayers.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {assignedPlayers.map((p) => (
                <span
                  key={p.id}
                  className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded"
                >
                  #{p.jerseyNumber}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Status buttons -- large 48px touch targets */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() =>
              onStatusChange(
                assignment.drillId,
                assignment.orderIndex,
                assignment.status === 'completed' ? 'pending' : 'completed',
              )
            }
            className={`min-w-[48px] min-h-[48px] rounded-lg flex items-center justify-center text-lg touch-manipulation ${
              assignment.status === 'completed'
                ? 'bg-green-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:bg-green-700 hover:text-white'
            }`}
            title={assignment.status === 'completed' ? 'Mark pending' : 'Complete'}
          >
            {'✓'}
          </button>
          <button
            onClick={() =>
              onStatusChange(
                assignment.drillId,
                assignment.orderIndex,
                assignment.status === 'skipped' ? 'pending' : 'skipped',
              )
            }
            className={`min-w-[48px] min-h-[48px] rounded-lg flex items-center justify-center text-lg touch-manipulation ${
              assignment.status === 'skipped'
                ? 'bg-slate-500 text-white'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-500 hover:text-white'
            }`}
            title={assignment.status === 'skipped' ? 'Mark pending' : 'Skip'}
          >
            {'✕'}
          </button>
        </div>
      </div>

      {/* Feedback area */}
      <div className="mt-2">
        {!showFeedback && !assignment.coachFeedback ? (
          <button
            onClick={() => setShowFeedback(true)}
            className="text-xs text-blue-400 hover:text-blue-300 touch-manipulation min-h-[32px]"
          >
            + Add feedback
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              onBlur={() => {
                if (feedbackText.trim()) {
                  onFeedback(assignment.drillId, assignment.orderIndex, feedbackText.trim());
                }
                if (!feedbackText.trim()) setShowFeedback(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && feedbackText.trim()) {
                  onFeedback(assignment.drillId, assignment.orderIndex, feedbackText.trim());
                }
              }}
              placeholder="Quick feedback..."
              className="flex-1 bg-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-400 min-h-[40px]"
              autoFocus={!assignment.coachFeedback}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface PracticePlanViewProps {
  plan: PracticePlan;
  drills: Drill[];
  players: Player[];
  onUpdateDrillStatus: (drillId: string, orderIndex: number, status: DrillStatus) => void;
  onUpdateDrillFeedback: (drillId: string, orderIndex: number, feedback: string) => void;
  onCompletePractice: (overallNotes: string) => void;
  onBack: () => void;
}

export default function PracticePlanView({
  plan,
  drills,
  players,
  onUpdateDrillStatus,
  onUpdateDrillFeedback,
  onCompletePractice,
  onBack,
}: PracticePlanViewProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [overallNotes, setOverallNotes] = useState('');
  const [warmupOpen, setWarmupOpen] = useState(true);
  const [mainOpen, setMainOpen] = useState(true);
  const [cooldownOpen, setCooldownOpen] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getDrill = (drillId: string) => drills.find((d) => d.id === drillId);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  const allDrills = [...plan.warmup, ...plan.mainBlock, ...plan.cooldown];
  const completedCount = allDrills.filter((d) => d.status === 'completed').length;
  const totalCount = allDrills.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const totalMinutes = plan.durationMinutes;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const remainingMinutes = Math.max(0, totalMinutes - elapsedMinutes);

  const handleComplete = () => {
    setTimerRunning(false);
    onCompletePractice(overallNotes);
  };

  const renderSection = (
    title: string,
    assignments: PracticeDrillAssignment[],
    isOpen: boolean,
    toggle: () => void,
  ) => (
    <div className="mb-4">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between py-3 px-4 bg-slate-800/80 rounded-lg touch-manipulation min-h-[48px]"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{title}</span>
          <span className="text-xs text-slate-400">
            ({assignments.filter((a) => a.status === 'completed').length}/{assignments.length})
          </span>
        </div>
        <span className="text-slate-500">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="space-y-2 mt-2">
          {assignments.length === 0 ? (
            <p className="text-sm text-slate-500 px-4 py-2">No drills in this section.</p>
          ) : (
            assignments.map((a, i) => (
              <DrillRow
                key={`${a.drillId}-${a.orderIndex}`}
                assignment={a}
                drill={getDrill(a.drillId)}
                players={players}
                orderLabel={i + 1}
                onStatusChange={onUpdateDrillStatus}
                onFeedback={onUpdateDrillFeedback}
              />
            ))
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={onBack}
            className="text-blue-400 hover:text-blue-300 text-sm touch-manipulation min-h-[44px] flex items-center"
          >
            {'←'} Back
          </button>
          <div className="flex items-center gap-3">
            {/* Timer */}
            <button
              onClick={() => setTimerRunning(!timerRunning)}
              className={`px-3 py-1.5 rounded-lg text-sm font-mono touch-manipulation min-h-[44px] ${
                timerRunning ? 'bg-green-900/50 text-green-400' : 'bg-slate-700 text-slate-300'
              }`}
            >
              {formatTime(elapsedSeconds)} {timerRunning ? '||' : '▶'}
            </button>
          </div>
        </div>

        <div>
          <h1 className="text-lg font-bold text-white">{plan.name}</h1>
          <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
            <span>{new Date(plan.date).toLocaleDateString()}</span>
            <span>{formatDuration(totalMinutes)}</span>
            <span>{remainingMinutes} min remaining</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Progress</span>
            <span>
              {completedCount}/{totalCount} drills
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Drill sections */}
      <div className="flex-1 overflow-auto p-4">
        {renderSection('Warmup', plan.warmup, warmupOpen, () => setWarmupOpen(!warmupOpen))}
        {renderSection('Main Block', plan.mainBlock, mainOpen, () => setMainOpen(!mainOpen))}
        {renderSection('Cooldown', plan.cooldown, cooldownOpen, () => setCooldownOpen(!cooldownOpen))}

        {/* Complete practice */}
        {plan.status !== 'completed' && (
          <div className="mt-6 bg-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Complete Practice</h3>
            <textarea
              value={overallNotes}
              onChange={(e) => setOverallNotes(e.target.value)}
              placeholder="Overall notes for this practice..."
              className="w-full bg-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-400 min-h-[80px] resize-none"
            />
            <button
              onClick={handleComplete}
              className="w-full py-4 bg-green-600 hover:bg-green-500 rounded-xl text-lg font-bold text-white touch-manipulation min-h-[56px]"
            >
              Complete Practice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
