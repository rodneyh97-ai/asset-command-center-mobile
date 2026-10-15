import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { clock } from '../../clock';
import { CATALOG, isSaved, mealTimeFor, recommend, safetyCheck, standingCautions, swapsFor, type Setting } from '../../engine';
import { VALID } from '../../engine/validate';
import { useActiveProfile } from '../../store/useActiveProfile';
import { useStore } from '../../store/AppProvider';
import { defaultContext } from '../../store/state';
import { Body, Button, Row, Screen, TextAction, Title } from '../../ui/components';
import { MealDetail } from '../../ui/MealDetail';

export default function MealScreen() {
  const params = useLocalSearchParams<{ id?: string; setting?: string }>();
  const { state, ready, feedback, track } = useStore();
  const [done, setDone] = useState(false);
  const p = useActiveProfile(state);
  // Route params are untrusted: only known meal ids and settings are accepted.
  const meal = CATALOG.find((m) => m.id === params.id);
  const setting: Setting = VALID.setting.includes(params.setting as Setting) ? (params.setting as Setting) : 'home';

  const view = useMemo(() => {
    if (!p || !meal) return null;
    const ctx = { ...(state.lastContext ?? defaultContext(p)), setting, budget: p.budget, mealTime: mealTimeFor(clock.now()) };
    const safety = safetyCheck(meal, p, setting);
    const r = recommend(p, ctx, { history: state.history, catalog: [meal] }).primary;
    return {
      ok: safety.ok,
      reasons: r?.reasons ?? [],
      cautions: r?.cautions ?? [...safety.cautions, ...standingCautions(p, ctx)],
      ctx,
    };
  }, [p, meal, setting, state.lastContext, state.history]);

  if (!ready) return null; // wait for saved data before deciding where to go
  if (!p) return <Redirect href="/onboarding" />;
  if (!meal || !view) {
    return (
      <Screen footer={<Button label="Back" onPress={() => router.back()} />}>
        <Title>Meal not found</Title>
      </Screen>
    );
  }

  const saved = isSaved(meal.id, state.history);
  return (
    <Screen
      footer={
        view.ok ? (
          done ? (
            <Button label="Done" onPress={() => router.back()} />
          ) : (
            <Row>
              <View style={{ flex: 1 }}>
                <Button
                  label={saved ? 'Saved' : 'Save'}
                  icon={saved ? 'bookmark' : 'bookmark-outline'}
                  variant="secondary"
                  onPress={() => {
                    feedback(meal.id, saved ? 'unsaved' : 'saved');
                    if (!saved) track('meal_saved');
                  }}
                />
              </View>
              <View style={{ flex: 1.4 }}>
                <Button
                  label="Try this"
                  onPress={() => {
                    feedback(meal.id, 'accepted', { setting, mealTime: view.ctx.mealTime, feeling: state.personalization.trackMood ? view.ctx.feeling : undefined });
                    track('repeat_meal');
                    setDone(true);
                  }}
                />
              </View>
            </Row>
          )
        ) : (
          <Button label="Back" onPress={() => router.back()} />
        )
      }
    >
      <TextAction icon="chevron-back" a11yLabel="Back" onPress={() => router.back()} />
      {done ? <Body>Enjoy. EatOS will ask how it was next time.</Body> : null}
      {!view.ok ? <Body>This doesn’t fit your allergies or diet {setting === 'home' ? '' : 'when eating out'}, so EatOS won’t suggest it.</Body> : null}
      <MealDetail meal={meal} reasons={view.reasons} cautions={view.cautions} swaps={swapsFor(meal, p)} setting={setting} />
    </Screen>
  );
}
