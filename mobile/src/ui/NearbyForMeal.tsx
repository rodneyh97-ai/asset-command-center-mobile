// "Places near you" under a recommendation: a map and a side-scrolling row of places,
// ones that serve this kind of food first. Real places only (OpenStreetMap); EatOS never
// claims a place has this exact dish on its menu.
import { useState } from 'react';
import { Linking, Pressable, ScrollView, TextInput, View } from 'react-native';

import { clock } from '../clock';
import { CATALOG, type MealIdea, type Recommendation, type Setting } from '../engine';
import { libraryConfigured, milesBetween, type Place } from '../library/client';
import { placeCuisines, rankPlaces, tasteFor } from '../library/personalize';
import { useStore } from '../store/AppProvider';
import { eatingWithNames } from '../store/state';
import { Body, Button, Heading, Icon, Small } from './components';
import { CUISINES } from './labels';
import { PlacesMap } from './PlacesMap';
import { radius, space, type, useColors } from './theme';
import { directionsUrl, menuSearchUrl, usePlaceSearch } from './usePlaceSearch';

const KIND_LABEL: Record<Place['kind'], string> = { restaurant: 'Restaurant', fast_food: 'Fast food', cafe: 'Café', grocery: 'Grocery store', convenience: 'Convenience store' };
const SHOWN = 12;

/** A rough drive estimate from straight-line distance (no traffic data): roads ~1.3x longer, ~25 mph in town. */
export function driveMinutes(miles: number): number {
  return Math.max(2, Math.round(((miles * 1.3) / 25) * 60));
}
export function distanceLabel(miles: number): string {
  return `${miles < 0.1 ? '<0.1' : miles.toFixed(1)} mi · about ${driveMinutes(miles)} min drive`;
}
const IDEAS_PER_PLACE = 8;
const DAY = 86400000;

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
  const { state } = useStore();
  const search = usePlaceSearch();
  // "Somewhere different": places serving food you haven't had lately go first.
  const [different, setDifferent] = useState(false);
  const { here, hereLabel, where, setWhere, places, status } = search;
  if (!libraryConfigured()) return null;

  const now = clock.now().getTime();
  const recent = new Set(
    state.history
      .filter((e) => e.kind === 'accepted' && now - Date.parse(e.at) < 30 * DAY)
      .map((e) => CATALOG.find((m) => m.id === e.mealId)?.cuisine)
      .filter(Boolean),
  );
  // Eating out: restaurants, fast food and cafés. On the go: anywhere that sells food.
  const fits = (p: Place) => setting === 'on_the_go' || (p.kind !== 'grocery' && p.kind !== 'convenience');
  // Places serving this kind of food first (or, in "somewhere different", food you haven't had
  // lately); within that, what you (and whoever you're eating with) like, then distance.
  // Places with a food someone avoids go last.
  const ranked = here
    ? rankPlaces((places ?? []).filter(fits), (p) => milesBetween(here.lat, here.lon, p.lat, p.lon), tasteFor(state, clock.now()), null)
        .map((r) => {
          const kinds = placeCuisines(r.item);
          return {
            p: r.item,
            reason: r.reason,
            disliked: r.disliked,
            miles: milesBetween(here.lat, here.lon, r.item.lat, r.item.lon),
            match: kinds.includes(meal.cuisine),
            fresh: kinds.length > 0 && kinds.every((k) => !recent.has(k) && k !== meal.cuisine),
          };
        })
        .sort((a, b) => Number(a.disliked) - Number(b.disliked) || (different ? Number(b.fresh) - Number(a.fresh) : Number(b.match) - Number(a.match)))
        .slice(0, SHOWN)
    : [];
  const together = eatingWithNames(state);
  const food = CUISINES.find((x) => x.value === meal.cuisine)?.label;
  // The user's own safe options that this kind of place usually has, best match first.
  const ideasFor = (p: Place) => {
    const kinds = placeCuisines(p);
    return ideas.filter((r) => kinds.includes(r.meal.cuisine)).slice(0, IDEAS_PER_PLACE);
  };
  const foodName = (v: string) => CUISINES.find((x) => x.value === v)?.label ?? v;

  return (
    <View style={{ gap: space.sm }}>
      <Heading>Places near you</Heading>
      {together.length ? <Small>Picked for you and {together.join(' and ')}: safe for everyone, matched to what you all like.</Small> : null}
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
          <Button
            label={different ? 'Showing somewhere different' : 'Somewhere different'}
            variant={different ? 'secondary' : 'ghost'}
            icon="compass-outline"
            a11yLabel={different ? 'Back to places that match this pick' : 'Show places with food I haven’t had lately'}
            onPress={() => setDifferent(!different)}
          />
          <Small>
            Near {hereLabel ? `“${hereLabel}”` : 'you'}
            {different ? ' · food you haven’t had lately first' : ranked[0].match && food ? ` · ${food} spots first` : ''} · swipe for more
          </Small>
          <PlacesMap here={here} places={ranked.map((r) => r.p)} height={180} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingRight: space.md }}>
            {ranked.map(({ p, miles, match, reason, fresh }) => (
              <View key={p.id} style={{ width: 250, gap: space.xs, padding: space.md, borderRadius: 16, borderWidth: 1, borderColor: (different ? fresh : match) ? c.primary : c.border, backgroundColor: c.surface }}>
                <Body style={{ fontWeight: '600' }}>
                  {p.name}
                </Body>
                <Small>
                  {KIND_LABEL[p.kind]}
                  {p.cuisines.length ? ` · ${p.cuisines.slice(0, 2).map((x) => x.replace(/_/g, ' ')).join(', ')}` : ''}
                </Small>
                <Small muted={false}>{distanceLabel(miles)}</Small>
                {different && fresh ? (
                  <Small muted={false}>Something different for you</Small>
                ) : match && food ? (
                  <Small muted={false}>Serves {food}</Small>
                ) : reason ? (
                  <Small muted={false}>{reason}</Small>
                ) : null}
                {ideasFor(p).length ? (
                  <View style={{ gap: 4 }}>
                    <Small>What you might get (dishes most {foodName(ideasFor(p)[0].meal.cuisine)} spots have):</Small>
                    {ideasFor(p).map((r, i) => (
                      <Pressable key={r.meal.id} accessibilityRole="button" accessibilityLabel={`Choose ${r.meal.name} at ${p.name}`} onPress={() => onChoose?.(r)} hitSlop={4}>
                        <Small muted={false} style={{ color: c.primary, fontWeight: '600' }}>
                          {i === 0 ? '★ ' : '• '}
                          {r.meal.name}
                          {i === 0 ? ' · Top pick for you' : ''}
                        </Small>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Small>No ideas from EatOS for this kind of place yet. Check their menu.</Small>
                )}
                <Button label="Directions" variant="secondary" icon="navigate-outline" a11yLabel={`Directions to ${p.name}`} onPress={() => void Linking.openURL(directionsUrl(p)).catch(() => {})} />
                <Button label="See their menu" variant="ghost" icon="restaurant-outline" a11yLabel={`Look up the menu for ${p.name}`} onPress={() => void Linking.openURL(menuSearchUrl(p)).catch(() => {})} />
              </View>
            ))}
          </ScrollView>
          <Small>Check the menu when you get there: EatOS doesn’t know each place’s exact dishes. Places © OpenStreetMap contributors.</Small>
        </>
      ) : null}
    </View>
  );
}
