import { describe, it, expect } from 'vitest';
import { validateSubstitution, getSetPointInfo } from '@/domain/substitution-validation';
import type { SetState, RulesetProfile } from '@/domain/types';

function makeSetState(overrides: Partial<SetState> = {}): SetState {
  return {
    setNumber: 1,
    ourScore: 0,
    opponentScore: 0,
    servingTeam: 'us',
    currentRotation: 1,
    courtPlayers: [
      { position: 1, playerId: 'p1' },
      { position: 2, playerId: 'p2' },
      { position: 3, playerId: 'p3' },
      { position: 4, playerId: 'p4' },
      { position: 5, playerId: 'p5' },
      { position: 6, playerId: 'p6' },
    ],
    benchPlayerIds: ['p7', 'p8'],
    substitutionCount: 0,
    timeoutsUsed: { us: 0, opponent: 0 },
    playerAvailability: [],
    substitutionHistory: [],
    liberoMovementLog: [],
    liberoIds: [],
    liberoTargetPlayerIds: [],
    liberoAutoSwapEnabled: false,
    playerStats: {},
    ...overrides,
  };
}

function makeRuleset(overrides: Partial<RulesetProfile> = {}): RulesetProfile {
  return {
    id: 'rs-1',
    name: 'Test Ruleset',
    governingBody: 'USAV',
    version: '2025',
    substitutionLimit: 12,
    reentryBehavior: 'same-position',
    liberoCountAllowed: 2,
    liberoServingRule: 'one-position',
    timeoutCount: 2,
    setTargetScore: 25,
    decidingSetTargetScore: 15,
    winByTwo: true,
    sideSwitchBehavior: 'after-set',
    strictnessLevel: 'Strict validation',
    customOverrides: {},
    ...overrides,
  };
}

describe('validateSubstitution', () => {
  it('allows a clean sub with no history', () => {
    const result = validateSubstitution(makeSetState(), 'p1', 'p7', makeRuleset());
    expect(result.allowed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('blocks when substitution limit is reached', () => {
    const state = makeSetState({ substitutionCount: 12 });
    const result = validateSubstitution(state, 'p1', 'p7', makeRuleset());
    expect(result.allowed).toBe(false);
    expect(result.errors[0]).toContain('limit reached');
  });

  it('allows when under limit', () => {
    const state = makeSetState({ substitutionCount: 11 });
    const result = validateSubstitution(state, 'p1', 'p7', makeRuleset());
    expect(result.allowed).toBe(true);
  });

  it('blocks re-entry for wrong player under same-position rule', () => {
    const state = makeSetState({
      substitutionHistory: [
        { playerOutId: 'p7', playerInId: 'p8', position: 1, timestamp: '2024-01-01T00:00:00Z' },
      ],
      courtPlayers: [
        { position: 1, playerId: 'p8' },
        { position: 2, playerId: 'p2' },
        { position: 3, playerId: 'p3' },
        { position: 4, playerId: 'p4' },
        { position: 5, playerId: 'p5' },
        { position: 6, playerId: 'p6' },
      ],
    });
    // p7 was subbed out and replaced by p8. Now trying to bring p7 back for p2 (wrong player)
    const result = validateSubstitution(state, 'p2', 'p7', makeRuleset());
    expect(result.allowed).toBe(false);
    expect(result.errors[0]).toContain('can only re-enter');
  });

  it('allows valid re-entry for same player', () => {
    const state = makeSetState({
      substitutionHistory: [
        { playerOutId: 'p1', playerInId: 'p7', position: 1, timestamp: '2024-01-01T00:00:00Z' },
      ],
      courtPlayers: [
        { position: 1, playerId: 'p7' },
        { position: 2, playerId: 'p2' },
        { position: 3, playerId: 'p3' },
        { position: 4, playerId: 'p4' },
        { position: 5, playerId: 'p5' },
        { position: 6, playerId: 'p6' },
      ],
      substitutionCount: 1,
    });
    // p1 was subbed out, replaced by p7 at position 1. Re-entering p1 for p7.
    const result = validateSubstitution(state, 'p7', 'p1', makeRuleset());
    expect(result.allowed).toBe(true);
  });

  it('treats errors as warnings under Coach warning strictness', () => {
    const state = makeSetState({ substitutionCount: 12 });
    const ruleset = makeRuleset({ strictnessLevel: 'Coach warning' });
    const result = validateSubstitution(state, 'p1', 'p7', ruleset);
    expect(result.allowed).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('skips validation for Practice / flexible', () => {
    const state = makeSetState({ substitutionCount: 999 });
    const ruleset = makeRuleset({ strictnessLevel: 'Practice / flexible' });
    const result = validateSubstitution(state, 'p1', 'p7', ruleset);
    expect(result.allowed).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('skips validation with no ruleset', () => {
    const result = validateSubstitution(makeSetState(), 'p1', 'p7', undefined);
    expect(result.allowed).toBe(true);
    expect(result.warnings[0]).toContain('No ruleset');
  });

  it('blocks all re-entry when reentryBehavior is none', () => {
    const state = makeSetState({
      substitutionHistory: [
        { playerOutId: 'p1', playerInId: 'p7', position: 1, timestamp: '2024-01-01T00:00:00Z' },
      ],
      courtPlayers: [
        { position: 1, playerId: 'p7' },
        { position: 2, playerId: 'p2' },
        { position: 3, playerId: 'p3' },
        { position: 4, playerId: 'p4' },
        { position: 5, playerId: 'p5' },
        { position: 6, playerId: 'p6' },
      ],
      substitutionCount: 1,
    });
    const ruleset = makeRuleset({ reentryBehavior: 'none' });
    const result = validateSubstitution(state, 'p7', 'p1', ruleset);
    expect(result.allowed).toBe(false);
    expect(result.errors[0]).toContain('Re-entry not allowed');
  });
});

describe('getSetPointInfo', () => {
  it('detects set point for us', () => {
    const result = getSetPointInfo(24, 20, 25, true);
    expect(result).toEqual({ team: 'us', type: 'set-point' });
  });

  it('detects set point for opponent', () => {
    const result = getSetPointInfo(20, 24, 25, true);
    expect(result).toEqual({ team: 'opponent', type: 'set-point' });
  });

  it('returns null when no set point', () => {
    const result = getSetPointInfo(20, 20, 25, true);
    expect(result).toBeNull();
  });

  it('detects set point in deuce (24-24 → next point is 25-24)', () => {
    const result = getSetPointInfo(25, 24, 25, true);
    expect(result).toEqual({ team: 'us', type: 'set-point' });
  });

  it('no set point at 24-24', () => {
    const result = getSetPointInfo(24, 24, 25, true);
    expect(result).toBeNull();
  });

  it('detects set point in deciding set to 15', () => {
    const result = getSetPointInfo(14, 10, 15, true);
    expect(result).toEqual({ team: 'us', type: 'set-point' });
  });
});
