import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { installCrashHandlers, recordCrash } from '../analytics/crash';
import { reportError } from '../analytics/sentry';
import { AppProvider } from '../store/AppProvider';
import { Body, Button, Screen, Title } from '../ui/components';
import { useColors } from '../ui/theme';

installCrashHandlers();

/** Shown instead of a blank/white screen if anything crashes while rendering. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    void recordCrash(error, true);
    reportError(error);
  }, [error]);
  const startFresh = async () => {
    try {
      // Keep a copy so nothing is lost for good, then clear the data that may be causing the crash.
      const raw = await AsyncStorage.getItem('eatos.state.v1');
      if (raw) await AsyncStorage.setItem('eatos.state.unreadable-backup', raw);
      await AsyncStorage.removeItem('eatos.state.v1');
    } finally {
      retry();
    }
  };
  return (
    <SafeAreaProvider>
      <Screen
        footer={
          <>
            <Button label="Try again" onPress={retry} />
            <Button label="Start fresh (keeps a backup)" variant="secondary" onPress={startFresh} />
          </>
        }
      >
        <Title>Something went wrong</Title>
        <Body muted>EatOS hit an unexpected problem. Your saved preferences are still on this device.</Body>
      </Screen>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const c = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="decide" />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: true,
          title: 'Preferences',
          headerStyle: { backgroundColor: c.background },
          headerTintColor: c.ink,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="auto" />
        <RootStack />
      </AppProvider>
    </SafeAreaProvider>
  );
}
