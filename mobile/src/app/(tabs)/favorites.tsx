import { Redirect, router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { CATALOG, isSaved, safetyCheck } from '../../engine';
import { useStore } from '../../store/AppProvider';
import { defaultContext, recentMealIds } from '../../store/state';
import { Body, Button, Heading, Icon, MealArt, Row, Screen, Small, Tags, Title } from '../../ui/components';
import { mealTags } from '../../ui/mealTags';
import { space, useColors } from '../../ui/theme';

export default function Favorites() {
  const { state, ready } = useStore();
  const c = useColors();
  const p = state.profile;
  if (!ready) return null; // wait for saved data before deciding where to go
  if (!p) return <Redirect href="/onboarding" />;
  const setting = (state.lastContext ?? defaultContext(p)).setting;
  const saved = CATALOG.filter((m) => isSaved(m.id, state.history));
  const recent = recentMealIds(state.history, 8)
    .map((id) => CATALOG.find((m) => m.id === id))
    .filter((m): m is (typeof CATALOG)[number] => !!m && !saved.includes(m));

  const row = (m: (typeof CATALOG)[number]) => {
    // Re-checked against today's allergies and diet: a favorite can stop being safe.
    const fits = safetyCheck(m, p, 'home').ok || safetyCheck(m, p, setting).ok;
    return (
      <Pressable
        key={m.id}
        accessibilityRole="button"
        accessibilityLabel={`${m.name}${fits ? '' : ', no longer fits your restrictions'}. Open details.`}
        onPress={() => router.push({ pathname: '/meal/[id]', params: { id: m.id } })}
        style={({ pressed }) => ({
          flexDirection: 'row',
          gap: space.md,
          alignItems: 'center',
          padding: space.sm,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surface,
          opacity: pressed ? 0.75 : fits ? 1 : 0.55,
        })}
      >
        <MealArt meal={m} variant="small" />
        <View style={{ flex: 1, gap: 4 }}>
          <Body>{m.name}</Body>
          {fits ? <Tags labels={mealTags(m, 2)} /> : <Small style={{ color: c.cautionText }}>No longer fits your restrictions</Small>}
        </View>
        <Icon name="chevron-forward" size={18} color={c.inkMuted} />
      </Pressable>
    );
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <Title>Favorites</Title>
      <Heading>Saved</Heading>
      {saved.length === 0 ? (
        <Body muted>Tap Save on any recommendation and it’ll live here for one-tap repeats.</Body>
      ) : (
        <View style={{ gap: space.sm }}>{saved.map(row)}</View>
      )}
      {recent.length > 0 ? (
        <>
          <Heading>Recently eaten</Heading>
          <View style={{ gap: space.sm }}>{recent.map(row)}</View>
        </>
      ) : null}
      {saved.length + recent.length === 0 ? (
        <Row>
          <View style={{ flex: 1 }}>
            <Button label="Get a recommendation" onPress={() => router.push('/')} />
          </View>
        </Row>
      ) : null}
    </Screen>
  );
}
