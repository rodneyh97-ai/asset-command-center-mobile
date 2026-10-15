// Shared helpers for the public-data importers. No dependencies; streams large files.
import fs from 'node:fs';
import readline from 'node:readline';

/** Streaming RFC 4180 CSV (or TSV) reader that yields objects keyed by header name. */
export async function* readTable(path, delimiter = ',') {
  const rl = readline.createInterface({ input: fs.createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  let header = null;
  let pending = '';
  for await (const line of rl) {
    pending = pending ? `${pending}\n${line}` : line;
    if (delimiter === ',' && (pending.match(/"/g) || []).length % 2 === 1) continue; // quoted newline: keep reading
    const fields = delimiter === ',' ? parseCsvLine(pending) : pending.split('\t');
    pending = '';
    if (!header) {
      header = fields.map((h) => h.replace(/^\uFEFF/, '').trim());
      continue;
    }
    const row = {};
    header.forEach((h, i) => (row[h] = fields[i] ?? ''));
    yield row;
  }
}

function parseCsvLine(s) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** One PostgreSQL COPY (text format) value. */
export function pg(v) {
  if (v === null || v === undefined || v === '') return '\\N';
  if (Array.isArray(v)) return pg(`{${v.map((x) => `"${String(x).replace(/["\\]/g, '\\$&')}"`).join(',')}}`);
  if (typeof v === 'object') return pg(JSON.stringify(v));
  return String(v).replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

export const FOOD_COLUMNS = ['source', 'source_id', 'kind', 'name', 'brand', 'category', 'gtin', 'ingredients_text', 'allergens', 'allergens_known', 'may_contain', 'nutrients', 'serving_g', 'verified'];
export const PLACE_COLUMNS = ['source', 'source_id', 'kind', 'name', 'brand', 'cuisines', 'lat', 'lon', 'address'];

export function writer(path, columns) {
  const out = fs.createWriteStream(path);
  let n = 0;
  return {
    write(row) {
      out.write(columns.map((c) => pg(row[c])).join('\t') + '\n');
      n++;
    },
    close: () => new Promise((r) => out.end(() => r(n))),
  };
}

export const num = (v) => {
  const n = Number(v);
  return v === '' || v === undefined || !Number.isFinite(n) ? undefined : n;
};
export const clean = (s, max = 300) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
export const gtin = (s) => (/^[0-9]{6,14}$/.test((s ?? '').trim()) ? s.trim() : undefined);

/** Map source allergen tags to EatOS allergens. */
export const ALLERGEN_TAGS = {
  'en:peanuts': 'peanut',
  'en:nuts': 'tree_nut',
  'en:milk': 'dairy',
  'en:eggs': 'egg',
  'en:gluten': 'gluten',
  'en:soybeans': 'soy',
  'en:fish': 'fish',
  'en:crustaceans': 'shellfish',
  'en:molluscs': 'shellfish',
  'en:sesame-seeds': 'sesame',
};
