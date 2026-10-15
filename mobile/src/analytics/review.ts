// App-store rating prompt. The OS decides whether to actually show it (Apple caps it at
// 3 times a year); EatOS only asks after good experiences (see reviewDue in store/state).
import * as StoreReview from 'expo-store-review';
import { Platform } from 'react-native';

export async function askForReview(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  try {
    if (!(await StoreReview.isAvailableAsync())) return false;
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}
