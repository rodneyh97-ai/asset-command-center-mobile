// A small map of nearby places. Tapping a pin's label opens directions.
// The map shows the searched spot as a pin; it never turns on live location tracking.
import { Linking, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import type { Place } from '../library/client';
import { radius, useColors } from './theme';
import { directionsUrl, type Here } from './usePlaceSearch';

export function PlacesMap({ here, places, height = 220 }: { here: Here; places: Pick<Place, 'id' | 'name' | 'lat' | 'lon'>[]; height?: number }) {
  const c = useColors();
  const lats = [here.lat, ...places.map((p) => p.lat)];
  const lons = [here.lon, ...places.map((p) => p.lon)];
  const pad = 1.3;
  const region = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
    latitudeDelta: Math.max(0.01, (Math.max(...lats) - Math.min(...lats)) * pad),
    longitudeDelta: Math.max(0.01, (Math.max(...lons) - Math.min(...lons)) * pad),
  };
  return (
    <View
      style={{ height, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}
      accessible
      accessibilityLabel={`Map of ${places.length} nearby places. The list below has the same places.`}
    >
      <MapView style={{ flex: 1 }} initialRegion={region} toolbarEnabled={false} showsPointsOfInterests={false}>
        <Marker coordinate={{ latitude: here.lat, longitude: here.lon }} title="You searched here" pinColor="blue" />
        {places.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lon }}
            title={p.name}
            description="Tap for directions"
            onCalloutPress={() => void Linking.openURL(directionsUrl(p)).catch(() => {})}
          />
        ))}
      </MapView>
    </View>
  );
}
