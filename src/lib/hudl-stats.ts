import { Player, PlayerMatchStats } from '@/domain/types';

const MAX_FIELD_LENGTH = 200;
const MAX_CSV_SIZE = 500 * 1024;

function sanitizeCSVField(value: string): string {
  let v = value.slice(0, MAX_FIELD_LENGTH);
  if (/^[=+\-@\t\r]/.test(v)) {
    v = "'" + v;
  }
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    v = '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

function hittingPct(kills: number, errors: number): string {
  const attempts = kills + errors;
  if (attempts === 0) return '.000';
  const pct = (kills - errors) / attempts;
  return pct.toFixed(3);
}

export function exportMatchStatsCSV(
  players: Player[],
  allSetStats: Record<string, PlayerMatchStats>[],
  opponentName: string,
  matchDate: string
): string {
  const rows: string[] = [];
  rows.push(sanitizeCSVField(`# Match vs ${opponentName} - ${matchDate}`));
  rows.push(
    'Player,Jersey,Set,Kills,Attack Errors,Hitting %,Aces,Service Errors,Digs,Blocks,Assists,Reception Errors,BHE,+/-,Points On Court,Points Against'
  );

  const playerTotals: Record<string, PlayerMatchStats> = {};

  for (let setIdx = 0; setIdx < allSetStats.length; setIdx++) {
    const setStats = allSetStats[setIdx];
    for (const [playerId, stats] of Object.entries(setStats)) {
      const player = players.find((p) => p.id === playerId);
      if (!player) continue;

      const plusMinus = stats.pointsOnCourt - stats.pointsAgainstOnCourt;
      rows.push(
        [
          sanitizeCSVField(player.displayName),
          player.jerseyNumber,
          setIdx + 1,
          stats.kills,
          stats.attackErrors,
          hittingPct(stats.kills, stats.attackErrors),
          stats.aces,
          stats.serviceErrors,
          stats.digs,
          stats.blocks,
          stats.assists,
          stats.receptionErrors,
          stats.ballHandlingErrors,
          plusMinus >= 0 ? `+${plusMinus}` : plusMinus,
          stats.pointsOnCourt,
          stats.pointsAgainstOnCourt,
        ].join(',')
      );

      if (!playerTotals[playerId]) {
        playerTotals[playerId] = {
          playerId,
          kills: 0, attackErrors: 0, aces: 0, serviceErrors: 0,
          digs: 0, blocks: 0, assists: 0, receptionErrors: 0, ballHandlingErrors: 0,
          pointsOnCourt: 0, pointsAgainstOnCourt: 0,
        };
      }
      const t = playerTotals[playerId];
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

  if (allSetStats.length > 1) {
    rows.push('');
    rows.push('# TOTALS');
    for (const [playerId, stats] of Object.entries(playerTotals)) {
      const player = players.find((p) => p.id === playerId);
      if (!player) continue;
      const plusMinus = stats.pointsOnCourt - stats.pointsAgainstOnCourt;
      rows.push(
        [
          sanitizeCSVField(player.displayName),
          player.jerseyNumber,
          'TOTAL',
          stats.kills,
          stats.attackErrors,
          hittingPct(stats.kills, stats.attackErrors),
          stats.aces,
          stats.serviceErrors,
          stats.digs,
          stats.blocks,
          stats.assists,
          stats.receptionErrors,
          stats.ballHandlingErrors,
          plusMinus >= 0 ? `+${plusMinus}` : plusMinus,
          stats.pointsOnCourt,
          stats.pointsAgainstOnCourt,
        ].join(',')
      );
    }
  }

  return rows.join('\n');
}

export function importHudlBoxScore(
  csv: string,
  players: Player[]
): Record<string, PlayerMatchStats> {
  if (csv.length > MAX_CSV_SIZE) {
    throw new Error(`CSV file too large (max ${MAX_CSV_SIZE / 1024}KB)`);
  }

  const lines = csv.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('CSV must have a header and at least one data row');

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());

  const colIndex = (names: string[]) => {
    for (const n of names) {
      const idx = header.indexOf(n.toLowerCase());
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const playerCol = colIndex(['player', 'name']);
  const jerseyCol = colIndex(['jersey', 'jersey number', '#']);
  const killsCol = colIndex(['kills']);
  const attackErrorsCol = colIndex(['attack errors', 'errors', 'hitting errors']);
  const acesCol = colIndex(['aces']);
  const serviceErrorsCol = colIndex(['service errors', 'serving errors']);
  const digsCol = colIndex(['digs']);
  const blocksCol = colIndex(['solo blocks', 'blocks', 'block solos']);
  const blockAssistsCol = colIndex(['block assists']);
  const assistsCol = colIndex(['assists']);
  const receptionErrorsCol = colIndex(['reception errors', 'passing errors']);
  const bheCol = colIndex(['ball handling errors', 'bhe']);

  const result: Record<string, PlayerMatchStats> = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^'/, ''));

    const matchedPlayer = matchPlayer(cols, playerCol, jerseyCol, players);
    if (!matchedPlayer) continue;

    const num = (idx: number) => {
      if (idx < 0 || idx >= cols.length) return 0;
      const n = parseInt(cols[idx], 10);
      return isNaN(n) ? 0 : Math.max(0, n);
    };

    const blockTotal = num(blocksCol) + num(blockAssistsCol);

    result[matchedPlayer.id] = {
      playerId: matchedPlayer.id,
      kills: num(killsCol),
      attackErrors: num(attackErrorsCol),
      aces: num(acesCol),
      serviceErrors: num(serviceErrorsCol),
      digs: num(digsCol),
      blocks: blockTotal,
      assists: num(assistsCol),
      receptionErrors: num(receptionErrorsCol),
      ballHandlingErrors: num(bheCol),
      pointsOnCourt: 0,
      pointsAgainstOnCourt: 0,
    };
  }

  return result;
}

function matchPlayer(
  cols: string[],
  playerCol: number,
  jerseyCol: number,
  players: Player[]
): Player | null {
  if (jerseyCol >= 0 && jerseyCol < cols.length) {
    const jersey = parseInt(cols[jerseyCol], 10);
    if (!isNaN(jersey)) {
      const match = players.find((p) => p.jerseyNumber === jersey);
      if (match) return match;
    }
  }

  if (playerCol >= 0 && playerCol < cols.length) {
    const name = cols[playerCol].toLowerCase().trim();
    if (name) {
      const match = players.find(
        (p) =>
          p.displayName.toLowerCase() === name ||
          `${p.firstName} ${p.lastName}`.toLowerCase() === name ||
          p.lastName.toLowerCase() === name
      );
      if (match) return match;
    }
  }

  return null;
}

export function downloadStatsCSV(csv: string, opponentName: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `match-stats-${opponentName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
