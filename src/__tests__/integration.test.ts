import { describe, it, expect } from 'vitest';
import {
  createEvent,
  rebuildState,
  undoLastEvent,
  redoLastUndo,
} from '@/domain/event-sourcing';
import {
  rotateClockwise,
  processOurPoint,
  processOpponentPoint,
  getCurrentServer,
  applyRotations,
} from '@/domain/rotation-engine';
import { MatchEvent, MatchState, RotationPosition, SetState } from '@/domain/types';

function makePositions(): RotationPosition[] {
  return [
    { position: 1, playerId: 'p1' },
    { position: 2, playerId: 'p2' },
    { position: 3, playerId: 'p3' },
    { position: 4, playerId: 'p4' },
    { position: 5, playerId: 'p5' },
    { position: 6, playerId: 'p6' },
  ];
}

function buildFullMatch(): MatchEvent[] {
  return [
    createEvent('m1', 'MatchCreated', { matchId: 'm1' }, false),
    createEvent('m1', 'SetStarted', {
      setNumber: 1,
      courtPlayers: makePositions(),
      benchPlayerIds: ['b1', 'b2'],
      servingTeam: 'us',
      liberoIds: [],
    }, false),
  ];
}

describe('Integration: Full Match Scenarios', () => {
  it('full rally sequence with side-outs rebuilds correctly', () => {
    const events = [
      ...buildFullMatch(),
      createEvent('m1', 'OurPoint', {}),      // 1-0, still serving
      createEvent('m1', 'OurPoint', {}),      // 2-0, still serving
      createEvent('m1', 'OpponentPoint', {}), // 2-1, opponent now serving
      createEvent('m1', 'OpponentPoint', {}), // 2-2, opponent still serving
      createEvent('m1', 'OurPoint', {}),      // 3-2, we win rally while receiving -> rotate
    ];

    const state = rebuildState(events)!;
    const set = state.sets[0];

    expect(set.ourScore).toBe(3);
    expect(set.opponentScore).toBe(2);
    expect(set.servingTeam).toBe('us');
    // After one rotation from side-out, p2 is at position 1
    expect(getCurrentServer(set.courtPlayers)).toBe('p2');
  });

  it('substitution + undo restores original court', () => {
    const events = [
      ...buildFullMatch(),
      createEvent('m1', 'SubstitutionConfirmed', { playerOutId: 'p3', playerInId: 'b1' }),
    ];

    const state = rebuildState(events)!;
    expect(state.sets[0].courtPlayers.some((p) => p.playerId === 'b1')).toBe(true);
    expect(state.sets[0].courtPlayers.some((p) => p.playerId === 'p3')).toBe(false);
    expect(state.sets[0].substitutionCount).toBe(1);

    // Undo
    const fullState: MatchState = { ...state, eventLog: events };
    const afterUndo = undoLastEvent(fullState);
    expect(afterUndo.sets[0].courtPlayers.some((p) => p.playerId === 'p3')).toBe(true);
    expect(afterUndo.sets[0].courtPlayers.some((p) => p.playerId === 'b1')).toBe(false);
    expect(afterUndo.sets[0].substitutionCount).toBe(0);
  });

  it('libero does not count as substitution', () => {
    const events = [
      ...buildFullMatch(),
      createEvent('m1', 'LiberoReplacement', {
        liberoId: 'lib1',
        replacedPlayerId: 'p5',
        isEntering: true,
      }),
    ];

    const state = rebuildState(events)!;
    expect(state.sets[0].substitutionCount).toBe(0);
    expect(state.sets[0].activeLiberoId).toBe('lib1');
    expect(state.sets[0].courtPlayers.some((p) => p.playerId === 'lib1')).toBe(true);
  });

  it('correction creates audit event and changes state', () => {
    const events = [
      ...buildFullMatch(),
      createEvent('m1', 'OurPoint', {}),
      createEvent('m1', 'OurPoint', {}),
      createEvent('m1', 'CorrectionApplied', { ourScore: 1 }, true, 'Mistap on scoring button'),
    ];

    const state = rebuildState(events)!;
    expect(state.sets[0].ourScore).toBe(1);

    const correctionEvent = events.find((e) => e.eventType === 'CorrectionApplied');
    expect(correctionEvent!.auditNote).toBe('Mistap on scoring button');
  });

  it('player availability change is tracked', () => {
    const events = [
      ...buildFullMatch(),
      createEvent('m1', 'PlayerAvailabilityChanged', {
        playerId: 'b1',
        status: 'Out for set',
        reason: 'Ankle injury',
      }),
    ];

    const state = rebuildState(events)!;
    const entry = state.sets[0].playerAvailability.find((a) => a.playerId === 'b1');
    expect(entry).toBeDefined();
    expect(entry!.status).toBe('Out for set');
    expect(entry!.reason).toBe('Ankle injury');
  });

  it('multiple undos in sequence work correctly', () => {
    const events = [
      ...buildFullMatch(),
      createEvent('m1', 'OurPoint', {}),
      createEvent('m1', 'OurPoint', {}),
      createEvent('m1', 'OurPoint', {}),
    ];

    let fullState: MatchState = { ...rebuildState(events)!, eventLog: events };
    expect(fullState.sets[0].ourScore).toBe(3);

    fullState = undoLastEvent(fullState);
    expect(fullState.sets[0].ourScore).toBe(2);

    fullState = undoLastEvent(fullState);
    expect(fullState.sets[0].ourScore).toBe(1);

    fullState = undoLastEvent(fullState);
    expect(fullState.sets[0].ourScore).toBe(0);

    // Redo all
    fullState = redoLastUndo(fullState);
    expect(fullState.sets[0].ourScore).toBe(1);

    fullState = redoLastUndo(fullState);
    expect(fullState.sets[0].ourScore).toBe(2);

    fullState = redoLastUndo(fullState);
    expect(fullState.sets[0].ourScore).toBe(3);
  });

  it('event log rebuilds exact same state (recovery simulation)', () => {
    const events = [
      ...buildFullMatch(),
      createEvent('m1', 'OurPoint', {}),
      createEvent('m1', 'OpponentPoint', {}),
      createEvent('m1', 'SubstitutionConfirmed', { playerOutId: 'p4', playerInId: 'b2' }),
      createEvent('m1', 'OurPoint', {}),
      createEvent('m1', 'TimeoutTaken', { team: 'us' }),
    ];

    // Build state once
    const state1 = rebuildState(events)!;

    // "Crash" and rebuild from same events (simulates recovery)
    const state2 = rebuildState(events)!;

    expect(state2.sets[0].ourScore).toBe(state1.sets[0].ourScore);
    expect(state2.sets[0].opponentScore).toBe(state1.sets[0].opponentScore);
    expect(state2.sets[0].servingTeam).toBe(state1.sets[0].servingTeam);
    expect(state2.sets[0].substitutionCount).toBe(state1.sets[0].substitutionCount);
    expect(state2.sets[0].timeoutsUsed.us).toBe(state1.sets[0].timeoutsUsed.us);
    expect(state2.sets[0].courtPlayers).toEqual(state1.sets[0].courtPlayers);
  });

  it('six consecutive side-outs return to original rotation', () => {
    let events = [...buildFullMatch()];
    // Set serving to opponent so our points cause rotations
    events[1] = createEvent('m1', 'SetStarted', {
      setNumber: 1,
      courtPlayers: makePositions(),
      benchPlayerIds: ['b1', 'b2'],
      servingTeam: 'opponent',
      liberoIds: [],
    }, false);

    // 6 side-outs: Our point (rotate) then opponent point (they get serve back)
    for (let i = 0; i < 6; i++) {
      events.push(createEvent('m1', 'OurPoint', {}));    // we win -> rotate, serve
      events.push(createEvent('m1', 'OpponentPoint', {})); // they win -> they serve
    }

    const state = rebuildState(events)!;
    // After 6 rotations we're back to p1 at position 1
    expect(getCurrentServer(state.sets[0].courtPlayers)).toBe('p1');
    expect(state.sets[0].ourScore).toBe(6);
    expect(state.sets[0].opponentScore).toBe(6);
  });

  it('substitution history is tracked in order', () => {
    const events = [
      ...buildFullMatch(),
      createEvent('m1', 'SubstitutionConfirmed', { playerOutId: 'p3', playerInId: 'b1' }),
      createEvent('m1', 'SubstitutionConfirmed', { playerOutId: 'p5', playerInId: 'b2' }),
    ];

    const state = rebuildState(events)!;
    expect(state.sets[0].substitutionHistory.length).toBe(2);
    expect(state.sets[0].substitutionHistory[0].playerOutId).toBe('p3');
    expect(state.sets[0].substitutionHistory[0].playerInId).toBe('b1');
    expect(state.sets[0].substitutionHistory[1].playerOutId).toBe('p5');
    expect(state.sets[0].substitutionHistory[1].playerInId).toBe('b2');
    expect(state.sets[0].substitutionCount).toBe(2);
  });

  it('libero movement log tracks entries and exits', () => {
    const events = [
      ...buildFullMatch(),
      createEvent('m1', 'LiberoReplacement', {
        liberoId: 'lib1', replacedPlayerId: 'p5', isEntering: true,
      }),
      createEvent('m1', 'LiberoReplacement', {
        liberoId: 'lib1', replacedPlayerId: 'p5', isEntering: false,
      }),
      createEvent('m1', 'LiberoReplacement', {
        liberoId: 'lib1', replacedPlayerId: 'p6', isEntering: true,
      }),
    ];

    const state = rebuildState(events)!;
    expect(state.sets[0].liberoMovementLog.length).toBe(3);
    expect(state.sets[0].liberoMovementLog[0].isEntering).toBe(true);
    expect(state.sets[0].liberoMovementLog[1].isEntering).toBe(false);
    expect(state.sets[0].liberoMovementLog[2].replacedPlayerId).toBe('p6');
    // No sub count increase
    expect(state.sets[0].substitutionCount).toBe(0);
  });
});
