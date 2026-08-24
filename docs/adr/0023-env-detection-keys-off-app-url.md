# Env detection keys off `APP_URL`, not `NODE_ENV`

`isLocalEnvironment()` (`lib/utils/environment.ts`) and `getPublicSiteUrl()` (`lib/utils/site-url.ts`) read the runtime app-URL env var (originally Better Auth's `BETTER_AUTH_URL`; renamed to plain `APP_URL` in the Clerk cutover — default fallback `https://clickfolio.me`), not `NODE_ENV`. wrangler bakes `NODE_ENV=production` at build time, so it's unreliable for local-vs-prod detection (e.g. `pnpm run preview`).
