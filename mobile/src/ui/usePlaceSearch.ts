// Finding where the user is (GPS, or a typed ZIP / neighborhood) and the places nearby.
// Location is held only while the screen is open; it is never saved.
import * as Location from 'expo-location';
import { useState } from 'react';

import { MAX_TYPED } from '../engine';
import { placesNear, webLink, type Place, type PlaceKind } from '../library/client';
import { useStore } from '../store/AppProvider';

export type Here = { lat: number; lon: number };
export type PlaceStatus = 'idle' | 'locating' | 'loading' | 'denied' | 'error' | 'not_found';

export function usePlaceSearch() {
  const { track } = useStore();
  const [here, setHere] = useState<Here | null>(null);
  const [where, setWhereRaw] = useState('');
  const [hereLabel, setHereLabel] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [status, setStatus] = useState<PlaceStatus>('idle');

  const load = async (at: Here, kind: PlaceKind | null) => {
    setStatus('loading');
    try {
      const found = await placesNear(at.lat, at.lon, kind);
      setPlaces(found);
      setStatus('idle');
      track('library_search', { kind: 'places', results: found.length });
    } catch {
      setStatus('error');
    }
  };
  const locate = async (kind: PlaceKind | null) => {
    setStatus('locating');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setStatus('denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const at = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      setHere(at);
      setHereLabel(null);
      await load(at, kind);
    } catch {
      setStatus('error');
    }
  };
  // Uses the phone's own address lookup (Apple / Google); no location permission needed.
  const findTyped = async (kind: PlaceKind | null) => {
    const q = where.trim();
    if (q.length < 2 || status === 'locating') return;
    setStatus('locating');
    try {
      const hits = await Location.geocodeAsync(q);
      const hit = hits.find((h) => Number.isFinite(h.latitude) && Number.isFinite(h.longitude));
      if (!hit) {
        setStatus('not_found');
        return;
      }
      const at = { lat: hit.latitude, lon: hit.longitude };
      setHere(at);
      setHereLabel(q);
      await load(at, kind);
    } catch {
      setStatus('not_found'); // includes web, where address lookup isn't available
    }
  };
  const setWhere = (t: string) => setWhereRaw(t.slice(0, MAX_TYPED));

  return { here, hereLabel, where, setWhere, places, status, load, locate, findTyped };
}

export const directionsUrl = (p: Pick<Place, 'lat' | 'lon'>) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
/** The place's own menu page, else its website (both from OpenStreetMap), else a web search for its menu.
 * EatOS has no menu data of its own. */
export const menuSearchUrl = (p: Pick<Place, 'name' | 'street' | 'menuUrl' | 'website'>) =>
  webLink(p.menuUrl) ??
  webLink(p.website) ??
  `https://www.google.com/search?q=${encodeURIComponent([p.name, p.street, 'menu'].filter(Boolean).join(' '))}`;

/** What the menu button says, so a website is never called a menu. */
export function menuLink(p: Pick<Place, 'name' | 'street' | 'menuUrl' | 'website'>): { url: string; kind: 'menu' | 'website' | 'search'; label: string; a11y: string } {
  const url = menuSearchUrl(p);
  if (url === webLink(p.menuUrl)) return { url, kind: 'menu', label: 'See their menu', a11y: `Open the menu for ${p.name}` };
  if (url === webLink(p.website)) return { url, kind: 'website', label: 'Their website', a11y: `Open the website for ${p.name}` };
  return { url, kind: 'search', label: 'See their menu', a11y: `Look up the menu for ${p.name}` };
}
/** Shown on place cards: OSM gives the last edit, not an opening date. */
export const NEW_ON_MAP_LABEL = 'New or updated on the map';
