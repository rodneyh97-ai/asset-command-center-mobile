import { describe, it, expect } from 'vitest';
import {
  createEvent,
  rebuildState,
  undoLastEvent,
  redoLastUndo,
  canUndo,
  canRedo,
} from '@/domain/event-sourcing';
import { MatchEvent, MatchState, RotationPosition } from '@/domain/types';

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

function buildMatchWithSet(): MatchEvent[] {
  const matchId = 'match-1';
  return [
    createEvent(matchId, 'MatchCreated', { matchId }, false),
    createEvent(matchId, 'SetStarted', {
      setNumber: 1,
      courtPlayers: makePositions(),
      benchPlayerIds: ['b1', 'b2'],
      servingTeam: 'us',
      liberoIds: [],
    }, false),
  ];
}

describe('Event Sourcing', () => {
  describe('rebuildState', () => {
    it('returns null for empty event list', () => {
      expect(rebuildState([])).toBeNull();
    });

    it('rebuilds match state from MatchCreated + SetStarted', () => {
      const events = buildMatchWithSet();
      const state = rebuildState(events);

      expect(state).not.toBeNull();
      expect(state!.matchId).toBe('match-1');
      expect(state!.matchStatus).toBe('In Progress');
      expect(state!.sets.length).toBe(1);
      expect(state!.sets[0].ourScore).toBe(0);
      expect(state!.sets[0].opponentScore).toBe(0);
      expect(state!.sets[0].servingTeam).toBe('us');
    });

    it('applies OurPoint correctly when serving', () => {
      const events = [
        ...buildMatchWithSet(),
        createEvent('match-1', 'OurPoint', {}),
      ];
      const state = rebuildState(events);

      expect(state!.sets[0].ourScore).toBe(1);
      expect(state!.sets[0].servingTeam).toBe('us');
    });

    it('applies OurPoint correctly when receiving (side-out + rotation)', () => {
      const baseEvents = buildMatchWithSet();
      // Change serving team to opponent
      baseEvents[1] = createEvent('match-1', 'SetStarted', {
        setNumber: 1,
        courtPlayers: makePositions(),
        benchPlayerIds: ['b1', 'b2'],
        servingTeam: 'opponent',
        liberoIds: [],
      }, false);

      const events = [...baseEvents, createEvent('match-1', 'OurPoint', {})];
      const state = rebuildState(events);

      expect(state!.sets[0].ourScore).toBe(1);
      expect(state!.sets[0].servingTeam).toBe('us');
      // Should have rotated - p2 now at position 1
      const serverPos = state!.sets[0].courtPlayers.find((p) => p.position === 1);
      expect(serverPos?.playerId).toBe('p2');
    });

    it('applies SubstitutionConfirmed correctly', () => {
      const events = [
        ...buildMatchWithSet(),
        createEvent('match-1', 'SubstitutionConfirmed', {
          playerOutId: 'p3',
          playerInId: 'b1',
        }),
      ];
      const state = rebuildState(events);

      const courtIds = state!.sets[0].courtPlayers.map((p) => p.playerId);
      expect(courtIds).toContain('b1');
      expect(courtIds).not.toContain('p3');
      expect(state!.sets[0].benchPlayerIds).toContain('p3');
      expect(state!.sets[0].benchPlayerIds).not.toContain('b1');
      expect(state!.sets[0].substitutionCount).toBe(1);
    });

    it('applies LiberoReplacement entering correctly', () => {
      const events = [
        ...buildMatchWithSet(),
        createEvent('match-1', 'LiberoReplacement', {
          liberoId: 'libero-1',
          replacedPlayerId: 'p5',
          isEntering: true,
        }),
      ];
      const state = rebuildState(events);

      expect(state!.sets[0].activeLiberoId).toBe('libero-1');
      expect(state!.sets[0].liberoReplacedPlayerId).toBe('p5');
      const courtIds = state!.sets[0].courtPlayers.map((p) => p.playerId);
      expect(courtIds).toContain('libero-1');
      expect(courtIds).not.toContain('p5');
      // Substitution count should NOT increase
      expect(state!.sets[0].substitutionCount).toBe(0);
    });

    it('applies LiberoReplacement exiting correctly', () => {
      const events = [
        ...buildMatchWithSet(),
        createEvent('match-1', 'LiberoReplacement', {
          liberoId: 'libero-1',
          replacedPlayerId: 'p5',
          isEntering: true,
        }),
        createEvent('match-1', 'LiberoReplacement', {
          liberoId: 'libero-1',
          replacedPlayerId: 'p5',
          isEntering: false,
        }),
      ];
      const state = rebuildState(events);

      expect(state!.sets[0].activeLiberoId).toBeUndefined();
      const courtIds = state!.sets[0].courtPlayers.map((p) => p.playerId);
      expect(courtIds).toContain('p5');
      expect(courtIds).not.toContain('libero-1');
    });

    it('applies CorrectionApplied with audit note', () => {
      const events = [
        ...buildMatchWithSet(),
        createEvent('match-1', 'OurPoint', {}),
        createEvent('match-1', 'OurPoint', {}),
        createEvent('match-1', 'CorrectionApplied', {
          ourScore: 1,
        }, true, 'Scorer error - one point was double counted'),
      ];
      const state = rebuildState(events);

      expect(state!.sets[0].ourScore).toBe(1);
      const correction = events.find((e) => e.eventType === 'CorrectionApplied');
      expect(correction!.auditNote).toBe('Scorer error - one point was double counted');
    });
  });

  describe('Undo / Redo', () => {
    it('undo reverts the last undoable event', () => {
      const events = [
        ...buildMatchWithSet(),
        createEvent('match-1', 'OurPoint', {}),
        createEvent('match-1', 'OurPoint', {}),
      ];
      const state = rebuildState(events)!;
      const fullState: MatchState = { ...state, eventLog: events };

      expect(fullState.sets[0].ourScore).toBe(2);

      const afterUndo = undoLastEvent(fullState);
      expect(afterUndo.sets[0].ourScore).toBe(1);
    });

    it('redo restores an undone event', () => {
      const events = [
        ...buildMatchWithSet(),
        createEvent('match-1', 'OurPoint', {}),
        createEvent('match-1', 'OurPoint', {}),
      ];
      const state = rebuildState(events)!;
      const fullState: MatchState = { ...state, eventLog: events };

      const afterUndo = undoLastEvent(fullState);
      expect(afterUndo.sets[0].ourScore).toBe(1);

      const afterRedo = redoLastUndo(afterUndo);
      expect(afterRedo.sets[0].ourScore).toBe(2);
    });

    it('canUndo returns false when no undoable events', () => {
      const events = buildMatchWithSet(); // both are undoable: false
      const state = rebuildState(events)!;
      const fullState: MatchState = { ...state, eventLog: events };

      expect(canUndo(fullState)).toBe(false);
    });

    it('canUndo returns true when undoable events exist', () => {
      const events = [
        ...buildMatchWithSet(),
        createEvent('match-1', 'OurPoint', {}),
      ];
      const state = rebuildState(events)!;
      const fullState: MatchState = { ...state, eventLog: events };

      expect(canUndo(fullState)).toBe(true);
    });

    it('canRedo returns true after undo', () => {
      const events = [
        ...buildMatchWithSet(),
        createEvent('match-1', 'OurPoint', {}),
      ];
      const state = rebuildState(events)!;
      const fullState: MatchState = { ...state, eventLog: events };

      const afterUndo = undoLastEvent(fullState);
      expect(canRedo(afterUndo)).toBe(true);
    });

    it('undo works after state rebuild (recovery scenario)', () => {
      const events = [
        ...buildMatchWithSet(),
        createEvent('match-1', 'OurPoint', {}),
        createEvent('match-1', 'OpponentPoint', {}),
        createEvent('match-1', 'OurPoint', {}),
      ];

      // Simulate recovery: rebuild from persisted events
      const state = rebuildState(events)!;
      const fullState: MatchState = { ...state, eventLog: events };

      expect(fullState.sets[0].ourScore).toBe(2);
      expect(fullState.sets[0].opponentScore).toBe(1);

      const afterUndo = undoLastEvent(fullState);
      expect(afterUndo.sets[0].ourScore).toBe(1);
      expect(afterUndo.sets[0].opponentScore).toBe(1);
    });
  });

  describe('Timeout tracking', () => {
    it('TimeoutTaken increments the correct team counter', () => {
      const events = [
        ...buildMatchWithSet(),
        createEvent('match-1', 'TimeoutTaken', { team: 'us' }),
        createEvent('match-1', 'TimeoutTaken', { team: 'opponent' }),
        createEvent('match-1', 'TimeoutTaken', { team: 'us' }),
      ];
      const state = rebuildState(events);

      expect(state!.sets[0].timeoutsUsed.us).toBe(2);
      expect(state!.sets[0].timeoutsUsed.opponent).toBe(1);
    });
  });
});
