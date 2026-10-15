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

const sectionConfig = {
  warmup: { icon: '\u{1F525}', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  main: { icon: '\u{1F3AF}', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  cooldown: { icon: '\u{2744}\u{FE0F}', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
};

interface DrillRowProps {
  assignment: PracticeDrillAssignment;
  drill: Drill | undefined;
  players: Player[];
  orderLabel: number;
  sectionType: 'warmup' | 'main' | 'cooldown';
  onStatusChange: (drillId: string, orderIndex: number, status: DrillStatus) => void;
  onFeedback: (drillId: string, orderIndex: number, feedback: string) => void;
}

function DrillRow({ assignment, drill, players, orderLabel, sectionType, onStatusChange, onFeedback }: DrillRowProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState(assignment.coachFeedback || '');
  const assignedPlayers = players.filter((p) => assignment.assignedPlayerIds.includes(p.id));
  const isCompleted = assignment.status === 'completed';
  const isSkipped = assignment.status === 'skipped';

  return (
    <div
      className={`rounded-xl p-4 transition-all ${
        isCompleted
          ? 'bg-emerald-500/10 border border-emerald-500/20'
          : isSkipped
            ? 'bg-slate-800/30 border border-slate-700/20 opacity-50'
            : 'bg-slate-800 border border-slate-700/30'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Status indicator */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5 ${
          isCompleted ? 'bg-emerald-500 text-white' : isSkipped ? 'bg-slate-600 text-slate-400 line-through' : 'bg-slate-700 text-slate-300'
        }`}>
          {isCompleted ? '✓' : orderLabel}
        </div>

        <div className="flex-1 min-w-0">
          <div className={`font-medium text-sm ${isCompleted ? 'text-emerald-300' : isSkipped ? 'text-slate-500 line-through' : 'text-white'}`}>
            {drill?.name || `Drill ${assignment.drillId.slice(0, 8)}`}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">
              {assignment.durationMinutes} min
            </span>
            {assignment.targetMetric && (
              <span className="text-xs text-blue-400/70 bg-blue-500/10 px-2 py-0.5 rounded-full">
                Target: {assignment.targetMetric}
                {assignment.targetValue != null && ` ${assignment.targetValue}`}
              </span>
            )}
          </div>
          {assignedPlayers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {assignedPlayers.map((p) => (
                <span
                  key={p.id}
                  className="text-xs bg-slate-700/80 text-slate-300 px-2 py-0.5 rounded-full"
                >
                  #{p.jerseyNumber} {p.displayName}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() =>
              onStatusChange(
                assignment.drillId,
                assignment.orderIndex,
                isCompleted ? 'pending' : 'completed',
              )
            }
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg touch-manipulation transition-all active:scale-95 ${
              isCompleted
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'bg-slate-700 text-slate-400 hover:bg-emerald-600/80 hover:text-white'
            }`}
            title={isCompleted ? 'Mark pending' : 'Complete'}
          >
            {'✓'}
          </button>
          <button
            onClick={() =>
              onStatusChange(
                assignment.drillId,
                assignment.orderIndex,
                isSkipped ? 'pending' : 'skipped',
              )
            }
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg touch-manipulation transition-all active:scale-95 ${
              isSkipped
                ? 'bg-slate-500 text-white'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-500 hover:text-white'
            }`}
            title={isSkipped ? 'Mark pending' : 'Skip'}
          >
            {'✕'}
          </button>
        </div>
      </div>

      {/* Feedback */}
      <div className="mt-2 pl-12">
        {!showFeedback && !assignment.coachFeedback ? (
          <button
            onClick={() => setShowFeedback(true)}
            className="text-xs text-slate-500 hover:text-blue-400 touch-manipulation min-h-[32px] transition-colors"
          >
            + Add note
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
              placeholder="Quick note..."
              className="flex-1 bg-slate-700/50 border border-slate-600/30 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 min-h-[40px] focus:border-blue-500/50 focus:outline-none"
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
  const skippedCount = allDrills.filter((d) => d.status === 'skipped').length;
  const totalCount = allDrills.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const totalMinutes = plan.durationMinutes;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const remainingMinutes = Math.max(0, totalMinutes - elapsedMinutes);
  const timeOverflow = elapsedMinutes > totalMinutes;

  const handleComplete = () => {
    setTimerRunning(false);
    onCompletePractice(overallNotes);
  };

  const renderSection = (
    title: string,
    type: 'warmup' | 'main' | 'cooldown',
    assignments: PracticeDrillAssignment[],
    isOpen: boolean,
    toggle: () => void,
  ) => {
    const cfg = sectionConfig[type];
    const sectionCompleted = assignments.filter((a) => a.status === 'completed').length;
    const sectionTotal = assignments.length;
    const sectionMinutes = assignments.reduce((sum, a) => sum + a.durationMinutes, 0);

    return (
      <div className="mb-5">
        <button
          onClick={toggle}
          className={`w-full flex items-center justify-between py-3 px-4 rounded-xl touch-manipulation min-h-[48px] transition-all ${cfg.bg} border ${cfg.border}`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{cfg.icon}</span>
            <span className={`text-sm font-semibold ${cfg.color}`}>{title}</span>
            <span className="text-xs text-slate-500">{sectionMinutes} min</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">
              {sectionCompleted}/{sectionTotal}
            </span>
            <span className="text-slate-500 text-sm">{isOpen ? '▲' : '▼'}</span>
          </div>
        </button>
        {isOpen && (
          <div className="space-y-2 mt-2">
            {assignments.length === 0 ? (
              <p className="text-sm text-slate-500 px-4 py-3 text-center">No drills in this section</p>
            ) : (
              assignments.map((a, i) => (
                <DrillRow
                  key={`${a.drillId}-${a.orderIndex}`}
                  assignment={a}
                  drill={getDrill(a.drillId)}
                  players={players}
                  orderLabel={i + 1}
                  sectionType={type}
                  onStatusChange={onUpdateDrillStatus}
                  onFeedback={onUpdateDrillFeedback}
                />
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-slate-800/95 backdrop-blur border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="text-blue-400 hover:text-blue-300 text-sm touch-manipulation min-h-[44px] flex items-center gap-1"
          >
            <span className="text-lg">{'‹'}</span> Back
          </button>

          {/* Timer */}
          <button
            onClick={() => setTimerRunning(!timerRunning)}
            className={`px-4 py-2 rounded-xl font-mono touch-manipulation min-h-[44px] flex items-center gap-2 transition-all ${
              timerRunning
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-700 text-slate-300 border border-slate-600/50'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${timerRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-lg font-bold tabular-nums">{formatTime(elapsedSeconds)}</span>
          </button>
        </div>

        <div className="mb-3">
          <h1 className="text-lg font-bold text-white">{plan.name}</h1>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <span>{new Date(plan.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <span className="text-slate-600">{'·'}</span>
            <span>{formatDuration(totalMinutes)}</span>
            <span className="text-slate-600">{'·'}</span>
            <span className={timeOverflow ? 'text-red-400 font-medium' : ''}>
              {timeOverflow ? `${elapsedMinutes - totalMinutes}m over` : `${remainingMinutes}m left`}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-3">
              <span className="text-emerald-400 font-medium">{completedCount} done</span>
              {skippedCount > 0 && <span className="text-slate-500">{skippedCount} skipped</span>}
            </div>
            <span className="text-slate-400 font-medium">
              {Math.round(progressPct)}%
            </span>
          </div>
          <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progressPct === 100 ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Drill sections */}
      <div className="flex-1 overflow-auto p-4">
        {renderSection('Warmup', 'warmup', plan.warmup, warmupOpen, () => setWarmupOpen(!warmupOpen))}
        {renderSection('Main Block', 'main', plan.mainBlock, mainOpen, () => setMainOpen(!mainOpen))}
        {renderSection('Cooldown', 'cooldown', plan.cooldown, cooldownOpen, () => setCooldownOpen(!cooldownOpen))}

        {/* Complete practice */}
        {plan.status !== 'completed' && (
          <div className="mt-4 bg-slate-800 border border-slate-700/50 rounded-2xl p-5 space-y-4">
            <div className="text-center">
              <h3 className="text-base font-semibold text-white">Wrap Up Practice</h3>
              <p className="text-xs text-slate-400 mt-0.5">Add any final notes before completing</p>
            </div>
            <textarea
              value={overallNotes}
              onChange={(e) => setOverallNotes(e.target.value)}
              placeholder="How did practice go? Any notes for next time..."
              className="w-full bg-slate-700/50 border border-slate-600/30 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-500 min-h-[80px] resize-none focus:border-blue-500/50 focus:outline-none"
            />
            <button
              onClick={handleComplete}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl text-lg font-bold text-white touch-manipulation min-h-[56px] shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-transform"
            >
              Complete Practice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
