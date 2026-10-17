import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { clock } from '../clock';
import type { Allergen, BudgetTier, Consideration, Cuisine, Diet, Goal, Struggle, TimeAvailable } from '../engine';
import { useStore } from '../store/AppProvider';
import { defaultContext } from '../store/state';
import {
  Body,
  Button,
  Caution,
  CheckRow,
  ChipGroup,
  Icon,
  ImageChoiceTile,
  Logo,
  MealArt,
  MultiChipGroup,
  OptionCard,
  ProgressHeader,
  RadioRow,
  Row,
  Screen,
  Small,
  Title,
  ToggleRow,
  toggleIn,
} from '../ui/components';
import { ALLERGENS, BUDGETS, CONSIDERATIONS, CUISINES, DIETS, GOALS, STRUGGLES, TIMES } from '../ui/labels';
import { TypedAnswer } from '../ui/TypedAnswer';
import { mealColors } from '../ui/mealArt';
import { space, type, useColors } from '../ui/theme';

// Fast start: only what safety needs (allergies/diets, then medical / no-diet-talk) before the
// first recommendation. Taste questions come later, after EatOS has already been useful ("more" mode).
type StepId = 'restrictions' | 'considerations' | 'goal' | 'cuisines' | 'budget' | 'struggles';
const START: StepId[] = ['restrictions', 'considerations'];
const MORE: StepId[] = ['goal', 'cuisines', 'budget', 'struggles'];
type Step = 'welcome' | number | 'done';

