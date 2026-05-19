import AsyncStorage from '@react-native-async-storage/async-storage';
import { FREE_DAILY_LIMIT } from '../constants/config';
import { checkPremiumEntitlement } from './purchases';

const USAGE_KEY = 'rc_usage_v1';
const PREMIUM_KEY = 'rc_premium_v1';

interface UsageData {
  count: number;
  date: string; // YYYY-MM-DD local
}

function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

async function loadUsage(): Promise<UsageData> {
  const today = todayString();
  try {
    const raw = await AsyncStorage.getItem(USAGE_KEY);
    if (!raw) return { count: 0, date: today };
    const data = JSON.parse(raw) as UsageData;
    // Reset if it's a new day
    return data.date === today ? data : { count: 0, date: today };
  } catch {
    return { count: 0, date: today };
  }
}

export async function getUsageCount(): Promise<number> {
  return (await loadUsage()).count;
}

export async function getRemainingChecks(): Promise<number | null> {
  if (await isPremium()) return null; // null = unlimited
  const data = await loadUsage();
  return Math.max(0, FREE_DAILY_LIMIT - data.count);
}

export async function canMakeCheck(): Promise<boolean> {
  if (await isPremium()) return true;
  const data = await loadUsage();
  return data.count < FREE_DAILY_LIMIT;
}

export async function recordCheck(): Promise<void> {
  const today = todayString();
  const data = await loadUsage();
  try {
    await AsyncStorage.setItem(USAGE_KEY, JSON.stringify({ count: data.count + 1, date: today }));
  } catch {
    // Non-fatal — UX counter may be stale but server enforces the real limit
  }
}

// Called when server returns RATE_LIMITED — syncs local count to max
export async function markRateLimited(): Promise<void> {
  try {
    await AsyncStorage.setItem(USAGE_KEY, JSON.stringify({ count: FREE_DAILY_LIMIT, date: todayString() }));
  } catch {
    // Non-fatal
  }
}

// ── Premium status ────────────────────────────────────────────────────────────
// RevenueCat is the authoritative source when initialized (production builds).
// Falls back to an AsyncStorage flag for Expo Go and pre-RC testing.

export async function isPremium(): Promise<boolean> {
  const rcResult = await checkPremiumEntitlement();
  if (rcResult !== null) return rcResult; // RC is running — trust it completely
  try {
    return (await AsyncStorage.getItem(PREMIUM_KEY)) === 'true';
  } catch {
    return false;
  }
}

// Called after a successful RC purchase to keep the local cache in sync.
// Also used to manually unlock premium during development.
export async function unlockPremium(): Promise<void> {
  try {
    await AsyncStorage.setItem(PREMIUM_KEY, 'true');
  } catch {
    // Non-fatal
  }
}

export async function revokePremium(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREMIUM_KEY);
  } catch {
    // Non-fatal
  }
}
