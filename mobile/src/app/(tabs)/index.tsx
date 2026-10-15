import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { clock } from '../../clock';
import { CATALOG, mealTimeFor, safetyCheck, type MealIdea } from '../../engine';
import { useStore } from '../../store/AppProvider';
import {
  checkinDue,
  defaultContext,
  nextMealSlot,
  pendingRating,
  planStatus,
  quickPicksFor,
  weeklyReflection,
  type SavedContext,
} from '../../store/state';
import { WeeklyCheckIn } from '../../ui/CheckIn';
import {
  Body,
  Button,
  Card,
  Cautions,
  ChipGroup,
  EmojiTile,
  Heading,
  Icon,
  IconTile,
  Logo,
  MealArt,
  Row,
  Screen,
  SectionLabel,
  Small,
  TextAction,
  Title,
} from '../../ui/components';
import { FEELINGS, HUNGER, SETTINGS, TIMES } from '../../ui/labels';
import { space, useColors } from '../../ui/theme';

const DATE_FMT: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };

export default function Home() {
  const { state, ready, dispatch, track, feedback } = useStore();
  const c = useColors();
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

  // Budget always follows the profile; everything else remembers the last choice.
  const ctx: SavedContext = { ...(state.lastContext ?? defaultContext(profile)), budget: profile.budget };
  const setCtx = (patch: Partial<SavedContext>) => dispatch({ type: 'setLastContext', context: { ...ctx, ...patch } });

  const pending = pendingRating(state.history, now);
  const pendingMeal = pending ? CATALOG.find((m) => m.id === pending.mealId) : undefined;
  const week = weeklyReflection(state.history, now);

  const decide = () => {
    dispatch({ type: 'setLastContext', context: ctx });
    track('decide_started', { setting: ctx.setting });
    router.push('/decide');
  };

  const repeat = (m: MealIdea) => {
    if (confirmation) return; // one repeat per visit; prevents double-tap duplicates
    feedback(m.id, 'accepted', { setting: ctx.setting, mealTime: mealTimeFor(clock.now()), feeling: ctx.feeling });
    track('repeat_meal');
    setConfirmation({ text: `${m.name} it is. Enjoy.`, mealId: m.id });
  };

  const plan = state.plan && !planExpired ? state.plan : null;
  const planMeal = plan ? CATALOG.find((m) => m.id === plan.mealId) : undefined;
  const planSafety = plan && planMeal ? safetyCheck(planMeal, profile, plan.setting) : null;
  const planDue = plan ? planStatus(plan, now) === 'due' : false;

  const followPlan = () => {
    if (!plan || !planMeal) return;
    feedback(plan.mealId, 'accepted', { setting: plan.setting, mealTime: plan.mealTime, feeling: ctx.feeling });
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
    <Screen edges={['top', 'left', 'right']}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Logo size={26} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile"
          onPress={() => router.push('/profile')}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: c.selected,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon name="person" size={22} color={c.primary} />
        </Pressable>
      </Row>

      <View style={{ gap: 2 }}>
        <Small>{now.toLocaleDateString('en-US', DATE_FMT)}</Small>
        <Title>What should I eat?</Title>
      </View>

      {plan && planMeal && planDue ? (
        <Card>
          <Small>Your plan for {plan.mealTime}</Small>
          <Row gap={space.md}>
            <MealArt meal={planMeal} variant="small" />
            <Heading style={{ flex: 1 }}>{planMeal.name}</Heading>
          </Row>
          {planSafety?.ok ? (
            <>
              <Cautions items={planSafety.cautions} />
              <Row>
                <View style={{ flex: 1 }}>
                  <Button label="Having it" onPress={followPlan} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Change" variant="secondary" onPress={changePlan} />
                </View>
              </Row>
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
        <Row style={{ justifyContent: 'space-between' }}>
          <Small style={{ flex: 1 }}>
            Planned for {plan.mealTime}: {planMeal.name}
          </Small>
          <TextAction label="Cancel" a11yLabel={`Cancel plan for ${plan.mealTime}`} onPress={() => dispatch({ type: 'clearPlan' })} />
        </Row>
      ) : null}

      {pendingMeal ? (
        <Card>
          <Body>How was the {pendingMeal.name.toLowerCase()}?</Body>
          <Row>
            <View style={{ flex: 1 }}>
              <Button label="Loved it" variant="secondary" onPress={() => rate('loved')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="It was fine" variant="secondary" onPress={() => rate('fine')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Not again" variant="secondary" onPress={() => rate('disliked')} />
            </View>
          </Row>
        </Card>
      ) : null}

      {confirmation ? (
        <Row style={{ justifyContent: 'space-between' }}>
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
        </Row>
      ) : null}

      <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel="Where are you eating?">
        <SectionLabel>Where are you eating?</SectionLabel>
        <Row gap={space.xs}>
          {SETTINGS.map((s) => (
            <IconTile key={s.value} icon={s.icon} label={s.label} selected={ctx.setting === s.value} onPress={() => setCtx({ setting: s.value })} />
          ))}
        </Row>
      </View>

      <ChipGroup stretch label="How hungry are you?" options={HUNGER} value={ctx.hunger} onChange={(v) => setCtx({ hunger: v })} />
      <ChipGroup stretch label="How much time do you have?" options={TIMES} value={ctx.time} onChange={(v) => setCtx({ time: v })} />

      <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel="How are you feeling?">
        <SectionLabel>How are you feeling?</SectionLabel>
        <Row gap={space.sm}>
          {FEELINGS.map((f) => (
            <EmojiTile key={f.value} emoji={f.emoji} label={f.label} selected={ctx.feeling === f.value} onPress={() => setCtx({ feeling: f.value })} />
          ))}
        </Row>
      </View>

      <Button big label="Get my recommendation" iconRight="arrow-forward" onPress={decide} hint="Shows one recommendation and two alternatives" />
      {!plan ? (
        <Button
          label={`Plan my ${nextMealSlot(now).mealTime}`}
          variant="ghost"
          icon="calendar-outline"
          onPress={() => {
            dispatch({ type: 'setLastContext', context: ctx });
            router.push('/decide?plan=1');
          }}
        />
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
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  minHeight: 64,
                  padding: space.sm,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: c.border,
                  backgroundColor: c.surface,
                  opacity: pressed || confirmation ? 0.6 : 1,
                })}
              >
                <MealArt meal={m} variant="small" />
                <View style={{ flex: 1 }}>
                  <Body>{m.name}</Body>
                  <Small>{saved ? 'Saved' : 'Recent'} · tap to have it again</Small>
                </View>
                <Icon name="repeat" size={18} color={c.primary} />
              </Pressable>
              <Cautions items={cautions} />
            </View>
          ))}
        </View>
      ) : null}

      {checkinShown ? <WeeklyCheckIn onDone={() => setCheckinPhase('thanks')} onClose={() => setCheckinPhase('closed')} /> : null}

      {week.decisions > 0 ? (
        <Small>
          This week: {week.decisions} {week.decisions === 1 ? 'meal' : 'meals'} decided across {week.activeDays}{' '}
          {week.activeDays === 1 ? 'day' : 'days'}.
        </Small>
      ) : null}
    </Screen>
  );
}
