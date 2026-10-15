import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { clock } from '../clock';
import { isSaved, mealTimeFor, recommend, swapsFor, type BudgetTier, type MealIdea, type Recommendation } from '../engine';
import { useActiveProfile } from '../store/useActiveProfile';
import { useStore } from '../store/AppProvider';
import { defaultContext, eatingWithNames, nextMealSlot } from '../store/state';
import {
  Body,
  Button,
  Card,
  Cautions,
  Heading,
  ListRow,
  Logo,
  MealArt,
  Row,
  Screen,
  Small,
  Tags,
  TextAction,
  Title,
} from '../ui/components';
import { MealDetail, MealFacts } from '../ui/MealDetail';
import { mealTags } from '../ui/mealTags';
import { space, useColors } from '../ui/theme';

type Nudge = { moreLike?: MealIdea['cuisine']; avoid?: MealIdea['cuisine'] };

export default function Decide() {
  const { state, ready, dispatch, track, feedback } = useStore();
  const c = useColors();
  const planning = useLocalSearchParams<{ plan?: string }>().plan === '1';
  const [slot] = useState(() => nextMealSlot(clock.now()));
  const [startedAt] = useState(now);
  const [exclude, setExclude] = useState<string[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Recommendation | null>(null);
  const [chosenAt, setChosenAt] = useState(0);
  const [view, setView] = useState<'main' | 'alternatives' | 'together'>('main');
  // Decide together: each person marks the options they'd eat; first one everyone likes wins.
  const [turn, setTurn] = useState(0);
  const [votes, setVotes] = useState<Record<string, number[]>>({});
  const [nudge, setNudge] = useState<Nudge | undefined>(undefined);
  const [budgetOverride, setBudgetOverride] = useState<BudgetTier | null>(null);
  const [showSwaps, setShowSwaps] = useState(false);
  const profile = useActiveProfile(state);

  // History is read once per screen visit so tapping Save doesn't reshuffle the cards under the user's finger.
  const [historyAtOpen] = useState(state.history);
  const ctx = useMemo(
    () =>
      profile
        ? {
            ...(state.lastContext ?? defaultContext(profile)),
            budget: budgetOverride ?? profile.budget,
            mealTime: planning ? slot.mealTime : mealTimeFor(clock.now()),
          }
        : null,
    [profile, state.lastContext, planning, slot, budgetOverride],
  );
  const result = useMemo(() => {
    if (!profile || !ctx) return null;
    return recommend(profile, ctx, { history: historyAtOpen, exclude, nudge });
  }, [profile, ctx, exclude, historyAtOpen, nudge]);

  const shown = result ? [result.primary, ...result.alternatives].filter((r): r is Recommendation => !!r) : [];
  const primary = shown.find((r) => r.meal.id === focusId) ?? shown[0];
  const others = shown.filter((r) => r !== primary);

  const primaryId = primary?.meal.id;
  useEffect(() => {
    if (primaryId) track('recommendation_shown');
    else if (result) track('recommendation_empty');
  }, [primaryId, result, track]);

  if (!ready) return null; // wait for saved data before deciding where to go
  if (!profile || !result || !ctx) return <Redirect href="/onboarding" />;

  const accept = (r: Recommendation) => {
    if (chosen) return; // ignore double taps
    const t = now();
    if (planning) {
      dispatch({ type: 'setPlan', plan: { mealId: r.meal.id, mealTime: slot.mealTime, date: slot.date, setting: ctx.setting } });
      track('meal_planned', { mealTime: slot.mealTime });
    } else {
      feedback(r.meal.id, 'accepted', { setting: ctx.setting, mealTime: ctx.mealTime, feeling: ctx.feeling });
      track('recommendation_accepted', { msSinceStart: t - startedAt, rank: shown.indexOf(r), wasNew: !!r.isNew });
    }
    setChosen(r);
    setChosenAt(t);
  };

  const refresh = (n?: Nudge) => {
    setFocusId(null);
    setNudge(n);
    setExclude([...exclude, ...shown.map((r) => r.meal.id)]);
    setView('main');
  };

  const swap = () => {
    if (primary) feedback(primary.meal.id, 'swapped');
    track('recommendation_swapped');
    refresh(nudge);
  };

  const dislike = (r: Recommendation) => {
    feedback(r.meal.id, 'disliked');
    track('meal_disliked');
    setFocusId(null);
    setExclude([...exclude, r.meal.id]);
  };

  // ---------- Confirmation ----------
  if (chosen) {
    const later = () => now() - chosenAt > DOUBLE_TAP_MS; // "Done" sits where "Try this" was; ignore a double tap
    return (
      <Screen
        footer={
          <>
            <Button label="Done" onPress={() => later() && router.back()} />
            {!planning ? (
              <Button
                label={`Plan my ${nextMealSlot(clock.now()).mealTime} too`}
                variant="secondary"
                icon="calendar-outline"
                hint="Deciding ahead makes it easier to follow through"
                onPress={() => later() && router.replace('/decide?plan=1')}
              />
            ) : null}
          </>
        }
      >
        <MealArt meal={chosen.meal} variant="hero" />
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
          <Heading>How to get it</Heading>
          <Body>{chosen.meal.howTo}</Body>
        </Card>
        <Cautions items={chosen.cautions} />
      </Screen>
    );
  }

  // ---------- Nothing left ----------
  if (!primary) {
    return (
      <Screen
        footer={
          <>
            {exclude.length > 0 ? (
              <Button
                label="Start over"
                onPress={() => {
                  setExclude([]);
                  setNudge(undefined);
                }}
              />
            ) : null}
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

  const names = eatingWithNames(state);
  const eaters = ['You', ...names];

  // ---------- Decide together ----------
  if (view === 'together') {
    const finished = turn >= eaters.length;
    const match = finished ? shown.find((r) => eaters.every((_, i) => votes[r.meal.id]?.includes(i))) : undefined;
    const toggle = (id: string) => {
      const cur = votes[id] ?? [];
      setVotes({ ...votes, [id]: cur.includes(turn) ? cur.filter((x) => x !== turn) : [...cur, turn] });
    };
    const restart = () => {
      setVotes({});
      setTurn(0);
    };
    return (
      <Screen
        footer={
          !finished ? (
            <Button
              label={turn < eaters.length - 1 ? `Done — pass to ${eaters[turn + 1]}` : 'See the result'}
              iconRight="arrow-forward"
              onPress={() => setTurn(turn + 1)}
            />
          ) : match ? (
            <Button label={`Let’s have ${match.meal.name.toLowerCase()}`} onPress={() => accept(match)} />
          ) : (
            <>
              <Button
                label="Show 3 new options"
                onPress={() => {
                  restart();
                  refresh(nudge);
                  setView('together');
                }}
              />
              <Button label="Just pick for us" variant="secondary" onPress={() => accept(primary)} />
            </>
          )
        }
      >
        <TextAction icon="chevron-back" a11yLabel="Back to recommendation" onPress={() => { restart(); setView('main'); }} />
        <Title>Decide together</Title>
        {!finished ? (
          <Body muted>
            <Body style={{ fontWeight: '700' }}>{eaters[turn]}</Body>: tap every option you’d happily eat.
          </Body>
        ) : match ? (
          <Body>It’s a match. Everyone picked {match.meal.name.toLowerCase()}.</Body>
        ) : (
          <Body>No match this round. Try three new options, or let EatOS pick.</Body>
        )}
        {shown.map((r) => {
          const mine = !finished && (votes[r.meal.id] ?? []).includes(turn);
          const isMatch = match?.meal.id === r.meal.id;
          return (
            <Card key={r.meal.id} style={{ flexDirection: 'row', gap: space.md, padding: space.md, borderColor: mine || isMatch ? c.primary : c.border }}>
              <MealArt meal={r.meal} variant="small" />
              <View style={{ flex: 1, gap: 4 }}>
                <Heading style={{ fontSize: 16 }}>{r.meal.name}</Heading>
                <Tags labels={mealTags(r.meal, 2)} />
              </View>
              {!finished ? (
                <TextAction
                  icon={mine ? 'heart' : 'heart-outline'}
                  a11yLabel={`${eaters[turn]} would eat ${r.meal.name}${mine ? ', selected' : ''}`}
                  onPress={() => toggle(r.meal.id)}
                />
              ) : null}
            </Card>
          );
        })}
        <Small>Works for everyone’s allergies and diets{names.length ? ` (you and ${names.join(' and ')})` : ''}.</Small>
      </Screen>
    );
  }

  // ---------- Alternatives ----------
  if (view === 'alternatives') {
    return (
      <Screen>
        <Row>
          <TextAction icon="chevron-back" a11yLabel="Back to recommendation" onPress={() => setView('main')} />
        </Row>
        <View style={{ gap: 2 }}>
          <Title>Other Options</Title>
          <Body muted>Here are a couple more good choices.</Body>
        </View>
        {others.length === 0 ? <Body muted>No other options fit right now.</Body> : null}
        {others.map((r) => (
          <Card key={r.meal.id} style={{ flexDirection: 'row', gap: space.md, padding: space.md }}>
            <MealArt meal={r.meal} variant="thumb" />
            <View style={{ flex: 1, gap: space.xs }}>
              <Heading style={{ fontSize: 16 }}>{r.meal.name}</Heading>
              <Tags labels={mealTags(r.meal, 2)} />
              <MealFacts meal={r.meal} setting={ctx.setting} />
              {r.cautions.length > 0 ? <Small style={{ color: c.cautionText }}>⚠︎ {r.cautions[0]}</Small> : null}
              <Button label="Choose this" a11yLabel={`Choose ${r.meal.name}`} onPress={() => accept(r)} />
            </View>
          </Card>
        ))}

        <Heading>Not feeling these?</Heading>
        <View style={{ gap: space.sm }}>
          <ListRow
            icon="sparkles-outline"
            label="Show more like this"
            onPress={() => {
              track('alt_more_like');
              refresh({ moreLike: primary.meal.cuisine });
            }}
          />
          <ListRow
            icon="swap-horizontal-outline"
            label="Swap ingredients"
            onPress={() => {
              track('alt_swap_ingredients');
              setShowSwaps(!showSwaps);
            }}
            right={<Small>{showSwaps ? 'Hide' : ''}</Small>}
          />
          {showSwaps ? (
            <Card>
              {swaps.length ? (
                swaps.map((s) => (
                  <Body key={s} muted>
                    • {s}
                  </Body>
                ))
              ) : (
                <Body muted>No safe swaps for {primary.meal.name.toLowerCase()} with your restrictions.</Body>
              )}
            </Card>
          ) : null}
          <ListRow
            icon="wallet-outline"
            label={ctx.budget > 1 ? 'Adjust for lower cost' : 'Already at your lowest budget'}
            onPress={() => {
              if (ctx.budget <= 1) return;
              track('alt_lower_cost');
              setBudgetOverride((ctx.budget - 1) as BudgetTier);
              setFocusId(null);
              setView('main');
            }}
          />
          <ListRow
            icon="shuffle-outline"
            label="Something different"
            onPress={() => {
              track('alt_different');
              refresh({ avoid: primary.meal.cuisine });
            }}
          />
        </View>
      </Screen>
    );
  }

  // ---------- Main recommendation ----------
  return (
    <Screen
      footer={
        <>
          <Row>
            <View style={{ flex: 1 }}>
              <Button
                label={saved ? 'Saved' : 'Save'}
                icon={saved ? 'bookmark' : 'bookmark-outline'}
                variant="secondary"
                onPress={() => {
                  feedback(primary.meal.id, saved ? 'unsaved' : 'saved');
                  if (!saved) track('meal_saved');
                }}
              />
            </View>
            <View style={{ flex: 1.4 }}>
              <Button
                label={planning ? `Plan for ${slot.mealTime}` : 'Try this'}
                a11yLabel={planning ? `Plan this for ${slot.mealTime}` : 'Try this'}
                onPress={() => accept(primary)}
              />
            </View>
          </Row>
          <Row>
            <View style={{ flex: 1 }}>
              <Button label="See Alternatives" variant="secondary" onPress={() => setView('alternatives')} />
            </View>
            {names.length > 0 && !planning ? (
              <View style={{ flex: 1 }}>
                <Button label="Decide together" variant="secondary" icon="people-outline" onPress={() => setView('together')} />
              </View>
            ) : null}
          </Row>
        </>
      }
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={0}>
          <TextAction icon="chevron-back" a11yLabel="Back" onPress={() => router.back()} />
          <Logo size={22} />
        </Row>
        <Row gap={0}>
          <TextAction icon="refresh" a11yLabel="Something else" onPress={swap} />
          <TextAction
            icon="thumbs-down-outline"
            a11yLabel={`Not for me: never suggest ${primary.meal.name} again`}
            onPress={() => dislike(primary)}
          />
        </Row>
      </Row>

      <Heading>{planning ? `Planning your ${slot.mealTime}` : 'Your Recommendation'}</Heading>
      {names.length > 0 ? <Small>For you and {names.join(' and ')} · safe for everyone’s allergies and diets</Small> : null}
      {budgetOverride ? <Small>Showing options at a lower cost.</Small> : null}
      {primary.isNew ? <Small>Something new you might like</Small> : null}

      <MealDetail meal={primary.meal} reasons={primary.reasons} cautions={primary.cautions} swaps={swaps} setting={ctx.setting} />
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
