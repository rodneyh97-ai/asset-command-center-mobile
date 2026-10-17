import type { Allergen } from '../../engine';
import { allergyStatus } from '../allergy';
import { milesBetween, parseFood, parsePlace, placesNear, searchFoods, type Food } from '../client';

const food = (o: Partial<Food>): Food => ({ id: 1, source: 'usda_fdc', name: 'X', brand: null, allergens: [], allergensKnown: false, mayContain: [], nutrients: {}, verified: true, ...o });
const ALL: Allergen[] = ['peanut', 'tree_nut', 'dairy', 'egg', 'gluten', 'soy', 'fish', 'shellfish', 'sesame'];

describe('allergy status never says "safe"', () => {
  it('USDA peanut butter (no allergen data) is flagged for a peanut allergy by its name', () => {
    expect(allergyStatus(food({ name: 'Peanut butter, creamy' }), ['peanut'])).toMatchObject({ level: 'name_suggests', nameSuggests: ['peanut'] });
  });
  it('label data wins: contains, then may contain', () => {
    const f = food({ source: 'open_food_facts', name: 'Bar', allergens: ['tree_nut'], mayContain: ['peanut'], allergensKnown: true });
    expect(allergyStatus(f, ['peanut', 'tree_nut'])).toMatchObject({ level: 'contains', contains: ['tree_nut'], mayContain: ['peanut'] });
    expect(allergyStatus(f, ['peanut'])).toMatchObject({ level: 'may_contain' });
  });
  it('no data and nothing in the name is "unknown", not "none"', () => {
    expect(allergyStatus(food({ name: 'Rice cakes' }), ['peanut']).level).toBe('unknown');
  });
  it('"none listed" only when the label lists allergens and none are the user’s', () => {
    expect(allergyStatus(food({ name: 'Rice cakes', allergens: ['soy'], allergensKnown: true }), ['peanut']).level).toBe('none_listed');
  });
  it('the name check can only add warnings, never remove label ones', () => {
    for (const a of ALL) {
      const f = food({ name: 'Plain water', allergens: [a], allergensKnown: true });
      expect(allergyStatus(f, [a]).level).toBe('contains');
    }
  });
  it('catches common hidden names', () => {
    const cases: [string, Allergen][] = [['Nutella hazelnut spread', 'tree_nut'], ['Tahini', 'sesame'], ['Whole wheat bread', 'gluten'], ['Shrimp, cooked', 'shellfish'], ['Miso soup', 'soy'], ['Greek yogurt', 'dairy'], ['Mayonnaise', 'egg'], ['Canned tuna', 'fish']];
    for (const [name, a] of cases) expect(allergyStatus(food({ name }), [a]).level).toBe('name_suggests');
  });
});

describe('library client treats server data as untrusted', () => {
  it('drops malformed rows and unknown allergens, clamps text', () => {
    expect(parseFood(null)).toBeNull();
    expect(parseFood({ id: 'x', name: 'a', source: 'usda_fdc' })).toBeNull();
    const f = parseFood({ id: 3, source: 'open_food_facts', name: 'n'.repeat(500), allergens: ['peanut', 'plutonium', 7], nutrients: { energy_kcal: 100, protein_g: -0.43, carbs_g: -5, junk: 5, fat_g: 'x' } })!;
    expect(f.name).toHaveLength(200);
    expect(f.allergens).toEqual(['peanut']);
    expect(f.nutrients).toEqual({ energy_kcal: 100, protein_g: 0 }); // tiny negative → 0; clearly bad (-5) dropped

    expect(parsePlace({ id: 1, kind: 'casino', name: 'x', lat: 1, lon: 1 })).toBeNull();
    expect(parsePlace({ id: 1, kind: 'cafe', name: 'x', lat: 200, lon: 1 })).toBeNull();
    expect(parsePlace({ id: 1, kind: 'cafe', name: 'Joe', lat: 39, lon: -94, cuisines: ['coffee', '<script>'], address: { housenumber: '12', street: 'Main St' } })).toMatchObject({ street: '12 Main St', cuisines: ['coffee'] });
  });

  it('calls the search and nearby functions with clamped input', async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fetchImpl = async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true, status: 200, json: async () => [{ id: 1, source: 'usda_fdc', name: 'Broccoli', nutrients: {} }, { bad: true }] };
    };
    const opts = { url: 'https://x.supabase.co', key: 'sb_publishable_' + 'a'.repeat(20), fetchImpl };
    expect(await searchFoods('b', opts)).toEqual([]);
    expect(calls).toHaveLength(0);
    expect((await searchFoods('  broc  ', opts)).map((f) => f.name)).toEqual(['Broccoli']);
    expect(calls[0]).toEqual({ url: 'https://x.supabase.co/rest/v1/rpc/search_foods', body: { q: 'broc', lim: 25 } });
    await placesNear(39.1, -94.58, 'grocery', opts);
    expect(calls[1].body).toEqual({ p_lat: 39.1, p_lon: -94.58, p_km: 8, p_kind: 'grocery' });
  });

  it('measures distance in miles', () => {
    expect(milesBetween(39.0997, -94.5786, 39.0997, -94.5786)).toBe(0);
    expect(milesBetween(39.0997, -94.5786, 38.627, -90.1994)).toBeGreaterThan(230); // KC → St. Louis ≈ 238 mi
    expect(milesBetween(39.0997, -94.5786, 38.627, -90.1994)).toBeLessThan(245);
  });
});
