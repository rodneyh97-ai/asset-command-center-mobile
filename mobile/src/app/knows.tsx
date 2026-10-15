import { Redirect, router } from 'expo-router';
import { Share, View } from 'react-native';

import { clock } from '../clock';
import { CATALOG, INGREDIENTS, activeMemories, inferredTaste, newMemory, valuesOf, type Memory } from '../engine';
import { useStore } from '../store/AppProvider';
import { Body, Button, Card, CheckRow, Heading, MultiChipGroup, Row, Screen, Small, TextAction, Title, ToggleRow } from '../ui/components';
import { ALLERGENS, CUISINES, DIETS, GOAL_LABEL, STRUGGLES } from '../ui/labels';

const LABEL: Partial<Record<Memory['topic'], string>> = {
  preferred_name: 'Call me',
  like_food: 'Likes',
  tradeoff: 'This week, prefers',
  weeknight_cook_minutes: 'Weeknight cooking time (min)',
  weekly_grocery_budget: 'Grocery budget this week ($)',
  cooking_skill: 'Cooking skill',
  meals_per_day: 'Meals per day',
};

const names = <T extends string>(opts: { value: T; label: string }[], vs: T[]) =>
  vs.map((v) => opts.find((o) => o.value === v)?.label ?? v).join(', ') || 'None';

export default function Knows() {
  const { state, ready, dispatch } = useStore();
  if (!ready) return null;
  const p = state.profile;
  if (!p) return <Redirect href="/onboarding" />;
  const now = clock.now();
  const mine = activeMemories(state.memories, now, ['me']);
  const dislikes = valuesOf(mine, 'dislike_food');
  const rejected = new Set(valuesOf(mine, 'not_true'));
  const confirmed = new Set(valuesOf(mine, 'confirmed_trait'));
  const guesses = state.personalization.learnFromBehavior
    ? inferredTaste(state.history, CATALOG, now).filter((g) => !rejected.has(g.trait) && !confirmed.has(g.trait))
    : [];
  const facts = mine.filter((m) => LABEL[m.topic] && m.kind !== 'temporary');
  const temporary = mine.filter((m) => m.kind === 'temporary');

  const setDislikes = (next: string[]) => {
    for (const v of next.filter((x) => !dislikes.includes(x)))
      dispatch({ type: 'remember', memory: newMemory('dislike_food', v, { source: 'manual', now: clock.now() }) });
    for (const m of mine.filter((x) => x.topic === 'dislike_food' && !next.includes(x.value))) dispatch({ type: 'forget', id: m.id });
  };

  const exportData = async () => {
    const data = {
      exportedAt: now.toISOString(),
      profile: p,
      peopleYouEatWith: state.members,
      memories: state.memories,
      history: state.history,
      plan: state.plan,
      settings: { personalization: state.personalization, reminders: state.reminders, appLock: state.appLock },
    };
    await Share.share({ message: JSON.stringify(data, null, 2) }).catch(() => {});
  };

  const row = (m: Memory) => (
    <Row key={m.id} style={{ justifyContent: 'space-between' }}>
      <View style={{ flex: 1 }}>
        <Body>
          {LABEL[m.topic]}: {m.value}
        </Body>
        <Small>
          {m.kind === 'temporary' ? `Until ${new Date(m.expiresAt!).toLocaleDateString()}` : m.kind === 'confirmed' ? 'You confirmed this' : 'You told EatOS'} ·{' '}
          {new Date(m.updatedAt).toLocaleDateString()}
        </Small>
      </View>
      <TextAction label="Delete" a11yLabel={`Delete: ${LABEL[m.topic]} ${m.value}`} onPress={() => dispatch({ type: 'forget', id: m.id })} />
    </Row>
  );

  return (
    <Screen>
      <TextAction icon="chevron-back" a11yLabel="Back" onPress={() => router.back()} />
      <Title>What EatOS knows about me</Title>
      <Small>Everything here is stored only on this phone. Edit or delete anything, any time.</Small>

      <Card>
        <Heading>You told EatOS</Heading>
        <Body>Goal: {GOAL_LABEL[p.goal]}</Body>
        <Body>Allergies: {names(ALLERGENS, p.allergens)}</Body>
        <Body>Diet: {names(DIETS, p.diets)}</Body>
        <Body>Foods you enjoy: {names(CUISINES, p.cuisines)}</Body>
        <Body>What gets in the way: {names(STRUGGLES, p.struggles)}</Body>
        <Button label="Edit in Profile" variant="secondary" onPress={() => router.push('/profile')} />
        {facts.map(row)}
      </Card>

      <Heading>Foods you don’t like</Heading>
      <Small>EatOS won’t suggest meals that contain these.</Small>
      <MultiChipGroup options={INGREDIENTS.map((i) => ({ value: i, label: i[0].toUpperCase() + i.slice(1) }))} value={dislikes} onChange={setDislikes} />

      {temporary.length ? (
        <>
          <Heading>Just for now</Heading>
          {temporary.map(row)}
        </>
      ) : null}

      <Heading>EatOS thinks… (not confirmed)</Heading>
      {guesses.length === 0 ? <Small>Nothing yet. As you use EatOS, patterns it notices will show up here for you to confirm or reject.</Small> : null}
      {guesses.map((g) => (
        <Card key={g.trait}>
          <Body>{g.text}</Body>
          <Row>
            <View style={{ flex: 1 }}>
              <Button
                label="That’s right"
                variant="secondary"
                onPress={() => dispatch({ type: 'remember', memory: newMemory('confirmed_trait', g.trait, { kind: 'confirmed', source: 'inference', now: clock.now() }) })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Not true"
                variant="secondary"
                onPress={() => dispatch({ type: 'remember', memory: newMemory('not_true', g.trait, { source: 'inference', now: clock.now() }) })}
              />
            </View>
          </Row>
        </Card>
      ))}
      {[...confirmed].length ? (
        <>
          <Small muted={false}>Confirmed by you</Small>
          {mine.filter((m) => m.topic === 'confirmed_trait').map((m) => (
            <Row key={m.id} style={{ justifyContent: 'space-between' }}>
              <CheckRow text={m.value.replace('cuisine:', 'Likes ').replace('effort:none', 'Prefers no-cook meals')} />
              <TextAction label="Delete" a11yLabel={`Delete confirmed ${m.value}`} onPress={() => dispatch({ type: 'forget', id: m.id })} />
            </Row>
          ))}
        </>
      ) : null}

      <Heading>Your controls</Heading>
      <View>
        <ToggleRow
          icon="sparkles-outline"
          label="Learn from my choices"
          value={state.personalization.learnFromBehavior}
          onChange={(v) => dispatch({ type: 'setPersonalization', patch: { learnFromBehavior: v } })}
        />
        <ToggleRow
          icon="happy-outline"
          label="Remember how I feel when I decide"
          value={state.personalization.trackMood}
          onChange={(v) => dispatch({ type: 'setPersonalization', patch: { trackMood: v } })}
        />
      </View>
      <Small>Turning learning off means suggestions use only what you’ve told EatOS. Nothing is deleted.</Small>
      <Button label="Export my data" variant="secondary" icon="download-outline" onPress={exportData} />
      <Small>Delete everything from Profile → Your data.</Small>
    </Screen>
  );
}
