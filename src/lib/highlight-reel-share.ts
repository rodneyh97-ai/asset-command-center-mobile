import type { HighlightReel, FilmClip, Player, Match } from '@/domain/types';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatReelForSharing(
  reel: HighlightReel,
  clips: FilmClip[],
  players: Player[],
  match?: Match,
): string {
  const lines: string[] = [];

  lines.push(reel.title);
  if (reel.description) lines.push(reel.description);
  if (match) lines.push(`vs ${match.opponentName}`);
  lines.push('');

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const timeRange = clip.endSeconds != null
      ? `${formatTime(clip.startSeconds)} - ${formatTime(clip.endSeconds)}`
      : formatTime(clip.startSeconds);

    const player = clip.playerId ? players.find((p) => p.id === clip.playerId) : null;
    const playerStr = player ? ` | #${player.jerseyNumber} ${player.displayName}` : '';
    const scoreStr = clip.score ? ` | ${clip.score}` : '';

    lines.push(`${i + 1}. [${timeRange}] ${clip.label}${playerStr}${scoreStr}`);

    if (clip.notes) lines.push(`   ${clip.notes}`);
  }

  if (clips.length > 0 && clips[0].filmUrl) {
    lines.push('');
    lines.push(`Film: ${clips[0].filmUrl}`);
  }

  return lines.join('\n');
}

export async function shareReel(text: string, title?: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: title || 'Highlight Reel', text });
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
