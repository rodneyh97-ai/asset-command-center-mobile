import { Player, MatchEvent, PlayerMatchStats, SetState } from '@/domain/types';
import { getPlayerPlusMinus, getHittingPercentage } from '@/domain/event-sourcing';

export interface PlayerHighlight {
  player: Player;
  totalStats: PlayerMatchStats;
  keyPlays: { category: string; timestamp: string; setNumber: number; gameTime: string }[];
  headline: string;
}

export interface MatchHighlightSummary {
  teamName: string;
  opponentName: string;
  matchDate: string;
  setScores: { our: number; opp: number }[];
  setsWon: number;
  setsLost: number;
  playerHighlights: PlayerHighlight[];
  mvpPlayerId: string | null;
  filmUrl?: string;
}

function formatGameTime(matchStartTime: string, eventTime: string): string {
  const start = new Date(matchStartTime).getTime();
  const event = new Date(eventTime).getTime();
  const diffMs = Math.max(0, event - start);
  const mins = Math.floor(diffMs / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const STAT_LABELS: Record<string, string> = {
  kill: 'Kill',
  attackError: 'Attack Error',
  ace: 'Ace',
  serviceError: 'Service Error',
  dig: 'Dig',
  block: 'Block',
  assist: 'Assist',
  receptionError: 'Reception Error',
  ballHandlingError: 'Ball Handling Error',
};

const POSITIVE_STATS = new Set(['kill', 'ace', 'block', 'assist', 'dig']);

function generateHeadline(player: Player, stats: PlayerMatchStats): string {
  const parts: string[] = [];
  if (stats.kills > 0) parts.push(`${stats.kills} kill${stats.kills !== 1 ? 's' : ''}`);
  if (stats.aces > 0) parts.push(`${stats.aces} ace${stats.aces !== 1 ? 's' : ''}`);
  if (stats.blocks > 0) parts.push(`${stats.blocks} block${stats.blocks !== 1 ? 's' : ''}`);
  if (stats.assists > 0) parts.push(`${stats.assists} assist${stats.assists !== 1 ? 's' : ''}`);
  if (stats.digs > 0) parts.push(`${stats.digs} dig${stats.digs !== 1 ? 's' : ''}`);
  if (parts.length === 0) return `#${player.jerseyNumber} ${player.displayName}`;
  return `#${player.jerseyNumber} ${player.displayName}: ${parts.join(', ')}`;
}

function computeMVP(highlights: PlayerHighlight[]): string | null {
  if (highlights.length === 0) return null;
  let best: PlayerHighlight | null = null;
  let bestScore = -Infinity;
  for (const h of highlights) {
    const s = h.totalStats;
    const score = s.kills * 3 + s.aces * 3 + s.blocks * 2 + s.assists * 1.5 + s.digs * 1
      - s.attackErrors * 2 - s.serviceErrors * 1.5 + getPlayerPlusMinus(s) * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  }
  return best?.player.id ?? null;
}

export function generateMatchHighlights(
  players: Player[],
  events: MatchEvent[],
  sets: SetState[],
  teamName: string,
  opponentName: string,
  filmUrl?: string,
): MatchHighlightSummary {
  const matchStart = events[0]?.timestamp ?? new Date().toISOString();
  const matchDate = new Date(matchStart).toLocaleDateString();

  const setScores = sets.map((s) => ({ our: s.ourScore, opp: s.opponentScore }));
  const setsWon = sets.filter((s) => s.ourScore > s.opponentScore).length;
  const setsLost = sets.filter((s) => s.opponentScore > s.ourScore).length;

  const statEvents = events.filter(
    (e) => e.eventType === 'StatRecorded' && !e.undone
  );

  const playerMap = new Map<string, {
    plays: { category: string; timestamp: string; setNumber: number; gameTime: string }[];
  }>();

  let currentSetNumber = 0;
  for (const event of events) {
    if (event.undone) continue;
    if (event.eventType === 'SetStarted') {
      currentSetNumber = (event.payload.setNumber as number) || currentSetNumber + 1;
    }
    if (event.eventType === 'StatRecorded') {
      const playerId = event.payload.playerId as string;
      const category = event.payload.category as string;
      if (!playerMap.has(playerId)) {
        playerMap.set(playerId, { plays: [] });
      }
      playerMap.get(playerId)!.plays.push({
        category: STAT_LABELS[category] || category,
        timestamp: event.timestamp,
        setNumber: currentSetNumber,
        gameTime: formatGameTime(matchStart, event.timestamp),
      });
    }
  }

  const totalStats: Record<string, PlayerMatchStats> = {};
  for (const set of sets) {
    for (const [playerId, stats] of Object.entries(set.playerStats)) {
      if (!totalStats[playerId]) {
        totalStats[playerId] = {
          playerId, kills: 0, attackErrors: 0, aces: 0, serviceErrors: 0,
          digs: 0, blocks: 0, assists: 0, receptionErrors: 0, ballHandlingErrors: 0,
          pointsOnCourt: 0, pointsAgainstOnCourt: 0,
        };
      }
      const t = totalStats[playerId];
      t.kills += stats.kills;
      t.attackErrors += stats.attackErrors;
      t.aces += stats.aces;
      t.serviceErrors += stats.serviceErrors;
      t.digs += stats.digs;
      t.blocks += stats.blocks;
      t.assists += stats.assists;
      t.receptionErrors += stats.receptionErrors;
      t.ballHandlingErrors += stats.ballHandlingErrors;
      t.pointsOnCourt += stats.pointsOnCourt;
      t.pointsAgainstOnCourt += stats.pointsAgainstOnCourt;
    }
  }

  const playerHighlights: PlayerHighlight[] = [];
  const relevantPlayerIds = new Set([
    ...Object.keys(totalStats),
    ...playerMap.keys(),
  ]);

  for (const playerId of relevantPlayerIds) {
    const player = players.find((p) => p.id === playerId);
    if (!player) continue;

    const stats = totalStats[playerId] || {
      playerId, kills: 0, attackErrors: 0, aces: 0, serviceErrors: 0,
      digs: 0, blocks: 0, assists: 0, receptionErrors: 0, ballHandlingErrors: 0,
      pointsOnCourt: 0, pointsAgainstOnCourt: 0,
    };

    const keyPlays = (playerMap.get(playerId)?.plays || [])
      .filter((p) => POSITIVE_STATS.has(
        Object.entries(STAT_LABELS).find(([, v]) => v === p.category)?.[0] || ''
      ));

    playerHighlights.push({
      player,
      totalStats: stats,
      keyPlays,
      headline: generateHeadline(player, stats),
    });
  }

  playerHighlights.sort((a, b) => {
    const aScore = a.totalStats.kills + a.totalStats.aces + a.totalStats.blocks;
    const bScore = b.totalStats.kills + b.totalStats.aces + b.totalStats.blocks;
    return bScore - aScore;
  });

  return {
    teamName,
    opponentName,
    matchDate,
    setScores,
    setsWon,
    setsLost,
    playerHighlights,
    mvpPlayerId: computeMVP(playerHighlights),
    filmUrl,
  };
}

export function formatHighlightForSocial(
  summary: MatchHighlightSummary,
  playerId?: string,
): string {
  const result = summary.setsWon > summary.setsLost ? 'W' : 'L';
  const scoreStr = summary.setScores.map((s) => `${s.our}-${s.opp}`).join(', ');

  if (playerId) {
    const ph = summary.playerHighlights.find((h) => h.player.id === playerId);
    if (!ph) return '';
    const isMVP = summary.mvpPlayerId === playerId;
    const lines = [
      `${ph.player.displayName} #${ph.player.jerseyNumber}${isMVP ? ' (MVP)' : ''}`,
      `${summary.teamName} vs ${summary.opponentName} | ${result} (${scoreStr})`,
      ph.headline,
    ];
    const hitPct = getHittingPercentage(ph.totalStats);
    if (hitPct !== null) lines.push(`Hitting: ${(hitPct * 100).toFixed(1)}%`);
    const pm = getPlayerPlusMinus(ph.totalStats);
    lines.push(`+/- : ${pm >= 0 ? '+' : ''}${pm}`);
    if (ph.keyPlays.length > 0) {
      lines.push('');
      lines.push('Key plays:');
      for (const play of ph.keyPlays.slice(0, 10)) {
        lines.push(`  ${play.gameTime} - ${play.category} (Set ${play.setNumber})`);
      }
    }
    if (summary.filmUrl) {
      lines.push('');
      lines.push(`Film: ${summary.filmUrl}`);
    }
    return lines.join('\n');
  }

  const lines = [
    `${summary.teamName} vs ${summary.opponentName}`,
    `${result} | Sets: ${summary.setsWon}-${summary.setsLost} (${scoreStr})`,
    `${summary.matchDate}`,
    '',
  ];

  for (const ph of summary.playerHighlights.slice(0, 6)) {
    const isMVP = summary.mvpPlayerId === ph.player.id;
    lines.push(`${isMVP ? 'MVP ' : ''}${ph.headline}`);
  }

  if (summary.filmUrl) {
    lines.push('');
    lines.push(`Film: ${summary.filmUrl}`);
  }

  return lines.join('\n');
}

export async function shareToSocial(text: string, title?: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: title || 'Match Highlights', text });
      return true;
    } catch {
      if (typeof navigator.clipboard?.writeText === 'function') {
        await navigator.clipboard.writeText(text);
      }
      return false;
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  return false;
}
