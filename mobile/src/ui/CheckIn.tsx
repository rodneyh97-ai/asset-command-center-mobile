// Weekly reflection, built on motivational-interviewing principles: open questions,
// the user names what helps and what gets in the way, and nothing changes without consent.
import { useState } from 'react';
import { View } from 'react-native';

import { clock } from '../clock';
import type { Struggle } from '../engine';
import { useStore } from '../store/AppProvider';
import { Body, Button, Card, ChipGroup, Heading, Small, TextAction } from './components';
import { STRUGGLES } from './labels';
import { space } from './theme';

type Helped = 'planning' | 'repeats' | 'quick_ideas' | 'not_yet';
const HELPED: { value: Helped; label: string }[] = [
  { value: 'quick_ideas', label: 'Quick ideas' },
  { value: 'repeats', label: 'Repeating favorites' },
  { value: 'planning', label: 'Planning ahead' },
  { value: 'not_yet', label: 'Not much yet' },
];

const AFFIRM: Record<Helped, string> = {
  quick_ideas: 'Good to hear: deciding fast is the whole point.',
  repeats: 'Repeating what works is a real strategy, not a cop-out.',
  planning: 'Planning ahead is one of the most reliable ways to follow through.',
  not_yet: 'Thanks for being straight with us — that helps EatOS improve.',
};

export function WeeklyCheckIn({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const { state, dispatch, track } = useStore();
  const [helped, setHelped] = useState<Helped | null>(null);
  const [obstacle, setObstacle] = useState<Struggle | 'none' | null>(null);
  const [done, setDone] = useState(false);
  const profile = state.profile;
  if (!profile) return null;

  const finish = (addFocus: boolean) => {
    onDone();
    if (addFocus && obstacle && obstacle !== 'none' && !profile.struggles.includes(obstacle)) {
      dispatch({ type: 'updateProfile', patch: { struggles: [...profile.struggles, obstacle] } });
    }
    dispatch({ type: 'checkinDone', at: clock.now().toISOString() });
    track('checkin_completed', { helped: helped ?? 'skipped', obstacle: obstacle ?? 'skipped', addedFocus: addFocus });
    setDone(true);
  };

  if (done) {
    return (
      <Card>
        <Body>{helped ? AFFIRM[helped] : 'Thanks.'} See you next week.</Body>
        <TextAction label="Close" onPress={onClose} />
      </Card>
    );
  }

  const isNewFocus = obstacle && obstacle !== 'none' && !profile.struggles.includes(obstacle);
  const obstacleLabel = STRUGGLES.find((s) => s.value === obstacle)?.label.toLowerCase();

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Small>Weekly check-in · 2 taps</Small>
        <TextAction
          label="Not now"
          a11yLabel="Not now, ask me later"
          onPress={() => {
            const until = new Date(clock.now().getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
            dispatch({ type: 'checkinSnooze', until });
            track('checkin_snoozed');
            onClose();
          }}
        />
      </View>
      {!helped ? (
        <>
          <Heading>What made eating the way you want easier this week?</Heading>
          <ChipGroup options={HELPED} value={helped as unknown as Helped} onChange={setHelped} />
        </>
      ) : obstacle === null ? (
        <>
          <Body muted>{AFFIRM[helped]}</Body>
          <Heading>What got in the way the most?</Heading>
          <ChipGroup
            options={[...STRUGGLES, { value: 'none' as const, label: 'Nothing really' }]}
            value={obstacle as unknown as Struggle}
            onChange={(v) => {
              setObstacle(v);
              if (v === 'none' || profile.struggles.includes(v as Struggle)) {
                // Nothing to change — wrap up straight away.
                setTimeout(() => finish(false), 0);
              }
            }}
          />
        </>
      ) : isNewFocus ? (
        <>
          <Heading>Want EatOS to help more with “{obstacleLabel}”?</Heading>
          <Body muted>It’ll lean its suggestions that way. You can change this anytime in Preferences.</Body>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Yes, help with that" onPress={() => finish(true)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="No thanks" variant="secondary" onPress={() => finish(false)} />
            </View>
          </View>
        </>
      ) : null}
    </Card>
  );
}
