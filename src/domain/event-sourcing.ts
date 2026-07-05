import { v4 as uuidv4 } from 'uuid';
import {
  MatchEvent,
  MatchEventType,
  MatchState,
  MatchStatus,
  RotationPosition,
  ServingTeam,
  SetState,
} from './types';
import { processOurPoint, processOpponentPoint } from './rotation-engine';

export function createEvent(
  matchId: string,
  eventType: MatchEventType,
  payload: Record<string, unknown>,
  undoable: boolean = true,
  auditNote?: string
): MatchEvent {
  return {
    id: uuidv4(),
    matchId,
    eventType,
    timestamp: new Date().toISOString(),
    payload,
    undoable,
    auditNote,
  };
}

function createInitialSetState(
  setNumber: number,
  courtPlayers: RotationPosition[],
  benchPlayerIds: string[],
  servingTeam: ServingTeam,
  liberoIds: string[]
): SetState {
  return {
    setNumber,
    ourScore: 0,
    opponentScore: 0,
    servingTeam,
    currentRotation: 1,
    courtPlayers,
    benchPlayerIds,
    activeLiberoId: undefined,
    liberoReplacedPlayerId: undefined,
    substitutionCount: 0,
    timeoutsUsed: { us: 0, opponent: 0 },
  };
}

export function rebuildState(events: MatchEvent[]): MatchState | null {
  const activeEvents = events.filter((e) => !e.undone);
  if (activeEvents.length === 0) return null;

  let state: MatchState = {
    matchId: '',
    sets: [],
    currentSetIndex: -1,
    matchStatus: 'Planned',
    eventLog: events,
    undoPointer: events.length,
  };

  for (const event of activeEvents) {
    state = applyEvent(state, event);
  }

  return state;
}

