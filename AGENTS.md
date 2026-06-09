# Repository Guidelines — clickfolio.me

## Stack

| Layer | Technology |
|---|---|
| Runtime | Cloudflare Workers |
| Framework | [vinext](https://github.com/cloudflare/vinext) (Vite-based Next.js — NOT standard Next.js) |
| Package manager | `bun` |
| DB | Cloudflare D1 + Drizzle ORM (SQLite) |
| Auth | Better Auth (Google OAuth + email/password) |
| Storage | Cloudflare R2 (`CLICKFOLIO_R2_BUCKET`) |
| Email | Cloudflare Email Workers (`EMAIL` binding) |
| Styling | shadcn/ui (new-york) + Tailwind CSS 4 |
| Validation | Zod |
| Lint/format | Oxlint + Oxfmt via `vp check` — NOT Biome/ESLint/Prettier |
| Testing | Vitest + jsdom + @testing-library/react |

## Project Structure

```
app/                        # vinext App Router
  page.tsx                  # Home page (root level, NOT inside any group)
  [handle]/                 # Public profile viewer (/@handle — root level, NOT in (public)/)
  (public)/                 # verify-email/ only
  (protected)/              # Auth-gated: dashboard, edit, settings, waiting, wizard, themes
  (admin)/admin/            # Admin-only: analytics, referrals, resumes, users (requireAdminAuth())
  api/                      # API routes (see API Routes section)
  blog/                     # Static blog pages (9 hardcoded slugs, not DB-driven)
  for/                      # SEO landing pages by role (software-engineer, designer, etc.)
  explore/                  # Single static explore page
  preview/                  # Resume template preview (unauthenticated)
  privacy/                  # Privacy policy
  terms/                    # Terms of service
  reset-password/           # Password reset flow
components/
  ui/                       # shadcn/ui components
  templates/                # Resume templates
lib/
  auth/                     # Better Auth server + client config; auth helpers
  db/                       # Drizzle schema (lib/db/schema/) + getDb() + session variants
  schemas/                  # Zod validation schemas
  ai/                       # AI resume parsing pipeline (unpdf → AI SDK → normalize)
  email/                    # Cloudflare Email Workers sender + disposable domain check
  cron/                     # 4 scheduled task implementations
  queue/                    # Queue consumer, DLQ, retry logic
  rate-limit/               # IP/user rate limiting (D1-backed, SHA-256 hashed IPs)
  durable-objects/          # WebSocket Durable Object (ClickfolioStatusDO)
  templates/                # Theme registry (server + client variants)
  schemas/                  # Zod validation schemas
  password/                 # HIBP check + zxcvbn strength (client-side only)
  seo/                      # JSON-LD schema generation + sitemap helpers
  data/                     # DB-layer data access functions
  config/                   # App-wide constants (site, retry, FAQ)
  types/                    # Shared TypeScript types
  utils/                    # Sanitization, security headers, pending-upload cookie, env helpers
  stubs/                    # Module stubs for CF Workers-incompatible packages
  umami/                    # Umami analytics client
  blog/                     # Blog post fetching utilities
  r2.ts                     # R2 upload/download helpers
  referral.ts               # Referral code system
  cloudflare-env.d.ts       # Auto-generated (cf-typegen) — do not edit
worker/index.ts             # Real entrypoint — wraps vinext + Queue + Cron + WebSocket
proxy.ts                    # vinext proxy (cookie-only auth check, NO D1 access)
__tests__/                  # Tests (see Testing section)
migrations/                 # D1 database migrations
scripts/                    # Utility scripts (deploy, seed, thumbnails, favicons, migrate-prod)
```

## Build, Test & Dev Commands

```bash
# Development
bun run dev              # Vite+ dev server on :3000
bun run preview          # Build + local CF Workers preview (wrangler dev)
bun run clean            # rm -rf .next dist (clear build artifacts)

# Type checking & quality
bun run type-check       # tsc --noEmit
bun run lint             # vp lint (Oxlint)
bun run fix              # vp check --fix (auto-fix lint + format)
vp check                 # lint + format + type-check (all at once)

# Testing
bun run test             # all tests
bun run test:unit        # unit only (fast, retry:0, pool:threads)
bun run test:integration # integration only (retry:2, timeout:10s)
bun run test:security    # security only (retry:0, pool:forks, timeout:15s)
bun run test:coverage    # all tests + coverage (80% gate — used in CI)
bun run test:watch       # interactive watch mode
bun run test:ui          # Vitest browser UI
bun run test:ci          # JSON reporter variant (used in CI pipelines)

# Build & deploy
bun run build            # vp build (vinext)
bun run analyze          # ANALYZE=true vp build → dist/stats.html (bundle visualizer)
bun run ci               # full CI: install + type-check + vp check + test + build
bun run deploy           # build + deploy to CF Workers

# Database
bun run db:generate      # drizzle-kit generate (create migration files)
bun run db:migrate       # apply migrations to local D1
bun run db:migrate:prod  # apply to production D1
bun run db:push          # drizzle-kit push (schema only, no migration files — local prototyping only)
bun run db:reset         # wipe .wrangler/state/v3/d1 + re-run db:migrate (destructive)
bun run db:reset:local   # db:reset + db:seed:local
bun run db:seed:local    # seed local DB from scripts/seed-local.ts
bun run db:studio        # Drizzle GUI at :4984

# Codegen & tooling
bun run cf-typegen       # regen lib/cloudflare-env.d.ts
bun run generate:favicons # regen favicons from scripts/generate-favicons.ts
```

**Pre-push:** `bun run type-check && vp check && bun run test`

> **Note:** `db:push` skips migration files — use `db:generate` + `db:migrate` for the canonical path. `db:reset` is destructive and local-only.

## Coding Style & Conventions

- Double quotes, semicolons, trailing commas, 2-space indent, 100-char line width
- Formatter: Oxfmt (`vp fmt`); Linter: Oxlint (`vp lint`)
- Lint suppression: `// eslint-disable-next-line <rule> -- <reason>` (not `biome-ignore`)
- Staged files are auto-fixed via `vp check --fix` on commit (configured in `vite.config.ts`)
- **DB access**: always use `getDb(env.CLICKFOLIO_DB)` — never construct drizzle directly (see DB Session Variants)
- Zod schemas in `lib/schemas/`
- shadcn components in `components/ui/`, resume templates in `components/templates/`
- `lib/cloudflare-env.d.ts` is auto-generated — do not edit manually
- Use `<img>` tags, not Next.js `<Image />` (CF Workers constraint)
- TypeScript strict flags enabled: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch` — these are errors, not warnings
- `moduleResolution: "bundler"` — imports without extensions and `package.json` `exports` resolve by bundler rules

## Testing Guidelines

Tests follow the trophy model. Four vitest config files exist — one per suite and one combined:

| Suite | Command | Config | Pool | Retry | Timeout | Coverage gate |
|---|---|---|---|---|---|---|
| Unit | `test:unit` | `vitest.unit.config.ts` | threads | 0 | default | stmts/lines/fns: 20%, branches: 15% |
| Integration | `test:integration` | `vitest.integration.config.ts` | default | 2 | 10s | stmts/lines: 34%, branches: 24%, fns: 27% |
| Security | `test:security` | `vitest.security.config.ts` | forks | 0 | 15s | stmts/lines: 20%, branches/fns: 15% |
| Combined | `test:coverage` | `vitest.config.ts` | — | — | — | **80% (CI gate)** |

> The 80% coverage threshold (lines, statements, functions, branches) is enforced only by `test:coverage`. Individual suite runs enforce lower thresholds. CI runs all four; the `coverage-gate` job uses `test:coverage`.

**Test file locations:**

- `__tests__/unit/` — unit tests
- `__tests__/integration/` — integration tests
- `__tests__/security/` — security tests
- `__tests__/` (root) — additional files assigned to suites by include patterns in each config (e.g. `claim-flow.test.ts`, `idor-ownership.test.ts`)
- `__tests__/e2e/` — exists but empty; excluded from all runs

**Test infrastructure:**

- Setup: `__tests__/setup.ts` (jsdom, jest-dom matchers via `vite-plus/test`)
- Cloudflare binding mocks: `__tests__/setup/mocks/db.mock.ts`, `r2.mock.ts`
- Crypto mocks: `__tests__/mocks/crypto.ts`
- Fixtures: `__tests__/setup/fixtures/`
- Shared helpers: `__tests__/setup/helpers/test-utils.ts`

**CI pipeline (7 jobs):** `quality` → `type-check`, `unit-tests`, `integration-tests`, `security-tests`, `coverage-gate`, `build`. The `build` job also runs `bunx knip` (unused exports check). The `quality` job uses `vp check` via the `setup-vp@v1` action.

## Commit & PR Guidelines

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

Branch naming: `feat/add-dark-mode`, `fix/oauth-redirect`, `chore/update-deps`

PR requirements:
- Title follows conventional commit format
- Description explains the change
- Screenshots for UI changes
- All CI checks pass (`bun run ci`)

## Architecture Notes

### Worker entry (`worker/index.ts`)

The real entrypoint. Wraps vinext handler and adds:

- **Queue consumer** (`CLICKFOLIO_PARSE_QUEUE`) + DLQ handler (`clickfolio-parse-dlq`). DLQ detected via `batch.queue === "clickfolio-parse-dlq"`. `lib/queue/errors.ts` provides `isRetryableError()`.
- **4 cron triggers** called directly (not via HTTP self-fetch to avoid double-billing):
  - `"0 2 * * *"` — R2 temp file cleanup (`lib/cron/cleanup-r2.ts`)
  - `"0 3 * * *"` — DB cleanup (`lib/cron/cleanup.ts`)
  - `"0 4 * * *"` — disposable domain KV sync (`lib/cron/sync-disposable-domains.ts`)
  - `"*/15 * * * *"` — orphan resume recovery (`lib/cron/recover-orphaned.ts`)
- **WebSocket upgrade routing** (`/ws/resume-status`) → Durable Object. Validates Better Auth session cookie + D1 resume ownership before routing. Uses `getSessionDbForWebhook` (not `getDb`). Passes `X-Authenticated-User-Id` to the DO.
- **Security headers** (`HSTS`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) injected on every response in `SECURITY_HEADERS` constant.

### Cloudflare bindings

| Binding | Type | Name | Notes |
|---|---|---|---|
| `CLICKFOLIO_DB` | D1 | `clickfolio-db` | Use via `getDb()` / session variants |
| `CLICKFOLIO_R2_BUCKET` | R2 | `clickfolio-bucket` | Use via `lib/r2.ts` helpers |
| `CLICKFOLIO_DISPOSABLE_DOMAINS` | KV | — | Disposable email domain list |
| `CLICKFOLIO_PARSE_QUEUE` | Queue | `clickfolio-parse-queue` | Resume parse jobs |
| `CLICKFOLIO_STATUS_DO` | DO | `ClickfolioStatusDO` | WebSocket parse status |
| `EMAIL` | Email | `send_email` | Transactional email via CF Email Workers; sender: `noreply@clickfolio.me` |
| `ASSETS` | Static | `dist/client` | Static asset binding |

**Smart placement** is enabled (`placement.mode: "smart"`). Observability is on (10% head sampling, logs persisted).

**DO migration history** (all three tags required when applying fresh): `v1 DOShardedTagCache` → `v2 ResumeStatusDO` → `v3 ClickfolioStatusDO`.

### Environment variables

**Static wrangler vars** (in `wrangler.jsonc`): `NODE_ENV: "production"`, `AI_MODEL: "openai/gpt-oss-120b:nitro"`

**Required secrets** (`wrangler secret put <name>`):
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `CF_AI_GATEWAY_ACCOUNT_ID`, `CF_AI_GATEWAY_ID`, `CF_AIG_AUTH_TOKEN` (AI gateway via OpenRouter)
- `CRON_SECRET` (protects `/api/cron/*` HTTP endpoints for manual triggers)
- Optional: `ALERT_CHANNEL`, `ALERT_WEBHOOK_URL`, Umami analytics vars

**Local dev:** secrets in `.dev.vars` (auto-loaded by Vite); copy `.env.example` to get started. `BETTER_AUTH_URL` is the single source of truth for the app URL.

### DB Session Variants (important — use the right one)

All in `lib/db/session.ts`. Using the wrong variant causes stale-read bugs or FK errors.

| Function | When to use |
|---|---|
| `getDb(env.CLICKFOLIO_DB)` | Read-only or non-user-facing queries |
| `getSessionDb(d1)` | Authenticated page/API routes (reads/writes `d1-session-bookmark` cookie for read-your-own-writes) |
| `getSessionDbWithPrimaryFirst(d1)` | Immediately after user creation (avoids FK errors before D1 replication) |
| `getSessionDbForWebhook(d1)` | Queue consumers, cron handlers, WebSocket handlers (no cookies available; uses `"first-primary"`) |

Schema is split: `lib/db/schema/auth.ts`, `resume.ts`, `site.ts`, `rate-limit.ts`, `relations.ts`, `index.ts`.

### API Routes

Key routes not obvious from directory names:

- `POST /api/upload` — Direct R2 upload; sets a signed `pending_upload` HTTP-only cookie; stores at `temp/{uuid}/{filename}`
- `GET|POST|DELETE /api/upload/pending` — Manages the pending-upload cookie (bridge for pre-auth upload flow)
- `POST /api/resume/claim` — Converts temp R2 key to real resume post-auth (verified via signed cookie)
- `GET /api/resume/status` — 5-state parse machine: `waiting_for_cache → queued → processing → completed → failed`; returns `can_retry` flag (max 2 retries)
- `GET /api/cron/*` — Manual cron trigger endpoints (`cleanup`, `cleanup-r2`, `recover-orphaned`, `sync-domains`); protected with `Bearer ${CRON_SECRET}`
- `GET /api/og/home`, `GET /api/og/[handle]` — OG image generation (stubbed `@vercel/og`)
- Sitemap: `/sitemap.xml` rewrites to `/api/sitemap-index`; `/sitemap/:id.xml` → `/api/sitemap/:id` (configured in `next.config.ts`)

### Auth patterns

- **No `middleware.ts`** — the file is `proxy.ts` (vinext convention, exported as `proxy`)
- **Protected routes in proxy** (cookie-check only): `/dashboard`, `/edit`, `/settings`, `/waiting`, `/wizard`. `/themes` and `/admin` use page-level auth only.
- **Auth instance is created per-request** (not singleton) because D1 is only available in request context
- Three auth helpers in `lib/auth/`:
  - `requireAuthWithMessage()` — API routes; returns `{user, error}`
  - `requireAuthWithUserValidation()` — fetches DB user row + env bindings + DO bookmark (used by most API routes)
  - `requireAdminAuth()` / `requireAdminAuthForApi()` — page vs API variants; redirects non-admins to `/dashboard`

### Key lib/ modules

- **`lib/ai/`** — `parseResumeWithAi(pdfBuffer, env)`. Pipeline: PDF text extraction (unpdf) → Vercel AI SDK structured output → normalize → fallback. 60k-char context limit with head/tail truncation.
- **`lib/rate-limit/`** — IP-based limits in D1. IPs are SHA-256 hashed for GDPR compliance. Upload: 10/hr & 50/day (anon), 5/day (authed). Handle changes: 3/24hr.
- **`lib/email/`** — Cloudflare Email Workers (`env.EMAIL`). No external API keys. `disposable-check.ts` queries `CLICKFOLIO_DISPOSABLE_DOMAINS` KV.
- **`lib/templates/`** — Theme registry. Use `theme-registry.ts` server-side, `theme-registry.client.tsx` client-side. `theme-access.ts` controls unlock logic.
- **`lib/password/`** — HIBP breach check (`hibp.ts`) + zxcvbn strength (`strength.ts`). Zxcvbn runs client-side only (`@zxcvbn-ts/*` stubbed in SSR).
- **`lib/utils/environment.ts`** — `isLocalEnvironment()` predicate; rate limiting skips limits in dev.

### Build system notes

- **Bundle analysis:** `ANALYZE=true bun run build` → `dist/stats.html` (rollup-plugin-visualizer)
- **Vendor chunks:** `@radix-ui` → `vendor-radix`, `react-hook-form` → `vendor-forms`, `better-auth` → `vendor-auth`
- **SSR aliases** (in `vite.config.ts`): `@vercel/og` → `lib/stubs/og-stub.js`; `@zxcvbn-ts/*` → `lib/stubs/zxcvbn-lang-stub.mjs`; `zod/v3` → `lib/stubs/zod-v3-stub.mjs`
- **`optimizeDeps.exclude: ["lucide-react"]`** — excluded from Vite pre-bundling
- **`ensureClientDir` plugin** — creates `dist/client/` before writeBundle (upstream vinext bug workaround)
- **`next.config.ts`** — `serverActions.bodySizeLimit` is dynamic from `MAX_UPLOAD_SIZE_MB` env var (default 5 MB); `allowedDevOrigins` includes `*.ngrok-free.app`

### Platform constraints

- **No `fs`** — use R2 bindings for file I/O
- **No D1 in proxy/middleware** — auth check is cookie-only there
- `unsafe-inline` in CSP required for React hydration (no nonce support on Workers)
- `vinext` uses `@cloudflare/vite-plugin` — do not add raw wrangler CLI to the build pipeline
- **Local D1** is auto-discovered from `.wrangler/state/v3/d1/...` — run `bun run dev` or `bun run db:migrate` at least once to create it before using drizzle-kit

### Module aliases & stubs

- `@/*` → project root (defined in both `tsconfig.json` and `vite.config.ts`)
- `cloudflare:workers` — stubbed for client/vitest (`lib/stubs/cloudflare-workers-client-stub.mjs`)
- `@vercel/og` — stubbed (incompatible with CF Workers)
- `@zxcvbn-ts/*` — stubbed in SSR (password strength runs client-side only)
- `zod/v3` — stubbed (aliased to avoid dual-bundle issues)
- `node:async_hooks` / `async_hooks` — stubbed for client environment

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` to format, lint, and type-check; run `vp test` to test changes.
- [ ] Suppress lint warnings with `// eslint-disable-next-line <rule> -- <reason>` (not `biome-ignore`).
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