export default function Onboarding() {
  const { state, ready, dispatch, track } = useStore();
  const c = useColors();
  const params = useLocalSearchParams<{ more?: string }>();
  // "More" only edits taste questions of an existing profile; it can never touch allergies.
  const more = params.more === '1' && !!state.profile;
  const steps = more ? MORE : START;
  const p = more ? state.profile : null;
  const [step, setStep] = useState<Step>(more ? 0 : 'welcome');
  const [goal, setGoal] = useState<Goal | null>(p?.goal ?? null);
  const [cuisines, setCuisines] = useState<Cuisine[]>(p?.cuisines ?? []);
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [diets, setDiets] = useState<Diet[]>([]);
  const [budget, setBudget] = useState<BudgetTier | null>(p?.budget ?? null);
  const [time, setTime] = useState<TimeAvailable>(state.lastContext?.time ?? 20);
  const [struggles, setStruggles] = useState<Struggle[]>(p?.struggles ?? []);
  const [considerations, setConsiderations] = useState<Consideration[]>([]);

  useEffect(() => {
    if (ready && !state.profile) track('onboarding_started');
  }, [ready, state.profile, track]);

  if (!ready) return null;
  // A link to /onboarding must not let anyone overwrite an existing profile (and its allergies).
  if (state.profile && step === 'welcome' && !more) return <Redirect href="/" />;

  const finishStart = () => {
    const profile = {
      goal: 'eat_better' as Goal,
      struggles: [],
      cuisines: [],
      allergens,
      diets,
      budget: 2 as BudgetTier,
      considerations: considerations.filter((x) => x !== 'none'),
      createdAt: clock.now().toISOString(),
    };
    dispatch({ type: 'completeOnboarding', profile });
    dispatch({ type: 'setLastContext', context: defaultContext(profile) });
    track('onboarding_completed');
    router.replace('/');
  };

  const finishMore = () => {
    if (goal && goal !== state.profile?.goal) track('goal_changed');
    dispatch({ type: 'updateProfile', patch: { goal: goal ?? 'eat_better', cuisines, budget: budget ?? 2, struggles } });
    if (state.lastContext) dispatch({ type: 'setLastContext', context: { ...state.lastContext, time, budget: budget ?? 2 } });
    dispatch({ type: 'setupDone' });
    track('setup_completed');
    setStep('done');
  };

  // ---------- Splash ----------
  if (step === 'welcome') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.hero, overflow: 'hidden' }}>
        <Leaves />
        <View style={styles.splash}>
          <View style={{ gap: space.xl }}>
            <Logo size={64} inverse />
            <Text style={[styles.tagline, { color: c.heroText }]}>
              Less thinking.{'\n'}Better eating.{'\n'}Real life.
            </Text>
          </View>
          <View style={{ gap: space.lg }}>
            <Button label="Get Started" variant="accent" big iconRight="arrow-forward" onPress={() => setStep(0)} />
            <Text style={[type.small, { color: c.heroMuted, textAlign: 'center' }]}>
              Two quick questions, then your first pick.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ---------- Finish (after the optional taste questions) ----------
  if (step === 'done') {
    return (
      <Screen footer={<Button label="Go to Home" big iconRight="arrow-forward" onPress={() => router.replace('/')} />}>
        <Confetti />
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <Icon name="star" size={36} color={c.brandGreen} />
          <Title style={{ textAlign: 'center' }}>You’re all set!</Title>
          <Body muted style={{ textAlign: 'center' }}>
            EatOS will now learn and get better{'\n'}the more you use it.
          </Body>
        </View>
        <MealArt meal={{ name: 'Grilled chicken bowl', cuisine: 'mediterranean' }} variant="hero" />
        <View style={[styles.checklist, { backgroundColor: c.surface, borderColor: c.border }]}>
          <CheckRow text="Your goal is saved" />
          <CheckRow text="Your preferences are set" />
          <CheckRow text="Personalized recommendations are ready" />
        </View>
      </Screen>
    );
  }

  const i = step;
  const id = steps[i];
  const last = i === steps.length - 1;
  const back = () => (i === 0 ? (more ? router.back() : setStep('welcome')) : setStep(i - 1));
  const next = () => (last ? (more ? finishMore() : finishStart()) : setStep(i + 1));
  const canContinue = id === 'goal' ? goal !== null : id === 'budget' ? budget !== null : true;
  const nextLabel =
    id === 'cuisines' && cuisines.length === 0
      ? 'Skip'
      : id === 'restrictions' && allergens.length + diets.length === 0
        ? 'None — Next'
        : id === 'struggles' && struggles.length === 0
          ? 'Skip'
          : last
            ? more
              ? 'Finish'
              : 'Show my first pick'
            : 'Next';

  return (
    <Screen footer={<Button label={nextLabel} big iconRight="arrow-forward" onPress={next} disabled={!canContinue} />}>
      <ProgressHeader step={i + 1} total={steps.length} onBack={back} />

      {id === 'goal' && (
        <>
          <Header title="What’s your main goal?" subtitle="This helps EatOS give you better recommendations. It stays put until you change it." />
          {GOALS.map((g) => (
            <OptionCard key={g.value} icon={g.icon} title={g.label} subtitle={g.subtitle} selected={goal === g.value} onPress={() => setGoal(g.value)} />
          ))}
        </>
      )}

      {id === 'cuisines' && (
        <>
          <Header title="What foods do you enjoy?" subtitle="Select as many as you like." />
          <View style={{ gap: space.md }}>
            {chunk(CUISINES, 3).map((row, i) => (
              <Row key={i} gap={space.md} style={{ alignItems: 'flex-start' }}>
                {row.map((o) => (
                  <ImageChoiceTile
                    key={o.value}
                    emoji={o.emoji}
                    colors={mealColors({ cuisine: o.value })}
                    label={o.label}
                    selected={cuisines.includes(o.value)}
                    onPress={() => setCuisines(toggleIn(cuisines, o.value))}
                  />
                ))}
                {Array.from({ length: 3 - row.length }, (_, k) => (
                  <View key={`pad${k}`} style={{ flex: 1 }} />
                ))}
              </Row>
            ))}
          </View>
        </>
      )}

      {id === 'restrictions' && (
        <>
          <Header title="Any dietary restrictions?" subtitle="We’ll keep these in mind always. Allergies are strict rules, never just preferences." />
          <View>
            <ToggleRow
              icon="checkmark-circle-outline"
              label="None"
              value={allergens.length + diets.length === 0}
              onChange={() => {
                setAllergens([]);
                setDiets([]);
              }}
            />
            {DIETS.map((d) => (
              <ToggleRow key={d.value} icon={d.icon} label={d.label} value={diets.includes(d.value)} onChange={() => setDiets(toggleIn(diets, d.value))} />
            ))}
            {ALLERGENS.map((a) => (
              <ToggleRow
                key={a.value}
                icon={a.icon}
                label={a.label}
                value={allergens.includes(a.value)}
                onChange={() => setAllergens(toggleIn(allergens, a.value))}
              />
            ))}
          </View>
          <Small>Anything else? Type it, e.g. “allergic to shrimp” or “I can’t stand mushrooms”.</Small>
          <TypedAnswer start="dislike" placeholder="Other allergies or foods you avoid" onAllergens={(a) => setAllergens([...new Set([...allergens, ...a])])} />
          {allergens.length > 0 ? (
            <Caution>
              EatOS filters out meals that normally contain your allergens, but it can’t see restaurant kitchens or product labels. Always
              confirm with staff and check labels.
            </Caution>
          ) : null}
        </>
      )}

      {id === 'budget' && (
        <>
          <Header title="What’s your typical budget per meal?" subtitle="This helps with realistic options." />
          <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel="Budget per meal">
            {BUDGETS.map((b) => (
              <RadioRow key={b.value} label={b.label} selected={budget === b.value} onPress={() => setBudget(b.value)} />
            ))}
          </View>
          <ChipGroup stretch label="How much time do you usually have?" options={TIMES} value={time} onChange={setTime} />
        </>
      )}

      {id === 'struggles' && (
        <>
          <Header title="What usually makes eating well hard?" subtitle="Pick any that sound familiar. This is where EatOS should help most." />
          <MultiChipGroup options={STRUGGLES} value={struggles} onChange={setStruggles} />
        </>
      )}

      {id === 'considerations' && (
        <>
          <Header title="Anything else EatOS should keep in mind?" />
          <MultiChipGroup options={CONSIDERATIONS} value={considerations} onChange={setConsiderations} exclusive="none" />
          {considerations.includes('medical') ? (
            <Caution>
              EatOS offers general meal ideas, not medical nutrition therapy. If a doctor or dietitian gave you a plan, theirs comes first.
            </Caution>
          ) : null}
          {considerations.includes('ed_sensitive') ? <Body muted>Got it. EatOS won’t use weight or diet language in its suggestions.</Body> : null}
        </>
      )}
    </Screen>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Title>{title}</Title>
      {subtitle ? <Small>{subtitle}</Small> : null}
    </View>
  );
}

