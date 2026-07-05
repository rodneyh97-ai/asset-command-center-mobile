import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  MatchState,
  MatchEvent,
  RotationPosition,
  ServingTeam,
  SetState,
} from '@/domain/types';
import {
  createEvent,
  rebuildState,
  undoLastEvent,
  redoLastUndo,
  canUndo,
  canRedo,
} from '@/domain/event-sourcing';
import { matchEventRepo } from '@/db/database';

interface MatchStore {
  state: MatchState | null;
  isLoaded: boolean;

  initMatch(matchId: string, events?: MatchEvent[]): void;
  startSet(
    setNumber: number,
    courtPlayers: RotationPosition[],
    benchPlayerIds: string[],
    servingTeam: ServingTeam,
    liberoIds: string[]
  ): void;
  scoreOurPoint(): void;
  scoreOpponentPoint(): void;
  takeTimeout(team: 'us' | 'opponent'): void;
  confirmSubstitution(playerOutId: string, playerInId: string): void;
  liberoReplacement(liberoId: string, replacedPlayerId: string, isEntering: boolean): void;
  applyCorrection(corrections: Record<string, unknown>, auditNote: string): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  getCurrentSet(): SetState | null;
  reset(): void;
}

async function persistEvent(event: MatchEvent) {
  try {
    await matchEventRepo.put(event);
  } catch {
    // offline fallback - events still in memory
  }
}

async function persistEvents(events: MatchEvent[]) {
  try {
    await matchEventRepo.putMany(events);
  } catch {
    // offline fallback
  }
}

export const useMatchStore = create<MatchStore>((set, get) => ({
  state: null,
  isLoaded: false,

  initMatch(matchId: string, events?: MatchEvent[]) {
    if (events && events.length > 0) {
      const rebuilt = rebuildState(events);
      set({ state: rebuilt, isLoaded: true });
    } else {
      const event = createEvent(matchId, 'MatchCreated', { matchId }, false);
      const newState: MatchState = {
        matchId,
        sets: [],
        currentSetIndex: -1,
        matchStatus: 'In Progress',
        eventLog: [event],
        undoPointer: 1,
      };
      set({ state: newState, isLoaded: true });
      persistEvent(event);
    }
  },

  startSet(setNumber, courtPlayers, benchPlayerIds, servingTeam, liberoIds) {
    const { state } = get();
    if (!state) return;

    const event = createEvent(state.matchId, 'SetStarted', {
      setNumber,
      courtPlayers,
      benchPlayerIds,
      servingTeam,
      liberoIds,
    }, false);

    const newState = rebuildState([...state.eventLog, event]);
    if (newState) {
      set({ state: { ...newState, eventLog: [...state.eventLog, event] } });
      persistEvent(event);
    }
  },

  scoreOurPoint() {
    const { state } = get();
    if (!state) return;

    const event = createEvent(state.matchId, 'OurPoint', {});
    const updatedLog = [...state.eventLog, event];
    const newState = rebuildState(updatedLog);
    if (newState) {
      set({ state: { ...newState, eventLog: updatedLog } });
      persistEvent(event);
    }
  },

  scoreOpponentPoint() {
    const { state } = get();
    if (!state) return;

    const event = createEvent(state.matchId, 'OpponentPoint', {});
    const updatedLog = [...state.eventLog, event];
    const newState = rebuildState(updatedLog);
    if (newState) {
      set({ state: { ...newState, eventLog: updatedLog } });
      persistEvent(event);
    }
  },

  takeTimeout(team) {
    const { state } = get();
    if (!state) return;

    const event = createEvent(state.matchId, 'TimeoutTaken', { team });
    const updatedLog = [...state.eventLog, event];
    const newState = rebuildState(updatedLog);
    if (newState) {
      set({ state: { ...newState, eventLog: updatedLog } });
      persistEvent(event);
    }
  },

  confirmSubstitution(playerOutId, playerInId) {
    const { state } = get();
    if (!state) return;

    const event = createEvent(state.matchId, 'SubstitutionConfirmed', {
      playerOutId,
      playerInId,
    });
    const updatedLog = [...state.eventLog, event];
    const newState = rebuildState(updatedLog);
    if (newState) {
      set({ state: { ...newState, eventLog: updatedLog } });
      persistEvent(event);
    }
  },

  liberoReplacement(liberoId, replacedPlayerId, isEntering) {
    const { state } = get();
    if (!state) return;

    const event = createEvent(state.matchId, 'LiberoReplacement', {
      liberoId,
      replacedPlayerId,
      isEntering,
    });
    const updatedLog = [...state.eventLog, event];
    const newState = rebuildState(updatedLog);
    if (newState) {
      set({ state: { ...newState, eventLog: updatedLog } });
      persistEvent(event);
    }
  },

  applyCorrection(corrections, auditNote) {
    const { state } = get();
    if (!state) return;

    const event = createEvent(state.matchId, 'CorrectionApplied', corrections, true, auditNote);
    const updatedLog = [...state.eventLog, event];
    const newState = rebuildState(updatedLog);
    if (newState) {
      set({ state: { ...newState, eventLog: updatedLog } });
      persistEvent(event);
    }
  },

  undo() {
    const { state } = get();
    if (!state) return;
    const newState = undoLastEvent(state);
    set({ state: newState });
    persistEvents(newState.eventLog);
  },

  redo() {
    const { state } = get();
    if (!state) return;
    const newState = redoLastUndo(state);
    set({ state: newState });
    persistEvents(newState.eventLog);
  },

  canUndo() {
    const { state } = get();
    return state ? canUndo(state) : false;
  },

  canRedo() {
    const { state } = get();
    return state ? canRedo(state) : false;
  },

  getCurrentSet() {
    const { state } = get();
    if (!state || state.currentSetIndex < 0) return null;
    return state.sets[state.currentSetIndex] || null;
  },

  reset() {
    set({ state: null, isLoaded: false });
  },
}));
