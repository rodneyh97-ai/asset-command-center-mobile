import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'realitycheck_device_id_v1';

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let cached: string | null = null;

export async function getOrCreateDeviceId(): Promise<string> {
  if (cached) return cached;
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
    const id = generateId();
    await AsyncStorage.setItem(KEY, id);
    cached = id;
    return id;
  } catch {
    // If storage fails, return an ephemeral ID for this session
    const id = generateId();
    cached = id;
    return id;
  }
}
