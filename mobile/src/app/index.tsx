import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { CATALOG, isSaved, mealTimeFor, violatesDiet, type MealIdea } from '../engine';
import { useStore } from '../store/AppProvider';
import { defaultContext, pendingRating, recentMealIds, weeklyReflection, type SavedContext } from '../store/state';
import { Body, Button, Card, ChipGroup, Heading, Screen, Small, Title } from '../ui/components';
import { BUDGETS, BUDGET_SHORT, FEELINGS, HUNGER, SETTINGS, TIMES } from '../ui/labels';
import { space, useColors } from '../ui/theme';

const GREETING = { breakfast: 'Good morning.', lunch: 'Lunchtime.', dinner: 'Dinnertime.', snack: 'Hungry?' };

export default function Home() {
  const { state, ready, dispatch, track, feedback } = useStore();
  const c = useColors();
  const [editing, setEditing] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const now = new Date();

  const profile = state.profile;

  // Saved + recent meals, re-checked against current allergies/diet (they may have changed since).
  const quickPicks = useMemo(() => {
    if (!profile) return [];
    const ids = [
      ...CATALOG.filter((m) => isSaved(m.id, state.history)).map((m) => m.id),
      ...recentMealIds(state.history),
    ];
    const unique = [...new Set(ids)];
    return unique
      .map((id) => CATALOG.find((m) => m.id === id))
      .filter((m): m is MealIdea => !!m)
      .filter((m) => !m.contains.some((a) => profile.allergens.includes(a)) && !violatesDiet(m, profile))
      .slice(0, 4);
  }, [profile, state.history]);

  if (!ready) return null;
  if (!profile) return <Redirect href="/onboarding" />;

  const ctx: SavedContext = state.lastContext ?? defaultContext(profile);

  const setCtx = (patch: Partial<SavedContext>) => dispatch({ type: 'setLastContext', context: { ...ctx, ...patch } });
  const pending = pendingRating(state.history, now);
  const pendingMeal = pending ? CATALOG.find((m) => m.id === pending.mealId) : undefined;
  const week = weeklyReflection(state.history, now);
  const label = <T extends string | number>(opts: { value: T; label: string }[], v: T) =>
    opts.find((o) => o.value === v)?.label ?? '';

  const decide = () => {
    dispatch({ type: 'setLastContext', context: ctx });
    track('decide_started', { setting: ctx.setting });
    router.push('/decide');
  };

  const repeat = (m: MealIdea) => {
    feedback(m.id, 'accepted');
    track('repeat_meal');
    setConfirmation(`${m.name} it is. Enjoy.`);
  };

  const rate = (kind: 'loved' | 'fine' | 'disliked') => {
    if (!pending) return;
    feedback(pending.mealId, kind);
    track('meal_rated', { rating: kind });
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Small>{GREETING[mealTimeFor(now)]}</Small>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Preferences"
          onPress={() => router.push('/settings')}
          hitSlop={12}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Small muted={false}>Preferences</Small>
        </Pressable>
      </View>

      <Title>What should I eat?</Title>

      {pendingMeal ? (
        <Card>
          <Body>How was the {pendingMeal.name.toLowerCase()}?</Body>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Loved it" variant="secondary" onPress={() => rate('loved')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="It was fine" variant="secondary" onPress={() => rate('fine')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Not again" variant="secondary" onPress={() => rate('disliked')} />
            </View>
          </View>
        </Card>
      ) : null}

      <ChipGroup label="Where are you eating?" options={SETTINGS} value={ctx.setting} onChange={(v) => setCtx({ setting: v })} />

      {editing ? (
        <>
          <ChipGroup label="How hungry?" options={HUNGER} value={ctx.hunger} onChange={(v) => setCtx({ hunger: v })} />
          <ChipGroup label="Time until you eat" options={TIMES} value={ctx.time} onChange={(v) => setCtx({ time: v })} />
          <ChipGroup label="Budget" options={BUDGETS} value={ctx.budget} onChange={(v) => setCtx({ budget: v })} />
          <ChipGroup label="How are you feeling?" options={FEELINGS} value={ctx.feeling} onChange={(v) => setCtx({ feeling: v })} />
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Current settings: ${label(HUNGER, ctx.hunger)}, ${label(TIMES, ctx.time)}, budget ${BUDGET_SHORT[ctx.budget]}, feeling ${label(FEELINGS, ctx.feeling)}. Tap to change.`}
          onPress={() => setEditing(true)}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Small>
            {label(HUNGER, ctx.hunger)} · {label(TIMES, ctx.time)} · {BUDGET_SHORT[ctx.budget]} · {label(FEELINGS, ctx.feeling)}
            {'  '}
            <Small muted={false}>Change</Small>
          </Small>
        </Pressable>
      )}

      <Button big label="Help me decide" onPress={decide} hint="Shows one recommendation and two alternatives" />

      {confirmation ? <Body>{confirmation}</Body> : null}

      {quickPicks.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Heading>Have again</Heading>
          {quickPicks.map((m) => (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              accessibilityLabel={`Have ${m.name} again`}
              onPress={() => repeat(m)}
              style={({ pressed }) => ({
                minHeight: 56,
                padding: space.md,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.surface,
                opacity: pressed ? 0.7 : 1,
                justifyContent: 'center',
              })}
            >
              <Body>{m.name}</Body>
              <Small>{isSaved(m.id, state.history) ? 'Saved' : 'Recent'} · tap to have it again</Small>
            </Pressable>
          ))}
        </View>
      ) : null}

      {week.decisions > 0 ? (
        <Small>
          This week: {week.decisions} {week.decisions === 1 ? 'meal' : 'meals'} decided across {week.activeDays}{' '}
          {week.activeDays === 1 ? 'day' : 'days'}.
        </Small>
      ) : null}
    </Screen>
  );
}
