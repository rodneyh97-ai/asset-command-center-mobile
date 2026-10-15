import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import RootLayout, { ErrorBoundary } from '../app/_layout';
import Decide from '../app/decide';
import Home from '../app/index';
import Onboarding from '../app/onboarding';
import Settings from '../app/settings';
import { clock } from '../clock';
import { CATALOG } from '../engine';

const routes = { _layout: RootLayout, index: Home, onboarding: Onboarding, decide: Decide, settings: Settings };

let app: ReturnType<typeof renderRouter>;

async function onboard(opts: { allergy?: string } = {}) {
  app = renderRouter(routes, { initialUrl: '/' });
  await screen.findByText('What do you want eating to do for you?');
  fireEvent.press(screen.getByLabelText('Build muscle'));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByLabelText('No time'));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByLabelText('Skip'));
  if (opts.allergy) {
    fireEvent.press(screen.getByLabelText(opts.allergy));
    fireEvent.press(screen.getByLabelText('Continue'));
  } else {
    fireEvent.press(screen.getByLabelText('None — continue'));
  }
  fireEvent.press(screen.getByLabelText('$$ Moderate'));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByLabelText('Show me what to eat'));
  await screen.findByText('What should I eat?');
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('core daily flow', () => {
  it('new user: onboarding → decide → accept in a handful of taps', async () => {
    await onboard();
    expect(app.getPathname()).toBe('/');

    fireEvent.press(screen.getByLabelText('Help me decide'));
    await screen.findByText('Your best option right now');
    expect(app.getPathname()).toBe('/decide');
    expect(screen.getByText('Why this fits')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('I’ll have this'));
    await screen.findByText(/^Enjoy your/);
  });

  it('home returns to its compact form after deciding', async () => {
    await onboard();
    fireEvent.press(screen.getByLabelText(/^Current settings/));
    expect(screen.getByText('How hungry?')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Help me decide'));
    await screen.findByText('Your best option right now');
    fireEvent.press(screen.getByLabelText('Back'));
    await screen.findByText('What should I eat?');
    expect(screen.queryByText('How hungry?')).toBeNull();
  });

  it('persists preferences: a returning user skips onboarding', async () => {
    await onboard();
    const raw = await AsyncStorage.getItem('eatos.state.v1');
    expect(JSON.parse(raw!).profile.goal).toBe('build_muscle');

    screen.unmount();
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('What should I eat?');
    expect(screen.queryByText('What do you want eating to do for you?')).toBeNull();
  });

  it('onboarding cannot continue without a goal', async () => {
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('What do you want eating to do for you?');
    expect(screen.getByLabelText('Continue')).toBeDisabled();
  });

  it('allergy chosen in onboarding is enforced on the recommendation screen', async () => {
    await onboard({ allergy: 'Gluten / wheat' });
    fireEvent.press(screen.getByLabelText('Takeout'));
    fireEvent.press(screen.getByLabelText('Help me decide'));
    await screen.findByText('Your best option right now');
    const glutenMeals = CATALOG.filter((m) => m.contains.includes('gluten') || m.mayContain.includes('gluten'));
    for (const m of glutenMeals) expect(screen.queryByText(m.name)).toBeNull();
    expect(screen.getAllByText(/gluten\/wheat allergy and confirm/).length).toBeGreaterThan(0);
  });

  it('"Something else" shows a different recommendation', async () => {
    await onboard();
    fireEvent.press(screen.getByLabelText('Help me decide'));
    await screen.findByText('Your best option right now');
    const titles = () => CATALOG.map((m) => m.name).filter((n) => screen.queryByRole('header', { name: n }));
    const first = titles();
    fireEvent.press(screen.getByLabelText('Something else'));
    await waitFor(() => expect(titles()).not.toEqual(first));
  });

  const stored = async () => JSON.parse((await AsyncStorage.getItem('eatos.state.v1'))!);

  it('accepted meal appears in "Have again" for one-tap repeat, with undo', async () => {
    await onboard();
    fireEvent.press(screen.getByLabelText('Help me decide'));
    await screen.findByText('Your best option right now');
    fireEvent.press(screen.getByLabelText('I’ll have this'));
    const done = await screen.findByLabelText('Done');
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000); // a deliberate tap, not a double tap
    fireEvent.press(done);
    await screen.findByText('Have again');
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
    fireEvent.press(screen.getByLabelText('Preferences'));
    fireEvent.press(await screen.findByLabelText('Delete all my data'));
    await screen.findByText('What do you want eating to do for you?');
    expect(await AsyncStorage.getItem('eatos.state.v1')).not.toContain('build_muscle');
    spy.mockRestore();
    g.confirm = original;
  });
});

describe('ATTACK: UI-level abuse', () => {
  const KEY = 'eatos.state.v1';
  const stored = async () => JSON.parse((await AsyncStorage.getItem(KEY))!);

  it.each(['/decide', '/settings'])('deep link to %s with no profile lands on onboarding, not a blank screen', async (url) => {
    renderRouter(routes, { initialUrl: url });
    await screen.findByText('What do you want eating to do for you?');
  });

  it('deep link to /onboarding cannot overwrite an existing profile', async () => {
    await onboard({ allergy: 'Peanuts' });
    screen.unmount();
    renderRouter(routes, { initialUrl: '/onboarding' });
    await screen.findByText('What should I eat?');
    expect((await stored()).profile.allergens).toEqual(['peanut']);
  });

  it('double-tapping "I’ll have this" records one decision', async () => {
    await onboard();
    fireEvent.press(screen.getByLabelText('Help me decide'));
    await screen.findByText('Your best option right now');
    const btn = screen.getByLabelText('I’ll have this');
    fireEvent.press(btn);
    fireEvent.press(btn);
    await screen.findByText(/^Enjoy your/);
    await waitFor(async () => {
      expect((await stored()).history.filter((e: { kind: string }) => e.kind === 'accepted')).toHaveLength(1);
    });
  });

  it('a storage read failure never overwrites the saved profile', async () => {
    await onboard({ allergy: 'Peanuts' });
    screen.unmount();
    const before = await AsyncStorage.getItem(KEY);
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk busy'));
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('What do you want eating to do for you?'); // runs without data this session
    fireEvent.press(screen.getByLabelText('Lose weight'));
    expect(await AsyncStorage.getItem(KEY)).toBe(before);
  });

  it('garbage in storage still opens the app and backs the garbage up', async () => {
    await AsyncStorage.setItem(KEY, '{"version":1,"profile":"💥"');
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('What do you want eating to do for you?');
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
    fireEvent.press(screen.getByLabelText('Help me decide'));
    await screen.findByText('Your best option right now');
    fireEvent.press(screen.getByLabelText(/^Not for me/));
    fireEvent.press(screen.getByLabelText('Back'));
    fireEvent.press(await screen.findByLabelText('Preferences'));
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
    await waitFor(() => expect(screen.queryByText(/easier this week/)).toBeNull());
  });
});

