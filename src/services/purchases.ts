import Purchases from 'react-native-purchases';
import type { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';
import { REVENUECAT_IOS_KEY, REVENUECAT_ANDROID_KEY, RC_ENTITLEMENT } from '../constants/config';

export type { PurchasesPackage };

let initialized = false;

export function initPurchases(): void {
  try {
    const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
    if (apiKey.includes('REPLACE_ME')) return; // not configured yet
    Purchases.configure({ apiKey });
    initialized = true;
  } catch {
    // Native module unavailable in Expo Go — all purchase calls will no-op gracefully
  }
}

export function isPurchasesInitialized(): boolean {
  return initialized;
}

// Returns true/false when RC is running, null when RC is unavailable (Expo Go / not configured)
export async function checkPremiumEntitlement(): Promise<boolean | null> {
  if (!initialized) return null;
  try {
    const info: CustomerInfo = await Purchases.getCustomerInfo();
    return RC_ENTITLEMENT in info.entitlements.active;
  } catch {
    return null;
  }
}

export interface RCOfferings {
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
}

export async function getOfferings(): Promise<RCOfferings> {
  if (!initialized) return { monthly: null, annual: null };
  try {
    const offerings = await Purchases.getOfferings();
    return {
      monthly: offerings.current?.monthly ?? null,
      annual: offerings.current?.annual ?? null,
    };
  } catch {
    return { monthly: null, annual: null };
  }
}

export type PurchaseResult =
  | { ok: true }
  | { ok: false; cancelled: boolean; error: string };

export async function purchaseRCPackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    if (RC_ENTITLEMENT in customerInfo.entitlements.active) return { ok: true };
    return { ok: false, cancelled: false, error: 'Subscription not active after purchase.' };
  } catch (e: unknown) {
    // RC throws a plain object (not an Error) with userCancelled: boolean | null
    if (e != null && typeof e === 'object' && 'userCancelled' in e && (e as Record<string, unknown>).userCancelled === true) {
      return { ok: false, cancelled: true, error: 'cancelled' };
    }
    const message = e instanceof Error ? e.message : 'Purchase failed. Please try again.';
    return { ok: false, cancelled: false, error: message };
  }
}

export async function restorePurchasesRC(): Promise<boolean> {
  if (!initialized) return false;
  try {
    const info: CustomerInfo = await Purchases.restorePurchases();
    return RC_ENTITLEMENT in info.entitlements.active;
  } catch {
    return false;
  }
}
