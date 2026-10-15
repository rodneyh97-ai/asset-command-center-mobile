// Incoming deep links (eatos://...) are untrusted input: anyone can send one.
// EatOS takes no parameters from links, so only exact known screens are allowed
// and everything else (query strings, unknown paths, oversized input) goes home.

export const ALLOWED_PATHS = ['/', '/decide', '/onboarding', '/history', '/favorites', '/search', '/profile', '/premium'] as const;
const MAX_LENGTH = 256;

const MEAL_PATH = /^\/meal\/[a-z0-9-]{1,60}$/;

export function sanitizeIncomingPath(raw: string): string {
  try {
    if (typeof raw !== 'string' || raw.length > MAX_LENGTH) return '/';
    let rest = raw;
    const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(rest);
    if (scheme) {
      rest = rest.slice(scheme[0].length);
      const s = scheme[1].toLowerCase();
      // Web and Expo dev links carry a host; app links ("eatos://decide") use the host slot as the screen.
      if (s === 'http' || s === 'https' || s === 'exp' || s === 'exps') rest = rest.replace(/^[^/]*/, '');
    } else if (/^[a-z][a-z0-9+.-]*:/i.test(rest)) {
      return '/'; // javascript:, data:, etc.
    }
    let path = `/${rest.split(/[?#]/)[0]}`
      .replace(/\/{2,}/g, '/') // eatos:///history → /history
      .replace(/^\/--(?=\/|$)/, ''); // Expo dev URLs: /--/history → /history
    if (!path.startsWith('/')) path = `/${path}`;
    if (path.length > 1) path = path.replace(/\/+$/, '');
    if (path === '' ) path = '/';
    if (path === '/settings') return '/profile'; // links from older versions
    if (MEAL_PATH.test(path)) return path;
    return (ALLOWED_PATHS as readonly string[]).includes(path) ? path : '/';
  } catch {
    return '/';
  }
}
