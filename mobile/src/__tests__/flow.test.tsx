import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert, Share } from 'react-native';

import * as reviewModule from '../analytics/review';
import * as libraryClient from '../library/client';
import { ErrorBoundary } from '../app/_layout';
import { clock } from '../clock';
import { CATALOG } from '../engine';
import { MEAL_INGREDIENTS } from '../engine/ingredients';

// Render the real app directory so tabs, stack screens and params all behave as in production.
const routes = 'src/app';

let app: ReturnType<typeof renderRouter>;

async function onboard(opts: { allergy?: string } = {}) {
  app = renderRouter(routes, { initialUrl: '/' });
  fireEvent.press(await screen.findByLabelText('Get Started'));
  await screen.findByText('Any dietary restrictions?');
  if (opts.allergy) {
    fireEvent.press(screen.getByLabelText(opts.allergy));
    fireEvent.press(screen.getByLabelText('Next'));
  } else {
    fireEvent.press(screen.getByLabelText('None — Next'));
  }
  fireEvent.press(screen.getByLabelText('Show my first pick'));
  await screen.findByText('What should I eat?');
}

/** Avatar button and the tab bar both say "Profile"; either goes to the same place. */
const openProfile = () => fireEvent.press(screen.getAllByLabelText('Profile')[0]);

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('core daily flow', () => {
  it('new user: onboarding → decide → accept in a handful of taps', async () => {
    await onboard();
    expect(app.getPathname()).toBe('/');

    fireEvent.press(screen.getByLabelText('Get my recommendation'));
    await screen.findByText('Your Recommendation');
    expect(app.getPathname()).toBe('/decide');
    expect(screen.getByText('Why this works for you')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Try this'));
    await screen.findByText(/^Enjoy your/);
  });

  it('returning user: one tap from opening the app to a recommendation, well under 15 seconds', async () => {
    await onboard();
    screen.unmount();
    const t0 = Date.now();
    renderRouter(routes, { initialUrl: '/' });
    fireEvent.press(await screen.findByLabelText('Get my recommendation')); // the only tap needed
    await screen.findByText('Your Recommendation');
    expect(Date.now() - t0).toBeLessThan(15000);
    expect(screen.getByText('Why this works for you')).toBeTruthy();
  });

  it('persists preferences: a returning user skips onboarding', async () => {
    await onboard();
    const raw = await AsyncStorage.getItem('eatos.state.v1');
    expect(JSON.parse(raw!).profile.goal).toBe('eat_better');

    screen.unmount();
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('What should I eat?');
    expect(screen.queryByLabelText('Get Started')).toBeNull();
  });

  it('allergies are the first question, and the first pick comes after just two questions', async () => {
    renderRouter(routes, { initialUrl: '/' });
    fireEvent.press(await screen.findByLabelText('Get Started'));
    await screen.findByText('Any dietary restrictions?');
    fireEvent.press(screen.getByLabelText('Peanut allergy'));
    fireEvent.press(screen.getByLabelText('Next'));
    await screen.findByText('Anything else EatOS should keep in mind?');
    fireEvent.press(screen.getByLabelText('Show my first pick'));
    fireEvent.press(await screen.findByLabelText('Get my recommendation'));
    await screen.findByText('Your Recommendation');
    const stored = JSON.parse((await AsyncStorage.getItem('eatos.state.v1'))!);
    expect(stored.profile).toMatchObject({ allergens: ['peanut'], goal: 'eat_better' });
    expect(stored.setup.done).toBe(false);
  });

  it('allergy chosen in onboarding is enforced on the recommendation screen', async () => {
    await onboard({ allergy: 'Gluten free' });
    fireEvent.press(screen.getByLabelText('Takeout'));
    fireEvent.press(screen.getByLabelText('Get my recommendation'));
    await screen.findByText('Your Recommendation');
    const glutenMeals = CATALOG.filter((m) => m.contains.includes('gluten') || m.mayContain.includes('gluten'));
    for (const m of glutenMeals) expect(screen.queryByText(m.name)).toBeNull();
    expect(screen.getAllByText(/gluten\/wheat allergy and confirm/).length).toBeGreaterThan(0);
  });

  it('"Something else" shows a different recommendation', async () => {
    await onboard();
    fireEvent.press(screen.getByLabelText('Get my recommendation'));
    await screen.findByText('Your Recommendation');
    const titles = () => CATALOG.map((m) => m.name).filter((n) => screen.queryByRole('header', { name: n }));
    const first = titles();
    fireEvent.press(screen.getByLabelText('Something else'));
    await waitFor(() => expect(titles()).not.toEqual(first));
  });

  const stored = async () => JSON.parse((await AsyncStorage.getItem('eatos.state.v1'))!);

  it('accepted meal appears in "Have again" for one-tap repeat, with undo', async () => {
    await onboard();
    fireEvent.press(screen.getByLabelText('Get my recommendation'));
    await screen.findByText('Your Recommendation');
    fireEvent.press(screen.getByLabelText('Try this'));
    const done = await screen.findByLabelText('Done');
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000); // a deliberate tap, not a double tap
    fireEvent.press(done);
    await screen.findByText('Your last meals');
    jest.restoreAllMocks();
    // One-tap repeat, then undo an accidental tap.
    const before = (await stored()).history.length;
    fireEvent.press(screen.getAllByLabelText(/^Have .* again$/)[0]);
    await screen.findByText(/it is\. Enjoy\./);
    fireEvent.press(screen.getByLabelText('Undo, I’m not having this'));
    await waitFor(async () => expect((await stored()).history.length).toBe(before));
  });

  it('delete all data returns to onboarding', async () => {
    await onboard();
    const g = globalThis as unknown as { confirm?: (m: string) => boolean };
    const original = g.confirm;
    g.confirm = () => true;
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((...args: unknown[]) => {
      const buttons = args[2] as { text: string; onPress?: () => void }[];
      buttons.find((b) => b.text === 'Delete')?.onPress?.();
    });
    openProfile();
    fireEvent.press(await screen.findByLabelText('Delete all my data'));
    await screen.findByLabelText('Get Started');
    expect(await AsyncStorage.getItem('eatos.state.v1')).not.toContain('build_muscle');
    spy.mockRestore();
    g.confirm = original;
  });
});

