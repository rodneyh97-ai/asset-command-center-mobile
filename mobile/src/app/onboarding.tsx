import { clock } from '../clock';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { Allergen, BudgetTier, Consideration, Cuisine, Diet, Goal, Struggle } from '../engine';
import { useStore } from '../store/AppProvider';
import { Body, Button, Caution, ChipGroup, Heading, MultiChipGroup, Screen, Small, Title } from '../ui/components';
import { ALLERGENS, BUDGETS, CONSIDERATIONS, CUISINES, DIETS, GOALS, STRUGGLES } from '../ui/labels';
import { space } from '../ui/theme';

const STEPS = 6;

export default function Onboarding() {
  const { state, ready, dispatch, track } = useStore();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [struggles, setStruggles] = useState<Struggle[]>([]);
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [diets, setDiets] = useState<Diet[]>([]);
  const [budget, setBudget] = useState<BudgetTier | null>(null);
  const [considerations, setConsiderations] = useState<Consideration[]>([]);

  const alreadyOnboarded = ready && !!state.profile;
  useEffect(() => {
    if (ready && !state.profile) track('onboarding_started');
  }, [ready, state.profile, track]);

  const finish = () => {
    dispatch({
      type: 'completeOnboarding',
      profile: {
        goal: goal ?? 'eat_better',
        struggles,
        cuisines,
        allergens,
        diets,
        budget: budget ?? 2,
        considerations: considerations.filter((c) => c !== 'none'),
        createdAt: clock.now().toISOString(),
      },
    });
    track('onboarding_completed');
    router.replace('/');
  };

  const next = () => (step === STEPS - 1 ? finish() : setStep(step + 1));
  const canContinue = [goal !== null, true, true, true, budget !== null, true][step];
  const nextLabel =
    step === 1 && struggles.length === 0
      ? 'Skip'
      : step === 2 && cuisines.length === 0
        ? 'Skip'
        : step === 3 && allergens.length + diets.length === 0
          ? 'None — continue'
          : step === STEPS - 1
            ? 'Show me what to eat'
            : 'Continue';

  if (!ready) return null;
  // A link to /onboarding must not let anyone overwrite an existing profile (and its allergies).
  if (alreadyOnboarded && step === 0) return <Redirect href="/" />;

  return (
    <Screen
      footer={
        <>
          <Button label={nextLabel} onPress={next} disabled={!canContinue} />
          {step > 0 ? <Button label="Back" variant="ghost" onPress={() => setStep(step - 1)} /> : null}
        </>
      }
    >
      <Small>
        Step {step + 1} of {STEPS}
      </Small>

      {step === 0 && (
        <>
          <Title>What do you want eating to do for you?</Title>
          <Body muted>Pick the one that matters most right now. It stays put until you decide to change it.</Body>
          <ChipGroup options={GOALS} value={goal as Goal} onChange={setGoal} />
        </>
      )}

      {step === 1 && (
        <>
          <Title>What usually makes eating the way you want hard?</Title>
          <Body muted>Pick any that sound familiar. This is where EatOS should help most.</Body>
          <MultiChipGroup options={STRUGGLES} value={struggles} onChange={setStruggles} />
        </>
      )}

      {step === 2 && (
        <>
          <Title>What do you actually enjoy eating?</Title>
          <Body muted>Suggestions you don’t want to eat aren’t useful. Pick as many as you like.</Body>
          <MultiChipGroup options={CUISINES} value={cuisines} onChange={setCuisines} />
        </>
      )}

      {step === 3 && (
        <>
          <Title>Anything EatOS must never suggest?</Title>
          <Body muted>Allergies and diets are strict rules, never just preferences.</Body>
          <Heading>Allergies</Heading>
          <MultiChipGroup options={ALLERGENS} value={allergens} onChange={setAllergens} />
          <Heading>Diet</Heading>
          <MultiChipGroup options={DIETS} value={diets} onChange={setDiets} />
          {allergens.length > 0 ? (
            <Caution>
              EatOS filters out meals that normally contain your allergens, but it can’t see restaurant kitchens or
              product labels. Always confirm with staff and check labels.
            </Caution>
          ) : null}
        </>
      )}

      {step === 4 && (
        <>
          <Title>What do you usually like to spend on a meal?</Title>
          <Body muted>You can change it any time you decide.</Body>
          <ChipGroup options={BUDGETS} value={budget as BudgetTier} onChange={setBudget} />
        </>
      )}

      {step === 5 && (
        <>
          <Title>Anything else EatOS should keep in mind?</Title>
          <MultiChipGroup options={CONSIDERATIONS} value={considerations} onChange={setConsiderations} exclusive="none" />
          <View style={{ gap: space.sm }}>
            {considerations.includes('medical') ? (
              <Caution>
                EatOS offers general meal ideas, not medical nutrition therapy. If a doctor or dietitian gave you a
                plan, theirs comes first.
              </Caution>
            ) : null}
            {considerations.includes('ed_sensitive') ? (
              <Body muted>Got it. EatOS won’t use weight or diet language in its suggestions.</Body>
            ) : null}
          </View>
        </>
      )}
    </Screen>
  );
}
