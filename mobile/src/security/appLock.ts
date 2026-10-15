// Optional App Lock using the phone's own Face ID / fingerprint / passcode check.
// EatOS never sees biometric data: the OS only answers "yes, it's the owner" or "no".
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/** Relock only after the app has been away this long, so quick app switches stay seamless. */
export const RELOCK_AFTER_MS = 5 * 60 * 1000;

export const lockSupported = Platform.OS === 'ios' || Platform.OS === 'android';

/** True if the phone has Face ID, a fingerprint, or at least a passcode set up. */
export async function canLock(): Promise<boolean> {
  if (!lockSupported) return false;
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

export async function authenticate(reason = 'Unlock EatOS'): Promise<boolean> {
  if (!lockSupported) return true;
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      // Fall back to the device passcode so nobody gets locked out of their own app.
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });
    return r.success;
  } catch {
    return false;
  }
}

