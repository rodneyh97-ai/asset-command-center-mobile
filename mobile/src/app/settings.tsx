import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Share } from 'react-native';

import { crashSummaryLines, readCrashes } from '../analytics/crash';
import { summaryText } from '../analytics/events';
import type { Goal, Profile } from '../engine';
import { useStore } from '../store/AppProvider';
import { Body, Button, Caution, ChipGroup, Heading, MultiChipGroup, Screen, Small } from '../ui/components';
import { ALLERGENS, BUDGETS, CONSIDERATIONS, CUISINES, DIETS, GOALS, STRUGGLES } from '../ui/labels';

function confirm(title: string, message: string, ok: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: ok, style: 'destructive', onPress: onOk },
  ]);
}

export default function Settings() {
  const { state, dispatch, track, deleteAllData } = useStore();
  const [changingGoal, setChangingGoal] = useState(false);
  const p = state.profile;
  if (!p) return <Redirect href="/onboarding" />;
  const hiddenCount = new Set(state.history.filter((e) => e.kind === 'disliked').map((e) => e.mealId)).size;

  const update = (patch: Partial<Omit<Profile, 'createdAt'>>) => dispatch({ type: 'updateProfile', patch });

  const changeGoal = (goal: Goal) => {
    if (goal === p.goal) return setChangingGoal(false);
    const label = GOALS.find((g) => g.value === goal)?.label ?? goal;
    confirm('Change your main goal?', `EatOS will start optimizing for “${label}”.`, 'Change goal', () => {
      update({ goal });
      track('goal_changed');
      setChangingGoal(false);
    });
  };

  return (
    <Screen>
      <Heading>Main goal</Heading>
      {changingGoal ? (
        <ChipGroup options={GOALS} value={p.goal} onChange={changeGoal} />
      ) : (
        <>
          <Body>{GOALS.find((g) => g.value === p.goal)?.label}</Body>
          <Button label="Change goal" variant="secondary" onPress={() => setChangingGoal(true)} />
        </>
      )}

      <Heading>Allergies</Heading>
      <MultiChipGroup options={ALLERGENS} value={p.allergens} onChange={(allergens) => update({ allergens })} />
      <Heading>Diet</Heading>
      <MultiChipGroup options={DIETS} value={p.diets} onChange={(diets) => update({ diets })} />

      <Heading>Foods you enjoy</Heading>
      <MultiChipGroup options={CUISINES} value={p.cuisines} onChange={(cuisines) => update({ cuisines })} />

      <Heading>What makes eating well hard</Heading>
      <MultiChipGroup options={STRUGGLES} value={p.struggles} onChange={(struggles) => update({ struggles })} />

      <Heading>Usual budget</Heading>
      <ChipGroup options={BUDGETS} value={p.budget} onChange={(budget) => update({ budget })} />

      <Heading>Other considerations</Heading>
      <MultiChipGroup
        options={CONSIDERATIONS.filter((c) => c.value !== 'none')}
        value={p.considerations}
        onChange={(considerations) => update({ considerations })}
      />

      {hiddenCount > 0 ? (
        <>
          <Heading>Hidden meals</Heading>
          <Small>You marked {hiddenCount} {hiddenCount === 1 ? 'meal' : 'meals'} “Not for me”.</Small>
          <Button label="Show hidden meals again" variant="secondary" onPress={() => dispatch({ type: 'clearHidden' })} />
        </>
      ) : null}

      <Heading>About EatOS</Heading>
      <Caution>
        EatOS suggests general meal ideas. It is not medical or nutrition advice, and it can’t verify restaurant
        ingredients, prices, or kitchen practices. If you have a medical condition or an eating disorder, follow your
        care team’s guidance.
      </Caution>

      <Heading>Your data</Heading>
      <Small>Everything is stored only on this device. Nothing is sent anywhere unless you share it.</Small>
      <Button
        label="Share my usage summary"
        variant="secondary"
        hint="Opens the share sheet with counts only — no allergies, diets, or meals"
        onPress={async () => {
          const crashes = await readCrashes();
          const message = [summaryText(state.analytics, new Date()), ...crashSummaryLines(crashes)].join('\n');
          await Share.share({ message }).catch(() => {});
        }}
      />
      <Button
        label="Delete all my data"
        variant="danger"
        onPress={() =>
          confirm('Delete everything?', 'Your preferences, history, and saved meals will be erased from this device.', 'Delete', async () => {
            await deleteAllData();
            router.replace('/onboarding');
          })
        }
      />
    </Screen>
  );
}
