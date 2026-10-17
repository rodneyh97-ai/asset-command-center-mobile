// The map library has no web version; on web, the list below the map is the whole view.
import type { Place } from '../library/client';
import type { Here } from './usePlaceSearch';

export function PlacesMap(_: { here: Here; places: Pick<Place, 'id' | 'name' | 'lat' | 'lon'>[]; height?: number }) {
  return null;
}
