// Optional, user-controlled meal reminders. Local notifications only: nothing goes
// through a server. Off by default; permission is requested only when turned on.
// Reminders are scheduled only WINDOW_DAYS ahead and renewed whenever the app opens, so
// someone who stops using EatOS gets one "paused" note and then silence — never daily nagging.
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

export const WINDOW_DAYS = 10;
export const PAUSED_COPY = {
  title: 'Meal reminders paused',
  body: 'Looks like a busy stretch, so we paused them. Open EatOS anytime for a quick idea.',
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

/** The exact reminder times for the next WINDOW_DAYS, plus when the single "paused" note goes out. */
export function reminderPlan(meals: ReminderMeal[], now: Date): { reminders: { meal: ReminderMeal; at: Date }[]; pausedAt: Date | null } {
  if (meals.length === 0) return { reminders: [], pausedAt: null };
  const order: ReminderMeal[] = ['breakfast', 'lunch', 'dinner'];
  const chosen = order.filter((m) => meals.includes(m));
  const reminders: { meal: ReminderMeal; at: Date }[] = [];
  for (let d = 0; d < WINDOW_DAYS; d++) {
    for (const meal of chosen) {
      const t = REMINDER_TIMES[meal];
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, t.hour, t.minute);
      if (at > now) reminders.push({ meal, at });
    }
  }
  const last = REMINDER_TIMES[chosen[chosen.length - 1]];
  return { reminders, pausedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + WINDOW_DAYS, last.hour, last.minute) };
}

/** Makes scheduled reminders exactly match the user's choices, starting from now. */
export async function syncReminders(meals: ReminderMeal[], now: Date = new Date()): Promise<void> {
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
  const channel = Platform.OS === 'android' ? { channelId: 'meal-reminders' } : {};
  const plan = reminderPlan(meals, now);
  for (const r of plan.reminders) {
    await Notifications.scheduleNotificationAsync({
      content: { ...COPY[r.meal], data: { url: '/' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, ...channel },
    });
  }
  if (plan.pausedAt) {
    await Notifications.scheduleNotificationAsync({
      content: { ...PAUSED_COPY, data: { url: '/' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: plan.pausedAt, ...channel },
    });
  }
}
