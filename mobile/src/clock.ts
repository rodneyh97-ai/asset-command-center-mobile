// Single source of "now" for app code, so tests can time-travel without faking
// the timers that animations and navigation depend on.
let offsetMs = 0;

export const clock = {
  now: (): Date => new Date(Date.now() + offsetMs),
  /** Tests only: pretend the current time is `at`. */
  set(at: Date | null) {
    offsetMs = at ? at.getTime() - Date.now() : 0;
  },
};
