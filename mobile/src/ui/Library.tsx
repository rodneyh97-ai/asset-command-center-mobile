// The public food & place library: search foods (USDA + Open Food Facts) and find
// restaurants and grocery stores nearby (OpenStreetMap). Read-only, no account needed.
import { useRef, useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';

import type { Allergen, Profile } from '../engine';
import { allergyStatus } from '../library/allergy';
import { rankFoods, rankPlaces, tasteFor } from '../library/personalize';
import { clock } from '../clock';
import { libraryConfigured, milesBetween, searchFoods, type Food, type NutrientKey, type Place, type PlaceKind } from '../library/client';
import { useStore } from '../store/AppProvider';
import { Body, Button, Caution, ChipGroup, Icon, Row, Small } from './components';
import { ALLERGENS } from './labels';
import { PlacesMap } from './PlacesMap';
import { radius, space, type, useColors } from './theme';
import { directionsUrl, usePlaceSearch } from './usePlaceSearch';

const MAX_QUERY = 60;
const allergenName = (a: Allergen) => ALLERGENS.find((x) => x.value === a)!.label.replace(/ allergy| free/i, '').toLowerCase();
const names = (xs: Allergen[]) => xs.map(allergenName).join(', ');

const NUTRIENT_LABELS: [NutrientKey, string, string][] = [
  ['energy_kcal', 'Calories', 'kcal'],
  ['protein_g', 'Protein', 'g'],
  ['carbs_g', 'Carbs', 'g'],
  ['fiber_g', 'Fiber', 'g'],
  ['sugars_g', 'Sugars', 'g'],
  ['fat_g', 'Fat', 'g'],
  ['sat_fat_g', 'Saturated fat', 'g'],
  ['sodium_mg', 'Sodium', 'mg'],
  ['potassium_mg', 'Potassium', 'mg'],
  ['calcium_mg', 'Calcium', 'mg'],
  ['iron_mg', 'Iron', 'mg'],
  ['magnesium_mg', 'Magnesium', 'mg'],
  ['zinc_mg', 'Zinc', 'mg'],
  ['vitamin_c_mg', 'Vitamin C', 'mg'],
  ['vitamin_d_ug', 'Vitamin D', 'µg'],
  ['vitamin_b12_ug', 'Vitamin B12', 'µg'],
];
const fmt = (v: number) => (v >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString());

function NotConnected({ what }: { what: string }) {
  return <Body muted>The {what} isn’t connected in this build yet. Meal ideas still work.</Body>;
}

// ---------- Foods ----------

export function FoodsPanel({ profile }: { profile: Profile }) {
  const { state, track } = useStore();
  const c = useColors();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [open, setOpen] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef('');
  // Numbers stay out of view for people who asked for no diet talk.
  const gentle = profile.considerations.includes('ed_sensitive');

  if (!libraryConfigured()) return <NotConnected what="food library" />;

  const run = async (q: string) => {
    latest.current = q;
    if (q.trim().length < 2) {
      setResults(null);
      setStatus('idle');
      return;
    }
    setStatus('loading');
    try {
      const found = await searchFoods(q);
      if (latest.current !== q) return; // a newer search is on its way
      setResults(found);
      setStatus('idle');
      track('library_search', { kind: 'food', results: found.length });
    } catch {
      if (latest.current === q) setStatus('error');
    }
  };
  const onChange = (t: string) => {
    const q = t.slice(0, MAX_QUERY);
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(q), 350);
  };

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 48 }}>
        <Icon name="search" size={18} color={c.inkMuted} />
        <TextInput
          value={query}
          onChangeText={onChange}
          onSubmitEditing={() => void run(query)}
          placeholder="Search foods, e.g. oatmeal, greek yogurt"
          placeholderTextColor={c.inkMuted}
          accessibilityLabel="Search foods"
          maxLength={MAX_QUERY}
          autoCorrect={false}
          returnKeyType="search"
          style={[type.body, { flex: 1, color: c.ink, paddingVertical: space.sm }]}
        />
      </View>
      {status === 'loading' ? <Small>Searching…</Small> : null}
      {status === 'error' ? <Body muted>Couldn’t reach the food library. Check your connection and try again.</Body> : null}
      {results && results.length === 0 && status === 'idle' ? <Body muted>No foods match “{query.trim()}”.</Body> : null}
      {rankFoods(results ?? [], tasteFor(state, clock.now())).map(({ item: f, reason, disliked }) => (
        <FoodRow key={f.id} food={f} reason={reason} disliked={disliked} allergens={profile.allergens} gentle={gentle} open={open === f.id} onToggle={() => setOpen(open === f.id ? null : f.id)} />
      ))}
      <Small>Food data: U.S. Department of Agriculture, FoodData Central (public domain) and Open Food Facts contributors (ODbL). Values are per 100 g.</Small>
    </View>
  );
}