describe('ATTACK: UI-level abuse', () => {
  const KEY = 'eatos.state.v1';
  const stored = async () => JSON.parse((await AsyncStorage.getItem(KEY))!);

  it.each(['/decide', '/profile'])('deep link to %s with no profile lands on onboarding, not a blank screen', async (url) => {
    renderRouter(routes, { initialUrl: url });
    await screen.findByLabelText('Get Started');
  });

  it('deep link to /onboarding cannot overwrite an existing profile', async () => {
    await onboard({ allergy: 'Peanut allergy' });
    screen.unmount();
    renderRouter(routes, { initialUrl: '/onboarding' });
    await screen.findByText('What should I eat?');
    expect((await stored()).profile.allergens).toEqual(['peanut']);
  });

  it('double-tapping "I’ll have this" records one decision', async () => {
    await onboard();
    fireEvent.press(screen.getByLabelText('Get my recommendation'));
    await screen.findByText('Your Recommendation');
    const btn = screen.getByLabelText('Try this');
    fireEvent.press(btn);
    fireEvent.press(btn);
    await screen.findByText(/^Enjoy your/);
    await waitFor(async () => {
      expect((await stored()).history.filter((e: { kind: string }) => e.kind === 'accepted')).toHaveLength(1);
    });
  });

  it('a storage read failure never overwrites the saved profile', async () => {
    await onboard({ allergy: 'Peanut allergy' });
    screen.unmount();
    const before = await AsyncStorage.getItem(KEY);
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk busy'));
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByLabelText('Get Started'); // runs without data this session
    fireEvent.press(screen.getByLabelText('Get Started'));
    fireEvent.press(screen.getByLabelText('Shellfish allergy'));
    expect(await AsyncStorage.getItem(KEY)).toBe(before);
  });

  it('garbage in storage still opens the app and backs the garbage up', async () => {
    await AsyncStorage.setItem(KEY, '{"version":1,"profile":"💥"');
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByLabelText('Get Started');
    expect(await AsyncStorage.getItem('eatos.state.unreadable-backup')).toBe('{"version":1,"profile":"💥"');
  });

  it('"Have again" hides a saved meal that became unsafe after adding an allergy', async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        profile: { goal: 'eat_better', struggles: [], cuisines: [], allergens: ['dairy'], diets: [], budget: 2, considerations: [], createdAt: '' },
        history: [{ mealId: 'greek-yogurt-bowl', kind: 'saved', at: new Date().toISOString() }],
        lastContext: { setting: 'home', hunger: 'normal', time: 20, budget: 2, feeling: 'fine' },
        analytics: [],
      }),
    );
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('What should I eat?');
    expect(screen.queryByText('Greek yogurt bowl')).toBeNull();
  });

  it('a render crash shows a recovery screen instead of a white screen', async () => {
    const retry = jest.fn(async () => {});
    renderRouter({ index: () => <ErrorBoundary error={new Error('boom')} retry={retry} /> }, { initialUrl: '/' });
    await screen.findByText('Something went wrong');
    fireEvent.press(screen.getByLabelText('Try again'));
    expect(retry).toHaveBeenCalled();
  });

  it('hidden ("Not for me") meals can be restored from Preferences', async () => {
    await onboard();
    fireEvent.press(screen.getByLabelText('Get my recommendation'));
    await screen.findByText('Your Recommendation');
    fireEvent.press(screen.getByLabelText(/^Not for me/));
    fireEvent.press(screen.getByLabelText('Back'));
    await screen.findByText('What should I eat?');
    openProfile();
    fireEvent.press(await screen.findByLabelText('Show hidden meals again'));
    await waitFor(async () => {
      expect((await stored()).history.some((e: { kind: string }) => e.kind === 'disliked')).toBe(false);
    });
  });
});

