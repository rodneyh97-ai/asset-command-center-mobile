import AsyncStorage from '@react-native-async-storage/async-storage';
import { FeedbackResult } from './claude';

const KEY = 'realitycheck_history_v1';
const MAX_ENTRIES = 50;

export interface HistoryEntry {
  id: string;
  timestamp: number;
  modeId: string;
  modeTitle: string;
  modeEmoji: string;
  inputPreview: string;
  result: FeedbackResult;
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export async function saveEntry(entry: HistoryEntry): Promise<void> {
  try {
    const existing = await loadHistory();
    const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // Storage failure is non-fatal
  }
}

export async function deleteEntry(id: string): Promise<void> {
  try {
    const existing = await loadHistory();
    const updated = existing.filter((e) => e.id !== id);
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // Storage failure is non-fatal
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Storage failure is non-fatal
  }
}
