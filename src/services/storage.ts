import * as SecureStore from 'expo-secure-store';

const API_KEY_STORAGE_KEY = 'no_bs_ai_api_key';

// WHEN_UNLOCKED_THIS_DEVICE_ONLY: requires device unlock, blocks iCloud Keychain
// backup, and prevents migration to a new device.
const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function saveApiKey(key: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, key, KEYCHAIN_OPTIONS);
  } catch {
    throw new Error('Failed to save API key. Please try again.');
  }
}

export async function getApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(API_KEY_STORAGE_KEY, KEYCHAIN_OPTIONS);
  } catch {
    return null;
  }
}

export async function hasApiKey(): Promise<boolean> {
  try {
    const key = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY, KEYCHAIN_OPTIONS);
    return key !== null && key.length > 0;
  } catch {
    return false;
  }
}

export async function clearApiKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY, KEYCHAIN_OPTIONS);
  } catch {
    throw new Error('Failed to remove API key. Please try again.');
  }
}