describe('planning the next meal (implementation intentions)', () => {
  afterEach(() => clock.set(null));
  const fakeNow = (iso: string) => clock.set(new Date(iso));

  it('plan lunch in the morning, then one tap at lunch time', async () => {
    fakeNow('2026-10-15T09:00:00');
    await onboard();
    fireEvent.press(screen.getByLabelText('Plan my lunch'));
    await screen.findByText('Planning your lunch');
    fireEvent.press(screen.getByLabelText('Plan this for lunch'));
    await screen.findByText(/^Lunch is planned:/);
    const planned = (await AsyncStorage.getItem('eatos.state.v1'))!;
    const mealId = JSON.parse(planned).plan.mealId;
    expect(mealId).toBeTruthy();

    // Later, at lunch time, the app opens to the plan.
    screen.unmount();
    fakeNow('2026-10-15T12:15:00');
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Your plan for lunch');
    fireEvent.press(screen.getByLabelText('Having it'));
    await screen.findByText(/as planned\. Enjoy\./);
    const after = JSON.parse((await AsyncStorage.getItem('eatos.state.v1'))!);
    expect(after.plan).toBeNull();
    expect(after.history.at(-1)).toMatchObject({ mealId, kind: 'accepted', mealTime: 'lunch' });
  });

  it('a missed plan disappears quietly the next day', async () => {
    fakeNow('2026-10-15T09:00:00');
    await onboard();
    fireEvent.press(screen.getByLabelText('Plan my lunch'));
    fireEvent.press(await screen.findByLabelText('Plan this for lunch'));
    await screen.findByText(/^Lunch is planned:/);
    screen.unmount();
    fakeNow('2026-10-16T19:00:00');
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('What should I eat?');
    expect(screen.queryByText(/Your plan for/)).toBeNull();
    await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem('eatos.state.v1'))!).plan).toBeNull());
  });

  it('a plan that no longer fits a new allergy is not offered as "Having it"', async () => {
    fakeNow('2026-10-15T12:30:00');
    await AsyncStorage.setItem(
      'eatos.state.v1',
      JSON.stringify({
        version: 1,
        profile: { goal: 'eat_better', struggles: [], cuisines: [], allergens: ['dairy'], diets: [], budget: 2, considerations: [], createdAt: '' },
        history: [],
        lastContext: null,
        analytics: [],
        plan: { mealId: 'grilled-cheese-soup', mealTime: 'lunch', date: '2026-10-15', setting: 'home' },
      }),
    );
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Your plan for lunch');
    expect(screen.queryByLabelText('Having it')).toBeNull();
    expect(screen.getByText(/no longer fits/)).toBeTruthy();
  });
});

describe('weekly check-in (motivational-interviewing style)', () => {
  const seed = async () => {
    const day = 86400000;
    await AsyncStorage.setItem(
      'eatos.state.v1',
      JSON.stringify({
        version: 1,
        profile: { goal: 'eat_better', struggles: ['no_time'], cuisines: [], allergens: [], diets: [], budget: 2, considerations: [], createdAt: new Date(Date.now() - 8 * day).toISOString() },
        history: [1, 2, 3].map((d) => ({ mealId: 'burrito-bowl', kind: 'accepted', at: new Date(Date.now() - d * day).toISOString() })),
        lastContext: null,
        analytics: [],
      }),
    );
  };

  it('asks two questions and only changes focus with consent', async () => {
    await seed();
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('What made eating the way you want easier this week?');
    fireEvent.press(screen.getByLabelText('Planning ahead'));
    await screen.findByText('What got in the way the most?');
    fireEvent.press(screen.getByLabelText('Tight budget'));
    await screen.findByText(/Want EatOS to help more with “tight budget”/);
    fireEvent.press(screen.getByLabelText('Yes, help with that'));
    await screen.findByText(/See you next week/);
    const s = JSON.parse((await AsyncStorage.getItem('eatos.state.v1'))!);
    expect(s.profile.struggles).toEqual(['no_time', 'budget']);
    expect(s.checkin.lastAt).toBeTruthy();
  });

  it('"No thanks" leaves preferences untouched', async () => {
    await seed();
    renderRouter(routes, { initialUrl: '/' });
    fireEvent.press(await screen.findByLabelText('Quick ideas'));
    fireEvent.press(await screen.findByLabelText('Tight budget'));
    fireEvent.press(await screen.findByLabelText('No thanks'));
    await screen.findByText(/See you next week/);
    expect(JSON.parse((await AsyncStorage.getItem('eatos.state.v1'))!).profile.struggles).toEqual(['no_time']);
  });

  it('"Not now" hides it', async () => {
    await seed();
    renderRouter(routes, { initialUrl: '/' });
    fireEvent.press(await screen.findByLabelText('Not now, ask me later'));
    await waitFor(() => expect(screen.queryByText('What made eating the way you want easier this week?')).toBeNull());
  });
});


