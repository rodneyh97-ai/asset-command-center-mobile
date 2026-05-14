import * as SecureStore from 'expo-secure-store';

const API_KEY_STORAGE_KEY = 'no_bs_ai_api_key';

export async function saveApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, key.trim());
}

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
}

export async function hasApiKey(): Promise<boolean> {
  const key = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
  return key !== null && key.length > 0;
}

export async function clearApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
}
