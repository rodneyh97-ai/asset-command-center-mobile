// =============================================================================
// RealityCheck AI — Cloudflare Worker
// Endpoints: feedback proxy, analytics, user suggestions, admin API
// Self-learning: weekly AI analysis cron that surfaces insights to the owner
// =============================================================================

export interface Env {
  RATE_LIMIT_KV: KVNamespace; // single namespace — rate limits + analytics + suggestions
  ANTHROPIC_API_KEY: string;
  APP_SECRET: string;         // shared with app binary (deters casual abuse)
  ADMIN_SECRET: string;       // owner-only, never in app binary
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface DailyStats {
  total: number;
  shares: number;
  modes: Record<string, number>;
  grades: Record<string, number>;
}

interface Suggestion {
  id: string;
  deviceIdHash: string; // SHA-256 prefix — no raw device IDs stored
  title: string;
  description: string;
  exampleInput: string;
  votes: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  adminNote: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const FREE_DAILY_LIMIT = 5;
const MAX_BODY_BYTES = 24_000;
const MAX_INPUT_CHARS = 4_200;
const MAX_SUGGESTIONS_PER_DAY = 3;
const MAX_STORED_SUGGESTIONS = 500;
const STATS_TTL = 60 * 60 * 24 * 90;   // 90 days
const INSIGHT_TTL = 60 * 60 * 24 * 90;
const SUGGESTION_TTL = 60 * 60 * 24 * 365;
const RL_TTL = 90_000; // ~25 h, covers UTC day rollover

// ── Response helpers ──────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function err(code: string, status: number): Response {
  return json({ error: code }, status);
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function isApp(req: Request, env: Env): boolean {
  return req.headers.get('X-App-Secret') === env.APP_SECRET;
}
function isAdmin(req: Request, env: Env): boolean {
  return req.headers.get('X-Admin-Key') === env.ADMIN_SECRET;
}

// ── Validation ────────────────────────────────────────────────────────────────

function isValidDeviceId(id: string): boolean {
  return typeof id === 'string' && id.length >= 8 && id.length <= 128 &&
    /^[a-zA-Z0-9_-]+$/.test(id);
}

function isValidModeId(id: string): boolean {
  return typeof id === 'string' && id.length > 0 && id.length <= 60 &&
    /^[a-zA-Z0-9_-]+$/.test(id);
}

// ── Crypto helpers ────────────────────────────────────────────────────────────

async function hashDeviceId(deviceId: string): Promise<string> {
  const data = new TextEncoder().encode(deviceId + '_rc_salt_2024');
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayUTC(): string { return new Date().toISOString().split('T')[0]; }
function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split('T')[0];
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

async function rateCheck(env: Env, prefix: string, deviceId: string, limit: number): Promise<boolean> {
  const key = `${prefix}_${deviceId}_${todayUTC()}`;
  const n = parseInt((await env.RATE_LIMIT_KV.get(key)) ?? '0', 10);
  if (n >= limit) return false;
  await env.RATE_LIMIT_KV.put(key, String(n + 1), { expirationTtl: RL_TTL });
  return true;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

async function recordFeedback(env: Env, modeId: string, grade: string): Promise<void> {
  const key = `stats_${todayUTC()}`;
  const stats: DailyStats = JSON.parse((await env.RATE_LIMIT_KV.get(key)) ?? 'null') ??
    { total: 0, shares: 0, modes: {}, grades: {} };
  stats.total += 1;
  stats.modes[modeId] = (stats.modes[modeId] ?? 0) + 1;
  stats.grades[grade] = (stats.grades[grade] ?? 0) + 1;
  await env.RATE_LIMIT_KV.put(key, JSON.stringify(stats), { expirationTtl: STATS_TTL });
}

async function recordShare(env: Env, modeId: string): Promise<void> {
  const key = `stats_${todayUTC()}`;
  const stats: DailyStats = JSON.parse((await env.RATE_LIMIT_KV.get(key)) ?? 'null') ??
    { total: 0, shares: 0, modes: {}, grades: {} };
  stats.shares += 1;
  stats.modes[modeId] = stats.modes[modeId] ?? 0; // ensure key exists
  await env.RATE_LIMIT_KV.put(key, JSON.stringify(stats), { expirationTtl: STATS_TTL });
}

async function getStats(env: Env, days: number): Promise<Record<string, DailyStats>> {
  const dates = Array.from({ length: days }, (_, i) => daysAgo(i));
  const entries = await Promise.all(dates.map(async d => {
    const raw = await env.RATE_LIMIT_KV.get(`stats_${d}`);
    return [d, raw ? JSON.parse(raw) : { total: 0, shares: 0, modes: {}, grades: {} }] as const;
  }));
  return Object.fromEntries(entries);
}

// ── Suggestions ───────────────────────────────────────────────────────────────

async function getIndex(env: Env): Promise<string[]> {
  return JSON.parse((await env.RATE_LIMIT_KV.get('suggestions_index')) ?? '[]');
}
async function putIndex(env: Env, ids: string[]): Promise<void> {
  await env.RATE_LIMIT_KV.put('suggestions_index', JSON.stringify(ids));
}
async function getSuggestion(env: Env, id: string): Promise<Suggestion | null> {
  const raw = await env.RATE_LIMIT_KV.get(`suggestion_${id}`);
  return raw ? JSON.parse(raw) : null;
}
async function putSuggestion(env: Env, s: Suggestion): Promise<void> {
  await env.RATE_LIMIT_KV.put(`suggestion_${s.id}`, JSON.stringify(s), { expirationTtl: SUGGESTION_TTL });
}
async function getAllSuggestions(env: Env): Promise<Suggestion[]> {
  const ids = await getIndex(env);
  const all = await Promise.all(ids.map(id => getSuggestion(env, id)));
  return all.filter((s): s is Suggestion => s !== null);
}

// ── Handlers: public ─────────────────────────────────────────────────────────

async function handleFeedback(req: Request, env: Env): Promise<Response> {
  if (!isApp(req, env)) return err('UNAUTHORIZED', 401);

  const text = await req.text().catch(() => '');
  if (text.length > MAX_BODY_BYTES) return err('REQUEST_TOO_LARGE', 413);

  let body: Record<string, unknown>;
  try { body = JSON.parse(text); } catch { return err('INVALID_JSON', 400); }

  const { deviceId, modeId, systemPrompt, userInput } = body;

  if (!isValidDeviceId(String(deviceId ?? ''))) return err('INVALID_DEVICE_ID', 400);
  if (!isValidModeId(String(modeId ?? ''))) return err('INVALID_MODE_ID', 400);
  if (typeof systemPrompt !== 'string' || !systemPrompt || systemPrompt.length > MAX_BODY_BYTES) return err('INVALID_REQUEST', 400);
  if (typeof userInput !== 'string' || !userInput || userInput.length > MAX_INPUT_CHARS) return err('INVALID_REQUEST', 400);

  const allowed = await rateCheck(env, 'rl', deviceId as string, FREE_DAILY_LIMIT);
  if (!allowed) return err('RATE_LIMITED', 429);

  let upstream: Response;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userInput }],
      }),
    });
  } catch { return err('UPSTREAM_UNREACHABLE', 502); }

  if (!upstream.ok) {
    const s = upstream.status;
    if (s === 401 || s === 403) return err('UPSTREAM_AUTH_ERROR', 500);
    if (s === 429) return err('UPSTREAM_RATE_LIMITED', 503);
    return err('UPSTREAM_ERROR', 502);
  }

  let data: { content?: Array<{ type: string; text?: string }> };
  try { data = await upstream.json(); } catch { return err('UPSTREAM_PARSE_ERROR', 502); }

  const textBlock = data.content?.find(b => b.type === 'text');
  if (!textBlock?.text) return err('EMPTY_RESPONSE', 502);

  const cleaned = textBlock.text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  let result: Record<string, unknown>;
  try { result = JSON.parse(cleaned); } catch { return err('PARSE_ERROR', 502); }

  // Fire-and-forget analytics — doesn't block response
  const grade = typeof result.grade === 'string' ? result.grade : 'unknown';
  void recordFeedback(env, modeId as string, grade);

  return json(result);
}