function FoodRow({
  food: f,
  reason,
  disliked,
  allergens,
  gentle,
  open,
  onToggle,
}: {
  food: Food;
  reason: string | null;
  disliked: boolean;
  allergens: Allergen[];
  gentle: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const c = useColors();
  const s = allergyStatus(f, allergens);
  const n = f.nutrients;
  const headline = gentle
    ? null
    : [n.energy_kcal !== undefined && `${fmt(n.energy_kcal)} kcal`, n.protein_g !== undefined && `${fmt(n.protein_g)} g protein`].filter(Boolean).join(' · ');
  return (
    <View style={{ gap: space.xs, padding: space.md, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${f.name}${f.brand ? `, ${f.brand}` : ''}. ${open ? 'Hide' : 'Show'} details.`} accessibilityState={{ expanded: open }} onPress={onToggle} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Body style={{ fontWeight: '600' }}>{f.name}</Body>
            <Small>
              {f.brand ? `${f.brand} · ` : ''}
              {f.verified ? 'USDA · verified' : 'Open Food Facts · not verified'}
              {headline ? ` · ${headline}` : ''}
            </Small>
          </View>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.inkMuted} />
        </Row>
      </Pressable>
      {reason ? <Reason text={reason} negative={disliked} /> : null}
      {allergens.length > 0 ? <AllergyLine status={s} /> : null}
      {open ? (
        gentle ? (
          <Small>Nutrition numbers are hidden because you asked for no diet talk. You can change that in Profile.</Small>
        ) : Object.keys(n).length === 0 ? (
          <Small>No nutrition information for this product.</Small>
        ) : (
          <View accessibilityLabel="Nutrition per 100 grams">
            {NUTRIENT_LABELS.filter(([k]) => n[k] !== undefined).map(([k, label, unit]) => (
              <Row key={k} style={{ justifyContent: 'space-between', paddingVertical: 2 }}>
                <Small muted={false}>{label}</Small>
                <Small muted={false}>
                  {fmt(n[k]!)} {unit}
                </Small>
              </Row>
            ))}
            <Small>Per 100 g.{f.verified ? '' : ' From product labels entered by volunteers; check the package.'}</Small>
          </View>
        )
      ) : null}
    </View>
  );
}

function Reason({ text, negative }: { text: string; negative: boolean }) {
  const c = useColors();
  return (
    <Row gap={space.xs}>
      <Icon name={negative ? 'thumbs-down-outline' : 'sparkles-outline'} size={14} color={negative ? c.inkMuted : c.primary} />
      <Small muted={negative}>{text}</Small>
    </Row>
  );
}

function AllergyLine({ status: s }: { status: ReturnType<typeof allergyStatus> }) {
  if (s.level === 'contains')
    return <Caution>Contains {names(s.contains)}.{s.mayContain.length ? ` May contain ${names(s.mayContain)}.` : ''}</Caution>;
  if (s.level === 'may_contain') return <Caution>May contain {names(s.mayContain)}. Check the label.</Caution>;
  if (s.level === 'name_suggests') return <Caution>Likely contains {names(s.nameSuggests)} (from its name). Check the label.</Caution>;
  if (s.level === 'unknown') return <Small>Allergens not recorded. Check the label before eating.</Small>;
  return <Small>None of your allergens are listed on the label. Labels can change, so check the package.</Small>;
}

// ---------- Places near me ----------

const KIND_OPTIONS: { value: PlaceKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'restaurant', label: 'Restaurants' },
  { value: 'fast_food', label: 'Fast food' },
  { value: 'cafe', label: 'Cafés' },
  { value: 'grocery', label: 'Grocery' },
];
const KIND_LABEL: Record<PlaceKind, string> = { restaurant: 'Restaurant', fast_food: 'Fast food', cafe: 'Café', grocery: 'Grocery store', convenience: 'Convenience store' };
const cuisineLabel = (x: string) => x.replace(/_/g, ' ');

export function NearbyPanel() {
  const { state, dispatch, track } = useStore();
  const c = useColors();
  const [kind, setKind] = useState<PlaceKind | 'all'>('all');
  const search = usePlaceSearch();
  const { here, hereLabel, where, setWhere, places, status } = search;

  if (!libraryConfigured()) return <NotConnected what="places library" />;

  const k = kind === 'all' ? null : kind;
  const locate = () => search.locate(k);
  const findTyped = () => search.findTyped(k);
  const pickKind = (next: PlaceKind | 'all') => {
    setKind(next);
    if (here) void search.load(here, next === 'all' ? null : next);
  };
  const directions = (p: Place) => void Linking.openURL(directionsUrl(p)).catch(() => {});
  const ranked = here ? rankPlaces(places ?? [], (p) => milesBetween(here.lat, here.lon, p.lat, p.lon), tasteFor(state, clock.now()), state.groceryStore?.id ?? null) : [];

  return (
    <View style={{ gap: space.md }}>
      {state.groceryStore ? (
        <Row gap={space.xs}>
          <Icon name="cart-outline" size={18} color={c.primary} />
          <Small muted={false} style={{ flex: 1 }}>
            My grocery store: {state.groceryStore.name}
          </Small>
          <Button label="Clear" variant="ghost" a11yLabel="Clear my grocery store" onPress={() => dispatch({ type: 'setGroceryStore', store: null })} />
        </Row>
      ) : null}
      {!here ? (
        <>
          <Body muted>Find restaurants, cafés and grocery stores around you. Your location is only used for this search and isn’t saved.</Body>
          <Button label={status === 'locating' ? 'Finding you…' : 'Find places near me'} icon="location-outline" disabled={status === 'locating'} onPress={() => void locate()} />
        </>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 48 }}>
        <Icon name="map-outline" size={18} color={c.inkMuted} />
        <TextInput
          value={where}
          onChangeText={setWhere}
          onSubmitEditing={() => void findTyped()}
          placeholder={here ? 'Search somewhere else' : 'Or type a ZIP code or neighborhood'}
          placeholderTextColor={c.inkMuted}
          accessibilityLabel="Type where you are"
          maxLength={MAX_QUERY}
          autoCorrect={false}
          returnKeyType="search"
          style={[type.body, { flex: 1, color: c.ink, paddingVertical: space.sm }]}
        />
        {where.trim().length >= 2 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Search this place" onPress={() => void findTyped()} hitSlop={12}>
            <Icon name="arrow-forward-circle" size={22} color={c.primary} />
          </Pressable>
        ) : null}
      </View>
      {here ? (
        <>
          <Small>Showing places near {hereLabel ? `“${hereLabel}”` : 'you'}</Small>
          <ChipGroup options={KIND_OPTIONS} value={kind} onChange={pickKind} />
        </>
      ) : null}
      {status === 'not_found' ? <Body muted>Couldn’t find that place. Try a ZIP code, or a neighborhood with the city, like “Westport, Kansas City”.</Body> : null}
      {status === 'denied' ? <Body muted>Location is off for EatOS. You can turn it on in your phone’s settings, type where you are above, or keep using meal ideas.</Body> : null}
      {status === 'error' ? <Body muted>Couldn’t load nearby places. Check your connection and try again.</Body> : null}
      {status === 'loading' ? <Small>Looking nearby…</Small> : null}
      {places && places.length === 0 && status === 'idle' ? <Body muted>Nothing listed within about 5 miles yet. Map data is volunteer-made and still growing.</Body> : null}
      {here && ranked.length ? <PlacesMap here={here} places={ranked.slice(0, 15).map((r) => r.item)} /> : null}
      {ranked.map(({ item: p, reason, disliked }) => {
        const mine = state.groceryStore?.id === p.id;
        const miles = here ? milesBetween(here.lat, here.lon, p.lat, p.lon) : 0;
        return (
          <View key={p.id} style={{ gap: space.xs, padding: space.md, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Body style={{ fontWeight: '600' }}>{p.name}</Body>
                <Small>
                  {KIND_LABEL[p.kind]}
                  {p.cuisines.length ? ` · ${p.cuisines.map(cuisineLabel).join(', ')}` : ''}
                  {p.street ? ` · ${p.street}` : ''}
                </Small>
              </View>
              <Small>{miles < 0.1 ? '<0.1' : miles.toFixed(1)} mi</Small>
            </Row>
            {reason && !mine ? <Reason text={reason} negative={disliked} /> : null}
            <Row>
              <View style={{ flex: 1 }}>
                <Button label="Directions" variant="secondary" icon="navigate-outline" a11yLabel={`Directions to ${p.name}`} onPress={() => directions(p)} />
              </View>
              {p.kind === 'grocery' ? (
                <View style={{ flex: 1 }}>
                  <Button
                    label={mine ? 'My store ✓' : 'My store'}
                    variant={mine ? 'primary' : 'secondary'}
                    icon="cart-outline"
                    a11yLabel={mine ? `${p.name} is my grocery store` : `Make ${p.name} my grocery store`}
                    onPress={() => {
                      dispatch({ type: 'setGroceryStore', store: mine ? null : { id: p.id, name: p.name } });
                      if (!mine) track('grocery_store_set');
                    }}
                  />
                </View>
              ) : null}
            </Row>
          </View>
        );
      })}
      {here ? <Small>Map data © OpenStreetMap contributors (ODbL). Hours and menus aren’t included; check before you go.</Small> : null}
    </View>
  );
}