function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

/** Decorative leaf silhouettes behind the splash (purely visual, hidden from screen readers). */
function Leaves() {
  const spots = [
    { top: -30, left: -40, size: 220, rotate: '-20deg', opacity: 0.12 },
    { top: 120, right: -60, size: 200, rotate: '35deg', opacity: 0.1 },
    { bottom: 140, left: -50, size: 180, rotate: '160deg', opacity: 0.09 },
    { bottom: -40, right: -30, size: 240, rotate: '200deg', opacity: 0.12 },
  ];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {spots.map((s, i) => (
        <View
          key={i}
          style={{ position: 'absolute', top: s.top, bottom: s.bottom, left: s.left, right: s.right, opacity: s.opacity, transform: [{ rotate: s.rotate }] }}
        >
          <Icon name="leaf" size={s.size} color="#7FBF7A" />
        </View>
      ))}
    </View>
  );
}

function Confetti() {
  const colors = ['#4E9B5A', '#A8D38A', '#F1B24A', '#E86F51', '#5B8DEF'];
  return (
    <View style={{ height: 0 }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: 14 }, (_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${(i * 37) % 100}%`,
            top: (i * 23) % 70,
            width: 6,
            height: 14,
            borderRadius: 2,
            backgroundColor: colors[i % colors.length],
            transform: [{ rotate: `${(i * 47) % 180}deg` }],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, justifyContent: 'space-between', padding: space.xl, paddingTop: 96, paddingBottom: space.xl },
  tagline: { fontSize: 24, lineHeight: 34, fontWeight: '500' },
  checklist: { borderRadius: 18, borderWidth: 1, padding: space.lg, gap: space.md },
});
