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
  SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' },
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

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(async () => true),
  requestReview: jest.fn(async () => {}),
}));

jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: jest.fn(() => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`) };
});

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 39.0997, longitude: -94.5786 } })),
  geocodeAsync: jest.fn(async () => [{ latitude: 39.0389, longitude: -94.5922 }]),
}));

jest.mock('react-native-maps', () => {
  const { View } = jest.requireActual('react-native');
  const MapView = (props: object) => jest.requireActual('react').createElement(View, { ...props, testID: 'map' });
  const Marker = (props: { title?: string }) => jest.requireActual('react').createElement(View, { accessibilityLabel: `Pin: ${props.title}` });
  return { __esModule: true, default: MapView, Marker };
});
