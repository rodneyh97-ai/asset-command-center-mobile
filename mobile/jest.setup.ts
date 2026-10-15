jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  setNotificationChannelAsync: jest.fn(async () => null),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));

jest.mock('@sentry/react-native', () => {
  const options: Record<string, unknown> = {};
  return {
    init: jest.fn((o: Record<string, unknown>) => Object.assign(options, o)),
    captureException: jest.fn(),
    getClient: jest.fn(() => ({ getOptions: () => options })),
  };
});

jest.mock('expo-local-authentication', () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  getEnrolledLevelAsync: jest.fn(async () => 3),
  authenticateAsync: jest.fn(async () => ({ success: true })),
}));
