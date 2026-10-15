// Shared body for any screen that presents one meal: hero art, name, tags, quick facts,
// safety notes, reasons, and how to make/order it.
import { View } from 'react-native';

import type { MealIdea, Setting } from '../engine';
import { Body, Card, Cautions, CheckRow, Heading, Icon, MealArt, Row, Small, Tags, Title } from './components';
import { costLabel, mealTags, timeLabel } from './mealTags';
import { space, useColors } from './theme';

export function MealFacts({ meal, setting }: { meal: MealIdea; setting?: Setting }) {
  const c = useColors();
  return (
    <Row gap={space.lg}>
      <Row gap={space.xs}>
        <Icon name="time-outline" size={16} color={c.inkMuted} />
        <Small>{timeLabel(meal, setting)}</Small>
      </Row>
      <View accessible accessibilityLabel={`Typical cost ${costLabel(meal)}, varies by place`}>
        <Row gap={space.xs}>
          <Icon name="wallet-outline" size={16} color={c.inkMuted} />
          <Small>{costLabel(meal)}</Small>
        </Row>
      </View>
    </Row>
  );
}

export function MealDetail({
  meal,
  reasons,
  cautions,
  swaps,
  setting,
}: {
  meal: MealIdea;
  reasons: string[];
  cautions: string[];
  swaps: string[];
  setting?: Setting;
}) {
  return (
    <View style={{ gap: space.md }}>
      <MealArt meal={meal} variant="hero" />
      <Title>{meal.name}</Title>
      <Tags labels={mealTags(meal)} />
      <MealFacts meal={meal} setting={setting} />
      <Body muted>{meal.summary}</Body>
      <Cautions items={cautions} />
      {reasons.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Heading>Why this works for you</Heading>
          {reasons.map((r) => (
            <CheckRow key={r} text={r} />
          ))}
        </View>
      ) : null}
      <Card>
        <Heading>How to get it</Heading>
        <Body>{meal.howTo}</Body>
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
    </View>
  );
}
