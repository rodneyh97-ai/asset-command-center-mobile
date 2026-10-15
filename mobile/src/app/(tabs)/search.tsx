import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { CATALOG, safetyCheck, type MealIdea, type Setting } from '../../engine';
import { useActiveProfile } from '../../store/useActiveProfile';
import { useStore } from '../../store/AppProvider';

import { Body, Caution, ChipGroup, Icon, IconTile, MealArt, Row, Screen, Small, Tags, Title } from '../../ui/components';
import { SETTINGS } from '../../ui/labels';
import { MealFacts } from '../../ui/MealDetail';
import { mealTags } from '../../ui/mealTags';
import { radius, space, type, useColors } from '../../ui/theme';

type Filter = 'all' | 'protein' | 'quick' | 'veg' | 'budget';
const FILTERS: { value: Filter; label: string; test: (m: MealIdea) => boolean }[] = [
  { value: 'all', label: 'All', test: () => true },
  { value: 'protein', label: 'High Protein', test: (m) => m.highProtein },
  { value: 'quick', label: 'Quick', test: (m) => m.effort === 'none' || m.prepMinutes <= 10 },
  { value: 'veg', label: 'Vegetarian', test: (m) => !m.diet.hasMeat && !m.diet.hasFish },
  { value: 'budget', label: 'Budget', test: (m) => m.budget === 1 },
];
const MAX_QUERY = 60;

export default function Search() {
  const { state, ready, track } = useStore();
  const c = useColors();
  const p = useActiveProfile(state);
  const [setting, setSetting] = useState<Setting>(() => (state.lastContext?.setting === 'home' ? 'restaurant' : (state.lastContext?.setting ?? 'restaurant')));
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!p) return [];
    const q = query.trim().toLowerCase();
    const test = FILTERS.find((f) => f.value === filter)!.test;
    return CATALOG.filter(
      (m) =>
        m.settings.includes(setting) &&
        safetyCheck(m, p, setting).ok && // never list something unsafe for this user
        test(m) &&
        (!q || `${m.name} ${m.summary} ${m.cuisine}`.toLowerCase().includes(q)),
    );
  }, [p, setting, filter, query]);

  if (!ready) return null; // wait for saved data before deciding where to go
  if (!p) return <Redirect href="/onboarding" />;

  return (
    <Screen edges={['top', 'left', 'right']}>
      <Title>Explore ideas</Title>
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 48 }]}>
        <Icon name="search" size={18} color={c.inkMuted} />
        <TextInput
          value={query}
          onChangeText={(t) => setQuery(t.slice(0, MAX_QUERY))}
          onSubmitEditing={() => track('search_used')}
          placeholder="Search meals, e.g. bowl, salad, tacos"
          placeholderTextColor={c.inkMuted}
          accessibilityLabel="Search meal ideas"
          maxLength={MAX_QUERY}
          autoCorrect={false}
          returnKeyType="search"
          style={[type.body, { flex: 1, color: c.ink, paddingVertical: space.sm }]}
        />
        {query ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={12}>
            <Icon name="close-circle" size={18} color={c.inkMuted} />
          </Pressable>
        ) : null}
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel="Where are you eating?">
        <Row gap={space.xs}>
          {SETTINGS.map((s) => (
            <IconTile key={s.value} icon={s.icon} label={s.label} selected={setting === s.value} onPress={() => setSetting(s.value)} />
          ))}
        </Row>
      </View>
      <ChipGroup options={FILTERS} value={filter} onChange={setFilter} />

      {setting === 'restaurant' || setting === 'takeout' ? (
        <Caution>These are dishes most places offer, not a specific restaurant’s menu. Nearby restaurant menus are coming once we have verified menu data.</Caution>
      ) : null}

      <Small>
        {results.length} {results.length === 1 ? 'idea' : 'ideas'} that fit your restrictions
      </Small>
      {results.length === 0 ? <Body muted>Nothing matches. Try another filter or place.</Body> : null}
      <View style={{ gap: space.sm }}>
        {results.map((m) => (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            accessibilityLabel={`${m.name}. Open details.`}
            onPress={() => router.push({ pathname: '/meal/[id]', params: { id: m.id, setting } })}
            style={({ pressed }) => ({
              flexDirection: 'row',
              gap: space.md,
              alignItems: 'center',
              padding: space.sm,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.surface,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <MealArt meal={m} variant="thumb" />
            <View style={{ flex: 1, gap: 4 }}>
              <Body style={{ fontWeight: '600' }}>{m.name}</Body>
              <Tags labels={mealTags(m, 2)} />
              <MealFacts meal={m} setting={setting} />
            </View>
            <Icon name="chevron-forward" size={18} color={c.inkMuted} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
