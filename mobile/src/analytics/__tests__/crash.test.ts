import AsyncStorage from '@react-native-async-storage/async-storage';

import { crashSummaryLines, CRASH_KEY, installCrashHandlers, readCrashes, recordCrash } from '../crash';

beforeEach(() => AsyncStorage.clear());

describe('crash capture', () => {
  it('records errors, capped and truncated', async () => {
    for (let i = 0; i < 60; i++) await recordCrash(new TypeError('x'.repeat(500)), i % 2 === 0);
    const list = await readCrashes();
    expect(list).toHaveLength(50);
    expect(list[0].message.length).toBeLessThanOrEqual(160);
    expect(crashSummaryLines(list)[0]).toMatch(/crashes: 50 \(25 fatal\)/);
  });

  it('survives a corrupt crash log', async () => {
    await AsyncStorage.setItem(CRASH_KEY, '{nope');
    await expect(recordCrash(new Error('a'), true)).resolves.toBeUndefined();
    expect(await readCrashes()).toEqual([]);
  });

  it('global handler records and still calls the previous handler', async () => {
    const previous = jest.fn();
    let handler: ((e: unknown, fatal?: boolean) => void) | undefined;
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = {
      getGlobalHandler: () => previous,
      setGlobalHandler: (h: typeof handler) => (handler = h),
    };
    installCrashHandlers();
    handler!(new RangeError('boom'), true);
    expect(previous).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
    expect((await readCrashes())[0]).toMatchObject({ name: 'RangeError', fatal: true });
  });
});
