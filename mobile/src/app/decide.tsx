import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { clock } from '../clock';
import { isSaved, mealTimeFor, recommend, swapsFor, type Recommendation } from '../engine';
import { useStore } from '../store/AppProvider';
import { defaultContext, nextMealSlot } from '../store/state';
import { Body, Button, Card, Cautions, Heading, Screen, Small, TextAction, Title } from '../ui/components';
import { BUDGET_SHORT } from '../ui/labels';
import { space, useColors } from '../ui/theme';

export default function Decide() {
  const { state, dispatch, track, feedback } = useStore();
  const planning = useLocalSearchParams<{ plan?: string }>().plan === '1';
  const [slot] = useState(() => nextMealSlot(clock.now()));
  const c = useColors();
  const [startedAt] = useState(now);
  const [exclude, setExclude] = useState<string[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Recommendation | null>(null);
  const [chosenAt, setChosenAt] = useState(0);
  const profile = state.profile;

  // History is read once per screen visit so tapping Save doesn't reshuffle the cards under the user's finger.
  const [historyAtOpen] = useState(state.history);
  const ctx = useMemo(
    () =>
      profile
        ? {
            ...(state.lastContext ?? defaultContext(profile)),
            mealTime: planning ? slot.mealTime : mealTimeFor(clock.now()),
          }
        : null,
    [profile, state.lastContext, planning, slot],
  );
  const result = useMemo(() => {
    if (!profile || !ctx) return null;
    return recommend(profile, ctx, { history: historyAtOpen, exclude });
  }, [profile, ctx, exclude, historyAtOpen]);

  const shown = result ? [result.primary, ...result.alternatives].filter((r): r is Recommendation => !!r) : [];
  const primary = shown.find((r) => r.meal.id === focusId) ?? shown[0];
  const others = shown.filter((r) => r !== primary);

  const primaryId = primary?.meal.id;
  useEffect(() => {
    if (primaryId) track('recommendation_shown');
    else if (result) track('recommendation_empty');
  }, [primaryId, result, track]);

  if (!profile || !result) return <Redirect href="/onboarding" />;

  const accept = (r: Recommendation) => {
    if (chosen || !ctx) return; // ignore double taps
    const t = now();
    if (planning) {
      dispatch({ type: 'setPlan', plan: { mealId: r.meal.id, mealTime: slot.mealTime, date: slot.date, setting: ctx.setting } });
      track('meal_planned', { mealTime: slot.mealTime });
    } else {
      feedback(r.meal.id, 'accepted', { setting: ctx.setting, mealTime: ctx.mealTime });
      track('recommendation_accepted', { msSinceStart: t - startedAt, rank: shown.indexOf(r), wasNew: !!r.isNew });
    }
    setChosen(r);
    setChosenAt(t);
  };

  const swap = () => {
    if (primary) feedback(primary.meal.id, 'swapped');
    track('recommendation_swapped');
    setFocusId(null);
    setExclude([...exclude, ...shown.map((r) => r.meal.id)]);
  };

  const dislike = (r: Recommendation) => {
    feedback(r.meal.id, 'disliked');
    track('meal_disliked');
    setFocusId(null);
    setExclude([...exclude, r.meal.id]);
  };

  if (chosen) {
    const goHome = () => {
      if (now() - chosenAt > DOUBLE_TAP_MS) router.back();
    };
    return (
      <Screen
        footer={
          <>
            {/* "Done" appears where "I'll have this" was; ignore the second half of a double tap. */}
            <Button label="Done" onPress={goHome} />
            {!planning ? (
              <Button
                label={`Plan my ${nextMealSlot(clock.now()).mealTime} too`}
                variant="secondary"
                hint="Deciding ahead makes it easier to follow through"
                onPress={() => {
                  if (now() - chosenAt > DOUBLE_TAP_MS) router.replace('/decide?plan=1');
                }}
              />
            ) : null}
          </>
        }
      >
        {planning ? (
          <>
            <Title>
              {cap(slot.mealTime)} is planned: {chosen.meal.name.toLowerCase()}.
            </Title>
            <Body muted>When it’s {slot.mealTime} time, open EatOS and tap “Having it”. No need to decide again.</Body>
          </>
        ) : (
          <>
            <Title>Enjoy your {chosen.meal.name.toLowerCase()}.</Title>
            <Body muted>Next time you open EatOS, it’ll ask how it was and use your answer to improve suggestions.</Body>
          </>
        )}
        <Card>
          <Heading>How to do it</Heading>
          <Body>{chosen.meal.howTo}</Body>
        </Card>
        <Cautions items={chosen.cautions} />
      </Screen>
    );
  }

  if (!primary) {
    return (
      <Screen
        footer={
          <>
            {exclude.length > 0 ? <Button label="Start over" onPress={() => setExclude([])} /> : null}
            <Button label="Change my situation" variant="secondary" onPress={() => router.back()} />
          </>
        }
      >
        <Title>No match right now</Title>
        <Body>{result.emptyReason}</Body>
      </Screen>
    );
  }

  const saved = isSaved(primary.meal.id, state.history);
  const swaps = swapsFor(primary.meal, profile);

  return (
    <Screen
      footer={
        <>
          <Button label={planning ? `Plan this for ${slot.mealTime}` : 'I’ll have this'} onPress={() => accept(primary)} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Something else" variant="secondary" onPress={swap} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={saved ? 'Saved ✓' : 'Save'}
                variant="secondary"
                onPress={() => {
                  feedback(primary.meal.id, saved ? 'unsaved' : 'saved');
                  if (!saved) track('meal_saved');
                }}
              />
            </View>
          </View>
        </>
      }
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <TextAction label="‹ Back" a11yLabel="Back" onPress={() => router.back()} />
        <TextAction
          label="Not for me"
          a11yLabel={`Not for me: never suggest ${primary.meal.name} again`}
          onPress={() => dislike(primary)}
        />
      </View>

      <Small>{planning ? `Planning your ${slot.mealTime}` : 'Your best option right now'}</Small>
      <Title>{primary.meal.name}</Title>
      <Body muted>{primary.meal.summary}</Body>

      <Cautions items={primary.cautions} />

      <Card>
        <Heading>Why this fits</Heading>
        {primary.reasons.map((r) => (
          <Body key={r}>• {r}</Body>
        ))}
        <Small>Typical cost: {BUDGET_SHORT[primary.meal.budget]} (varies by place)</Small>
      </Card>

      <Card>
        <Heading>How to do it</Heading>
        <Body>{primary.meal.howTo}</Body>
        {swaps.length > 0 ? (
          <>
            <Small muted={false}>Easy swaps</Small>
            {swaps.map((s) => (
              <Body key={s} muted>
                • {s}
              </Body>
            ))}
          </>
        ) : null}
      </Card>

      {others.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Heading>Or</Heading>
          {others.map((r) => (
            <Pressable
              key={r.meal.id}
              accessibilityRole="button"
              accessibilityLabel={`${r.meal.name}. ${r.reasons[0] ?? ''}. Tap to see details.`}
              onPress={() => setFocusId(r.meal.id)}
              style={({ pressed }) => ({
                padding: space.lg,
                minHeight: 56,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.surface,
                opacity: pressed ? 0.7 : 1,
                gap: space.xs,
              })}
            >
              <Body>{r.meal.name}</Body>
              <Small>{r.reasons[0] ?? r.meal.summary}</Small>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const DOUBLE_TAP_MS = 700;

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function now() {
  return clock.now().getTime();
}