describe('new screens', () => {
  const seed = async (over: object = {}) =>
    AsyncStorage.setItem(
      'eatos.state.v1',
      JSON.stringify({
        version: 1,
        profile: { goal: 'eat_better', struggles: [], cuisines: [], allergens: ['peanut'], diets: ['vegetarian'], budget: 2, considerations: [], createdAt: new Date().toISOString() },
        history: [],
        lastContext: { setting: 'restaurant', hunger: 'normal', time: 20, budget: 2, feeling: 'fine' },
        analytics: [],
        ...over,
      }),
    );

  it('Search lists only ideas that are safe for this user, and opens details', async () => {
    await seed();
    renderRouter(routes, { initialUrl: '/search' });
    await screen.findByText('Explore');
    for (const m of CATALOG) {
      const unsafe = m.contains.includes('peanut') || m.mayContain.includes('peanut') || m.diet.hasMeat || m.diet.hasFish;
      if (unsafe) expect(screen.queryByLabelText(`${m.name}. Open details.`)).toBeNull();
    }
    fireEvent.changeText(screen.getByLabelText('Search meal ideas'), 'falafel');
    fireEvent.press(await screen.findByLabelText('Falafel bowl. Open details.'));
    await screen.findByText('How to get it');
    expect(screen.getAllByText(/peanut allergy and confirm/).length).toBeGreaterThan(0);
  });

  it('meal links: hostile ids never reach the screen; unknown ids are handled', async () => {
    await seed();
    renderRouter(routes, { initialUrl: '/meal/%3Cscript%3E' });
    await screen.findByText('What should I eat?'); // blocked by the link guard → Home
    screen.unmount();
    renderRouter(routes, { initialUrl: '/meal/not-a-real-meal' });
    await screen.findByText('Meal not found');
  });

  it('meal detail refuses to offer an unsafe meal even if linked directly', async () => {
    await seed();
    renderRouter(routes, { initialUrl: '/meal/apple-peanut-butter' });
    await screen.findByText(/doesn’t fit your allergies or diet/);
    expect(screen.queryByLabelText('Try this')).toBeNull();
  });

  it('EatOS+ waitlist records interest and never charges', async () => {
    await seed();
    renderRouter(routes, { initialUrl: '/premium' });
    fireEvent.press(await screen.findByLabelText('Join the EatOS+ waitlist'));
    await screen.findByText(/No payment was taken/);
    const s = JSON.parse((await AsyncStorage.getItem('eatos.state.v1'))!);
    expect(s.premiumInterest).toBe(true);
    expect(s.analytics.some((e: { name: string }) => e.name === 'premium_interest')).toBe(true);
  });

  it('Favorites shows saved meals and flags ones that no longer fit', async () => {
    await seed({
      history: [
        { mealId: 'falafel-bowl', kind: 'saved', at: new Date().toISOString() },
        { mealId: 'pb-banana-toast', kind: 'saved', at: new Date().toISOString() },
      ],
    });
    renderRouter(routes, { initialUrl: '/favorites' });
    await screen.findByText('Saved');
    expect(screen.getByLabelText('Falafel bowl. Open details.')).toBeTruthy();
    expect(screen.getByLabelText('Peanut butter banana toast, no longer fits your restrictions. Open details.')).toBeTruthy();
  });

  it('Progress shows decisions and mood without any streak', async () => {
    const at = new Date().toISOString();
    await seed({
      history: [
        { mealId: 'falafel-bowl', kind: 'accepted', at, feeling: 'tired' },
        { mealId: 'falafel-bowl', kind: 'accepted', at, feeling: 'energized' },
      ],
    });
    renderRouter(routes, { initialUrl: '/history' });
    await screen.findByText('Your Progress');
    expect(screen.getByLabelText('2 Good decisions')).toBeTruthy();
    expect(screen.queryByText(/streak/i)).toBeNull();
    expect(screen.getByText('2 times')).toBeTruthy();
  });

  it('App Lock: shows the lock screen on a cold start and unlocks with Face ID', async () => {
    const LocalAuthentication = jest.requireMock('expo-local-authentication');
    LocalAuthentication.authenticateAsync.mockResolvedValueOnce({ success: false });
    await seed({ appLock: true });
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('EatOS is locked');
    fireEvent.press(screen.getByLabelText('Unlock'));
    await waitFor(() => expect(screen.queryByText('EatOS is locked')).toBeNull());
  });

  it('App Lock can only be turned on after proving you can unlock', async () => {
    const LocalAuthentication = jest.requireMock('expo-local-authentication');
    await seed();
    renderRouter(routes, { initialUrl: '/profile' });
    LocalAuthentication.authenticateAsync.mockResolvedValueOnce({ success: false });
    fireEvent.press(await screen.findByLabelText('App Lock (Face ID / fingerprint)'));
    await waitFor(() => expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled());
    expect(JSON.parse((await AsyncStorage.getItem('eatos.state.v1'))!).appLock).toBe(false);
    fireEvent.press(screen.getByLabelText('App Lock (Face ID / fingerprint)'));
    await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem('eatos.state.v1'))!).appLock).toBe(true));
    expect(screen.queryByText('EatOS is locked')).toBeNull(); // turning it on doesn't lock you out mid-session
  });
});