async function handleShare(req: Request, env: Env): Promise<Response> {
  if (!isApp(req, env)) return err('UNAUTHORIZED', 401);
  const text = await req.text().catch(() => '{}');
  let body: Record<string, unknown>;
  try { body = JSON.parse(text); } catch { return json({ ok: true }); }
  if (isValidModeId(String(body.modeId ?? ''))) {
    void recordShare(env, body.modeId as string);
  }
  return json({ ok: true });
}

async function handleSubmitSuggestion(req: Request, env: Env): Promise<Response> {
  if (!isApp(req, env)) return err('UNAUTHORIZED', 401);

  const text = await req.text().catch(() => '');
  if (text.length > 4000) return err('REQUEST_TOO_LARGE', 413);

  let body: Record<string, unknown>;
  try { body = JSON.parse(text); } catch { return err('INVALID_JSON', 400); }

  const { deviceId, title, description, exampleInput = '' } = body;

  if (!isValidDeviceId(String(deviceId ?? ''))) return err('INVALID_DEVICE_ID', 400);
  const t = String(title ?? '').trim();
  const d = String(description ?? '').trim();
  if (t.length < 3 || t.length > 100) return err('INVALID_TITLE', 400);
  if (d.length < 10 || d.length > 500) return err('INVALID_DESCRIPTION', 400);

  const allowed = await rateCheck(env, 'suggest', deviceId as string, MAX_SUGGESTIONS_PER_DAY);
  if (!allowed) return err('SUGGESTION_LIMIT', 429);

  const index = await getIndex(env);
  if (index.length >= MAX_STORED_SUGGESTIONS) return err('SUGGESTIONS_FULL', 503);

  const id = crypto.randomUUID();
  const deviceIdHash = await hashDeviceId(deviceId as string);

  const suggestion: Suggestion = {
    id, deviceIdHash,
    title: t.slice(0, 100),
    description: d.slice(0, 500),
    exampleInput: String(exampleInput).slice(0, 300),
    votes: 0,
    status: 'pending',
    createdAt: Date.now(),
    adminNote: '',
  };

  await putSuggestion(env, suggestion);
  await putIndex(env, [id, ...index]);
  return json({ ok: true, id });
}

