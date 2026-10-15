// Optional, user-controlled meal reminders. Local notifications only: nothing goes
// through a server. Off by default; permission is requested only when turned on.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type ReminderMeal = 'breakfast' | 'lunch' | 'dinner';

export const REMINDER_TIMES: Record<ReminderMeal, { hour: number; minute: number; label: string }> = {
  breakfast: { hour: 7, minute: 45, label: '7:45 am' },
  lunch: { hour: 11, minute: 45, label: '11:45 am' },
  dinner: { hour: 17, minute: 45, label: '5:45 pm' },
};

// Friendly, never guilt-based. One per chosen meal per day, never more.
const COPY: Record<ReminderMeal, { title: string; body: string }> = {
  breakfast: { title: 'Breakfast in a bit?', body: 'Tap for one quick idea.' },
  lunch: { title: 'Lunch soon?', body: 'Get a good option in a few taps.' },
  dinner: { title: 'Thinking about dinner?', body: 'Let EatOS make the call.' },
};

export const remindersSupported = Platform.OS === 'ios' || Platform.OS === 'android';

let handlerSet = false;
function ensureHandler() {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Asks for permission (only if needed). Returns whether reminders can be delivered. */
export async function ensurePermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Makes scheduled reminders exactly match the user's choices. */
export async function syncReminders(meals: ReminderMeal[]): Promise<void> {
  if (!remindersSupported) return;
  ensureHandler();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (meals.length === 0) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('meal-reminders', {
      name: 'Meal reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  for (const meal of meals) {
    const t = REMINDER_TIMES[meal];
    await Notifications.scheduleNotificationAsync({
      content: { ...COPY[meal], data: { url: '/' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: t.hour,
        minute: t.minute,
        ...(Platform.OS === 'android' ? { channelId: 'meal-reminders' } : {}),
      },
    });
  }
}
