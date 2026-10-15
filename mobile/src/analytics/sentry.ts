// Crash reporting via the open-source Sentry SDK. Works with Sentry's cloud OR a server
// you own (self-hosted Sentry / GlitchTip) — just point EXPO_PUBLIC_SENTRY_DSN at it.
// No DSN configured = completely off. A DSN is a public identifier, not a secret.
import * as Sentry from '@sentry/react-native';
import type { ErrorEvent } from '@sentry/core';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
export const sentryConfigured = !!DSN;
let started = false;

/** Strip anything that could identify a person or reveal what they eat. */
export function scrubEvent<T extends Pick<ErrorEvent, 'user' | 'request' | 'breadcrumbs' | 'extra' | 'contexts' | 'tags'>>(event: T): T {
  delete event.user;
  delete event.request;
  delete event.extra;
  event.breadcrumbs = [];
  if (event.contexts) {
    // Keep OS/app versions (needed to fix bugs); drop the device's user-assigned name.
    const device = event.contexts.device as Record<string, unknown> | undefined;
    if (device) delete device.name;
    delete event.contexts.profile;
    delete event.contexts.state;
  }
  return event;
}

export function startCrashReporting(enabled: boolean): void {
  if (!DSN) return;
  if (!started) {
    Sentry.init({
      dsn: DSN,
      enabled,
      sendDefaultPii: false,
      maxBreadcrumbs: 0,
      tracesSampleRate: 0,
      attachScreenshot: false,
      attachViewHierarchy: false,
      beforeSend: (event) => scrubEvent(event),
    });
    started = true;
    return;
  }
  const options = Sentry.getClient()?.getOptions();
  if (options) options.enabled = enabled;
}

export function reportError(error: unknown): void {
  if (DSN && started) Sentry.captureException(error);
}