async function handleVote(req: Request, env: Env, suggestionId: string): Promise<Response> {
  if (!isApp(req, env)) return err('UNAUTHORIZED', 401);

  const text = await req.text().catch(() => '{}');
  let body: Record<string, unknown>;
  try { body = JSON.parse(text); } catch { return err('INVALID_JSON', 400); }

  if (!isValidDeviceId(String(body.deviceId ?? ''))) return err('INVALID_DEVICE_ID', 400);

  const s = await getSuggestion(env, suggestionId);
  if (!s) return err('NOT_FOUND', 404);
  if (s.status !== 'pending') return err('NOT_VOTEABLE', 400);

  const hash = await hashDeviceId(body.deviceId as string);
  const voteKey = `vote_${suggestionId}_${hash}`;
  if (await env.RATE_LIMIT_KV.get(voteKey)) return err('ALREADY_VOTED', 409);

  await env.RATE_LIMIT_KV.put(voteKey, '1', { expirationTtl: SUGGESTION_TTL });
  s.votes += 1;
  await putSuggestion(env, s);
  return json({ ok: true, votes: s.votes });
}

// ── Handlers: admin ───────────────────────────────────────────────────────────

async function handleAdminStats(req: Request, env: Env): Promise<Response> {
  if (!isAdmin(req, env)) return err('UNAUTHORIZED', 401);
  const stats = await getStats(env, 7);
  const vals = Object.values(stats);
  const totalChecks = vals.reduce((s, d) => s + d.total, 0);
  const totalShares = vals.reduce((s, d) => s + d.shares, 0);
  const modes: Record<string, number> = {};
  const grades: Record<string, number> = {};
  for (const d of vals) {
    for (const [k, v] of Object.entries(d.modes)) modes[k] = (modes[k] ?? 0) + v;
    for (const [k, v] of Object.entries(d.grades)) grades[k] = (grades[k] ?? 0) + v;
  }
  return json({
    period: '7 days',
    totalChecks,
    totalShares,
    shareRate: totalChecks > 0 ? `${((totalShares / totalChecks) * 100).toFixed(1)}%` : '0%',
    topModes: Object.entries(modes).sort(([, a], [, b]) => b - a).slice(0, 5),
    gradeDistribution: grades,
    byDay: stats,
  });
}

