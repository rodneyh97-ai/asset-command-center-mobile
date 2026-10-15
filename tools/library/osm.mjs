// OpenStreetMap (ODbL) → places.tsv, from an Overpass API JSON response.
// Get data:  curl -s https://overpass-api.de/api/interpreter --data-urlencode "data@overpass.ql" > area.json
// (edit the bounding box in overpass.ql first). Usage: node osm.mjs area.json places.tsv
import fs from 'node:fs';
import { PLACE_COLUMNS, clean, writer } from './lib.mjs';

const KIND = { restaurant: 'restaurant', fast_food: 'fast_food', cafe: 'cafe', supermarket: 'grocery', grocery: 'grocery', greengrocer: 'grocery', convenience: 'convenience' };

export async function importOsm(input, outPath) {
  const data = JSON.parse(fs.readFileSync(input, 'utf8'));
  const out = writer(outPath, PLACE_COLUMNS);
  for (const el of data.elements ?? []) {
    const t = el.tags ?? {};
    const kind = KIND[t.amenity] ?? KIND[t.shop];
    const name = clean(t.name ?? t.brand, 200);
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!kind || !name || typeof lat !== 'number' || typeof lon !== 'number') continue;
    out.write({
      source: 'openstreetmap',
      source_id: `${el.type}/${el.id}`,
      kind,
      name,
      brand: clean(t.brand, 120) || undefined,
      cuisines: (t.cuisine ?? '').split(/[;,]/).map((x) => x.trim().toLowerCase()).filter((x) => /^[a-z_]{2,30}$/.test(x)).slice(0, 6),
      lat,
      lon,
      address: Object.fromEntries(['housenumber', 'street', 'city', 'postcode', 'state'].map((k) => [k, t[`addr:${k}`]]).filter(([, v]) => v)),
    });
  }
  return out.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [input, out] = process.argv.slice(2);
  importOsm(input, out).then((n) => console.log(`osm: ${n} places → ${out}`));
}
