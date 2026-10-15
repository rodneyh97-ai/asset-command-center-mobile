import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, Share, Text, TextInput, View } from 'react-native';

import { crashSummaryLines, readCrashes } from '../../analytics/crash';
import { summaryText } from '../../analytics/events';
import { sentryConfigured } from '../../analytics/sentry';
import { clock } from '../../clock';
import { INGREDIENTS, newMemory, type Goal, type Member, type Profile } from '../../engine';
import { ensurePermission, REMINDER_TIMES, remindersSupported, syncReminders, type ReminderMeal } from '../../notifications/reminders';
import { authenticate, canLock, lockSupported } from '../../security/appLock';
import { useStore } from '../../store/AppProvider';
import {
  Body,
  Button,
  Card,
  Caution,
  Heading,
  Icon,
  MultiChipGroup,
  OptionCard,
  RadioRow,
  Row,
  Screen,
  Small,
  TextAction,
  Title,
  ToggleRow,
  toggleIn,
} from '../../ui/components';
import { ALLERGENS, BUDGETS, CONSIDERATIONS, CUISINES, DIETS, GOAL_LABEL, GOALS, STRUGGLES } from '../../ui/labels';
import { space, type, useColors } from '../../ui/theme';

const DISLIKE_OPTIONS = INGREDIENTS.map((i) => ({ value: i, label: i[0].toUpperCase() + i.slice(1) }));

function confirm(title: string, message: string, ok: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: ok, style: 'destructive', onPress: onOk },
  ]);
}

