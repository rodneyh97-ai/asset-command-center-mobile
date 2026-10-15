/* eslint-disable @typescript-eslint/no-require-imports -- each test needs a fresh module copy to check DSN on/off behaviour */
describe('Sentry crash reporting', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    jest.resetModules();
  });

  it('is completely off when no DSN is configured', () => {
    jest.isolateModules(() => {
      const Sentry = require('@sentry/react-native');
      const { startCrashReporting, reportError, sentryConfigured } = require('../sentry');
      startCrashReporting(true);
      reportError(new Error('x'));
      expect(sentryConfigured).toBe(false);
      expect(Sentry.init).not.toHaveBeenCalled();
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });

  it('starts privacy-safe when configured, and honours the off switch', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://public@example.invalid/1';
    jest.isolateModules(() => {
      const Sentry = require('@sentry/react-native');
      const { startCrashReporting } = require('../sentry');
      startCrashReporting(true);
      const opts = Sentry.init.mock.calls[0][0];
      expect(opts).toMatchObject({ sendDefaultPii: false, maxBreadcrumbs: 0, tracesSampleRate: 0, attachScreenshot: false });
      startCrashReporting(false);
      expect(Sentry.getClient().getOptions().enabled).toBe(false);
      expect(Sentry.init).toHaveBeenCalledTimes(1);
    });
  });

  it('scrubs identity, breadcrumbs, and device name from every event', () => {
    const { scrubEvent } = require('../sentry');
    const out = scrubEvent({
      user: { id: '1', email: 'a@b.c' },
      request: { url: 'x' },
      extra: { allergies: ['peanut'] },
      breadcrumbs: [{ message: 'tapped Peanuts' }],
      contexts: { device: { name: "Sam's iPhone", model: 'iPhone15,2' }, os: { name: 'iOS', version: '19' } },
    });
    expect(out.user).toBeUndefined();
    expect(out.request).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(out.breadcrumbs).toEqual([]);
    expect(out.contexts.device).toEqual({ model: 'iPhone15,2' });
    expect(out.contexts.os).toEqual({ name: 'iOS', version: '19' });
  });
});