describe('couples', () => {
  it('add a partner, eat together safely, and decide together', async () => {
    await onboard();
    openProfile();
    fireEvent.press(await screen.findByLabelText('Add someone you eat with'));
    fireEvent.changeText(screen.getByLabelText('Their name or nickname'), 'Sam');
    fireEvent.press(screen.getAllByLabelText('Peanut allergy').at(-1)!);
    fireEvent.press(screen.getByLabelText('Save person'));
    await screen.findByLabelText('Edit Sam');

    fireEvent.press(screen.getAllByLabelText('Home')[0]);
    fireEvent.press(await screen.findByLabelText('+ Sam'));
    fireEvent.press(screen.getByLabelText('Get my recommendation'));
    await screen.findByText(/For you and Sam/);
    for (const m of CATALOG.filter((x) => x.contains.includes('peanut'))) expect(screen.queryByText(m.name)).toBeNull();

    fireEvent.press(screen.getByLabelText('Decide together'));
    await screen.findByText('Decide together');
    const first = screen.getAllByLabelText(/^You would eat /)[0];
    const meal = (first.props.accessibilityLabel as string).replace('You would eat ', '');
    fireEvent.press(first);
    fireEvent.press(screen.getByLabelText('Done — pass to Sam'));
    fireEvent.press(screen.getByLabelText(`Sam would eat ${meal}`));
    fireEvent.press(screen.getByLabelText('See the result'));
    await screen.findByText(/It’s a match/);
    fireEvent.press(screen.getByLabelText(`Let’s have ${meal.toLowerCase()}`));
    await screen.findByText(/^Enjoy your/);
  });

  it('no shared pick → offers new options or lets EatOS choose', async () => {
    await AsyncStorage.setItem(
      'eatos.state.v1',
      JSON.stringify({
        version: 1,
        profile: { goal: 'eat_better', struggles: [], cuisines: [], allergens: [], diets: [], budget: 2, considerations: [], createdAt: new Date().toISOString() },
        history: [],
        lastContext: { setting: 'takeout', hunger: 'normal', time: 20, budget: 2, feeling: 'fine' },
        analytics: [],
        members: [{ id: 'm-sam', name: 'Sam', allergens: [], diets: [], cuisines: [] }],
        eatingWith: ['m-sam'],
      }),
    );
    renderRouter(routes, { initialUrl: '/decide' });
    fireEvent.press(await screen.findByLabelText('Decide together'));
    fireEvent.press(screen.getByLabelText('Done — pass to Sam'));
    fireEvent.press(screen.getByLabelText('See the result'));
    await screen.findByText(/No match this round/);
    fireEvent.press(screen.getByLabelText('Just pick for us'));
    await screen.findByText(/^Enjoy your/);
  });
});

describe('memory & privacy dashboard', () => {
  const seed = (over: object = {}) =>
    AsyncStorage.setItem(
      'eatos.state.v1',
      JSON.stringify({
        version: 1,
        profile: { goal: 'eat_better', struggles: [], cuisines: [], allergens: [], diets: [], budget: 3, considerations: [], createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
        history: [],
        lastContext: { setting: 'restaurant', hunger: 'normal', time: 20, budget: 3, feeling: 'fine' },
        analytics: [],
        ...over,
      }),
    );

  it('a question answered on Home becomes a visible, deletable memory', async () => {
    await seed();
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText(/faster meals, or cheaper ones/);
    fireEvent.press(screen.getByLabelText('Faster'));
    await waitFor(() => expect(screen.queryByText(/faster meals, or cheaper ones/)).toBeNull());
    screen.unmount();
    renderRouter(routes, { initialUrl: '/knows' });
    await screen.findByText('What EatOS knows about me');
    expect(screen.getByText('This week, prefers: faster')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Delete: This week, prefers faster'));
    await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem('eatos.state.v1'))!).memories).toEqual([]));
  });

  it('a food marked "don’t like" never appears on the recommendation screen', async () => {
    await seed();
    renderRouter(routes, { initialUrl: '/knows' });
    fireEvent.press(await screen.findByLabelText('Mushrooms'));
    fireEvent.press(screen.getByLabelText('Rice'));
    screen.unmount();
    renderRouter(routes, { initialUrl: '/decide' });
    await screen.findByText('Your Recommendation');
    for (const m of CATALOG.filter((x) => /rice|mushroom/.test(JSON.stringify(MEAL_INGREDIENTS[x.id])))) {
      expect(screen.queryByText(m.name)).toBeNull();
    }
  });

  it('guesses are shown as unconfirmed and only stored when the user decides', async () => {
    const at = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
    await seed({ history: Array.from({ length: 8 }, (_, i) => ({ mealId: 'burrito-bowl', kind: 'loved', at: at(i) })) });
    renderRouter(routes, { initialUrl: '/knows' });
    await screen.findByText('You often go for Mexican food');
    expect(JSON.parse((await AsyncStorage.getItem('eatos.state.v1'))!).memories ?? []).toEqual([]);
    fireEvent.press(screen.getAllByLabelText('Not true')[0]);
    await waitFor(() => expect(screen.queryByText('You often go for Mexican food')).toBeNull());
  });

  it('export shares everything EatOS stores about the user', async () => {
    await seed();
    const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    renderRouter(routes, { initialUrl: '/knows' });
    fireEvent.press(await screen.findByLabelText('Export my data'));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const data = JSON.parse((spy.mock.calls[0][0] as { message: string }).message);
    expect(Object.keys(data)).toEqual(expect.arrayContaining(['profile', 'memories', 'history', 'peopleYouEatWith', 'settings']));
    spy.mockRestore();
  });
});