export default function ProfileScreen() {
  const { state, ready, dispatch, track, deleteAllData } = useStore();
  const c = useColors();
  const [changingGoal, setChangingGoal] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [editing, setEditingRaw] = useState<Member | null>(null);
  const [editDislikes, setEditDislikes] = useState<string[]>([]);
  const setEditing = (m: Member | null) => {
    setEditingRaw(m);
    if (m && m.id !== editing?.id) setEditDislikes(state.memories.filter((x) => x.subject === m.id && x.topic === 'dislike_food').map((x) => x.value));
  };
  const p = state.profile;
  if (!ready) return null; // wait for saved data before deciding where to go
  if (!p) return <Redirect href="/onboarding" />;
  const hiddenCount = new Set(state.history.filter((e) => e.kind === 'disliked').map((e) => e.mealId)).size;
  const update = (patch: Partial<Omit<Profile, 'createdAt'>>) => dispatch({ type: 'updateProfile', patch });

  const changeGoal = (goal: Goal) => {
    if (goal === p.goal) return setChangingGoal(false);
    confirm('Change your main goal?', `EatOS will start optimizing for “${GOAL_LABEL[goal]}”.`, 'Change goal', () => {
      update({ goal });
      track('goal_changed');
      setChangingGoal(false);
    });
  };

  const toggleLock = async (on: boolean) => {
    setNote(null);
    if (on) {
      if (!(await canLock())) {
        setNote('Set up Face ID, a fingerprint, or a passcode on your phone first.');
        return;
      }
      // Prove the owner can unlock before turning it on, so nobody locks themselves out.
      if (!(await authenticate('Turn on App Lock'))) return;
    }
    dispatch({ type: 'setAppLock', on, at: Date.now() });
    track('app_lock_changed', { on });
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <Title>Profile</Title>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.selected, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="person" size={26} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.label, { color: c.ink }]}>Goal: {GOAL_LABEL[p.goal]}</Text>
          <Small>Your data stays on this phone</Small>
        </View>
      </Card>

      <Pressable accessibilityRole="button" accessibilityLabel="EatOS+ — see what’s coming" onPress={() => router.push('/premium')}>
        <LinearGradient colors={[c.hero, '#1F5A3E']} style={{ borderRadius: 18, padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Text style={{ fontSize: 28 }} accessible={false}>
            👑
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={[type.heading, { color: c.heroText }]}>EatOS+</Text>
            <Text style={[type.small, { color: c.heroMuted }]}>More personalized. More options.</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={c.heroText} />
        </LinearGradient>
      </Pressable>

      <Button label="What EatOS knows about me" variant="secondary" icon="finger-print-outline" iconRight="chevron-forward" onPress={() => router.push('/knows')} />

      <Heading>Main goal</Heading>
      {changingGoal ? (
        GOALS.map((g) => <OptionCard key={g.value} icon={g.icon} title={g.label} subtitle={g.subtitle} selected={p.goal === g.value} onPress={() => changeGoal(g.value)} />)
      ) : (
        <Row style={{ justifyContent: 'space-between' }}>
          <Body>{GOAL_LABEL[p.goal]}</Body>
          <Button label="Change goal" variant="secondary" onPress={() => setChangingGoal(true)} />
        </Row>
      )}

      <Heading>People you eat with</Heading>
      <Small>Add a partner or family member. When they’re eating too, EatOS only suggests meals that are safe for both of you.</Small>
      {state.members.map((m) => (
        <Row key={m.id} style={{ justifyContent: 'space-between' }}>
          <Body style={{ flex: 1 }}>
            {m.name}
            {m.allergens.length + m.diets.length ? ` · ${m.allergens.length + m.diets.length} restriction${m.allergens.length + m.diets.length === 1 ? '' : 's'}` : ''}
          </Body>
          <TextAction label="Edit" a11yLabel={`Edit ${m.name}`} onPress={() => setEditing(m)} />
          <TextAction label="Remove" a11yLabel={`Remove ${m.name}`} onPress={() => dispatch({ type: 'removeMember', id: m.id })} />
        </Row>
      ))}
      {editing ? (
        <Card>
          <TextInput
            value={editing.name}
            onChangeText={(name) => setEditing({ ...editing, name: name.slice(0, 30) })}
            placeholder="Their name or nickname"
            placeholderTextColor={c.inkMuted}
            accessibilityLabel="Their name or nickname"
            maxLength={30}
            style={[type.body, { color: c.ink, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: space.md }]}
          />
          <Small muted={false}>Their allergies</Small>
          <MultiChipGroup options={ALLERGENS} value={editing.allergens} onChange={(allergens) => setEditing({ ...editing, allergens })} />
          <Small muted={false}>Their diet</Small>
          <MultiChipGroup options={DIETS} value={editing.diets} onChange={(diets) => setEditing({ ...editing, diets })} />
          <Small muted={false}>Foods they enjoy</Small>
          <MultiChipGroup options={CUISINES} value={editing.cuisines} onChange={(cuisines) => setEditing({ ...editing, cuisines })} />
          <Small muted={false}>Foods they don’t like</Small>
          <MultiChipGroup options={DISLIKE_OPTIONS} value={editDislikes} onChange={setEditDislikes} />
          <Row>
            <View style={{ flex: 1 }}>
              <Button
                label="Save person"
                disabled={!editing.name.trim()}
                onPress={() => {
                  dispatch({ type: 'saveMember', member: { ...editing, name: editing.name.trim() } });
                  // Their dislikes are memories about them, enforced when you eat together.
                  const now = clock.now();
                  for (const m of state.memories.filter((x) => x.subject === editing.id && x.topic === 'dislike_food' && !editDislikes.includes(x.value)))
                    dispatch({ type: 'forget', id: m.id });
                  for (const v of editDislikes.filter((v) => !state.memories.some((x) => x.subject === editing.id && x.topic === 'dislike_food' && x.value === v)))
                    dispatch({ type: 'remember', memory: newMemory('dislike_food', v, { source: 'manual', subject: editing.id, now }) });
                  track('member_saved');
                  setEditing(null);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Cancel" variant="secondary" onPress={() => setEditing(null)} />
            </View>
          </Row>
        </Card>
      ) : state.members.length < 8 ? (
        <Button
          label="Add someone you eat with"
          variant="secondary"
          icon="person-add-outline"
          onPress={() => setEditing({ id: `m-${Date.now().toString(36)}`, name: '', allergens: [], diets: [], cuisines: [] })}
        />
      ) : null}

      <Heading>Dietary restrictions</Heading>
      <Small>Allergies are strict rules. EatOS never suggests a meal that normally contains them.</Small>
      <View>
        {DIETS.map((d) => (
          <ToggleRow key={d.value} icon={d.icon} label={d.label} value={p.diets.includes(d.value)} onChange={() => update({ diets: toggleIn(p.diets, d.value) })} />
        ))}
        {ALLERGENS.map((a) => (
          <ToggleRow
            key={a.value}
            icon={a.icon}
            label={a.label}
            value={p.allergens.includes(a.value)}
            onChange={() => update({ allergens: toggleIn(p.allergens, a.value) })}
          />
        ))}
      </View>

      <Heading>Foods you enjoy</Heading>
      <MultiChipGroup options={CUISINES} value={p.cuisines} onChange={(cuisines) => update({ cuisines })} />

      <Heading>What makes eating well hard</Heading>
      <MultiChipGroup options={STRUGGLES} value={p.struggles} onChange={(struggles) => update({ struggles })} />

      <Heading>Typical budget per meal</Heading>
      <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel="Typical budget per meal">
        {BUDGETS.map((b) => (
          <RadioRow key={b.value} label={b.label} selected={p.budget === b.value} onPress={() => update({ budget: b.value })} />
        ))}
      </View>

      <Heading>Other considerations</Heading>
      <MultiChipGroup options={CONSIDERATIONS.filter((x) => x.value !== 'none')} value={p.considerations} onChange={(considerations) => update({ considerations })} />

      {remindersSupported ? (
        <>
          <Heading>Reminders</Heading>
          <Small>Optional. One gentle nudge before the meals you choose. Off unless you turn it on.</Small>
          <MultiChipGroup
            options={(['breakfast', 'lunch', 'dinner'] as ReminderMeal[]).map((m) => ({
              value: m,
              label: `${m[0].toUpperCase()}${m.slice(1)} · ${REMINDER_TIMES[m].label}`,
            }))}
            value={state.reminders}
            onChange={async (meals) => {
              setNote(null);
              if (meals.length > state.reminders.length && !(await ensurePermission())) {
                setNote('Notifications are turned off for EatOS in your phone’s settings.');
                return;
              }
              dispatch({ type: 'setReminders', meals });
              track('reminders_changed', { count: meals.length });
              await syncReminders(meals).catch(() => setNote('Couldn’t update reminders. Try again.'));
            }}
          />
        </>
      ) : null}

      <Heading>Privacy & security</Heading>
      <View>
        {lockSupported ? <ToggleRow icon="lock-closed-outline" label="App Lock (Face ID / fingerprint)" value={state.appLock} onChange={toggleLock} /> : null}
        {sentryConfigured ? (
          <ToggleRow
            icon="bug-outline"
            label="Send anonymous crash reports"
            value={state.crashReports}
            onChange={(on) => dispatch({ type: 'setCrashReports', on })}
          />
        ) : null}
      </View>
      <Small>
        Your preferences and history are stored only on this phone.
        {state.appLock ? ' App Lock asks again after 5 minutes away.' : ''}
      </Small>
      {note ? <Caution>{note}</Caution> : null}

      {hiddenCount > 0 ? (
        <>
          <Heading>Hidden meals</Heading>
          <Small>
            You marked {hiddenCount} {hiddenCount === 1 ? 'meal' : 'meals'} “Not for me”.
          </Small>
          <Button label="Show hidden meals again" variant="secondary" onPress={() => dispatch({ type: 'clearHidden' })} />
        </>
      ) : null}

      <Heading>About EatOS</Heading>
      <Caution>
        EatOS suggests general meal ideas. It is not medical or nutrition advice, and it can’t verify restaurant ingredients, prices, or kitchen
        practices. If you have a medical condition or an eating disorder, follow your care team’s guidance.
      </Caution>

      <Heading>Your data</Heading>
      <Button
        label="Share my usage summary"
        variant="secondary"
        icon="share-outline"
        hint="Opens the share sheet with counts only — no allergies, diets, or meals"
        onPress={async () => {
          const crashes = await readCrashes();
          const message = [summaryText(state.analytics, clock.now()), ...crashSummaryLines(crashes)].join('\n');
          await Share.share({ message }).catch(() => {});
        }}
      />
      <Button
        label="Delete all my data"
        variant="danger"
        icon="trash-outline"
        onPress={() =>
          confirm('Delete everything?', 'Your preferences, history, and saved meals will be erased from this device.', 'Delete', async () => {
            await deleteAllData();
            router.replace('/onboarding');
          })
        }
      />
    </Screen>
  );
}
