import { recommend } from '../recommend';
import type { Profile, Context, Allergen, Diet } from '../types';
const settings = ['home','takeout','restaurant','work','on_the_go'] as const;
const mealTimes = ['breakfast','lunch','dinner','snack'] as const;
const times = [5,15,30,60] as const;
const budgets = [1,2,3,4] as const;
const personas: [string, Allergen[], Diet[]][] = [
  ['none',[],[]],['vegetarian',[],['vegetarian']],['vegan',[],['vegan']],['gluten',['gluten'],[]],['dairy',['dairy'],[]],
  ['peanut',['peanut'],[]],['egg',['egg'],[]],['soy',['soy'],[]],['sesame',['sesame'],[]],['shellfish+fish',['shellfish','fish'],[]],
  ['vegan+gluten',['gluten'],['vegan']],['dairy+egg',['dairy','egg'],[]],
];
it('every common user type always gets at least one option that fits the meal time', () => {
  const failures: string[] = [];
  const rows: string[] = [];
  for (const [name, allergens, diets] of personas) {
    const p: Profile = { goal:'eat_better', struggles:[], cuisines:[], allergens, diets, budget:2, considerations:[], createdAt:'' };
    let total=0, empty=0, under3=0; const emptyEx = new Map<string,number>();
    for (const setting of settings) for (const mealTime of mealTimes) for (const time of times) for (const budget of budgets) {
      const ctx: Context = { setting, mealTime, time, budget, hunger:'normal', feeling:'fine' };
      const r = recommend(p, ctx);
      // "good" option = one whose meal time actually matches
      const n = [r.primary, ...r.alternatives].filter(x => x && x.meal.mealTimes.includes(mealTime)).length;
      total++; if (n===0) { failures.push(`${name} ${setting}/${mealTime}/${time}min/budget${budget}`); empty++; const k=`${setting}/${mealTime}`; emptyEx.set(k,(emptyEx.get(k)??0)+1);} if (n<3) under3++;
    }
    rows.push(`${name.padEnd(15)} total ${total}  no-fitting-option ${String(empty).padStart(3)} (${Math.round(empty/total*100)}%)  <3 options ${String(under3).padStart(3)} (${Math.round(under3/total*100)}%)  worst: ${[...emptyEx].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>k+'×'+v).join(', ')}`);
  }
  if (process.env.COVERAGE_REPORT) console.log(rows.join('\n'));
  expect(failures).toEqual([]);
});