describe('history people can see', () => {
  const seed = (over: object = {}) =>
    AsyncStorage.setItem(
      'eatos.state.v1',
      JSON.stringify({
        version: 1,
        profile: { goal: 'eat_better', struggles: [], cuisines: [], allergens: [], diets: [], budget: 3, considerations: [], createdAt: new Date().toISOString() },
        history: [],
        lastContext: { setting: 'takeout', hunger: 'normal', time: 20, budget: 3, feeling: 'fine' },
        analytics: [],
        members: [{ id: 'm-sam', name: 'Sam', allergens: [], diets: [], cuisines: [] }],
        ...over,
      }),
    );

  it('a meal eaten together shows "with Sam" on Home and in History', async () => {
    await seed({ eatingWith: ['m-sam'] });
    renderRouter(routes, { initialUrl: '/decide' });
    fireEvent.press(await screen.findByLabelText('Try this'));
    await screen.findByText(/^Enjoy your/);
    screen.unmount();
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Your last meals');
    expect(screen.getAllByText(/with Sam/).length).toBeGreaterThan(0);
    screen.unmount();
    renderRouter(routes, { initialUrl: '/history' });
    await screen.findByText('Your meals');
    expect(screen.getAllByText(/with Sam/).length).toBeGreaterThan(0);
  });

  it('logging something EatOS didn’t suggest shows up in last meals, and can be deleted', async () => {
    await seed();
    renderRouter(routes, { initialUrl: '/' });
    fireEvent.press(await screen.findByLabelText('I ate something else'));
    fireEvent.press(await screen.findByLabelText('Something not listed'));
    await screen.findByText('Logged.');
    screen.unmount();
    renderRouter(routes, { initialUrl: '/history' });
    await screen.findByText('Something not listed');
    expect(screen.getByText(/logged by you/)).toBeTruthy();
    fireEvent.press(screen.getAllByLabelText(/^Delete meal from/)[0]);
    await waitFor(() => expect(screen.queryByText('Something not listed')).toBeNull());
  });

  it('a partner’s disliked food is avoided when eating together', async () => {
    await seed({
      eatingWith: ['m-sam'],
      memories: [{ id: 'mem-1', subject: 'm-sam', topic: 'dislike_food', value: 'rice', kind: 'stated', source: 'manual', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    });
    renderRouter(routes, { initialUrl: '/decide' });
    await screen.findByText('Your Recommendation');
    for (const m of CATALOG.filter((x) => MEAL_INGREDIENTS[x.id].includes('rice'))) expect(screen.queryByText(m.name)).toBeNull();
  });
});

describe('retention without pressure', () => {
  const KEY = 'eatos.state.v1';
  const stored = async () => JSON.parse((await AsyncStorage.getItem(KEY))!);
  afterEach(() => clock.set(null));

  it('after the first meal, the 4 taste questions are offered; answering never touches allergies', async () => {
    await onboard({ allergy: 'Peanut allergy' });
    expect(screen.queryByText(/Answer 4 quick questions/)).toBeNull(); // not before EatOS has helped
    fireEvent.press(screen.getByLabelText('Get my recommendation'));
    fireEvent.press(await screen.findByLabelText('Try this'));
    await screen.findByText(/^Enjoy your/);
    clock.set(new Date(Date.now() + 1000)); // past the double-tap guard
    fireEvent.press(screen.getByLabelText('Done'));
    await screen.findByText(/Answer 4 quick questions/);
    fireEvent.press(screen.getByLabelText('Let’s do it'));
    await screen.findByText('What’s your main goal?');
    fireEvent.press(screen.getByLabelText('Build muscle'));
    fireEvent.press(screen.getByLabelText('Next'));
    fireEvent.press(screen.getByLabelText('Mexican'));
    fireEvent.press(screen.getByLabelText('Next'));
    fireEvent.press(screen.getByLabelText('$10 – $15'));
    fireEvent.press(screen.getByLabelText('Next'));
    fireEvent.press(screen.getByLabelText('No time'));
    fireEvent.press(screen.getByLabelText('Finish'));
    await screen.findByText('You’re all set!');
    const s = await stored();
    expect(s.profile).toMatchObject({ goal: 'build_muscle', cuisines: ['mexican'], budget: 2, struggles: ['no_time'], allergens: ['peanut'] });
    expect(s.setup.done).toBe(true);
    fireEvent.press(screen.getByLabelText('Go to Home'));
    await screen.findByText('What should I eat?');
    expect(screen.queryByText(/Answer 4 quick questions/)).toBeNull();
  });

  it('"Later" hides the setup card', async () => {
    await onboard();
    fireEvent.press(screen.getByLabelText('Get my recommendation'));
    fireEvent.press(await screen.findByLabelText('Try this'));
    await screen.findByText(/^Enjoy your/);
    clock.set(new Date(Date.now() + 1000));
    fireEvent.press(screen.getByLabelText('Done'));
    fireEvent.press(await screen.findByLabelText('Ask me later'));
    await waitFor(() => expect(screen.queryByText(/Answer 4 quick questions/)).toBeNull());
  });

  it('the "more" link can’t be used to skip the allergy question', async () => {
    renderRouter(routes, { initialUrl: '/onboarding?more=1' });
    fireEvent.press(await screen.findByLabelText('Get Started'));
    await screen.findByText('Any dietary restrictions?');
  });

  const seed = async (over: object = {}) => {
    const day = 86400000;
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        profile: { goal: 'eat_better', struggles: [], cuisines: [], allergens: [], diets: [], budget: 2, considerations: [], createdAt: new Date(Date.now() - 10 * day).toISOString() },
        history: [4, 5, 6].map((d) => ({ mealId: 'burrito-bowl', kind: 'accepted', at: new Date(Date.now() - d * day).toISOString(), setting: 'home' })),
        lastContext: null,
        analytics: [],
        setup: { done: true, snoozeUntil: null },
        checkin: { lastAt: new Date().toISOString(), snoozeUntil: null },
        ...over,
      }),
    );
  };

  it('a forgiving weekly goal can be picked on Home and shows progress', async () => {
    await seed();
    renderRouter(routes, { initialUrl: '/' });
    fireEvent.press(await screen.findByLabelText('Goal: Eat at home more, 3 meals at home a week'));
    await screen.findByLabelText(/Eat at home more: (done for this week|\d of 3 meals at home this week)/);
    expect((await stored()).weeklyGoal).toEqual({ kind: 'cook_home', target: 3 });
  });

  it('after 10+ days away: a welcome back, no guilt', async () => {
    await seed({ lastOpenAt: new Date(Date.now() - 12 * 86400000).toISOString(), weeklyGoalAsked: true });
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Welcome back!');
    expect(screen.queryByText(/missed|streak|lost/i)).toBeNull();
    fireEvent.press(screen.getByLabelText('Pick something for me'));
    await screen.findByText('Your Recommendation');
  });

  it('a normal return shows no welcome back', async () => {
    await seed({ lastOpenAt: new Date(Date.now() - 2 * 86400000).toISOString(), weeklyGoalAsked: true });
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('What should I eat?');
    expect(screen.queryByText('Welcome back!')).toBeNull();
  });

  it('asks for a store rating only after good experiences', async () => {
    const review = jest.spyOn(reviewModule, 'askForReview').mockResolvedValue(true);
    const day = 86400000;
    const history = [
      ...[4, 5, 6].map((d) => ({ mealId: 'burrito-bowl', kind: 'accepted', at: new Date(Date.now() - d * day).toISOString() })),
      { mealId: 'burrito-bowl', kind: 'loved', at: new Date(Date.now() - 4 * day).toISOString() },
    ];
    await seed({ weeklyGoalAsked: true, history });
    renderRouter(routes, { initialUrl: '/decide' });
    fireEvent.press(await screen.findByLabelText('Try this'));
    await screen.findByText(/^Enjoy your/);
    jest.advanceTimersByTime(2000);
    await waitFor(() => expect(review).toHaveBeenCalledTimes(1));
    await waitFor(async () => expect((await stored()).reviewPrompts).toHaveLength(1));
    review.mockRestore();
  });

  it('never asks for a rating without a "loved" meal', async () => {
    const review = jest.spyOn(reviewModule, 'askForReview').mockResolvedValue(true);
    await seed({ weeklyGoalAsked: true });
    renderRouter(routes, { initialUrl: '/decide' });
    fireEvent.press(await screen.findByLabelText('Try this'));
    await screen.findByText(/^Enjoy your/);
    jest.advanceTimersByTime(2000);
    expect(review).not.toHaveBeenCalled();
    review.mockRestore();
  });

  it('shows how much EatOS has learned, linking to what it knows', async () => {
    const at = new Date().toISOString();
    const mem = (id: string, value: string) => ({ id, subject: 'me', topic: 'dislike_food', value, kind: 'stated', source: 'manual', createdAt: at, updatedAt: at });
    await seed({ weeklyGoalAsked: true, memories: [mem('a', 'olives'), mem('b', 'mushrooms'), mem('c', 'tuna')] });
    renderRouter(routes, { initialUrl: '/' });
    fireEvent.press(await screen.findByLabelText(/^EatOS has learned \d+ things about you/));
    await screen.findByText(/olives/i);
  });

  it('no usage-sharing question when no server is configured', async () => {
    await seed({ weeklyGoalAsked: true });
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('What should I eat?');
    expect(screen.queryByText('Share which days you open EatOS?')).toBeNull();
  });
});

