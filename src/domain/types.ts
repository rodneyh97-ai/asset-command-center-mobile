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
  highlightReelUrl?: string;
  profileImageUrl?: string;
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
  filmUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type StatCategory = 'kill' | 'attackError' | 'ace' | 'serviceError' | 'dig' | 'block' | 'assist' | 'receptionError' | 'ballHandlingError';

export interface PlayerMatchStats {
  playerId: string;
  kills: number;
  attackErrors: number;
  aces: number;
  serviceErrors: number;
  digs: number;
  blocks: number;
  assists: number;
  receptionErrors: number;
  ballHandlingErrors: number;
  pointsOnCourt: number;   // points scored by team while this player was on court
  pointsAgainstOnCourt: number; // points scored by opponent while on court
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
  | 'MatchEnded'
  | 'StatRecorded';

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

export interface PlayerAvailabilityEntry {
  playerId: string;
  status: AvailabilityStatus;
  reason?: string;
}

export interface SubstitutionRecord {
  playerOutId: string;
  playerInId: string;
  position: number;
  timestamp: string;
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
  playerAvailability: PlayerAvailabilityEntry[];
  substitutionHistory: SubstitutionRecord[];
  liberoMovementLog: { liberoId: string; replacedPlayerId: string; isEntering: boolean; timestamp: string }[];
  liberoIds: string[];
  liberoTargetPlayerIds: string[];
  liberoAutoSwapEnabled: boolean;
  playerStats: Record<string, PlayerMatchStats>;
}

export interface MatchState {
  matchId: string;
  sets: SetState[];
  currentSetIndex: number;
  matchStatus: MatchStatus;
  eventLog: MatchEvent[];
  undoPointer: number;
}

// ── Practice Intelligence Module ──

export type SkillArea =
  | 'serving'
  | 'serve-receive'
  | 'attacking'
  | 'blocking'
  | 'setting'
  | 'defense'
  | 'transition'
  | 'rotation';

export type EvidenceSource = 'match-stats' | 'hudl-import' | 'coach-observation';

export type DrillIntensity = 'low' | 'medium' | 'high';

export type PracticeDuration = 60 | 90 | 120;

export type PracticePlanStatus = 'draft' | 'active' | 'completed';

export type DrillStatus = 'pending' | 'completed' | 'skipped';

export interface EvidenceRecord {
  source: EvidenceSource;
  matchId?: string;
  matchDate?: string;
  opponentName?: string;
  value: number;
  sampleSize: number;
  timestamp: string;
}

export interface PlayerWeakness {
  playerId: string;
  skillArea: SkillArea;
  metric: string;
  currentValue: number;
  benchmarkValue: number;
  evidence: EvidenceRecord[];
  confidence: number;
  description: string;
}

export interface PlayerDevelopmentPlan {
  id: string;
  teamId: string;
  playerId: string;
  generatedAt: string;
  strengths: { skillArea: SkillArea; metric: string; value: number; evidence: EvidenceRecord[] }[];
  weaknesses: PlayerWeakness[];
  recommendations: string[];
  coachNotes: string;
  updatedAt: string;
}

export interface TeamPracticePriority {
  skillArea: SkillArea;
  reason: string;
  impactScore: number;
  confidenceScore: number;
  urgencyScore: number;
  compositeScore: number;
  affectedPlayerIds: string[];
  evidence: EvidenceRecord[];
}

export interface Drill {
  id: string;
  name: string;
  skillArea: SkillArea;
  targetRoles: PlayerRole[];
  purpose: string;
  setup: string;
  execution: string;
  progressions: string[];
  successMeasurement: string;
  defaultDurationMinutes: number;
  defaultReps?: number;
  intensity: DrillIntensity;
  minPlayers: number;
  maxPlayers: number;
  isCustom: boolean;
}

export interface PracticeDrillAssignment {
  drillId: string;
  orderIndex: number;
  durationMinutes: number;
  reps?: number;
  assignedPlayerIds: string[];
  targetMetric?: string;
  targetValue?: number;
  status: DrillStatus;
  coachFeedback?: string;
  actualReps?: number;
}

export interface PracticePlan {
  id: string;
  teamId: string;
  name: string;
  date: string;
  durationMinutes: PracticeDuration;
  status: PracticePlanStatus;
  priorities: TeamPracticePriority[];
  warmup: PracticeDrillAssignment[];
  mainBlock: PracticeDrillAssignment[];
  cooldown: PracticeDrillAssignment[];
  coachOverrides: string;
  generatedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PracticeResult {
  id: string;
  practicePlanId: string;
  teamId: string;
  date: string;
  drillResults: {
    drillId: string;
    status: DrillStatus;
    coachFeedback?: string;
    actualReps?: number;
  }[];
  overallNotes: string;
  completedAt: string;
}

export interface CoachObservation {
  id: string;
  teamId: string;
  playerId: string;
  skillArea: SkillArea;
  observation: string;
  rating?: number;
  createdAt: string;
}

export interface ImprovementSnapshot {
  playerId: string;
  skillArea: SkillArea;
  metric: string;
  value: number;
  sampleSize: number;
  date: string;
  source: EvidenceSource;
}
