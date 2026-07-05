export type PlayerRole =
  | 'Setter'
  | 'Outside Hitter'
  | 'Middle Blocker'
  | 'Right Side'
  | 'Libero'
  | 'Defensive Specialist';

export type CoachingTag =
  | 'Six-rotation player'
  | 'Serving specialist'
  | 'Defensive specialist'
  | 'Libero eligible'
  | 'Emergency setter'
  | 'Emergency middle'
  | 'Front-row restricted'
  | 'Back-row restricted'
  | string;

export type AvailabilityStatus =
  | 'Available'
  | 'Limited'
  | 'Emergency only'
  | 'Out for set'
  | 'Out for match';

export type SystemType = '5-1' | '6-2' | '4-2' | 'Custom' | 'Blank';

export type StrictnessLevel =
  | 'Planning only'
  | 'Coach warning'
  | 'Strict validation'
  | 'Practice / flexible';

export type GoverningBody = 'USAV' | 'NFHS' | 'AAU' | 'Custom';

export type MatchStatus = 'Planned' | 'In Progress' | 'Completed' | 'Cancelled';

export type ServingTeam = 'us' | 'opponent';

export interface Club {
  id: string;
  name: string;
  logo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Season {
  id: string;
  clubId: string;
  name: string;
  year: number;
  ageGroup: string;
  notes: string;
}

export interface Team {
  id: string;
  seasonId: string;
  name: string;
  coachNames: string[];
  defaultRulesetId?: string;
  defaultSystem: SystemType;
  teamColors?: { primary: string; secondary: string };
}

export interface Player {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  jerseyNumber: number;
  primaryRole: PlayerRole;
  secondaryRoles: PlayerRole[];
  coachingTags: CoachingTag[];
  availabilityStatus: AvailabilityStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface RulesetProfile {
  id: string;
  name: string;
  governingBody: GoverningBody;
  version: string;
  substitutionLimit: number;
  reentryBehavior: 'same-position' | 'unrestricted' | 'none';
  liberoCountAllowed: number;
  liberoServingRule: 'no-serve' | 'one-position' | 'unrestricted';
  timeoutCount: number;
  setTargetScore: number;
  decidingSetTargetScore: number;
  winByTwo: boolean;
  sideSwitchBehavior: 'after-set' | 'at-8-deciding' | 'none';
  strictnessLevel: StrictnessLevel;
  customOverrides: Record<string, unknown>;
}

export interface RotationPosition {
  position: 1 | 2 | 3 | 4 | 5 | 6;
  playerId: string;
}

export interface TacticalOverlay {
  rotationNumber: number;
  type: 'serve-receive' | 'base-defense' | 'transition-offense' | 'free-ball' | 'emergency';
  playerPositions: { playerId: string; x: number; y: number }[];
  notes: string;
}

export interface Lineup {
  id: string;
  teamId: string;
  name: string;
  systemType: SystemType;
  officialRotationOrder: RotationPosition[];
  selectedLiberoIds: string[];
  tacticalOverlays: TacticalOverlay[];
  notes: string;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Match {
  id: string;
  teamId: string;
  opponentName: string;
  rulesetProfileId: string;
  lineupId: string;
  matchStatus: MatchStatus;
  currentSetNumber: number;
  createdAt: string;
  updatedAt: string;
}

export type MatchEventType =
  | 'MatchCreated'
  | 'SetStarted'
  | 'OurPoint'
  | 'OpponentPoint'
  | 'TimeoutTaken'
  | 'SubstitutionConfirmed'
  | 'LiberoReplacement'
  | 'PlayerAvailabilityChanged'
  | 'CorrectionApplied'
  | 'NoteAdded'
  | 'SetEnded'
  | 'MatchEnded';

export interface MatchEvent {
  id: string;
  matchId: string;
  eventType: MatchEventType;
  timestamp: string;
  payload: Record<string, unknown>;
  undoable: boolean;
  undone?: boolean;
  auditNote?: string;
}

export interface SetState {
  setNumber: number;
  ourScore: number;
  opponentScore: number;
  servingTeam: ServingTeam;
  currentRotation: number;
  courtPlayers: RotationPosition[];
  benchPlayerIds: string[];
  activeLiberoId?: string;
  liberoReplacedPlayerId?: string;
  substitutionCount: number;
  timeoutsUsed: { us: number; opponent: number };
}

export interface MatchState {
  matchId: string;
  sets: SetState[];
  currentSetIndex: number;
  matchStatus: MatchStatus;
  eventLog: MatchEvent[];
  undoPointer: number;
}