async function handleAdminSuggestions(req: Request, env: Env, statusFilter?: string): Promise<Response> {
  if (!isAdmin(req, env)) return err('UNAUTHORIZED', 401);
  const all = await getAllSuggestions(env);
  const filtered = statusFilter ? all.filter(s => s.status === statusFilter) : all;
  return json({ count: filtered.length, suggestions: filtered.sort((a, b) => b.votes - a.votes) });
}

async function handleAdminUpdateSuggestion(
  req: Request, env: Env, id: string, action: 'approve' | 'reject'
): Promise<Response> {
  if (!isAdmin(req, env)) return err('UNAUTHORIZED', 401);
  const s = await getSuggestion(env, id);
  if (!s) return err('NOT_FOUND', 404);
  const body: Record<string, unknown> = JSON.parse((await req.text().catch(() => '{}')));
  s.status = action === 'approve' ? 'approved' : 'rejected';
  s.adminNote = String(body.adminNote ?? '').slice(0, 500);
  await putSuggestion(env, s);
  return json({ ok: true, suggestion: s });
}

async function handleAdminInsights(req: Request, env: Env, latest: boolean): Promise<Response> {
  if (!isAdmin(req, env)) return err('UNAUTHORIZED', 401);
  const raw = await env.RATE_LIMIT_KV.get('insights_index');
  const index: string[] = raw ? JSON.parse(raw) : [];
  if (latest) {
    if (!index.length) return json({ message: 'No insights yet. POST /admin/analysis/run to generate.' });
    const insight = await env.RATE_LIMIT_KV.get(`insight_${index[0]}`);
    return json(insight ? JSON.parse(insight) : { message: 'Not found.' });
  }
  return json({ count: index.length, dates: index });
}

async function handleAdminRunAnalysis(req: Request, env: Env): Promise<Response> {
  if (!isAdmin(req, env)) return err('UNAUTHORIZED', 401);
  try {
    await runWeeklyAnalysis(env);
    return json({ ok: true, message: 'Analysis complete. GET /admin/insights/latest' });
  } catch (e) {
    return err('ANALYSIS_FAILED', 500);
  }
}

// ── Self-learning: weekly AI analysis ────────────────────────────────────────

