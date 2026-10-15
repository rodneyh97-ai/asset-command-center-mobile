import { v4 as uuidv4 } from 'uuid';
import {
  MatchEvent,
  MatchEventType,
  MatchState,
  MatchStatus,
  PlayerMatchStats,
  RotationPosition,
  ServingTeam,
  SetState,
  StatCategory,
} from './types';
import { processOurPoint, processOpponentPoint, getAutoLiberoSwap } from './rotation-engine';

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
  liberoIds: string[],
  liberoTargetPlayerIds: string[] = []
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
    playerAvailability: [],
    substitutionHistory: [],
    liberoMovementLog: [],
    liberoIds,
    liberoTargetPlayerIds,
    liberoAutoSwapEnabled: liberoTargetPlayerIds.length > 0,
    playerStats: {},
  };
}

/**
 * Applies any pending auto-libero swaps to the set state.
 * May apply up to two swaps (exit then enter) if a rotation causes
 * the libero to reach the front row while another target player
 * enters the back row.
 */
function applyAutoLiberoSwaps(setState: SetState, timestamp: string): SetState {
  let current = setState;

  // First pass: check if libero needs to exit
  const exitSwap = getAutoLiberoSwap(current, current.liberoIds);
  if (exitSwap && !exitSwap.isEntering) {
    const updatedCourt = current.courtPlayers.map((p) =>
      p.playerId === exitSwap.liberoId
        ? { ...p, playerId: exitSwap.replacedPlayerId }
        : p
    );
    current = {
      ...current,
      courtPlayers: updatedCourt,
      activeLiberoId: undefined,
      liberoReplacedPlayerId: undefined,
      liberoMovementLog: [
        ...current.liberoMovementLog,
        { ...exitSwap, timestamp },
      ],
    };
  }

  // Second pass: check if libero needs to enter
  const enterSwap = getAutoLiberoSwap(current, current.liberoIds);
  if (enterSwap && enterSwap.isEntering) {
    const updatedCourt = current.courtPlayers.map((p) =>
      p.playerId === enterSwap.replacedPlayerId
        ? { ...p, playerId: enterSwap.liberoId }
        : p
    );
    current = {
      ...current,
      courtPlayers: updatedCourt,
      activeLiberoId: enterSwap.liberoId,
      liberoReplacedPlayerId: enterSwap.replacedPlayerId,
      liberoMovementLog: [
        ...current.liberoMovementLog,
        { ...enterSwap, timestamp },
      ],
    };
  }

  return current;
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

function createEmptyStats(playerId: string): PlayerMatchStats {
  return {
    playerId,
    kills: 0, attackErrors: 0, aces: 0, serviceErrors: 0,
    digs: 0, blocks: 0, assists: 0, receptionErrors: 0, ballHandlingErrors: 0,
    pointsOnCourt: 0, pointsAgainstOnCourt: 0,
  };
}

function updatePlusMinus(
  setState: SetState,
  field: 'pointsOnCourt' | 'pointsAgainstOnCourt'
): SetState {
  const updatedStats = { ...setState.playerStats };
  for (const cp of setState.courtPlayers) {
    const existing = updatedStats[cp.playerId] || createEmptyStats(cp.playerId);
    updatedStats[cp.playerId] = {
      ...existing,
      [field]: existing[field] + 1,
    };
  }
  return { ...setState, playerStats: updatedStats };
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
        liberoTargetPlayerIds?: string[];
      };
      const newSet = createInitialSetState(
        payload.setNumber,
        payload.courtPlayers,
        payload.benchPlayerIds,
        payload.servingTeam,
        payload.liberoIds,
        payload.liberoTargetPlayerIds || []
      );
      // Apply initial auto-libero swap (MB may start in back row)
      const setWithLibero = applyAutoLiberoSwaps(newSet, event.timestamp);
      return {
        ...state,
        sets: [...state.sets, setWithLibero],
        currentSetIndex: state.sets.length,
      };
    }

    case 'OurPoint': {
      const currentSet = state.sets[state.currentSetIndex];
      if (!currentSet) return state;
      const result = processOurPoint(currentSet);
      const withPlusMinus = updatePlusMinus(result.setState, 'pointsOnCourt');
      const afterLibero = applyAutoLiberoSwaps(withPlusMinus, event.timestamp);
      const updatedSets = [...state.sets];
      updatedSets[state.currentSetIndex] = afterLibero;
      return { ...state, sets: updatedSets };
    }

    case 'OpponentPoint': {
      const currentSet = state.sets[state.currentSetIndex];
      if (!currentSet) return state;
      const result = processOpponentPoint(currentSet);
      const withPlusMinus = updatePlusMinus(result.setState, 'pointsAgainstOnCourt');
      const afterLibero = applyAutoLiberoSwaps(withPlusMinus, event.timestamp);
      const updatedSets = [...state.sets];
      updatedSets[state.currentSetIndex] = afterLibero;
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
      const position = currentSet.courtPlayers.find((p) => p.playerId === playerOutId)?.position || 0;
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
        substitutionHistory: [
          ...currentSet.substitutionHistory,
          { playerOutId, playerInId, position, timestamp: event.timestamp },
        ],
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
      const logEntry = { liberoId, replacedPlayerId, isEntering, timestamp: event.timestamp };
      if (isEntering) {
        const updatedCourt = currentSet.courtPlayers.map((p) =>
          p.playerId === replacedPlayerId ? { ...p, playerId: liberoId } : p
        );
        updatedSets[state.currentSetIndex] = {
          ...currentSet,
          courtPlayers: updatedCourt,
          activeLiberoId: liberoId,
          liberoReplacedPlayerId: replacedPlayerId,
          liberoMovementLog: [...currentSet.liberoMovementLog, logEntry],
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
          liberoMovementLog: [...currentSet.liberoMovementLog, logEntry],
        };
      }
      return { ...state, sets: updatedSets };
    }

    case 'PlayerAvailabilityChanged': {
      const currentSet = state.sets[state.currentSetIndex];
      if (!currentSet) return state;
      const { playerId, status, reason } = event.payload as {
        playerId: string;
        status: string;
        reason?: string;
      };
      const existing = currentSet.playerAvailability.filter((p) => p.playerId !== playerId);
      const updatedSets = [...state.sets];
      updatedSets[state.currentSetIndex] = {
        ...currentSet,
        playerAvailability: [
          ...existing,
          { playerId, status: status as any, reason },
        ],
      };
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

    case 'StatRecorded': {
      const currentSet = state.sets[state.currentSetIndex];
      if (!currentSet) return state;
      const { playerId, category } = event.payload as { playerId: string; category: StatCategory };
      const existing = currentSet.playerStats[playerId] || createEmptyStats(playerId);
      const updated = { ...existing };
      switch (category) {
        case 'kill': updated.kills++; break;
        case 'attackError': updated.attackErrors++; break;
        case 'ace': updated.aces++; break;
        case 'serviceError': updated.serviceErrors++; break;
        case 'dig': updated.digs++; break;
        case 'block': updated.blocks++; break;
        case 'assist': updated.assists++; break;
        case 'receptionError': updated.receptionErrors++; break;
        case 'ballHandlingError': updated.ballHandlingErrors++; break;
      }
      const updatedSets = [...state.sets];
      updatedSets[state.currentSetIndex] = {
        ...currentSet,
        playerStats: { ...currentSet.playerStats, [playerId]: updated },
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

export function getPlayerPlusMinus(stats: PlayerMatchStats): number {
  return stats.pointsOnCourt - stats.pointsAgainstOnCourt;
}

export function getHittingPercentage(stats: PlayerMatchStats): number | null {
  const attempts = stats.kills + stats.attackErrors;
  if (attempts === 0) return null;
  return (stats.kills - stats.attackErrors) / attempts;
}