function applyEvent(state: MatchState, event: MatchEvent): MatchState {
  switch (event.eventType) {
    case 'MatchCreated':
      return {
        ...state,
        matchId: event.matchId,
        matchStatus: 'In Progress',
      };

    case 'SetStarted': {
      const payload = event.payload as {
        setNumber: number;
        courtPlayers: RotationPosition[];
        benchPlayerIds: string[];
        servingTeam: ServingTeam;
        liberoIds: string[];
      };
      const newSet = createInitialSetState(
        payload.setNumber,
        payload.courtPlayers,
        payload.benchPlayerIds,
        payload.servingTeam,
        payload.liberoIds
      );
      return {
        ...state,
        sets: [...state.sets, newSet],
        currentSetIndex: state.sets.length,
      };
    }

    case 'OurPoint': {
      const currentSet = state.sets[state.currentSetIndex];
      if (!currentSet) return state;
      const result = processOurPoint(currentSet);
      const updatedSets = [...state.sets];
      updatedSets[state.currentSetIndex] = result.setState;
      return { ...state, sets: updatedSets };
    }

    case 'OpponentPoint': {
      const currentSet = state.sets[state.currentSetIndex];
      if (!currentSet) return state;
      const result = processOpponentPoint(currentSet);
      const updatedSets = [...state.sets];
      updatedSets[state.currentSetIndex] = result.setState;
      return { ...state, sets: updatedSets };
    }

    case 'TimeoutTaken': {
      const currentSet = state.sets[state.currentSetIndex];
      if (!currentSet) return state;
      const team = event.payload.team as 'us' | 'opponent';
      const updatedSets = [...state.sets];
      updatedSets[state.currentSetIndex] = {
        ...currentSet,
        timeoutsUsed: {
          ...currentSet.timeoutsUsed,
          [team]: currentSet.timeoutsUsed[team] + 1,
        },
      };
      return { ...state, sets: updatedSets };
    }

    case 'SubstitutionConfirmed': {
      const currentSet = state.sets[state.currentSetIndex];
      if (!currentSet) return state;
      const { playerOutId, playerInId } = event.payload as {
        playerOutId: string;
        playerInId: string;
      };
      const updatedCourt = currentSet.courtPlayers.map((p) =>
        p.playerId === playerOutId ? { ...p, playerId: playerInId } : p
      );
      const updatedBench = currentSet.benchPlayerIds
        .filter((id) => id !== playerInId)
        .concat(playerOutId);
      const updatedSets = [...state.sets];
      updatedSets[state.currentSetIndex] = {
        ...currentSet,
        courtPlayers: updatedCourt,
        benchPlayerIds: updatedBench,
        substitutionCount: currentSet.substitutionCount + 1,
      };
      return { ...state, sets: updatedSets };
    }

    case 'LiberoReplacement': {
      const currentSet = state.sets[state.currentSetIndex];
      if (!currentSet) return state;
      const { liberoId, replacedPlayerId, isEntering } = event.payload as {
        liberoId: string;
        replacedPlayerId: string;
        isEntering: boolean;
      };
      const updatedSets = [...state.sets];
      if (isEntering) {
        const updatedCourt = currentSet.courtPlayers.map((p) =>
          p.playerId === replacedPlayerId ? { ...p, playerId: liberoId } : p
        );
        updatedSets[state.currentSetIndex] = {
          ...currentSet,
          courtPlayers: updatedCourt,
          activeLiberoId: liberoId,
          liberoReplacedPlayerId: replacedPlayerId,
        };
      } else {
        const updatedCourt = currentSet.courtPlayers.map((p) =>
          p.playerId === liberoId ? { ...p, playerId: replacedPlayerId } : p
        );
        updatedSets[state.currentSetIndex] = {
          ...currentSet,
          courtPlayers: updatedCourt,
          activeLiberoId: undefined,
          liberoReplacedPlayerId: undefined,
        };
      }
      return { ...state, sets: updatedSets };
    }

    case 'CorrectionApplied': {
      const currentSet = state.sets[state.currentSetIndex];
      if (!currentSet) return state;
      const corrections = event.payload as Record<string, unknown>;
      const updatedSets = [...state.sets];
      updatedSets[state.currentSetIndex] = {
        ...currentSet,
        ...(corrections.ourScore !== undefined && { ourScore: corrections.ourScore as number }),
        ...(corrections.opponentScore !== undefined && {
          opponentScore: corrections.opponentScore as number,
        }),
        ...(corrections.servingTeam !== undefined && {
          servingTeam: corrections.servingTeam as ServingTeam,
        }),
        ...(corrections.currentRotation !== undefined && {
          currentRotation: corrections.currentRotation as number,
        }),
        ...(corrections.courtPlayers !== undefined && {
          courtPlayers: corrections.courtPlayers as RotationPosition[],
        }),
        ...(corrections.substitutionCount !== undefined && {
          substitutionCount: corrections.substitutionCount as number,
        }),
      };
      return { ...state, sets: updatedSets };
    }

    case 'SetEnded': {
      return state;
    }

    case 'MatchEnded': {
      return { ...state, matchStatus: 'Completed' };
    }

    default:
      return state;
  }
}

export function undoLastEvent(state: MatchState): MatchState {
  const events = [...state.eventLog];
  for (let i = events.length - 1; i >= 0; i--) {
    if (!events[i].undone && events[i].undoable) {
      events[i] = { ...events[i], undone: true };
      break;
    }
  }
  const rebuilt = rebuildState(events);
  return rebuilt ? { ...rebuilt, eventLog: events } : state;
}

export function redoLastUndo(state: MatchState): MatchState {
  const events = [...state.eventLog];
  for (let i = 0; i < events.length; i++) {
    if (events[i].undone) {
      events[i] = { ...events[i], undone: false };
      break;
    }
  }
  const rebuilt = rebuildState(events);
  return rebuilt ? { ...rebuilt, eventLog: events } : state;
}

export function canUndo(state: MatchState): boolean {
  return state.eventLog.some((e) => !e.undone && e.undoable);
}

export function canRedo(state: MatchState): boolean {
  return state.eventLog.some((e) => e.undone);
}
