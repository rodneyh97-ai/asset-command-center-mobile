import * as Notifications from 'expo-notifications';

import { ensurePermission, syncReminders } from '../reminders';

const mocked = Notifications as jest.Mocked<typeof Notifications>;

beforeEach(() => jest.clearAllMocks());

describe('reminders', () => {
  it('schedules exactly one daily reminder per chosen meal, replacing old ones', async () => {
    await syncReminders(['lunch', 'dinner']);
    expect(mocked.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    const triggers = mocked.scheduleNotificationAsync.mock.calls.map((c) => c[0].trigger);
    expect(triggers).toEqual([
      expect.objectContaining({ type: 'daily', hour: 11, minute: 45 }),
      expect.objectContaining({ type: 'daily', hour: 17, minute: 45 }),
    ]);
  });

  it('turning all reminders off cancels everything and schedules nothing', async () => {
    await syncReminders([]);
    expect(mocked.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('copy is never guilt-based', async () => {
    await syncReminders(['breakfast', 'lunch', 'dinner']);
    for (const [req] of mocked.scheduleNotificationAsync.mock.calls) {
      const text = `${req.content.title} ${req.content.body}`;
      expect(text).not.toMatch(/forgot|missed|don't|streak|fail|guilt|should have|calorie/i);
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
