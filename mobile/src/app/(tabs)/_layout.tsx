import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';

import { useColors } from '../../ui/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'history', title: 'History', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  { name: 'favorites', title: 'Favorites', icon: 'heart-outline', iconActive: 'heart' },
  { name: 'search', title: 'Search', icon: 'search-outline', iconActive: 'search' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.tabInactive,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarAccessibilityLabel: t.title,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? t.iconActive : t.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
