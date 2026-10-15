import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { clock } from '../clock';
import { CATALOG, mealTimeFor, safetyCheck, type MealIdea } from '../engine';
import { useStore } from '../store/AppProvider';
import { checkinDue, defaultContext, nextMealSlot, pendingRating, planStatus, quickPicksFor, weeklyReflection, type SavedContext } from '../store/state';
import { Body, Button, Card, Cautions, ChipGroup, Heading, Screen, Small, TextAction, Title } from '../ui/components';
import { BUDGETS, BUDGET_SHORT, FEELINGS, HUNGER, SETTINGS, TIMES } from '../ui/labels';
import { WeeklyCheckIn } from '../ui/CheckIn';
import { space, useColors } from '../ui/theme';

const GREETING = { breakfast: 'Good morning.', lunch: 'Lunchtime.', dinner: 'Dinnertime.', snack: 'Hungry?' };

export default function Home() {
  const { state, ready, dispatch, track, feedback } = useStore();
  const c = useColors();
  const [editing, setEditing] = useState(false);
  // 'auto' = show when due; 'thanks' = keep visible for its closing message; 'closed' = hidden this visit.
  const [checkinPhase, setCheckinPhase] = useState<'auto' | 'thanks' | 'closed'>('auto');
  const [confirmation, setConfirmation] = useState<{ text: string; mealId: string } | null>(null);
  const now = clock.now();

  const profile = state.profile;
  const setting = state.lastContext?.setting ?? 'home';
  // Re-checked against today's allergies, diet, and where the user is eating.
  const quickPicks = useMemo(
    () => (profile ? quickPicksFor(profile, state.history, setting) : []),
    [profile, state.history, setting],
  );

  // Plans whose moment has passed are dropped quietly — no guilt.
  const planExpired = !!state.plan && planStatus(state.plan, now) === 'expired';
  useEffect(() => {
    if (planExpired) {
      track('plan_missed');
      dispatch({ type: 'clearPlan' });
    }
  }, [planExpired, dispatch, track]);

  const checkinShown = checkinPhase === 'thanks' || (checkinPhase === 'auto' && ready && checkinDue(state, now));

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
    if (confirmation) return; // one repeat per visit; prevents double-tap duplicates
    feedback(m.id, 'accepted', { setting: ctx.setting, mealTime: mealTimeFor(clock.now()) });
    track('repeat_meal');
    setConfirmation({ text: `${m.name} it is. Enjoy.`, mealId: m.id });
  };

  const plan = state.plan && !planExpired ? state.plan : null;

  const planMeal = plan ? CATALOG.find((m) => m.id === plan.mealId) : undefined;
  const planSafety = plan && planMeal ? safetyCheck(planMeal, profile, plan.setting) : null;
  const planDue = plan ? planStatus(plan, now) === 'due' : false;

  const followPlan = () => {
    if (!plan || !planMeal) return;
    feedback(plan.mealId, 'accepted', { setting: plan.setting, mealTime: plan.mealTime });
    track('plan_followed');
    dispatch({ type: 'clearPlan' });
    setConfirmation({ text: `${planMeal.name}, as planned. Enjoy.`, mealId: plan.mealId });
  };
  const changePlan = () => {
    track('plan_changed');
    dispatch({ type: 'clearPlan' });
    router.push('/decide');
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
        <TextAction label="Preferences" onPress={() => router.push('/settings')} />
      </View>

      <Title>What should I eat?</Title>

      {plan && planMeal && planDue ? (
        <Card>
          <Small>Your plan for {plan.mealTime}</Small>
          <Heading>{planMeal.name}</Heading>
          {planSafety?.ok ? (
            <>
              <Cautions items={planSafety.cautions} />
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Button label="Having it" onPress={followPlan} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Change" variant="secondary" onPress={changePlan} />
                </View>
              </View>
            </>
          ) : (
            <>
              <Body muted>This no longer fits your allergies or diet, so let’s pick something else.</Body>
              <Button label="Pick something else" onPress={changePlan} />
            </>
          )}
        </Card>
      ) : null}

      {plan && planMeal && !planDue ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Small>
            Planned for {plan.mealTime}: {planMeal.name}
          </Small>
          <TextAction
            label="Cancel"
            a11yLabel={`Cancel plan for ${plan.mealTime}`}
            onPress={() => dispatch({ type: 'clearPlan' })}
          />
        </View>
      ) : null}

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
      {!plan ? (
        <Button
          label={`Plan my ${nextMealSlot(now).mealTime}`}
          variant="ghost"
          onPress={() => {
            dispatch({ type: 'setLastContext', context: ctx });
            router.push('/decide?plan=1');
          }}
        />
      ) : null}

      {confirmation ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Body style={{ flex: 1 }}>{confirmation.text}</Body>
          <TextAction
            label="Undo"
            a11yLabel="Undo, I’m not having this"
            onPress={() => {
              dispatch({ type: 'undoAccept', mealId: confirmation.mealId });
              track('repeat_undone');
              setConfirmation(null);
            }}
          />
        </View>
      ) : null}

      {quickPicks.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Heading>Have again</Heading>
          {quickPicks.map(({ meal: m, saved, cautions }) => (
            <View key={m.id} style={{ gap: space.xs }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Have ${m.name} again`}
                accessibilityState={{ disabled: !!confirmation }}
                disabled={!!confirmation}
                onPress={() => repeat(m)}
                style={({ pressed }) => ({
                  minHeight: 56,
                  padding: space.md,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: c.border,
                  backgroundColor: c.surface,
                  opacity: pressed || confirmation ? 0.6 : 1,
                  justifyContent: 'center',
                })}
              >
                <Body>{m.name}</Body>
                <Small>{saved ? 'Saved' : 'Recent'} · tap to have it again</Small>
              </Pressable>
              <Cautions items={cautions} />
            </View>
          ))}
        </View>
      ) : null}

      {checkinShown ? (
        <WeeklyCheckIn onDone={() => setCheckinPhase('thanks')} onClose={() => setCheckinPhase('closed')} />
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
