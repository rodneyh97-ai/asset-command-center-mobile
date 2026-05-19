// ── Proxy URL ────────────────────────────────────────────────────────────────
// After deploying the Cloudflare Worker (see backend/DEPLOY.md), replace this
// with your worker URL: https://realitycheck-proxy.YOUR-SUBDOMAIN.workers.dev
export const PROXY_URL = 'https://realitycheck-proxy.REPLACE_ME.workers.dev';

// ── App secret ───────────────────────────────────────────────────────────────
// Must match the APP_SECRET set in the Cloudflare Worker via:
//   wrangler secret put APP_SECRET
// This value is in the app binary and is not truly secret — it exists to deter
// casual automated abuse, not determined attackers. Rotate it periodically.
export const APP_SECRET = 'rc_7f3a9b2c4e8d11edb8780242ac120002';

// ── Free tier ────────────────────────────────────────────────────────────────
export const FREE_DAILY_LIMIT = 5;

// ── RevenueCat ────────────────────────────────────────────────────────────────
// Get these from app.revenuecat.com → Your Project → API Keys
// iOS key starts with "appl_", Android key starts with "goog_"
export const REVENUECAT_IOS_KEY = 'appl_REPLACE_ME';
export const REVENUECAT_ANDROID_KEY = 'goog_REPLACE_ME';
// Must match the entitlement identifier you create in the RevenueCat dashboard.
// Attach both your monthly and annual products to this entitlement.
export const RC_ENTITLEMENT = 'premium';
