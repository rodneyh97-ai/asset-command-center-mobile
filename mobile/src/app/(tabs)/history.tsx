import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { clock } from '../../clock';
import { CATALOG } from '../../engine';
import { useStore } from '../../store/AppProvider';
import { progressFor } from '../../store/progress';
import { Body, Button, Card, ChipGroup, Heading, MealArt, Row, Screen, Small, StatCard, Title } from '../../ui/components';
import { FEELING_EMOJI } from '../../ui/labels';
import { space, type, useColors } from '../../ui/theme';

export default function History() {
  const { state, ready } = useStore();
  const c = useColors();
  const [range, setRange] = useState<7 | 30>(7);
  const [showAll, setShowAll] = useState(false);
  if (!ready) return null; // wait for saved data before deciding where to go
  if (!state.profile) return <Redirect href="/onboarding" />;

  const now = clock.now();
  const p = progressFor(state.history, now, range);
  const all = state.history.filter((e) => e.kind === 'accepted').slice().reverse();
  const period = range === 7 ? 'this week' : 'this month';

  return (
    <Screen edges={['top', 'left', 'right']}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Title>Your Progress</Title>
        <ChipGroup
          options={[
            { value: 7, label: 'Week' },
            { value: 30, label: 'Month' },
          ]}
          value={range}
          onChange={(v) => setRange(v as 7 | 30)}
        />
      </Row>

      <Row gap={space.sm}>
        <StatCard value={String(p.decisions)} label="Good decisions" />
        <StatCard value={String(p.favoritesUsed)} label="Favorites used" icon="heart" />
        <StatCard value={String(p.activeDays)} label="Active days" />
      </Row>

      <Card>
        <Heading>How you’ve been feeling</Heading>
        {p.mood.every((m) => m.score === 0) ? (
          <Small>Pick how you feel on Home when you decide, and your week will show up here.</Small>
        ) : null}
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', height: 120 }} gap={space.xs}>
          {p.mood.map((m) => (
            <View
              key={m.date}
              style={{ flex: 1, alignItems: 'center', gap: 4 }}
              accessible
              accessibilityLabel={`${m.label}: ${m.feeling ? `felt ${m.feeling === 'fine' ? 'good' : m.feeling}` : 'no entry'}`}
            >
              {m.feeling ? <Text style={{ fontSize: 14 }}>{FEELING_EMOJI[m.feeling]}</Text> : null}
              <View
                style={{
                  width: 18,
                  height: m.score ? 18 + m.score * 16 : 10,
                  borderRadius: 9,
                  backgroundColor: m.score ? c.brandGreen : c.border,
                  opacity: m.score ? 0.55 + m.score * 0.1 : 1,
                }}
              />
              <Text style={[type.tiny, { color: c.inkMuted }]}>{m.label}</Text>
            </View>
          ))}
        </Row>
      </Card>

      <Heading>Top meals {period}</Heading>
      {p.topMeals.length === 0 ? <Body muted>Nothing yet {period}. Your go-to meals will show up here.</Body> : null}
      {p.topMeals.map(({ meal, count }) => (
        <Row key={meal.id} gap={space.md}>
          <MealArt meal={meal} variant="small" />
          <Body style={{ flex: 1 }}>{meal.name}</Body>
          <Small>
            {count} {count === 1 ? 'time' : 'times'}
          </Small>
        </Row>
      ))}

      {all.length > 0 ? (
        <Button label={showAll ? 'Hide full history' : 'View full history'} variant="ghost" iconRight={showAll ? 'chevron-up' : 'chevron-forward'} onPress={() => setShowAll(!showAll)} />
      ) : (
        <Button label="Get my first recommendation" onPress={() => router.push('/')} />
      )}
      {showAll
        ? all.slice(0, 200).map((e, i) => {
            const meal = CATALOG.find((m) => m.id === e.mealId);
            if (!meal) return null;
            return (
              <Row key={`${e.at}-${i}`} gap={space.md}>
                <Small style={{ width: 92 }}>{new Date(e.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}</Small>
                <Body style={{ flex: 1 }}>{meal.name}</Body>
              </Row>
            );
          })
        : null}
    </Screen>
  );
}
