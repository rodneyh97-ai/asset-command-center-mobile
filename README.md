# EatOS

**Less thinking. Better eating. Real life.**

EatOS answers one question fast: *“What should I eat right now?”* It gives one clear recommendation,
up to two alternatives, and a short reason why, based on your goal, your restrictions, where you are,
how hungry you are, your time, budget, and mood. It doesn't track calories.

> This repository was previously named/described as “asset-command-center-mobile” and contained
> no application code. EatOS lives in `mobile/`. See `DECISIONS.md` (D6) about the repo name.

## Status

Phase 2 (functional MVP), **local-only prototype**. Not launch-ready. See `ROADMAP.md`.

## Run it

```bash
cd mobile
npm install
npm start          # then press i (iOS simulator), a (Android), w (web), or scan the QR with Expo Go
npm test           # unit + screen-flow tests
npm run typecheck
npm run lint
```

## Screens

`screens/eatos-screens-light.png` and `screens/eatos-screens-dark.png` show every screen, captured from the real build.

## Docs

| File | Purpose |
|---|---|
| `PRODUCT_REQUIREMENTS.md` | What we're building and why, MVP scope, non-goals |
| `ARCHITECTURE.md` | How it's built, now and next; costs |
| `ROADMAP.md` | Phases and what's next |
| `DECISIONS.md` | Key decisions and their reasoning |
| `TEST_PLAN.md` | What's tested, what isn't |
| `DEVICE_TEST_CHECKLIST.md` | 20-minute checklist to run on real phones |
| `PRIVACY_POLICY.md` | Draft privacy policy (needs review before publishing) |
| `RESEARCH.md` | Evidence behind the design, competitor take/leave, learning results |
| `OWNERSHIP.md` | What you own, what you rent, and the exit path for each |
