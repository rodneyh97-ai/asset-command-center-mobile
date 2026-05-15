import { PROXY_URL, APP_SECRET } from '../constants/config';
import { getOrCreateDeviceId } from './deviceId';

export interface SuggestionPayload {
  title: string;
  description: string;
  exampleInput?: string;
}

export async function submitSuggestion(
  payload: SuggestionPayload,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const deviceId = await getOrCreateDeviceId();
  try {
    const res = await fetch(`${PROXY_URL}/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Secret': APP_SECRET },
      body: JSON.stringify({ deviceId, ...payload }),
    });
    const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? 'UNKNOWN' };
    return { ok: true, id: data.id };
  } catch {
    return { ok: false, error: 'NETWORK_ERROR' };
  }
}

// Fire-and-forget — called when the user shares a result
export async function trackShareEvent(modeId: string): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  fetch(`${PROXY_URL}/analytics/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Secret': APP_SECRET },
    body: JSON.stringify({ deviceId, modeId }),
  }).catch(() => {
    // Analytics is non-critical — never throw
  });
}
