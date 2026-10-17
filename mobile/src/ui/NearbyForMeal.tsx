// "Places near you" under a recommendation: a map and a side-scrolling row of places,
// ones that serve this kind of food first. Real places only (OpenStreetMap); EatOS never
// claims a place has this exact dish on its menu.
import { Linking, Pressable, ScrollView, TextInput, View } from 'react-native';

import type { MealIdea, Recommendation, Setting } from '../engine';
import { libraryConfigured, milesBetween, type Place } from '../library/client';
import { placeCuisines } from '../library/personalize';
import { Body, Button, Heading, Icon, Small } from './components';
import { CUISINES } from './labels';
import { PlacesMap } from './PlacesMap';
import { radius, space, type, useColors } from './theme';
import { directionsUrl, usePlaceSearch } from './usePlaceSearch';

const KIND_LABEL: Record<Place['kind'], string> = { restaurant: 'Restaurant', fast_food: 'Fast food', cafe: 'Café', grocery: 'Grocery store', convenience: 'Convenience store' };
const SHOWN = 12;

export function NearbyForMeal({
  meal,
  setting,
  ideas = [],
  onChoose,
}: {
  meal: MealIdea;
  setting: Setting;
  /** Safe options already checked for this user; the ones matching a place's food are shown on its card. */
  ideas?: Recommendation[];
  onChoose?: (r: Recommendation) => void;
}) {
  const c = useColors();
  const search = usePlaceSearch();
  const { here, hereLabel, where, setWhere, places, status } = search;
  if (!libraryConfigured()) return null;

  // Eating out: restaurants, fast food and cafés. On the go: anywhere that sells food.
  const fits = (p: Place) => setting === 'on_the_go' || (p.kind !== 'grocery' && p.kind !== 'convenience');
  const ranked = here
    ? (places ?? [])
        .filter(fits)
        .map((p) => ({ p, miles: milesBetween(here.lat, here.lon, p.lat, p.lon), match: placeCuisines(p).includes(meal.cuisine) }))
        .sort((a, b) => Number(b.match) - Number(a.match) || a.miles - b.miles)
        .slice(0, SHOWN)
    : [];
  const food = CUISINES.find((x) => x.value === meal.cuisine)?.label;
  const ideasFor = (p: Place) => {
    const kinds = placeCuisines(p);
    return ideas.filter((r) => kinds.includes(r.meal.cuisine)).slice(0, 2);
  };
  const foodName = (v: string) => CUISINES.find((x) => x.value === v)?.label ?? v;

  return (
    <View style={{ gap: space.sm }}>
      <Heading>Places near you</Heading>
      {!here ? (
        <>
          <Small>See where to get something like this. Your location is only used for this search and isn’t saved.</Small>
          <Button
            label={status === 'locating' ? 'Finding you…' : 'Show places near me'}
            icon="location-outline"
            variant="secondary"
            disabled={status === 'locating'}
            onPress={() => void search.locate(null)}
          />
        </>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 44 }}>
        <Icon name="map-outline" size={18} color={c.inkMuted} />
        <TextInput
          value={where}
          onChangeText={setWhere}
          onSubmitEditing={() => void search.findTyped(null)}
          placeholder={here ? 'Search somewhere else' : 'Or type a ZIP code or neighborhood'}
          placeholderTextColor={c.inkMuted}
          accessibilityLabel="Type where you are"
          autoCorrect={false}
          returnKeyType="search"
          style={[type.body, { flex: 1, color: c.ink, paddingVertical: space.sm }]}
        />
        {where.trim().length >= 2 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Search this place" onPress={() => void search.findTyped(null)} hitSlop={12}>
            <Icon name="arrow-forward-circle" size={22} color={c.primary} />
          </Pressable>
        ) : null}
      </View>
      {status === 'not_found' ? <Small>Couldn’t find that place. Try a ZIP code, or a neighborhood with the city.</Small> : null}
      {status === 'denied' ? <Small>Location is off for EatOS. Type where you are above instead.</Small> : null}
      {status === 'error' ? <Small>Couldn’t load nearby places. Check your connection and try again.</Small> : null}
      {status === 'loading' ? <Small>Looking nearby…</Small> : null}
      {here && places && ranked.length === 0 && status === 'idle' ? (
        <Body muted>Nothing listed nearby yet. EatOS only has places for some areas so far, and map data is volunteer-made.</Body>
      ) : null}
      {here && ranked.length ? (
        <>
          <Small>
            Near {hereLabel ? `“${hereLabel}”` : 'you'}
            {ranked[0].match && food ? ` · ${food} spots first` : ''} · swipe for more
          </Small>
          <PlacesMap here={here} places={ranked.map((r) => r.p)} height={180} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingRight: space.md }}>
            {ranked.map(({ p, miles, match }) => (
              <View key={p.id} style={{ width: 220, gap: space.xs, padding: space.md, borderRadius: 16, borderWidth: 1, borderColor: match ? c.primary : c.border, backgroundColor: c.surface }}>
                <Body style={{ fontWeight: '600' }}>
                  {p.name}
                </Body>
                <Small>
                  {KIND_LABEL[p.kind]}
                  {p.cuisines.length ? ` · ${p.cuisines.slice(0, 2).map((x) => x.replace(/_/g, ' ')).join(', ')}` : ''}
                </Small>
                <Small muted={false}>
                  {miles < 0.1 ? '<0.1' : miles.toFixed(1)} mi{match && food ? ` · ${food}` : ''}
                </Small>
                {ideasFor(p).length ? (
                  <View style={{ gap: 2 }}>
                    <Small>Ideas here (dishes most {foodName(ideasFor(p)[0].meal.cuisine)} spots have):</Small>
                    {ideasFor(p).map((r) => (
                      <Pressable key={r.meal.id} accessibilityRole="button" accessibilityLabel={`Choose ${r.meal.name} at ${p.name}`} onPress={() => onChoose?.(r)} hitSlop={6}>
                        <Small muted={false} style={{ color: c.primary, fontWeight: '600' }}>• {r.meal.name}</Small>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <Button label="Directions" variant="secondary" icon="navigate-outline" a11yLabel={`Directions to ${p.name}`} onPress={() => void Linking.openURL(directionsUrl(p)).catch(() => {})} />
              </View>
            ))}
          </ScrollView>
          <Small>Check the menu when you get there: EatOS doesn’t know each place’s exact dishes. Places © OpenStreetMap contributors.</Small>
        </>
      ) : null}
    </View>
  );
}
