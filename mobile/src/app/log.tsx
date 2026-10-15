import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { clock } from '../clock';
import { CATALOG, mealTimeFor, type MealTime, type Setting } from '../engine';
import { useStore } from '../store/AppProvider';
import { OTHER_MEAL } from '../store/state';
import { Body, Button, ChipGroup, MealArt, Screen, Small, TextAction, Title } from '../ui/components';
import { SETTINGS } from '../ui/labels';
import { radius, space, type, useColors } from '../ui/theme';

const MEAL_TIMES: { value: MealTime; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

/** Log a meal EatOS didn't suggest, so history and learning reflect real life. */
export default function LogMeal() {
  const { state, ready, feedback, track } = useStore();
  const c = useColors();
  const [mealTime, setMealTime] = useState<MealTime>(() => mealTimeFor(clock.now()));
  const [setting, setSetting] = useState<Setting>(() => state.lastContext?.setting ?? 'home');
  const [query, setQuery] = useState('');
  const [done, setDone] = useState<string | null>(null);
  if (!ready) return null;
  if (!state.profile) return <Redirect href="/onboarding" />;

  const log = (mealId: string, name: string) => {
    if (done) return;
    feedback(mealId, 'accepted', { setting, mealTime, source: 'logged' });
    track('meal_logged', { listed: mealId !== OTHER_MEAL });
    setDone(name);
  };
  const q = query.trim().toLowerCase();
  const list = CATALOG.filter((m) => !q || `${m.name} ${m.summary}`.toLowerCase().includes(q)).slice(0, 25);

  if (done) {
    return (
      <Screen footer={<Button label="Done" onPress={() => router.back()} />}>
        <Title>Logged.</Title>
        <Body muted>
          {done} is in your history{state.eatingWith.length ? ' for both of you' : ''}. EatOS will take it into account.
        </Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <TextAction icon="chevron-back" a11yLabel="Back" onPress={() => router.back()} />
      <Title>What did you eat?</Title>
      <ChipGroup label="When" options={MEAL_TIMES} value={mealTime} onChange={setMealTime} />
      <ChipGroup label="Where" options={SETTINGS} value={setting} onChange={setSetting} />
      <TextInput
        value={query}
        onChangeText={(t) => setQuery(t.slice(0, 60))}
        maxLength={60}
        placeholder="Search, e.g. burrito, salad, eggs"
        placeholderTextColor={c.inkMuted}
        accessibilityLabel="Search meals to log"
        style={[type.body, { color: c.ink, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: space.md, backgroundColor: c.surface }]}
      />
      <View style={{ gap: space.sm }}>
        {list.map((m) => (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            accessibilityLabel={`Log ${m.name}`}
            onPress={() => log(m.id, m.name)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.7 : 1 })}
          >
            <MealArt meal={m} variant="small" />
            <Body style={{ flex: 1 }}>{m.name}</Body>
          </Pressable>
        ))}
      </View>
      <Button label="Something not listed" variant="secondary" onPress={() => log(OTHER_MEAL, 'Your meal')} />
      <Small>Not listed meals still count toward your history; EatOS just can’t learn their ingredients.</Small>
    </Screen>
  );
}
