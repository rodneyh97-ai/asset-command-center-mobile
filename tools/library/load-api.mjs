// Load importer output into Supabase through the Management API (HTTPS only; no direct Postgres needed).
// Usage: SUPABASE_ACCESS_TOKEN=… node load-api.mjs <project-ref> foods|places <file.tsv> [--useful]
//   --useful (foods): skip products with no nutrition, no label allergens and no "may contain" data.
import fs from 'node:fs';
import readline from 'node:readline';
import { FOOD_COLUMNS, PLACE_COLUMNS } from './lib.mjs';

const unescape = (v) => (v === '\\N' ? null : v.replace(/\\(.)/g, (_, c) => ({ t: '\t', n: '\n', r: '\r' })[c] ?? c));
const pgArray = (s) => (s === null ? [] : JSON.parse(`[${s.slice(1, -1)}]`.replace(/^\[\]$/, '[]')));
const BATCH_BYTES = 1_500_000;

export function toRow(line, kind) {
  const cols = kind === 'foods' ? FOOD_COLUMNS : PLACE_COLUMNS;
  const f = line.split('\t').map(unescape);
  const o = Object.fromEntries(cols.map((c, i) => [c, f[i]]));
  for (const c of ['allergens', 'may_contain', 'cuisines']) if (c in o) o[c] = pgArray(o[c]);
  for (const c of ['nutrients', 'address']) if (c in o) o[c] = o[c] ? JSON.parse(o[c]) : {};
  for (const c of ['allergens_known', 'verified']) if (c in o) o[c] = o[c] === 'true';
  for (const c of ['serving_g', 'lat', 'lon']) if (c in o && o[c] !== null) o[c] = Number(o[c]);
  return o;
}

export const isUseful = (o) => o.allergens_known || o.may_contain.length > 0 || Object.keys(o.nutrients).length > 0;

function sql(kind, rows) {
  const cols = kind === 'foods' ? FOOD_COLUMNS : PLACE_COLUMNS;
  const json = JSON.stringify(rows);
  let tag = 'j';
  while (json.includes(`$${tag}$`)) tag += 'j';
  const updates = cols.filter((c) => c !== 'source' && c !== 'source_id').map((c) => `${c} = excluded.${c}`).join(', ');
  return `insert into public.${kind} (${cols.join(', ')})
select ${cols.join(', ')} from jsonb_populate_recordset(null::public.${kind}, $${tag}$${json}$${tag}$::jsonb)
on conflict (source, source_id) do update set ${updates}, imported_at = now();`;
}

async function run(ref, token, query) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (res.ok) return;
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [ref, kind, file] = process.argv.slice(2);
  const useful = process.argv.includes('--useful');
  const token = (process.env.SUPABASE_ACCESS_TOKEN ?? '').replace(/^</, '').replace(/>$/, '');
  if (!token || !['foods', 'places'].includes(kind)) throw new Error('usage: load-api.mjs <ref> foods|places <file> [--useful]');
  let batch = [];
  let bytes = 0;
  let sent = 0;
  let skipped = 0;
  const flush = async () => {
    if (!batch.length) return;
    await run(ref, token, sql(kind, batch));
    sent += batch.length;
    process.stdout.write(`\r${kind}: ${sent} loaded, ${skipped} skipped`);
    batch = [];
    bytes = 0;
  };
  for await (const line of readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity })) {
    if (!line) continue;
    const o = toRow(line, kind);
    if (useful && kind === 'foods' && !isUseful(o)) {
      skipped++;
      continue;
    }
    batch.push(o);
    bytes += line.length;
    if (bytes > BATCH_BYTES) await flush();
  }
  await flush();
  console.log(`\n${kind}: done, ${sent} loaded, ${skipped} skipped`);
}
