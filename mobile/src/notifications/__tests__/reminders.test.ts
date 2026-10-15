import * as Notifications from 'expo-notifications';

import { ensurePermission, PAUSED_COPY, reminderPlan, syncReminders, WINDOW_DAYS } from '../reminders';

const mocked = Notifications as jest.Mocked<typeof Notifications>;

beforeEach(() => jest.clearAllMocks());

describe('reminders', () => {
  const morning = new Date(2026, 9, 15, 9, 0); // Thu 15 Oct, 9:00 local

  it('schedules each chosen meal for the next 10 days, then one "paused" note, replacing old ones', async () => {
    await syncReminders(['lunch', 'dinner'], morning);
    expect(mocked.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    const calls = mocked.scheduleNotificationAsync.mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(2 * WINDOW_DAYS + 1);
    expect(calls[0].trigger).toEqual(expect.objectContaining({ type: 'date', date: new Date(2026, 9, 15, 11, 45) }));
    expect(calls[1].trigger).toEqual(expect.objectContaining({ type: 'date', date: new Date(2026, 9, 15, 17, 45) }));
    const last = calls[calls.length - 1];
    expect(last.content.title).toBe(PAUSED_COPY.title);
    expect(last.trigger).toEqual(expect.objectContaining({ date: new Date(2026, 9, 25, 17, 45) }));
  });

  it('never schedules a reminder in the past, and stays under the iOS limit of 64', () => {
    const evening = new Date(2026, 9, 15, 20, 0);
    const plan = reminderPlan(['breakfast', 'lunch', 'dinner'], evening);
    expect(plan.reminders.every((r) => r.at > evening)).toBe(true);
    expect(plan.reminders).toHaveLength(3 * (WINDOW_DAYS - 1));
    expect(plan.reminders.length + 1).toBeLessThan(64);
    // The paused note comes after the last real reminder, so an active user never sees it.
    expect(plan.pausedAt!.getTime()).toBeGreaterThan(Math.max(...plan.reminders.map((r) => r.at.getTime())));
  });

  it('opening the app moves the window, so active users never get the paused note', () => {
    const a = reminderPlan(['dinner'], morning);
    const b = reminderPlan(['dinner'], new Date(2026, 9, 18, 9, 0));
    expect(b.pausedAt!.getTime() - a.pausedAt!.getTime()).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it('turning all reminders off cancels everything and schedules nothing', async () => {
    await syncReminders([]);
    expect(mocked.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('copy is never guilt-based', async () => {
    await syncReminders(['breakfast', 'lunch', 'dinner'], morning);
    for (const [req] of mocked.scheduleNotificationAsync.mock.calls) {
      const text = `${req.content.title} ${req.content.body}`;
      expect(text).not.toMatch(/forgot|missed|don't|streak|fail|guilt|should have|calorie|miss you/i);
    }
  });

  it('asks for permission only when not already granted, and respects "never ask again"', async () => {
    mocked.getPermissionsAsync.mockResolvedValueOnce({ granted: true } as never);
    expect(await ensurePermission()).toBe(true);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();

    mocked.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
    expect(await ensurePermission()).toBe(false);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
