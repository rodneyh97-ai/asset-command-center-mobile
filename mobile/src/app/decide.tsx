import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { isSaved, mealTimeFor, recommend, swapsFor, type Recommendation } from '../engine';
import { useStore } from '../store/AppProvider';
import { defaultContext } from '../store/state';
import { Body, Button, Card, Cautions, Heading, Screen, Small, TextAction, Title } from '../ui/components';
import { BUDGET_SHORT } from '../ui/labels';
import { space, useColors } from '../ui/theme';

export default function Decide() {
  const { state, track, feedback } = useStore();
  const c = useColors();
  const [startedAt] = useState(now);
  const [exclude, setExclude] = useState<string[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Recommendation | null>(null);
  const [chosenAt, setChosenAt] = useState(0);
  const profile = state.profile;

  // History is read once per screen visit so tapping Save doesn't reshuffle the cards under the user's finger.
  const [historyAtOpen] = useState(state.history);
  const result = useMemo(() => {
    if (!profile) return null;
    const ctx = { ...(state.lastContext ?? defaultContext(profile)), mealTime: mealTimeFor(new Date()) };
    return recommend(profile, ctx, { history: historyAtOpen, exclude });
  }, [profile, state.lastContext, exclude, historyAtOpen]);

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
    if (chosen) return; // ignore double taps
    feedback(r.meal.id, 'accepted');
    const t = now();
    track('recommendation_accepted', { msSinceStart: t - startedAt, rank: shown.indexOf(r) });
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
    return (
      <Screen
        footer={
          <Button
            label="Done"
            // The Done button appears where "I'll have this" was; ignore the second half of a double tap.
            onPress={() => {
              if (now() - chosenAt > DOUBLE_TAP_MS) router.back();
            }}
          />
        }
      >
        <Title>Enjoy your {chosen.meal.name.toLowerCase()}.</Title>
        <Body muted>Next time you open EatOS, it’ll ask how it was and use your answer to improve suggestions.</Body>
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
          <Button label="I’ll have this" onPress={() => accept(primary)} />
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

      <Small>Your best option right now</Small>
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

function now() {
  return Date.now();
}