async function runWeeklyAnalysis(env: Env): Promise<void> {
  const stats = await getStats(env, 7);
  const allSuggestions = await getAllSuggestions(env);
  const topSuggestions = allSuggestions
    .filter(s => s.status === 'pending')
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 10);

  const systemPrompt = `You are the product analyst for RealityCheck AI — a brutally honest AI feedback app. Users submit ideas, plans, and decisions across 15 modes and receive structured feedback with a grade (A+ to F), truth score, risk score, verdict, weaknesses, blind spots, better version, and next action.

Your job: analyze usage data and generate actionable weekly insights for the solo founder. Be specific, data-driven, and direct — just like the app itself. Respond ONLY with valid JSON, no markdown.`;

  const userMessage = `Analyze RealityCheck AI performance for the past 7 days.

USAGE STATS BY DATE:
${JSON.stringify(stats, null, 2)}

TOP USER-SUGGESTED NEW MODES (by votes):
${JSON.stringify(topSuggestions.map(s => ({ id: s.id, title: s.title, description: s.description, exampleInput: s.exampleInput, votes: s.votes })), null, 2)}

Return exactly this JSON structure:
{
  "summary": "2-3 sentence executive summary",
  "totalChecks": <number>,
  "shareRate": "<X.X%>",
  "topMode": "<mode-id>",
  "weakestMode": "<mode-id or null>",
  "keyInsight": "<one non-obvious insight>",
  "modeRecommendations": [
    { "modeId": "<id>", "issue": "<specific issue>", "recommendation": "<actionable fix>" }
  ],
  "topSuggestions": [
    {
      "id": "<suggestion id>",
      "title": "<title>",
      "score": <0-100>,
      "reasoning": "<why this is valuable>",
      "draftSystemPrompt": "<complete NEPQ-style system prompt for this mode — include the JSON format instruction at the end>"
    }
  ]
}`;

  let responseText: string;
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!res.ok) return;
    const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
    responseText = data.content?.find(b => b.type === 'text')?.text ?? '';
  } catch { return; }

  let analysis: unknown;
  try {
    analysis = JSON.parse(responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim());
  } catch { return; }

  const today = todayUTC();
  const insight = { generatedAt: Date.now(), weekEnding: today, ...(analysis as object) };
  await env.RATE_LIMIT_KV.put(`insight_${today}`, JSON.stringify(insight), { expirationTtl: INSIGHT_TTL });

  // Update index (keep last 52 weeks)
  const rawIndex = await env.RATE_LIMIT_KV.get('insights_index');
  const index: string[] = rawIndex ? JSON.parse(rawIndex) : [];
  await env.RATE_LIMIT_KV.put('insights_index', JSON.stringify([today, ...index].slice(0, 52)));
}

// ── Main router ───────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const m = request.method;

    if (pathname === '/health' && m === 'GET') return json({ ok: true });

    // App endpoints
    if (pathname === '/feedback' && m === 'POST') return handleFeedback(request, env);
    if (pathname === '/analytics/share' && m === 'POST') return handleShare(request, env);
    if (pathname === '/suggestions' && m === 'POST') return handleSubmitSuggestion(request, env);
    const voteMatch = pathname.match(/^\/suggestions\/([a-zA-Z0-9_-]+)\/vote$/);
    if (voteMatch && m === 'POST') return handleVote(request, env, voteMatch[1]);

    // Admin endpoints
    if (pathname === '/admin/stats' && m === 'GET') return handleAdminStats(request, env);
    if (pathname === '/admin/suggestions' && m === 'GET') return handleAdminSuggestions(request, env);
    if (pathname === '/admin/suggestions/pending' && m === 'GET') return handleAdminSuggestions(request, env, 'pending');
    if (pathname === '/admin/suggestions/approved' && m === 'GET') return handleAdminSuggestions(request, env, 'approved');
    if (pathname === '/admin/insights' && m === 'GET') return handleAdminInsights(request, env, false);
    if (pathname === '/admin/insights/latest' && m === 'GET') return handleAdminInsights(request, env, true);
    if (pathname === '/admin/analysis/run' && m === 'POST') return handleAdminRunAnalysis(request, env);

    const updateMatch = pathname.match(/^\/admin\/suggestions\/([a-zA-Z0-9_-]+)\/(approve|reject)$/);
    if (updateMatch && m === 'POST') {
      return handleAdminUpdateSuggestion(request, env, updateMatch[1], updateMatch[2] as 'approve' | 'reject');
    }

    return err('NOT_FOUND', 404);
  },

  // Runs every Monday at 09:00 UTC — generates weekly self-analysis
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await runWeeklyAnalysis(env);
  },
};
