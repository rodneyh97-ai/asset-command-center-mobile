// Incoming deep links (eatos://...) are untrusted input: anyone can send one.
// EatOS takes no parameters from links, so only exact known screens are allowed
// and everything else (query strings, unknown paths, oversized input) goes home.

export const ALLOWED_PATHS = ['/', '/decide', '/settings', '/onboarding'] as const;
const MAX_LENGTH = 256;

export function sanitizeIncomingPath(raw: string): string {
  try {
    if (typeof raw !== 'string' || raw.length > MAX_LENGTH) return '/';
    // Web links: drop scheme + host. App links ("eatos://decide"): the "host" is the screen.
    const noOrigin = /^https?:\/\//i.test(raw)
      ? raw.replace(/^https?:\/\/[^/]*/i, '')
      : raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '/');
    let path = noOrigin.split(/[?#]/)[0] || '/';
    if (!path.startsWith('/')) path = `/${path}`;
    if (path.length > 1) path = path.replace(/\/+$/, '');
    return (ALLOWED_PATHS as readonly string[]).includes(path) ? path : '/';
  } catch {
    return '/';
  }
}