describe('food & place library', () => {
  const KEY = 'eatos.state.v1';
  const seed = (over: object = {}) =>
    AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        profile: { goal: 'eat_better', struggles: [], cuisines: [], allergens: ['peanut'], diets: [], budget: 2, considerations: [], createdAt: new Date().toISOString() },
        history: [],
        lastContext: null,
        analytics: [],
        setup: { done: true, snoozeUntil: null },
        ...over,
      }),
    );
  const pb = { id: 1, source: 'usda_fdc' as const, name: 'Peanut butter, creamy', brand: null, allergens: [], allergensKnown: false, mayContain: [], nutrients: { energy_kcal: 589.38, protein_g: 22.5, iron_mg: 1.7 }, verified: true };
  const cakes = { id: 2, source: 'open_food_facts' as const, name: 'Plain Rice Cakes', brand: 'Puffy', allergens: [], allergensKnown: false, mayContain: [], nutrients: {}, verified: false };
  let configured: jest.SpyInstance;
  beforeEach(() => {
    configured = jest.spyOn(libraryClient, 'libraryConfigured').mockReturnValue(true);
  });
  afterEach(() => jest.restoreAllMocks());

  const openSection = async (label: string) => {
    renderRouter(routes, { initialUrl: '/search' });
    fireEvent.press(await screen.findByLabelText(label));
  };

  it('food search warns a peanut-allergic user about peanut butter even though USDA records no allergens', async () => {
    const search = jest.spyOn(libraryClient, 'searchFoods').mockResolvedValue([pb, cakes]);
    await seed();
    await openSection('Foods');
    fireEvent.changeText(screen.getByLabelText('Search foods'), 'peanut');
    jest.advanceTimersByTime(400);
    await screen.findByText('Peanut butter, creamy');
    expect(search).toHaveBeenCalledWith('peanut');
    expect(screen.getByText(/Likely contains peanut \(from its name\)/)).toBeTruthy();
    expect(screen.getByText(/Allergens not recorded/)).toBeTruthy(); // rice cakes: unknown, never "safe"
    expect(screen.queryByText(/safe/i)).toBeNull();
    fireEvent.press(screen.getByLabelText(/^Peanut butter, creamy\. Show details/));
    expect(await screen.findByText('589 kcal')).toBeTruthy();
    expect(screen.getByText('Iron')).toBeTruthy();
  });

  it('hides nutrition numbers for people who asked for no diet talk', async () => {
    jest.spyOn(libraryClient, 'searchFoods').mockResolvedValue([pb]);
    await seed({ profile: { goal: 'eat_better', struggles: [], cuisines: [], allergens: [], diets: [], budget: 2, considerations: ['ed_sensitive'], createdAt: new Date().toISOString() } });
    await openSection('Foods');
    fireEvent.changeText(screen.getByLabelText('Search foods'), 'peanut');
    jest.advanceTimersByTime(400);
    fireEvent.press(await screen.findByLabelText(/^Peanut butter, creamy\. Show details/));
    await screen.findByText(/Nutrition numbers are hidden/);
    expect(screen.queryByText(/kcal/)).toBeNull();
  });

  it('a failed search says so instead of showing nothing', async () => {
    jest.spyOn(libraryClient, 'searchFoods').mockRejectedValue(new Error('offline'));
    await seed();
    await openSection('Foods');
    fireEvent.changeText(screen.getByLabelText('Search foods'), 'oats');
    jest.advanceTimersByTime(400);
    await screen.findByText(/Couldn’t reach the food library/);
  });

  it('nearby: asks for location only on tap, lists places with distance, and remembers my grocery store', async () => {
    const Location = jest.requireMock('expo-location');
    Location.requestForegroundPermissionsAsync.mockClear();
    const near = jest.spyOn(libraryClient, 'placesNear').mockResolvedValue([
      { id: 10, kind: 'grocery', name: "Cosentino's Downtown Market", cuisines: [], lat: 39.1033, lon: -94.5786, street: '13th St' },
      { id: 11, kind: 'restaurant', name: "Joe's Tacos", cuisines: ['mexican'], lat: 39.11, lon: -94.58, street: null },
    ]);
    await seed();
    await openSection('Near me');
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Find places near me'));
    await screen.findByText("Cosentino's Downtown Market");
    expect(near).toHaveBeenCalledWith(39.0997, -94.5786, null);
    expect(screen.getByText(/Restaurant · mexican/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Make Cosentino's Downtown Market my grocery store"));
    await screen.findByText("My grocery store: Cosentino's Downtown Market");
    const stored = JSON.parse((await AsyncStorage.getItem(KEY))!);
    expect(stored.groceryStore).toEqual({ id: 10, name: "Cosentino's Downtown Market" });
    expect(JSON.stringify(stored)).not.toContain('39.0997'); // location is never saved
    fireEvent.press(screen.getByLabelText('Grocery'));
    await waitFor(() => expect(near).toHaveBeenLastCalledWith(39.0997, -94.5786, 'grocery'));
  });

  it('location denied: explains, no crash', async () => {
    const Location = jest.requireMock('expo-location');
    Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ granted: false });
    await seed();
    await openSection('Near me');
    fireEvent.press(screen.getByLabelText('Find places near me'));
    await screen.findByText(/Location is off for EatOS/);
  });

  it('without a server, the library says it isn’t connected and meal ideas still work', async () => {
    configured.mockReturnValue(false);
    await seed();
    await openSection('Foods');
    await screen.findByText(/food library isn’t connected/);
    fireEvent.press(screen.getByLabelText('Meal ideas'));
    await screen.findByLabelText('Search meal ideas');
  });
});
