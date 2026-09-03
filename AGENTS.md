# Repository Guidelines — clickfolio.me

> **clickfolio.me** turns a PDF resume into a hosted portfolio (`/@handle`) in <60s: upload → AI parse → shareable link. Cloudflare Workers (Hyperdrive→PlanetScale Postgres, R2, Queues, Durable Objects) + Clerk.

This file is the **single source of truth** — read top-to-bottom before touching unfamiliar code.
**Mandatory:** when you change anything documented here, update the correct section in the same change — be specific (exact paths/names), consolidate don't append, fix don't stack, keep dense (tables/short bullets). If rationale isn't obvious from code, add an ADR under `docs/adr/` and index it below.

## Stack

| Layer       | Technology                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| Runtime     | Cloudflare Workers                                                                                             |
| Framework   | [vinext](https://github.com/cloudflare/vinext) `1.0.0-beta.8` on Next `^16.3.4`, React `^19.2.8`               |
| Toolchain   | Vite+ `vite-plus@^0.3.0`; `vite` alias `npm:@voidzero-dev/vite-plus-core@^0.3.0`                               |
| Package mgr | `pnpm@11.10.0` via `packageManager`                                                                            |
| DB          | PlanetScale Postgres via Hyperdrive `HYPERDRIVE` + Drizzle `drizzle-orm/pg-core` (postgres-js)                 |
| Auth        | Clerk `@clerk/react` + `@clerk/backend` (NOT `@clerk/nextjs`) — Google OAuth                                   |
| AI parsing  | Cloudflare AI Gateway → OpenRouter `openai/gpt-5.6-luna:nitro` + `unpdf` + Vercel AI SDK `ai`                  |
| Storage     | Cloudflare R2 `CLICKFOLIO_R2_BUCKET`                                                                           |
| Queue       | Cloudflare Queues `CLICKFOLIO_PARSE_QUEUE` + DLQ                                                               |
| Realtime    | Durable Object `ClickfolioStatusDO` (hibernation)                                                              |
| Styling     | shadcn/ui `new-york` `rsc:true` + `lucide` + Tailwind CSS 4 (PostCSS-only, no `tailwind.config`)               |
| Validation  | Zod `^4.5.4`                                                                                                   |
| Lint/format | Oxlint + Oxfmt via `vp check` (NOT Biome/ESLint/Prettier)                                                      |
| Testing     | Vitest `4.1.11` via `vite-plus/test` + `jsdom` + `@testing-library/react`; `@vitest/coverage-v8@4.1.11` pinned |

> Pin: `catalog:vitest` == `vitest` == `@vitest/coverage-v8` == `4.1.11` — mismatch aborts `--coverage` at startup. Keep `pnpm-workspace.yaml` override + `package.json` dep in sync.

## Project Structure

```
app/                          # vinext App Router
  page.tsx                    # Home — ISR 3600
  [handle]/                   # /@handle public viewer — ISR 3600, dynamicParams true
  (protected)/                # dashboard, edit, settings, waiting, wizard — each page self-gates via getServerSession
                              #   layout sets robots: noindex,nofollow
  (admin)/admin/              # admin (analytics, resumes, users) — layout gates via requireAdminAuth; 4 sub-pages "use client"
  api/                        # 27 routes (see API Contracts)
  blog/                       # 17 route folders ↔ lib/blog/posts.ts BLOG_POSTS 17:17 — ISR 86400
  for/                        # 6 role landing pages (software-engineer, designer, …) — ISR 86400
  explore/                    # /explore directory (showInDirectory=true) — ISR 300
  preview/[id]/               # demo-data preview for thumbnails — ISR 7d, noindex
  privacy/  terms/  about/  faq/  manifest.webmanifest (theme #d94e4e, background #fdf8f3 — coral)
  ui/  templates/ (10)  wizard/  home/  blog/  analytics/  Faq.tsx  BrandIcons.tsx
lib/
  auth/  db/  schemas/  ai/  queue/  rate-limit/  seo/  templates/  config/  types/
  utils/  data/  umami/  blog/  durable-objects/  stubs/  r2.ts  cloudflare-env.d.ts (generated)
hooks/                        # useFileUpload, useResumeWebSocket, useResumeStatus, useDismissable, useCopyToClipboard
lib/db/schema/                # auth.ts, resume.ts, site.ts, rate-limit.ts, maintenance.ts, relations.ts, index.ts
  └─ getDb(env.HYPERDRIVE) per-invocation accessor (lib/db/index.ts)
worker/index.ts               # real entrypoint: vinext + queue + cron + WS
proxy.ts                      # edge auth gate (dual export proxy/default) — replaces middleware.ts
instrumentation.ts / instrumentation-client.ts  # PostHog server/client hooks
__tests__/  migrations_pg/  scripts/ (deploy.ts, generate-favicons.ts)
```

## Build, Test & Dev Commands

```bash
  # Dev
pnpm run dev            # vp dev --port 3000
pnpm run preview        # vp build && wrangler dev
pnpm run clean          # rm -rf .next dist
  # Quality
pnpm run type-check     # tsc --noEmit
pnpm run lint           # vp lint (Oxlint)
pnpm run fix            # vp check --fix
vp check                # lint + format + type-check (single gate)
  # Test
pnpm run test             # all suites (vitest.config.ts, retry:2/threads)
pnpm run test:unit        # --config vitest.unit.config.ts
pnpm run test:integration # --config vitest.integration.config.ts
pnpm run test:security    # --config vitest.security.config.ts
pnpm run test:coverage    # --coverage (combined)
pnpm run test:watch       # vp test (watch)
pnpm run test:ui          # vp test --ui
pnpm run test:ci          # vp test run --coverage --reporter=json
  # Build
pnpm run build          # vp build (vinext)
pnpm run analyze        # ANALYZE=true vp build → dist/stats.html
pnpm run ci             # install --frozen-lockfile && type-check && vp check && test && build
pnpm run deploy         # tsx scripts/deploy.ts — builds then wrangler deploy
  # DB (drizzle-kit — needs DATABASE_URL direct PlanetScale URL; Hyperdrive only inside Worker)
pnpm run db:generate    # drizzle-kit generate → migrations_pg/ (offline)
pnpm run db:migrate     # drizzle-kit migrate (apply)
pnpm run db:push        # drizzle-kit push (prototyping only — skips migration files)
pnpm run db:studio      # drizzle-kit studio --port 4984
  # Codegen
pnpm run cf-typegen         # wrangler types → lib/cloudflare-env.d.ts
pnpm run generate:favicons  # sharp from public/icon.svg → favicons
```

- `prepare` (`vp config`) runs on `pnpm install`.
- **Pre-push:** `pnpm run type-check && vp check && pnpm run test`
- **pnpm lockfile:** `catalog:` refs can leave importer storing `specifier:'catalog:'`; clean checkout then fails `ERR_PNPM_OUTDATED_LOCKFILE`. Fix: `pnpm install --no-frozen-lockfile` once, commit regenerated `pnpm-lock.yaml`.
- **Coverage pin:** `catalog:vitest == vitest == @vitest/coverage-v8 == 4.1.11` (3 places).
- **`db:push` vs `db:generate+migrate`:** `push` is prototyping only; canonical is `generate` + `migrate`.
- **Thumbnails:** `public/previews/` holds 10 committed `.webp` (bento, bold_corporate, classic_ats, design_folio, dev_terminal, glass, midnight, minimalist_editorial→`minimalist.webp`, neo_brutalist→`brutalist.webp`, spotlight) shot at 1280×800 @2x via `/preview/[id]`. No generator script in repo (deleted with `playwright` devDep); re-add as doc snippet when re-shooting. Slug shortenings are intentional.
- **Deploy:** `scripts/deploy.ts` runs `pnpm run build` with `POSTHOG_UPLOAD_SOURCEMAPS=true` (unless `--dry-run` → `false`), then `pnpm exec wrangler deploy`; forwards args/exit codes.
- **Config pointer:** CSP/HSTS lives in `next.config.ts:headers()` — allowlist Umami/Clerk/Google OAuth/CF Insights (see file); vendor chunks wrap vinext `manualChunks`; `viteEnvironment rsc/ssr` + `onwarn MISSING_EXPORT middleware` (see `vite.config.ts:15-31,239-254`).
- **Module aliases:** `resolve.alias` has 2 entries (`next/dist/compiled/@vercel/og/index.edge.js→lib/stubs/og-stub.js`, `zod/v3→zod-v3-stub.mjs`); client `cloudflare:workers` + `node:async_hooks` are `clientModuleStubs()` plugin (`vite.config.ts:15-31`), not alias. Zxcvbn stubs removed.
- **Local dev:** `.dev.vars` + `wrangler.jsonc` routes `clickfolio.me`/`www.clickfolio.me`; `compatibility_date 2026-01-22` + flags `nodejs_compat`/`global_fetch_strictly_public`; see `wrangler.jsonc:118` crons.
- **Bundle:** `postcss` + `@tailwindcss/postcss` + `tailwindcss` + `tw-animate-css`; no `tailwind.config.ts`; `optimizeDeps.exclude: ["lucide-react"]`.
- **Drizzle:** `drizzle.config.ts` `dialect:"postgresql"`, `schema:"./lib/db/schema/index.ts"`, `out:"./migrations_pg"`; `db:*` scripts need `DATABASE_URL`.
- **Env template:** `.env.example` 6.3KB / 154 lines — copy to `.dev.vars`; `lib/cloudflare-env.d.ts` generated via `cf-typegen`.

## Coding Style & Conventions

- Double quotes, semicolons, trailing commas, 2-space indent, 100-char width. Formatter Oxfmt, linter Oxlint via `vp check`.
- **Oxlint config** in `vite.config.ts:127-233`: plugins `react, typescript, jsx-a11y, oxc` + **12 anti-slop rules** (`no-chained-type-assertions`, `no-conditional-empty-object-spread`, `no-known-value-widening`, `no-object-parameters`, `no-reflect-apply/get`, `no-runtime-typeof`, `no-shape-in-symbol-names`, `no-unknown-parameters/returns/type-aliases`, `no-unsafe-dictionary-type`, `no-widen-then-assert`, `require-safety-comment-for-type-assertion`) + 2 jsPlugins (`vite-plus/oxlint-plugin`, `anti-slop`). Ignores **14 patterns** (`dist/**`, `lib/cloudflare-env.d.ts`, `.agent/**`, `.agents/**`, `.claude/**`, `.codex/**`, `.continue/**`, `.cursor/**`, `.gemini/**`, `.opencode/**`, `.pi/**`, `.roo/**`, `.windsurf/**`, `tools/oxlint/anti-slop/**`). Overrides for `__tests__/**` etc. Staged hook: `staged: {"*.{ts,tsx,js,jsx,json,css}": ["vp check --fix"]}` (Vite+ native, not husky).
- **DB:** always `getDb(env.HYPERDRIVE)` **per invocation** — never cache across Workers; `POSTGRES_OPTIONS {prepare:false, fetch_types:false, max:5, idle_timeout:20, connect_timeout:10}` (ADR-0025). `db.transaction(async (tx)=>…)` for atomicity; `23505 duplicate key value` → HTTP 409.
- **Session:** pages/RSC use `getServerSession()` (`lib/auth/session.ts`); APIs use `requireAuthWithMessage` / `requireAuthWithUserValidation` (`lib/auth/middleware.ts`).
- **API responses:** `createSuccessResponse` / `createErrorResponse` + `ERROR_CODES` from `lib/utils/security-headers.ts`; spreads single `SECURITY_HEADERS` (see Runtime). Never hand-roll `Response.json`.
- **Logging:** `log(level,msg,fields)` from `lib/utils/log.ts` (JSON line) — not `console.*` in worker/queue/cron/DLQ.
- Zod schemas `lib/schemas/`; shadcn `components/ui/`, templates `components/templates/`; `lib/cloudflare-env.d.ts` is generated (`cf-typegen`); use `<img>` not Next `<Image/>`.
- **TypeScript:** `strict:true` (+ `noUnusedLocals/noUnusedParameters/noImplicitReturns/noFallthroughCasesInSwitch` as errors), `jsxImportSource:react`, `jsx:react-jsx`, `incremental`, `esModuleInterop`, `resolveJsonModule`, `isolatedModules`, `plugins:[{name:"next"}]` (`tsconfig.json:6`).
- **Shadcn:** `components.json` new-york rsc lucide Tailwind4 PostCSS-only; no `tailwind.config.ts`.

## Testing Guidelines

| Suite       | Command            | Config                         | Pool    | Retry | Isolate | Timeout | Thresholds (stmts/lines/br/fns) |
| ----------- | ------------------ | ------------------------------ | ------- | ----- | ------- | ------- | ------------------------------- |
| Unit        | `test:unit`        | `vitest.unit.config.ts`        | threads | 0     | true    | default | 20/20/15/20                     |
| Integration | `test:integration` | `vitest.integration.config.ts` | —       | 2     | —       | 10s     | 34/34/24/27                     |
| Security    | `test:security`    | `vitest.security.config.ts`    | forks   | 0     | —       | 15s     | 20/20/15/15                     |
| Combined    | `test:coverage`    | `vitest.config.ts`             | threads | 2     | —       | default | report only (no gate)           |

- Shared base `vitest.base.config.ts`: `sharedExclude ["node_modules",".next","dist","__tests__/e2e/**",".worktrees/**"]`, `sharedSetupFiles ["__tests__/setup.ts"]`, `sharedAlias {"@":".", "cloudflare:workers":"lib/stubs/cloudflare-workers-client-stub.mjs"}`, `sharedCoverageProvider "v8"`. Security **has no explicit `exclude`** — relies on narrow `include` glob.
- Suite selection via `--config` in npm scripts; `test`/`test:coverage` pass no `--config` → `vitest.config.ts` `include ["**/__tests__/**/*.test.{ts,tsx}"]`.
- **File locations:** auto `__tests__/unit|integration|security/**/*.test.*` + root `*.test.ts` must be hard-coded (unit 5 + integration 2 + security 3 = **10**): unit `privacy, profile-schema, resume-schema, sitemap, theme-id-consistency`; integration `claim-flow, share`; security `idor-ownership, sanitization, claim-security-cookie`. `password-strength`/`email-verification` live under `__tests__/security/**` via glob. `__tests__/e2e/**` excluded (no active tests).
- **All tests import from `vite-plus/test`** (`import {describe,it,expect,vi} from "vite-plus/test"`), not `vitest`.
- **Pattern — mock-then-dynamic-import:** top-level `vi.mock("…",()=>({…}))` (hoisted), then inside `it` do `const {POST}=await import("@/app/api/…/route")` so SUT loads after mocks. `vi.doMock` for per-test dynamic mocking. **Inline hand-rolled mocks are the norm** (~9/96 files import shared fixtures).
- **Infra:** `__tests__/setup.ts` sets jest-dom, hand-rolled `localStorage`, deterministic `crypto` (SHA-1/256 real, `randomUUID` sequential, `sign` pseudo-HMAC), clears `clearKeyCache()`; `cloudflare:workers` alias needs `vi.mock("cloudflare:workers",()=>({env:{…}}))` to inject bindings; `server.deps.inline` + alias for `@zxcvbn-ts/*` (see `vite.config.ts`). See `__tests__/setup/mocks/` for `createMockQueryChain`/`createMockDb`/`createMockR2Bucket`.
- **Suite routing:** unit `retry:0` isolate `true`; integration `retry:2` 10s; security `forks` `retry:0` 15s — see table; combined `reportOnly`.

## Commit & CI

- **Conventional Commits:** `<type>(<scope>): <description>` — types `feat, fix, docs, style, refactor, perf, test, chore`. Branch `feat/add-dark-mode`, `fix/oauth-redirect`, `chore/update-deps`.
- **PR:** title conventional; all CI checks pass (`pnpm run ci`); screenshots for UI changes.
- **Dependabot** (`.github/dependabot.yml`): daily `npm` (commit `chore(deps)`, label `dependencies`, 10 open-PR limit, minor/patch grouped `all-minor-patch`; majors not grouped) + `github-actions` (prefix `chore(ci)`, labels `ci`+`dependencies`).

| Job                 | Needs                                          | Command                                | Notes                                    |
| ------------------- | ---------------------------------------------- | -------------------------------------- | ---------------------------------------- |
| `quality`           | —                                              | `vp check`                             | lint+format+type via Vite+               |
| `type-check`        | —                                              | `pnpm run type-check`                  | `tsc --noEmit` (strict flags are errors) |
| `unit-tests`        | —                                              | `pnpm run test:unit --coverage`        | threads, retry 0                         |
| `integration-tests` | —                                              | `pnpm run test:integration --coverage` | retry 2, 10s                             |
| `security-tests`    | —                                              | `pnpm run test:security --coverage`    | forks, retry 0, 15s                      |
| `build`             | `quality+type-check+unit+integration+security` | `pnpm exec knip && pnpm run build`     |                                          |
| `ci-success`        | all 6 above (`if: always()`)                   | shell check `needs.*.result==success`  | **required gate**                        |

Workflow `.github/workflows/ci.yml`: triggers push+PR on `main`/`master`; `permissions: {contents:read}`; `concurrency` `${{github.workflow}}-${{github.ref}}` cancel-in-progress; **3 actions SHA-pinned** (`actions/checkout`, `pnpm/action-setup`, `actions/setup-node`) with `cache: pnpm` — no floating Vite+ setup tag.

- **knip** (`knip.jsonc`): `entry ["scripts/**/*.ts"]`; `project ["app/**","components/**","hooks/**","lib/**","worker/**","proxy.ts","instrumentation*.ts","global.d.ts"]`; `ignoreExportsUsedInFile:true`; `ignoreDependencies [cloudflare, postcss, tailwindcss, tw-animate-css, @tailwindcss/typography, oxlint]`.

## Runtime & Bindings

**Worker (`worker/index.ts`) — wraps vinext handler, adds:**

- **Scanner-probe short-circuit** (first in `fetch()`): `BLOCKED_PATHS = /(?:\.php$|^\/\.env|^\/\.git\/|^\/\.aws\/|^\/wp-|^\/xmlrpc\.php$|(?:^|\/)adminer(?:\/|$)|^\/config\.json$|application\.ya?ml$)/i` → bare `404` with `SECURITY_HEADERS` (anchored `xmlrpc`/`adminer` so `@xmlrpc` handle not blocked; also in `RESERVED_HANDLES`).
- **Queue consumer** (`CLICKFOLIO_PARSE_QUEUE`) + DLQ `clickfolio-parse-dlq`: each message `queueMessageSchema.safeParse`'d; **malformed → `ack()` discarded (never DLQ)**; processing throw → `isRetryableError`→`retry()`, else `ack()` discarded (only retry-exhausted hits DLQ). Parse queue `max_retries:3`; DLQ `max_batch_size:1, max_retries:0`. Consumer marks failed + DO notify + `sendAlert` then rethrows.
- **3 crons direct-call** (not HTTP self-fetch, ADR-0013) via `scheduled()` dispatching `controller.cron`; each guards missing binding (R2/Queue), whole switch try/catch, unknown `cron` → log. See cron table below.
- **WebSocket** `/ws/resume-status?resume_id=`: extracts JWT from `Cookie __session` or `Authorization: Bearer`, **JWKS-verifies** via `verifyClerkToken` (`@clerk/backend`), maps `sub→user.clerkId` row, checks resume ownership, forwards to DO `idFromName(resumeId)` with `X-Authenticated-User-Id` header.
- **Security headers:** every non-WS response spreads the single `SECURITY_HEADERS` from `lib/utils/security-headers.ts` (HSTS `63072000; includeSubDomains; preload` + `X-Content-Type-Options: nosniff` etc.).

**Bindings (`wrangler.jsonc`)**

| Binding                  | Type       | Name                     | Notes                                                                                |
| ------------------------ | ---------- | ------------------------ | ------------------------------------------------------------------------------------ |
| `HYPERDRIVE`             | Hyperdrive | PlanetScale Postgres     | `id 8132893bf32b4e0b8b1b7edc8dad16c1` → DB `clickfolio`; via `getDb(env.HYPERDRIVE)` |
| `CLICKFOLIO_R2_BUCKET`   | R2         | `clickfolio-bucket`      | via `lib/r2.ts`                                                                      |
| `CLICKFOLIO_PARSE_QUEUE` | Queue      | `clickfolio-parse-queue` | `max_batch_size:1, max_retries:3`, DLQ `clickfolio-parse-dlq` (`1,0`)                |
| `CLICKFOLIO_STATUS_DO`   | DO         | `ClickfolioStatusDO`     | hibernation WebSocket status (`ctx.storage`)                                         |
| `ASSETS`                 | Assets     | `dist/client`            | static assets                                                                        |

Compat `2026-01-22`, flags `nodejs_compat`, `global_fetch_strictly_public`; `workers_dev:true`, `preview_urls:false`; routes `clickfolio.me`/`www.clickfolio.me`; smart placement `mode:"smart"` (ADR-0014); **observability `enabled:true`, `logs:{enabled:true, persist:true, invocation_logs:true}`**, `logpush:false` (default).

| Cron            | Schedule       | Module                         | What it does                                                                                       |
| --------------- | -------------- | ------------------------------ | -------------------------------------------------------------------------------------------------- |
| R2 cleanup      | `0 2 * * *`    | `lib/cron/cleanup-r2.ts`       | delete expired temp R2 + retry `pending_r2_deletions`                                              |
| DB cleanup      | `0 3 * * *`    | `lib/cron/cleanup.ts`          | expired `upload_rate_limits` + `handle_changes>90d` in one transaction                             |
| Orphan recovery | `*/15 * * * *` | `lib/cron/recover-orphaned.ts` | re-queues `pending_claim` orphans + `waiting_for_cache` timeout; TOCTOU skip if `totalAttempts>=6` |

**Env vars — static `wrangler.jsonc:vars` (5):** `NODE_ENV:production`, `APP_URL:https://clickfolio.me`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:pk_live_…`, `AI_MODEL:openai/gpt-5.6-luna:nitro`, `AI_REASONING_EFFORT:medium`.
**Secrets** (`wrangler secret put` / `.dev.vars`): `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `PENDING_UPLOAD_SECRET`, `CF_AI_GATEWAY_ACCOUNT_ID|ID|CF_AIG_AUTH_TOKEN`, `CRON_SECRET`, `ALERT_CHANNEL|ALERT_WEBHOOK_URL`, Umami vars, `DISABLE_RATE_LIMITS` (ignored in prod). PostHog needs no Worker var (literals in `lib/analytics/config.ts`; source-map creds `POSTHOG_API_KEY|PROJECT_ID` only in local deploy env).
**Not Worker var:** `DATABASE_URL` (direct PlanetScale URL for drizzle-kit only).
Local `.dev.vars` auto-loaded by Vite; `.env.example` **6.3KB** (154 lines) is the template. `lib/cloudflare-env.d.ts` (cf-typegen, ~569KB) types a broader env (also `DISABLE_RATE_LIMITS`, `NEXT_PUBLIC_SITE_*`, `CLERK_*`, etc. — injected via secrets/local env, not wrangler vars).

## Data Model

**6 tables** `lib/db/schema/`: `user` (`auth.ts`), `resumes` (`resume.ts`), `site_data` (`site.ts`), `handle_changes`+`upload_rate_limits` (`rate-limit.ts`), `pending_r2_deletions` (`maintenance.ts`) + `relations.ts`.

**Conventions:** `timestamp(...,{withTimezone:true, mode:"string"})` → timestamptz in PG, ISO string in app; JSON cols `jsonb` (Drizzle auto serializes — no manual `JSON.parse`); `boolean` native; PKs `text` (nanoid/ `user_…`); enum-like `text` + TS union (no PG enum); `lib/types/database.ts` derives blob type from Zod, row types from `$inferSelect`.

**Identity:** `user.clerkId` `unique()` → Clerk `user_…`; imported users keep legacy `id` as `externalId`, new users use `clerkId` as both `id`+`clerkId`.

**FK CASCADE — data-loss footgun:**

- `site_data.resumeId→resumes.id cascade` + `site_data.userId→user.id unique cascade` → **deleting a `resumes` row CASCADE-deletes the user's `site_data` portfolio**.
- `resumes.userId`, `handle_changes.userId` cascade.
- `pending_r2_deletions` has **NO FK** to user (user already deleted when 2am cron retries R2).

**`user`:** `handle` unique, `email` unique, `clerkId` unique, `isAdmin bool default false`, `role` enum `student|entry_level|mid_level|senior|executive` (`roleSource ai|user`), `privacySettings jsonb default {"show_phone":false,"show_address":false,"hide_from_search":false,"show_in_directory":true}` must equal `DEFAULT_PRIVACY_SETTINGS_JSON` (`lib/utils/privacy.ts` — literal to avoid circular import). Denormalized `showInDirectory bool default true` + `user_show_in_directory_idx` — must stay synced with `privacySettings.show_in_directory` (dual-write in wizard/privacy routes).

**`resumes` status enum (6):** `pending_claim → queued → processing → completed | failed | waiting_for_cache` (default `pending_claim`). `parsedContent` (final jsonb) vs `parsedContentStaged` (raw AI, cleared on success); `errorMessage` vs `lastAttemptError` (`classifyQueueError().toJSON()`); `retryCount` (per-cycle) vs `totalAttempts` (monotonic); `fileHash` SHA-256 dedup.

**`site_data`:** 6 denormalized preview cols (`previewName/Headline/Location/ExpCount/EduCount/Skills`) written by `buildSiteDataUpsert()` (`lib/data/site-data-upsert.ts`) via `extractPreviewFields(content)` into `onConflictDoUpdate(target:userId)` (also filters `previewLocation` at read via `extractCityState`); `themeId` default `minimalist_editorial` nullable; `updatedAt notNull`, `lastPublishedAt` nullable.

**Access:** `getDb(env.HYPERDRIVE)` per-invocation; `db.transaction` for atomicity; `lib/data/resume.ts` fetchers use React `cache()` + `getDb`; stored content not re-validated with Zod on read (ADR-0022, saves 200–400ms).

- `POSTGRES_OPTIONS` tuned for Hyperdrive: `prepare:false` (no prepared statements), `fetch_types:false`, `max:5`, `idle_timeout:20`, `connect_timeout:10` — see `lib/db/index.ts:22`.
- `pending_r2_deletions` stores `{key, attempts}`; 2am cron retries `attempts<3` with exponential backoff; success deletes row.
- `handle_changes` indexes `userId` + `createdAt` (90d retention via `0 3` cron); `upload_rate_limits` composite `(identifier, window)`.
- `site_data` indexes `resume_id`, `updated_at`; `user` indexes `handle`, `clerkId`, `showInDirectory`.

## Auth

- Clerk Google OAuth; **no `@clerk/nextjs`**, no `middleware.ts` — `proxy.ts` exports both `proxy` and `default`.
- **3-layer gate:**

  1. **Edge `proxy.ts`:** cookie-presence-only on `protectedRoutes ["/dashboard","/edit","/settings","/waiting","/wizard"]` — checks `cookies.has("__session")` only, redirects `/` if missing; `__client` device cookie always present (even signed out) — never treat as session. No DB/JWKS here; `isProtectedRoute` not covering `/admin`/`/themes`.
  2. **Pages/RSC:** `getServerSession()` → redirect `/` if null; onboarding check deferred to page.
  3. **APIs:** `requireAuthWithMessage` (401 on fail) vs `requireAuthWithUserValidation` (404 when JWT valid but PG row missing — webhook lag/deleted; treat 404 as auth failure) via `lib/auth/middleware.ts`.

- **Webhook** `POST /api/webhooks/clerk` (Svix `CLERK_WEBHOOK_SECRET`): resolves user by `clerkId` then `externalId`; **no email fallback**. App-owned columns never written from webhook.
- **Wrappers** `withUser`/`withAdmin` (`lib/auth/wrappers.ts`) use inner-callback form (ADR-0002). **Admin** `requireAdminAuth()` re-reads `isAdmin` from DB every request (ADR-0006, immediate revoke).
- **Role vs admin:** `role` (career level 5 values) ≠ `isAdmin` boolean — never gate on `role`; AI overwrites `role` on re-parse.
- **Client:** `lib/auth/client.tsx` adapter `user.id = externalId ?? clerkId`; `<SignInButton mode="modal">` etc.

## API Contracts

**Toolkit (universal):** `createSuccessResponse(data, status?)` / `createErrorResponse(error, code, status, details?)` + `ERROR_CODES` spread the **single `SECURITY_HEADERS`** (`lib/utils/security-headers.ts`: HSTS `63072000; includeSubDomains; preload` + `X-Content-Type-Options: nosniff` etc.). Wrap every JSON response.

**Rate-limit:** IP SHA-256 hashed before storage (ADR-0017, GDPR); atomic `INSERT…SELECT` via `db.$client` (Hyperdrive forbids prepared statements). Limits: `HOURLY 10`, `DAILY 50` (upload), `HANDLE 100`, `3/24h` handle-change, `5/24h` `resume_upload` (authed claim). Validations fail open on DB error. See `lib/rate-limit/`.

| Route                                             | Method              | Auth                 | Invariant                                                                                                                                                                                                                                                             |
| ------------------------------------------------- | ------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/upload`                                     | POST raw            | anon                 | Requires `X-Filename` (400 if missing) + `Content-Length` (missing→411, mismatch→400); magic `%PDF-`/size check; IP limit with `X-RateLimit-Remaining-*`; sets HMAC `pending_upload` cookie (`PENDING_UPLOAD_SECRET`; missing→cookie omitted) via `SameSite=Strict`   |
| `/api/upload/pending`                             | GET/POST/DELETE     | anon                 | POST guards `validateRequestSize`+`readJsonWithLimit`; `R2.head` before signing; `sameSite:lax`                                                                                                                                                                       |
| `/api/resume/claim`                               | POST                | `requireAuth`        | **Double-claim guard before rate-limit** (`already_claimed` not 429); per-user `fileHash` cache→`completed`(`cached:true`) / in-flight `processing                                                                                                                    | queued`→`waiting_for_cache`; R2 `temp/→users/{uid}/{ts}/file`; enqueue parse; queue-publish fail leaves `pending_claim`for`*/15`cron re-queue; authed`5/24h`limit here not in`/upload` |
| `/api/resume/status`                              | GET                 | authed               | Virtual `waiting_for_cache` timeout `WAITING_FOR_CACHE_TIMEOUT_MS 10m` presented as `failed` (DB persisted only by cron); `pending_claim`→`processing` 15% via `lifecycle.statusPresentation()`; `can_retry` via `lifecycle.canRetryResume()`                         |
| `/api/resume/retry`                               | POST                | authed               | `lifecycle.checkRetryEligibility` (4 gates: total cap 429, permanent 400, status≠failed 400, manual cap 429; accepts virtual timeout as retryable); TOCTOU `WHERE status='failed' AND retryCount<2` (or `waiting_for_cache`) →409 on 0 rows; rollback on publish fail |
| `/api/resume/latest-status`                       | GET                 | authed               | Mirrors `/status` invariants (`statusPresentation`/`waitingForCacheTimedOut`/`canRetryResume`)                                                                                                                                                                        |
| `/api/resume/update` + `/api/resume/update-theme` | PUT/POST            | authed               | `resumeContentSchemaStrict` + `extractPreviewFields`; 404 if no `site_data`; theme validates `THEME_IDS`                                                                                                                                                              |
| `/api/wizard/complete`                            | POST                | authed               | `buildWizardCompleteSchema([...THEME_IDS])`; re-onboarding enforces `3/24h` handle_changes in same `db.transaction` (audit row); `user.handle+privacy+showInDirectory+onboardingCompleted` + siteData upsert; `23505→409`                                             |
| `/api/profile/handle`                             | PUT                 | authed               | Counts `handleChanges` 24h (`>=3→429`); atomic `update handle + insert handleChanges`; `23505→409`; `old_handle` snake_case                                                                                                                                           |
| `/api/profile/privacy`                            | PUT                 | authed               | Dual-writes `privacySettings` jsonb + `showInDirectory`                                                                                                                                                                                                               |
| `/api/profile/me`                                 | GET                 | authed               | `{id,name,email,image,handle,headline,privacySettings(parsed),onboardingCompleted,role,roleSource,isAdmin,createdAt,updatedAt}`                                                                                                                                       |
| `/api/webhooks/clerk`                             | POST                | Svix                 | `clerkId→externalId`, no email fallback (see Auth)                                                                                                                                                                                                                    |
| `/api/account/delete`                             | POST                | authed               | Requires `confirmation===email` (case-insensitive); order `pendingR2Deletions` (failed→record) → Clerk `users.deleteUser(clerkId)` (404 tolerated else 503) → local `DELETE user` (cascade)                                                                           |
| `/api/handle/check`                               | GET                 | —                    | **Ordering: validate→rate-limit→DB→auth-cost**. Invalid/reserved (`RESERVED_HANDLES`)→`{available:false,reason:'reserved'}` without DB/limiter; valid→IP limit; available→return zero auth cost; only if taken resolve session to distinguish `isCurrentHandle`       |
| `/api/admin/*`                                    | GET                 | `withAdmin`          | `stats                                                                                                                                                                                                                                                                | users                                                                                                                                                                                  | resumes           | analytics`; not rate-limited; `PAGE_SIZE 25`; `escapeLikePattern`+`LIKE ESCAPE '\'`; `analytics ?period=7d | 30d | 90d`cache`private 30/60` |
| `/api/analytics/stats`                            | GET                 | authed               | Proxies Umami; aggregates current handle + up to 3 old handles from `handleChanges` (no orderBy → oldest 3; double-counts uniqueVisitors)                                                                                                                             |
| `/api/cron/*`                                     | GET                 | Bearer `CRON_SECRET` | `cleanup                                                                                                                                                                                                                                                              | cleanup-r2                                                                                                                                                                             | recover-orphaned` |
| `/api/health`                                     | GET `force-dynamic` | —                    | Checks Postgres `SELECT 1`, R2 `list`, AI gateway config presence; 200 `healthy`/503/`degraded` + `latencyMs`                                                                                                                                                         |
| `/api/og/home` + `/api/og/[handle]`               | GET                 | —                    | Branded PNG `1200×630` via `@cf-wasm/resvg` (`Resvg.async(svg,{fitTo:{mode:'width',value:1200}}).render().asPng()`); `max-age:604800`; handle OG falls back to lastResort on resvg fail                                                                               |

Shared infra: `rewrites /sitemap.xml→/api/sitemap-index`, `redirects /:handle→/@handle 308` (`next.config.ts`); sitemap/cron/og not rate-limited.

## Request Lifecycle & Realtime

1. **Edge `proxy.ts`:** `__session` presence check → redirect `/` or `NextResponse.next()`.
2. **Worker `worker/index.ts`:** scanner-probe → WS `/ws/resume-status` (JWKS) → queue/cron → vinext.
3. **Page/API:** `getServerSession()` / `requireAuth*` → `getDb(env.HYPERDRIVE)` → Drizzle.

**State machine (6 statuses, default `pending_claim`):** `pending_claim → queued → processing → completed | failed` with alt branches `waiting_for_cache` (in-flight dup at claim time) and `completed` (cache hit at claim time). Transitions via `lib/resume/lifecycle.ts`.

**6-step flow:** anon upload (`temp/{uuid}/{file}` + signed cookie) → auth → claim (`pending_claim` + fileHash dedup + R2 move + enqueue) → waiting (`waiting_for_cache`/`queued` 30%/25% or `processing` 50%) via WS/poll → consumer transaction (AI parse → `completed` 100% + siteData upsert or `failed` 0% + DO `failed` notify) → failure: orphan `pending_claim` re-queued by `*/15` cron, timeout virtual→durable via cron.

**Cron table:** see Runtime section (3 crons, all direct-call, binding guards, try/catch).

**Realtime DO:** `ClickfolioStatusDO` uses **hibernation WebSocket** + `ctx.storage` (not SQL API) + 30s alarm cleanup; shared transport `lib/realtime/socket.ts`; `WS_MAX_RECONNECT 3`; best-effort `notify` + `alert` (`logpush` default / `webhook`); fallback to poll on WS fail. Client hooks: `useResumeWebSocket` / `useResumeStatus`.

## AI Parsing Pipeline

**State machine invariants** above; single owner `lib/resume/lifecycle.ts` (`INFRA`, `RETRY_LIMITS`, `WAITING_FOR_CACHE_TIMEOUT_MS 10m`, `statusPresentation`, `canRetryResume`/`checkRetryEligibility`).

**Progress %:** `pending_claim 15`, `queued 25`, `waiting_for_cache 30` (or virtual `failed`), `processing 50`, `completed 100`, `failed 0`.

**Retry caps:** `RETRY_LIMITS`: manual `2`, total `6`; **5 permanent error types** (non-retryable) + **`unknown` non-retryable** (`ack` discarded, never DLQ, ADR-0012); retryable keeps `processing` (ADR-0011). Queue `max_retries 3` for transient.

**Queue contract:** `queueMessageSchema` (`resumeId`, `userId`, `fileHash`, etc.) validated on publish + consume; helper `publishToParseQueue`; consumer `lib/queue/consumer.ts` does `db.transaction` atomic resume update + siteData upsert; malformed→discarded, `isRetryableError→retry()` else `ack`.

**AI seam:** `lib/ai/` lazy-imports; `unpdf` extract (50 pages / 5 MB / 60k truncation) → AI SDK (OpenRouter via `CF_AI_GATEWAY_*`) → `normalizeResumeContent` with Zod; provider routed via gateway; notifications best-effort.

**Failure handling:** consumer writes `lastAttemptError=classifyQueueError().toJSON()` + increments `retryCount`/`totalAttempts`; permanent→`failed` else stays `processing` for retry; `sendAlert` on permanent; DLQ handler (`clickfolio-parse-dlq`) logs structured `DLQ_ALERT`.

**Orphan recovery (`*/15`):** scans `pending_claim` >5m or `processing` stale >15m; re-queues if `totalAttempts<6` (TOCTOU `WHERE totalAttempts<6` else skip); `waiting_for_cache` timeout persists via `buildWaitingForCacheTimeoutUpdate()`.

## User Flows & Templates

**Wizard (`app/(protected)/wizard`) — 5 steps if `needsUpload`, 4 if has resume:**

Order: needs `onboardingCompleted` check → if true short-circuit to `/dashboard` _before_ claim logic; else `pending_claim→waiting_for_cache/completed` branches; claim → `processing`/`queued`→`/waiting`. **Waiting** (`/waiting`) shows progress via WS/poll; error-fallback after 35s → offers return to wizard → retry.

**Dashboard (`/dashboard`):** `getServerSession()` → if not `onboardingCompleted` redirect `/wizard`; `RealtimeStatusListener` opens WS only on `processing|queued` (not `pending_claim`).

**Edit (`/edit`):** autosave 3000ms debounce via `resumeContentSchemaStrict` + `extractPreviewFields` denorm; `beforeunload` guard; optimistic local state.

**Render modes:** `force-dynamic` (dashboard, edit, settings, waiting, wizard) vs ISR `3600` (home, `[handle]`), `86400` (blog, `for/`), `300` (`/explore`), `604800` (`/api/og/home`).

**Error levels (4):** `error.tsx` boundaries per segment + `captureAnalyticsError` (`lib/analytics/error.ts`) for client/server; `not-found.tsx` for 404.

**Profile (`/@handle`):** `decode` + `formatHandle` + `hide_from_search` → `robots noindex` (not 404) via `notHiddenFromSearch` filter.

**Templates — 10 free themes:**

`THEME_IDS = [bento, bold_corporate, classic_ats, design_folio, dev_terminal, glass, midnight, minimalist_editorial, neo_brutalist, spotlight]`; `THEME_METADATA` (`preview /previews/*.webp` — note `minimalist_editorial→minimalist.webp`, `neo_brutalist→brutalist.webp` intentional shortenings); `DEFAULT_THEME minimalist_editorial`; `themeToShareVariant` maps underscore→kebab; `DYNAMIC_TEMPLATES` + `TEMPLATE_LOADERS` + `DEMO_RESUME` + 4 `cva` Maps.

**8-step update checklist** (compressed): `THEME_IDS` → `THEME_METADATA` (+ preview) → `themeToShareVariant` → `TEMPLATE_LOADERS`/`DYNAMIC_TEMPLATES` → `DEMO_RESUME_DATA` → 4 variant Maps + `public/previews/*.webp` (Playwright thumb) → `Record<ThemeId,…>` guard ensures compile fail if out of sync → `registry-sync.test.ts` + `theme-id-consistency.test.ts` assert file ↔ metadata ↔ loader sync; live preview `1280px` at `/preview/[id]`.

- **Public assets:** `public/brand/` icons used by `BrandIcons.tsx`; `public/previews/` holds 10 `.webp` thumbnails; source `public/icon.svg` drives `generate:favicons`.
- **Drizzle config:** `drizzle.config.ts` dialect `postgresql`, schema `lib/db/schema/index.ts`, out `migrations_pg`; `global.d.ts` declares `Window.__clickfolioOwner` + `vite-plus/test` jest-dom augmentation.
- **Hooks:** `hooks/useFileUpload.ts` (upload state), `useResumeWebSocket.ts` (WS with reconnect), `useResumeStatus.ts` (poll fallback), `useDismissable.ts`, `useCopyToClipboard.ts`.
- **Instrumentation:** `instrumentation.ts` (server) + `instrumentation-client.ts` (PostHog `init` + autocapture) — see `lib/analytics/`.

## Design Decisions (ADR Index)

Each decision + why is an ADR under `docs/adr/`. `_5 superseded (D1/Better Auth/password — 0003,0004,0007,0015,0019) — see git history`._

| ADR                                                              | Decision                                                                |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [0001](docs/adr/0001-hsts-preload.md)                            | HSTS `preload` site-wide (2yr `63072000` `includeSubDomains` `preload`) |
| [0002](docs/adr/0002-inner-callback-auth-wrapper.md)             | Auth wrappers use inner-callback form (vinext route detection)          |
| [0005](docs/adr/0005-proxy-cookie-presence-only.md)              | `proxy.ts` presence-only (no DB on edge)                                |
| [0006](docs/adr/0006-admin-reads-isadmin-from-db.md)             | Admin re-reads `isAdmin` from DB every request                          |
| [0008](docs/adr/0008-resume-complete-single-batch.md)            | Resume complete atomic `db.transaction`                                 |
| [0009](docs/adr/0009-pending-r2-deletions-before-batch.md)       | `pendingR2Deletions` before delete batch, no user FK                    |
| [0010](docs/adr/0010-filehash-cache-per-user.md)                 | fileHash dedup per-user (no cross-user leak)                            |
| [0011](docs/adr/0011-retryable-errors-keep-processing.md)        | Retryable keeps `processing` (no false-negative failed)                 |
| [0012](docs/adr/0012-unknown-queue-error-non-retryable.md)       | `unknown` queue error non-retryable (acked discarded)                   |
| [0013](docs/adr/0013-cron-called-directly.md)                    | Cron direct-call in worker (avoid double-billing)                       |
| [0014](docs/adr/0014-smart-placement.md)                         | Smart placement `mode:"smart"`                                          |
| [0016](docs/adr/0016-stubs-for-cf-incompatible-packages.md)      | Stubs for CF-incompatible (`@vercel/og`, `zod/v3`)                      |
| [0017](docs/adr/0017-ip-addresses-sha256-hashed.md)              | IPs SHA-256 hashed (GDPR)                                               |
| [0018](docs/adr/0018-claim-check-pending-upload-cookie.md)       | Claim-check pending_upload signed cookie                                |
| [0020](docs/adr/0020-theme-ids-zero-component-import.md)         | `theme-ids.ts` zero component import                                    |
| [0021](docs/adr/0021-related-profiles-avoids-order-by-random.md) | `getRelatedProfiles` avoids `ORDER BY random()`                         |
| [0022](docs/adr/0022-public-reads-skip-zod-revalidation.md)      | Public reads skip Zod re-validation (trusted, 200–400ms saved)          |
| [0023](docs/adr/0023-env-detection-keys-off-app-url.md)          | Env detection keys off `APP_URL` not `NODE_ENV`                         |
| [0024](docs/adr/0024-planet-scale-postgres-clerk-cutover.md)     | PG via Hyperdrive + Clerk cutover (D1/Better Auth dropped)              |
| [0025](docs/adr/0025-hyperdrive-client-per-invocation.md)        | Hyperdrive clients per-invocation, never cached                         |

## Gotchas

- **Single `SECURITY_HEADERS`** from `lib/utils/security-headers.ts` (HSTS `63072000` preload + nosniff etc.) — editing one constant covers worker + all API responses (issue #172). CSP+HSTS origin is `next.config.ts:headers()` (see `vite.config.ts:127` comment — not duplicated here).
- **`(protected)/layout.tsx` does NOT gate auth** — each page calls `getServerSession()` + `redirect("/")` itself. `/themes` relies only on its own page check.
- **`proxy.ts` presence-only:** forged `__session` passes edge; `/admin` + `/themes` not in `protectedRoutes`.
- **`__session` vs `__client`:** Clerk sets `__session` only when signed in; `__client` always exists — never treat as session.
- **`requireAuthWithUserValidation` → 404 not 401** when JWT valid but PG row missing (webhook lag/deleted) — treat 404 as auth failure.
- **`getServerSession()` vs `requireAuthClerk()`:** pages use former (`lib/auth/session.ts`), APIs use latter via `lib/auth/middleware.ts` — don't mix.
- **Webhook no email fallback:** resolves `clerkId` → `externalId` only; app-owned cols never written from webhook.
- **`getEnvValue()` throws** if required var missing (e.g. `PENDING_UPLOAD_SECRET`) — check `.dev.vars` / `wrangler secret put`.
- **`showInDirectory` ≠ `hide_from_search`:** `/explore` filters `user.showInDirectory`; sitemap filters `privacySettings->>'hide_from_search'`; dual-write required.
- **`role` ≠ `isAdmin`:** `role` is career enum 5 values; admin is `isAdmin` bool — never gate on `role`.
- **`waiting_for_cache` not first state:** start is `pending_claim`; `waiting_for_cache`/`completed` are claim-time branches.
- **`lifecycle.canRetryResume` / `checkRetryEligibility` is sole owner** of retry eligibility — don't re-implement; `QueueError` JSON never parsed outside lifecycle.
- **`db:push` skips migration files** — canonical is `db:generate` + `db:migrate`; drizzle-kit needs `DATABASE_URL`.
- **Blog 1:1:** `lib/blog/posts.ts` `BLOG_POSTS` 17 entries ↔ `app/blog/<slug>/page.tsx` 17 folders + `public/llms-full.txt`; `getPostBySlug("<slug>")!` at module scope throws at build if desynced; `seo-assets.test.ts` guards `llms.txt`.
- **`preview/[id]` is demo-data only:** no auth, no DB; `revalidate 604800` (7d); don't use for real user data.
- **`__tests__/setup.ts` crypto is deterministic:** `randomUUID` sequential, `sign` pseudo-HMAC — don't assert exact signature values as crypto-valid.
- **`vite.config.ts` `lint` + `fmt` share 14 ignores:** see `vite.config.ts:127`; staged hook auto-fixes `*.{ts,tsx,js,jsx,json,css}` via `vp check --fix`.

## SEO & Blog

- **JSON-LD:** always `serializeJsonLd()` from `lib/seo/json-ld.ts` before embedding (XSS-safe). Per-route `buildPublicPageMetadata` (`lib/seo/page-metadata.ts`) must set `openGraph` + `twitter` (`summary_large_image`) itself; root layout has no default OG image (Next.js merges).
- **Sitemap** (`lib/seo/sitemap.ts`): `URLS_PER_SITEMAP 50000`; `STATIC_SITEMAP_ENTRY_COUNT = 7 + PROFESSIONS.length(6) + BLOG_POSTS.length(17)` (7: home, privacy, terms, explore, blog, about, faq) — keep accurate or shard 0 over/under-fills. Shard 0 = static + first `50000-STATIC_COUNT` users; shard N>0 = 50000 users offset. Filter `notHiddenFromSearch`: `handle IS NOT NULL AND (privacySettings->>'hide_from_search' IS NULL OR = 'false')` (jsonb). `lastModified = lastPublishedAt||siteData.updatedAt||user.updatedAt`; `<7d`→`daily` else `weekly`.
- **Blog 2-file rule** (both required): (1) add `BlogPostMeta` to `BLOG_POSTS` (`slug, title, description, date, readTime, category, keywords, faq`); (2) create `app/blog/<slug>/page.tsx` with `const post=getPostBySlug("<slug>")!` at module scope, `revalidate=86400`, `relatedPosts=[slugs].map(getPostBySlug).filter(Boolean)`, `generateMetadata` via `buildBlogPostMetadata`. Also hand-update `public/llms.txt` + `public/llms-full.txt` or `__tests__/unit/app/seo-assets.test.ts` fails.
- **Roles `app/for/<slug>` (6):** `revalidate 86400`; slugs must match `lib/config/professions.ts` `PROFESSIONS` (homepage grid + sitemap). Note `PROFESSIONS` ↔ `sitemap` ↔ `for/` sync.
- **Robots** (`app/robots.ts`, `MetadataRoute.Robots`): base `getPublicSiteUrl()` (`APP_URL||https://clickfolio.me`); `*` `Allow /` + `/api/og/` and `Disallow /admin /dashboard /edit /preview /settings /waiting /wizard` (not `/api/`). Per-AI-crawler groups (`GPTBot`, `ChatGPT-User`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `GoogleOther`) Allow `/, /explore, /blog` + copy Disallow list (named groups don't inherit `*`). `/for/` + `/blog/*` indexable.
- **URL divergence:** sitemap/robots/manifest derive from `getPublicSiteUrl()` (`APP_URL`); JSON-LD/canonical use hardcoded `siteConfig.url` (`https://clickfolio.me`) — intentional for SEO stability across preview deploys.
- **Guard tests:** `theme-id-consistency.test.ts`, `seo-assets.test.ts`, `registry-sync.test.ts`.
- **Sitemap guards:** `STATIC_SITEMAP_ENTRY_COUNT` must stay accurate; `seo-assets.test.ts` asserts `llms.txt` keywords + `llms-full.txt` contains every `BLOG_POSTS` slug+title and every `/for/<slug>` path — hand-update both files on new post/profession.
- **Manifest:** `app/manifest.webmanifest` coral `theme_color #d94e4e` + `background_color #fdf8f3`; matches `app/layout.tsx` viewport `#fbfaf9`/`#121211`. No stale blue.

## Agent Skills

- **Issues:** GitHub Issues `Divkix/clickfolio.me` via `gh` CLI — see `docs/agents/issue-tracker.md`.

## Vite+

Using Vite+ (`vp`). `vp <name>` is builtin, `vp run <name>` runs `package.json`/`vite.config.ts` script. `vp help`, `vp toolchain`, `vp why <pkg>`. Docs in `node_modules/vite-plus/docs` or https://viteplus.dev/guide/.

- `vp install` after pull; `vp check` + `vp test` to validate; `vp env doctor` if runtime looks wrong; see `vite.config.ts` for tasks.
- `pnpm-workspace.yaml` catalog `vite: npm:@voidzero-dev/vite-plus-core@^0.3.0` + overrides `@vitest/coverage-v8:4.1.11` / `@voidzero-dev/vite-plus-core:^0.3.0`; `supportedArchitectures` linux+darwin x64/arm64 glibc.
- `instrumentation-client.ts` + `next.config.ts` `allowedDevOrigins *.ngrok-free.app` + `serverActions.bodySizeLimit 5mb` (derived from `MAX_UPLOAD_SIZE_MB`).
- `prepare` = `vp config`; `clean` removes `.next`/`dist`; `preview` uses `wrangler dev` with `HYPERDRIVE` local binding via `.dev.vars`.
