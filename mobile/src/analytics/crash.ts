// Zero-cost crash capture: errors are recorded on-device only and included in the
// user-shared usage summary. A hosted service (e.g. Sentry) can replace this later.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CRASH_KEY = 'eatos.crashes.v1';
const MAX_CRASHES = 50;

export interface CrashRecord {
  at: string;
  name: string;
  message: string;
  fatal: boolean;
}

function describe(e: unknown): { name: string; message: string } {
  if (e instanceof Error) return { name: e.name, message: e.message };
  return { name: 'NonError', message: typeof e === 'string' ? e : 'unknown' };
}

export async function recordCrash(e: unknown, fatal: boolean): Promise<void> {
  try {
    const { name, message } = describe(e);
    const raw = await AsyncStorage.getItem(CRASH_KEY);
    const list: CrashRecord[] = raw ? JSON.parse(raw) : [];
    list.push({ at: new Date().toISOString(), name: name.slice(0, 60), message: message.slice(0, 160), fatal });
    await AsyncStorage.setItem(CRASH_KEY, JSON.stringify(list.slice(-MAX_CRASHES)));
  } catch {
    // Never let crash reporting itself crash the app.
  }
}

export async function readCrashes(): Promise<CrashRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(CRASH_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((c) => c && typeof c.name === 'string') : [];
  } catch {
    return [];
  }
}

let installed = false;

type ErrorUtilsLike = {
  getGlobalHandler: () => ((e: unknown, isFatal?: boolean) => void) | undefined;
  setGlobalHandler: (h: (e: unknown, isFatal?: boolean) => void) => void;
};

export function installCrashHandlers(): void {
  if (installed) return;
  installed = true;
  const eu = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (eu?.getGlobalHandler) {
    const previous = eu.getGlobalHandler();
    eu.setGlobalHandler((e, isFatal) => {
      void recordCrash(e, !!isFatal);
      previous?.(e, isFatal);
    });
  }
  const w = globalThis as unknown as {
    addEventListener?: (type: string, cb: (ev: { error?: unknown; message?: unknown; reason?: unknown }) => void) => void;
  };
  if (typeof w.addEventListener === 'function' && typeof document !== 'undefined') {
    w.addEventListener('error', (ev) => void recordCrash(ev.error ?? ev.message, true));
    w.addEventListener('unhandledrejection', (ev) => void recordCrash(ev.reason, false));
  }
}

export function crashSummaryLines(crashes: CrashRecord[]): string[] {
  if (crashes.length === 0) return ['crashes: 0'];
  return [
    `crashes: ${crashes.length} (${crashes.filter((c) => c.fatal).length} fatal)`,
    ...crashes.slice(-3).map((c) => `  ${c.at.slice(0, 16)} ${c.name}: ${c.message}`),
  ];
}
