// 1,000 simulated people using the real screens with random choices and random taps.
// After every tap: no crash screen, and every meal on a recommendation screen is safe
// for the user's CURRENT allergies/diet. Run with: DEEP=1 npx jest src/__tests__/deep/journeys
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appendFileSync } from 'fs';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert, Share } from 'react-native';

import { CATALOG, safetyCheck, type Profile, type Setting } from '../../engine';

const run = process.env.DEEP ? describe : describe.skip;
const JOURNEYS = Number(process.env.JOURNEYS ?? 1000);
const STEPS = 30;
const SKIP = new Set(['Share my usage summary']);

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

// expo-router's test renderer runs on fake timers, so settle work by advancing them.
const flush = async () => {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await Promise.resolve();
    });
    try {
      act(() => {
        jest.runOnlyPendingTimers();
      });
    } catch {
      /* real timers: nothing to advance */
    }
  }
};

async function stored() {
  const raw = await AsyncStorage.getItem('eatos.state.v1');
  return raw ? JSON.parse(raw) : null;
}

run('1,000 random user journeys through the real app', () => {
  jest.setTimeout(60 * 60 * 1000);
  const findings: string[] = [];
  let taps = 0;

  beforeAll(() => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const b = (buttons ?? []).find((x) => x.style === 'destructive') ?? (buttons ?? [])[0];
      b?.onPress?.();
    });
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'dismissedAction' } as never);
    (globalThis as { confirm?: () => boolean }).confirm = () => true;
  });

  it('every journey stays crash-free and safe', async () => {
    for (let j = 0; j < JOURNEYS; j++) {
      const r = rng(1000 + j);
      await AsyncStorage.clear();
      const T = (m: string) => process.env.TRACE && appendFileSync('/tmp/claude-0/-home-user-asset-command-center-mobile/6c3bb8c0-a719-568d-be17-868188014731/scratchpad/trace.log', m + '\n');
      T(`j${j} render`);
      renderRouter('src/app', { initialUrl: '/' });
      T(`j${j} rendered`);
      await flush();
      T(`j${j} flushed`);
      for (let step = 0; step < STEPS; step++) {
        T(`j${j} s${step} query`);
        const buttons = [...screen.queryAllByRole('button'), ...screen.queryAllByRole('switch'), ...screen.queryAllByRole('radio')].filter((b) => {
          const label = b.props.accessibilityLabel as string | undefined;
          return !b.props.accessibilityState?.disabled && !SKIP.has(label ?? '');
        });
        const input = screen.queryByLabelText('Search meal ideas');
        if (input && r() < 0.15) {
          fireEvent.changeText(input, ['bowl', '<script>', '%%%', 'taco', '🍔', 'x'.repeat(200)][Math.floor(r() * 6)]);
        } else if (buttons.length > 0) {
          const b = buttons[Math.floor(r() * buttons.length)];
          fireEvent.press(b);
          taps++;
        }
        T(`j${j} s${step} pressed`);
        await flush();
        T(`j${j} s${step} flushed`);

        if (screen.queryByText('Something went wrong')) findings.push(`journey ${j} step ${step}: crash screen`);
        const s = await stored();
        const profile: Profile | null = s?.profile ?? null;
        const onRecommendation = screen.queryByText('Your Recommendation') || screen.queryByText('Other Options') || screen.queryByText(/^Planning your/);
        if (profile && onRecommendation) {
          const setting: Setting = s.lastContext?.setting ?? 'home';
          for (const m of CATALOG) {
            if (screen.queryAllByText(m.name).length === 0) continue;
            if (!safetyCheck(m, profile, setting).ok) findings.push(`journey ${j} step ${step}: UNSAFE ${m.id} shown for ${profile.allergens}/${profile.diets} at ${setting}`);
          }
        }
      }
      screen.unmount();
      if (findings.length > 20) break;
    }
    console.log(`journeys: ${JOURNEYS}, taps: ${taps}, findings: ${findings.length}\n${findings.slice(0, 20).join('\n')}`);
    expect(findings).toEqual([]);
  });
});
