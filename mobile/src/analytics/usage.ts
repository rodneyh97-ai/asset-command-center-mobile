// Opt-in anonymous usage signal: "this install opened EatOS on day N". That's all it sends —
// no food, health, profile or device identifiers. The id is a random UUID created on opt-in and
// thrown away on opt-out. Inert unless a server is configured (EXPO_PUBLIC_SUPABASE_URL/ANON_KEY).
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function usageServerConfigured(url = URL, key = KEY): boolean {
  return /^https:\/\/[a-z0-9.-]+(:\d+)?\/?$/i.test(url) && key.length > 20;
}

export const newInstallId = (): string => Crypto.randomUUID();

export interface Ping {
  install_id: string;
  day: number;
  platform: 'ios' | 'android' | 'web';
  app_version: string;
}

export function makePing(installId: string, day: number): Ping {
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  return { install_id: installId, day, platform, app_version: (Constants.expoConfig?.version ?? '0').slice(0, 20) };
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number }>;

const headers = (key: string) => ({ apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' });

/** True when the server has the ping (sent now, or already there). */
export async function sendPing(ping: Ping, opts: { url?: string; key?: string; fetchImpl?: Fetch } = {}): Promise<boolean> {
  const url = opts.url ?? URL;
  const key = opts.key ?? KEY;
  if (!usageServerConfigured(url, key)) return false;
  try {
    const res = await (opts.fetchImpl ?? (fetch as unknown as Fetch))(`${url.replace(/\/$/, '')}/rest/v1/retention_pings`, {
      method: 'POST',
      headers: headers(key),
      body: JSON.stringify(ping),
    });
    return res.ok || res.status === 409; // 409 = already recorded
  } catch {
    return false; // offline: try again next open
  }
}

/** Opt-out: ask the server to delete everything sent under this id. Best effort. */
export async function forgetInstall(installId: string, opts: { url?: string; key?: string; fetchImpl?: Fetch } = {}): Promise<boolean> {
  const url = opts.url ?? URL;
  const key = opts.key ?? KEY;
  if (!usageServerConfigured(url, key)) return false;
  try {
    const res = await (opts.fetchImpl ?? (fetch as unknown as Fetch))(`${url.replace(/\/$/, '')}/rest/v1/rpc/forget_install`, {
      method: 'POST',
      headers: headers(key),
      body: JSON.stringify({ p_install_id: installId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
