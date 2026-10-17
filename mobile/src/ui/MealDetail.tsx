// Shared body for any screen that presents one meal: hero art, name, tags, quick facts,
// safety notes, reasons, and how to make/order it.
import { Linking, View } from 'react-native';

import type { MealIdea, Setting } from '../engine';
import { Body, Button, Card, Cautions, CheckRow, Heading, Icon, MealArt, Row, Small, Tags, Title } from './components';
import { costLabel, mealTags, timeLabel } from './mealTags';
import { space, useColors } from './theme';

/** Meals you'd actually cook (not just assemble or buy) get a link to cooking videos. */
export const cooksAtHome = (meal: MealIdea, setting?: Setting) =>
  (setting === undefined || setting === 'home') && meal.settings.includes('home') && meal.prepMinutes >= 5;
/** A YouTube search, not one chosen video: EatOS can't vouch for what's in a particular video. */
export const cookingVideosUrl = (meal: Pick<MealIdea, 'name'>) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`how to make ${meal.name.toLowerCase()} easy`)}`;

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
        {cooksAtHome(meal, setting) ? (
          <Button
            label="Watch how to make it"
            variant="secondary"
            icon="play-circle-outline"
            a11yLabel={`Watch videos on how to make ${meal.name}`}
            onPress={() => void Linking.openURL(cookingVideosUrl(meal)).catch(() => {})}
          />
        ) : null}
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
