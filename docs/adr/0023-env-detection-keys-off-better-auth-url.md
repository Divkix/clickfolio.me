# Env detection keys off BETTER_AUTH_URL, not NODE_ENV

`isLocalEnvironment()` (`lib/utils/environment.ts`) and `getPublicSiteUrl()` (`lib/utils/site-url.ts`) read `BETTER_AUTH_URL` (default `https://clickfolio.me`), not `NODE_ENV`. wrangler bakes `NODE_ENV=production` at build time, so it's unreliable for local-vs-prod detection (e.g. `bun run preview`).
