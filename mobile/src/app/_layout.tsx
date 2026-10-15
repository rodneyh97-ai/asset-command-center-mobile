import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider } from '../store/AppProvider';
import { useColors } from '../ui/theme';

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
