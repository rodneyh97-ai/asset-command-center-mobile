// "Type it in your own words": understood on the phone (engine/understand.ts) and turned
// into likes, dislikes and liked cuisines. Typed allergies are only applied after the user
// confirms them; words EatOS can't match are kept as a visible note, never used for picks.
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { clock } from '../clock';
import { ALLERGEN_LABEL, MAX_TYPED, newMemory, understandFoodText, understoodAnything, type Allergen, type Understood } from '../engine';
import { useStore } from '../store/AppProvider';
import { Body, Button, Caution, Row, Small } from './components';
import { CUISINES } from './labels';
import { space, type, useColors } from './theme';

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function TypedAnswer({
  start = 'neutral',
  placeholder = 'e.g. I hate mushrooms, love spicy food',
  onAllergens,
}: {
  /** What a bare list of foods means here. */
  start?: 'like' | 'dislike' | 'neutral';
  placeholder?: string;
  /** Onboarding: allergies switch on the visible toggles instead of asking here. */
  onAllergens?: (a: Allergen[]) => void;
}) {
  const { state, dispatch, track } = useStore();
  const c = useColors();
  const [text, setText] = useState('');
  const [result, setResult] = useState<Understood | null>(null);
  const [pending, setPending] = useState<Allergen[]>([]);
  const mine = state.profile?.allergens ?? [];

  const submit = () => {
    const said = text.trim();
    if (said.length < 2) return;
    const u = understandFoodText(said, start);
    const now = clock.now();
    for (const i of u.dislikes) dispatch({ type: 'remember', memory: newMemory('dislike_food', i, { source: 'manual', now }) });
    for (const i of u.likes) dispatch({ type: 'remember', memory: newMemory('like_food', i, { source: 'manual', now }) });
    if (u.cuisines.length && state.profile) dispatch({ type: 'updateProfile', patch: { cuisines: [...new Set([...state.profile.cuisines, ...u.cuisines])] } });
    if (u.leftover || !understoodAnything(u)) dispatch({ type: 'remember', memory: newMemory('note', said.slice(0, MAX_TYPED), { source: 'manual', now }) });
    const newAllergens = u.allergens.filter((a) => !mine.includes(a));
    if (onAllergens) onAllergens(newAllergens);
    else setPending(newAllergens);
    // Counts only: what was typed (and any allergy) never goes into analytics (D5).
    track('typed_answer', { understood: u.likes.length + u.dislikes.length + u.cuisines.length, note: u.leftover || !understoodAnything(u) });
    setResult(u);
    setText('');
  };

  const confirmAllergy = (a: Allergen, yes: boolean) => {
    if (yes && state.profile) dispatch({ type: 'updateProfile', patch: { allergens: [...new Set([...state.profile.allergens, a])] } });
    setPending(pending.filter((x) => x !== a));
  };

  const cuisineName = (v: string) => CUISINES.find((x) => x.value === v)?.label ?? v;
  return (
    <View style={{ gap: space.sm }}>
      <TextInput
        value={text}
        onChangeText={(t) => setText(t.slice(0, MAX_TYPED))}
        onSubmitEditing={submit}
        maxLength={MAX_TYPED}
        placeholder={placeholder}
        placeholderTextColor={c.inkMuted}
        accessibilityLabel="Type it in your own words"
        returnKeyType="done"
        style={[type.body, { color: c.ink, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: space.md, backgroundColor: c.surface }]}
      />
      {text.trim().length >= 2 ? <Button label="Tell EatOS" variant="secondary" icon="chatbubble-ellipses-outline" onPress={submit} /> : null}
      {result ? (
        <View style={{ gap: space.xs }} accessibilityLiveRegion="polite">
          {result.dislikes.length ? <Small muted={false}>Got it: EatOS won’t suggest meals with {list(result.dislikes)}.</Small> : null}
          {result.likes.length ? <Small muted={false}>Got it: EatOS will lean toward {list(result.likes)}.</Small> : null}
          {result.cuisines.length ? <Small muted={false}>Added to foods you enjoy: {list(result.cuisines.map(cuisineName))}.</Small> : null}
          {onAllergens && result.allergens.length ? <Small muted={false}>Turned on above: {list(result.allergens.map((a) => ALLERGEN_LABEL[a]))}. Check it’s right.</Small> : null}
          {result.leftover || !understoodAnything(result) ? <Small>Saved as a note in What EatOS knows. EatOS can’t use it for picks yet.</Small> : null}
          {result.unscreenedAllergy ? (
            <Caution>EatOS can only screen for the 9 major allergens. For any other allergy, always check labels and tell staff.</Caution>
          ) : null}
        </View>
      ) : null}
      {pending.map((a) => (
        <View key={a} style={{ gap: space.xs, padding: space.md, borderRadius: 12, borderWidth: 1, borderColor: c.border }}>
          <Body>Add a {ALLERGEN_LABEL[a]} allergy? EatOS will never suggest meals that normally contain it.</Body>
          <Row>
            <View style={{ flex: 1 }}>
              <Button label="Yes, add it" variant="secondary" a11yLabel={`Yes, add ${ALLERGEN_LABEL[a]} allergy`} onPress={() => confirmAllergy(a, true)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="No" variant="secondary" a11yLabel={`No, not a ${ALLERGEN_LABEL[a]} allergy`} onPress={() => confirmAllergy(a, false)} />
            </View>
          </Row>
        </View>
      ))}
    </View>
  );
}
