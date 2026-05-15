# Deploying the RealityCheck Proxy

## One-time setup

1. **Install wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**
   ```bash
   wrangler login
   ```

3. **Create the KV namespace** (stores rate-limit counters)
   ```bash
   wrangler kv:namespace create RATE_LIMIT_KV
   ```
   Copy the two IDs from the output into `wrangler.toml`:
   ```toml
   id = "paste-production-id-here"
   preview_id = "paste-preview-id-here"
   ```

4. **Set secrets** (never stored in source)
   ```bash
   wrangler secret put ANTHROPIC_API_KEY
   # paste your sk-ant-... key when prompted

   wrangler secret put APP_SECRET
   # paste the same value as APP_SECRET in src/constants/config.ts
   ```

5. **Deploy**
   ```bash
   npm run deploy
   ```
   Wrangler will print your worker URL:
   `https://realitycheck-proxy.YOUR-SUBDOMAIN.workers.dev`

6. **Update the app**
   In `src/constants/config.ts`, set:
   ```ts
   export const PROXY_URL = 'https://realitycheck-proxy.YOUR-SUBDOMAIN.workers.dev';
   ```

## Local development

```bash
# Create a .dev.vars file (gitignored) with your secrets:
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .dev.vars
echo "APP_SECRET=your-secret" >> .dev.vars

npm run dev
# Worker runs at http://localhost:8787
```

## Rate limits

- Free tier: 5 checks per device per UTC day (set by `FREE_DAILY_LIMIT` in worker.ts)
- Cloudflare free plan: 100,000 requests/day — covers ~20,000 active users at 5 checks/day
- Scale up: Cloudflare Workers Paid plan ($5/month) for 10M requests/month

## Rotating the APP_SECRET

1. Generate a new secret
2. `wrangler secret put APP_SECRET` with the new value
3. Update `APP_SECRET` in `src/constants/config.ts`
4. Rebuild and redeploy the app
