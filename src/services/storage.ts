import * as SecureStore from 'expo-secure-store';

const API_KEY_STORAGE_KEY = 'no_bs_ai_api_key';

export async function saveApiKey(key: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, key.trim());
  } catch {
    throw new Error('Failed to save API key. Please try again.');
  }
}

export async function getApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function hasApiKey(): Promise<boolean> {
  try {
    const key = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
    return key !== null && key.length > 0;
  } catch {
    return false;
  }
}

export async function clearApiKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
  } catch {
    throw new Error('Failed to remove API key. Please try again.');
  }
}
