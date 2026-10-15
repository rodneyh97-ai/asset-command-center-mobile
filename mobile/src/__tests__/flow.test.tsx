import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import RootLayout from '../app/_layout';
import Decide from '../app/decide';
import Home from '../app/index';
import Onboarding from '../app/onboarding';
import Settings from '../app/settings';
import { CATALOG } from '../engine';

const routes = { _layout: RootLayout, index: Home, onboarding: Onboarding, decide: Decide, settings: Settings };

async function onboard(opts: { allergy?: string } = {}) {
  renderRouter(routes, { initialUrl: '/' });
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
    expect(screen).toHavePathname('/');

    fireEvent.press(screen.getByLabelText('Help me decide'));
    await screen.findByText('Your best option right now');
    expect(screen).toHavePathname('/decide');
    expect(screen.getByText('Why this fits')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('I’ll have this'));
    await screen.findByText(/^Enjoy your/);
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

  it('accepted meal appears in "Have again" for one-tap repeat', async () => {
    await onboard();
    fireEvent.press(screen.getByLabelText('Help me decide'));
    await screen.findByText('Your best option right now');
    fireEvent.press(screen.getByLabelText('I’ll have this'));
    fireEvent.press(await screen.findByLabelText('Done'));
    await screen.findByText('Have again');
  });

  it('delete all data returns to onboarding', async () => {
    await onboard();
    const g = globalThis as unknown as { confirm?: (m: string) => boolean };
    const original = g.confirm;
    g.confirm = () => true;
    const { Alert } = require('react-native');
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
