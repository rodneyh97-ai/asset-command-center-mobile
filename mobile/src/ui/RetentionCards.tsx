// Home-screen cards that help people stick with EatOS without pressure. Each is optional,
// dismissible, and shown only when it's useful; Home shows at most one "ask" card at a time.
import { router } from 'expo-router';
import { View } from 'react-native';

import { newInstallId } from '../analytics/usage';
import { clock } from '../clock';
import { useStore } from '../store/AppProvider';
import { WEEKLY_GOALS, weekProgress, type WeeklyGoalKind } from '../store/state';
import { Body, Button, Card, Icon, Row, Small, TextAction } from './components';
import { space, useColors } from './theme';

const DAY = 24 * 60 * 60 * 1000;

export function WelcomeBack({ onDecide }: { onDecide: () => void }) {
  const { dispatch } = useStore();
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Body style={{ fontWeight: '600', flex: 1 }}>Welcome back!</Body>
        <TextAction label="Close" a11yLabel="Close welcome back message" onPress={() => dispatch({ type: 'dismissWelcomeBack' })} />
      </Row>
      <Body muted>No catching up needed. Want something quick?</Body>
      <Button
        label="Pick something for me"
        onPress={() => {
          dispatch({ type: 'dismissWelcomeBack' });
          onDecide();
        }}
      />
    </Card>
  );
}

export function SetupCard() {
  const { dispatch, track } = useStore();
  return (
    <Card>
      <Small>Optional · about 1 minute</Small>
      <Body style={{ fontWeight: '600' }}>Want better picks? Answer 4 quick questions about your goal, favorite foods and budget.</Body>
      <Row>
        <View style={{ flex: 1 }}>
          <Button label="Let’s do it" onPress={() => router.push('/onboarding?more=1')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Later"
            variant="secondary"
            a11yLabel="Ask me later"
            onPress={() => {
              dispatch({ type: 'setupSnooze', until: new Date(clock.now().getTime() + 2 * DAY).toISOString() });
              track('setup_snoozed');
            }}
          />
        </View>
      </Row>
    </Card>
  );
}

export function UsageAskCard() {
  const { dispatch, track } = useStore();
  const answer = (on: boolean) => {
    dispatch(on ? { type: 'setUsageSharing', on: true, installId: newInstallId() } : { type: 'setUsageSharing', on: false });
    track('usage_sharing_changed', { on });
  };
  return (
    <Card>
      <Small>Help improve EatOS · optional</Small>
      <Body style={{ fontWeight: '600' }}>Share which days you open EatOS?</Body>
      <Body muted>
        Only “opened on day 3”, with a random code. No food, health or personal details, ever. You can turn it off in Profile and it deletes what was sent.
      </Body>
      <Row>
        <View style={{ flex: 1 }}>
          <Button label="Yes, share" a11yLabel="Yes, share which days I open EatOS" onPress={() => answer(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="No thanks" variant="secondary" a11yLabel="No thanks, don’t share" onPress={() => answer(false)} />
        </View>
      </Row>
    </Card>
  );
}

export const GOAL_OPTIONS = (Object.keys(WEEKLY_GOALS) as WeeklyGoalKind[]).map((k) => ({
  value: k,
  label: WEEKLY_GOALS[k].label,
  detail: `${WEEKLY_GOALS[k].target} ${WEEKLY_GOALS[k].unit} a week`,
}));

export function WeeklyGoalAsk() {
  const { dispatch, track } = useStore();
  const set = (kind: WeeklyGoalKind | null) => {
    dispatch({ type: 'setWeeklyGoal', goal: kind ? { kind, target: WEEKLY_GOALS[kind].target } : null });
    if (kind) track('weekly_goal_set', { kind });
  };
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Small>Optional weekly goal</Small>
        <TextAction label="Not now" a11yLabel="No weekly goal" onPress={() => set(null)} />
      </Row>
      <Body style={{ fontWeight: '600' }}>Want a small goal for the week?</Body>
      <Body muted>Missing a week is fine: nothing resets, a new week just starts.</Body>
      {GOAL_OPTIONS.map((o) => (
        <Button key={o.value} label={`${o.label} · ${o.detail}`} a11yLabel={`Goal: ${o.label}, ${o.detail}`} variant="secondary" onPress={() => set(o.value)} />
      ))}
    </Card>
  );
}

export function WeeklyGoalProgress() {
  const { state } = useStore();
  const c = useColors();
  const p = weekProgress(state, clock.now());
  if (!p || !state.weeklyGoal) return null;
  const g = WEEKLY_GOALS[state.weeklyGoal.kind];
  const shown = Math.min(p.count, p.target);
  const label = p.done ? `${g.label}: done for this week` : `${g.label}: ${shown} of ${p.target} ${g.unit} this week`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }} accessible accessibilityLabel={label}>
      <Row gap={4}>
        {Array.from({ length: p.target }, (_, i) => (
          <View key={i} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: i < shown ? c.brandGreen : c.border }} />
        ))}
      </Row>
      <Small style={{ flex: 1 }}>{label}</Small>
      {p.done ? <Icon name="checkmark-circle" size={18} color={c.brandGreen} /> : null}
    </View>
  );
}

export function LearnedLine({ count }: { count: number }) {
  const c = useColors();
  return (
    <Row gap={space.xs}>
      <Icon name="sparkles-outline" size={16} color={c.primary} />
      <TextAction
        label={`EatOS has learned ${count} things about you`}
        a11yLabel={`EatOS has learned ${count} things about you. See and edit them`}
        onPress={() => router.push('/knows')}
      />
    </Row>
  );
}
