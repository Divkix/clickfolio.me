# Repository Guidelines — clickfolio.me

> **clickfolio.me** turns a PDF resume into a hosted web portfolio (`yoursite.com/@handle`) in under 60 seconds: upload a PDF → AI parses it → get a shareable link. Runs entirely on Cloudflare Workers (D1, R2, Queues, Durable Objects, Email Workers, KV).

## Maintaining This File

This file is **not** auto-generated. When you make changes that affect anything
documented here — build pipeline, scripts, env vars, routes, key systems,
dependencies, directory layout, or code-style rules — update the relevant
section in the same change so it stays accurate. `AGENTS.md` is a symlink to
this file, so edit `CLAUDE.md`.

## How to read & maintain this file

**This file is the single source of truth for how clickfolio.me works.** An agent reading it once should understand the structure, runtime, CI, data flows, the key user-facing flows, and the _why_ behind major decisions. Read it top-to-bottom before touching unfamiliar code.

**MAINTENANCE PROTOCOL (mandatory).** When you discover a new important fact, decision, constraint, or gotcha while working — or you find something here that is now wrong — you **MUST** update `CLAUDE.md` (the real file; `AGENTS.md` is a symlink to it) in the same change. Rules:

- **Record it in the correct existing section** (don't bolt on a new "Notes" blob).
- **Consolidate, don't append.** Merge with related content, dedupe, fix contradictions, keep each section coherent. Prefer rewriting a line over adding a near-duplicate.
- **Be specific.** Use exact file paths, function names, env var names, and bindings.
- **Fix, don't stack.** If a statement is now inaccurate, replace it; do not leave the old claim alongside the new one.
- Keep it dense and scannable (tables, short bullets, command blocks). Don't pad.

If a decision's rationale isn't obvious from code, capture the _why_ as a new numbered ADR under `docs/adr/` and add a one-line row to the index in **Design decisions & rationale**.

## Stack

| Layer           | Technology                                                                                                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime         | Cloudflare Workers                                                                                                                                                                                                      |
| Framework       | [vinext](https://github.com/cloudflare/vinext) (Vite-based Next.js — NOT standard Next.js) `^0.2.0` (on Next `^16`, React `^19.2`)                                                                                      |
| Toolchain       | Vite+ (`vp`) — `vite-plus@0.2.1` direct dep; `vite` is an npm-alias to `@voidzero-dev/vite-plus-core@0.2.1` (forced via package.json `overrides`); `vitest` is a regular dep `^4.1.9` pinned to `4.1.9` via `overrides` |
| Package manager | `pnpm` (pinned `pnpm@11.10.0` via `packageManager`)                                                                                                                                                                     |
| DB              | Cloudflare D1 + Drizzle ORM (SQLite)                                                                                                                                                                                    |
| Auth            | Better Auth (Google OAuth + email/password)                                                                                                                                                                             |
| AI parsing      | OpenRouter via Cloudflare AI Gateway (`openai/gpt-oss` models) + `unpdf` + Vercel AI SDK                                                                                                                                |
| Storage         | Cloudflare R2 (`CLICKFOLIO_R2_BUCKET`)                                                                                                                                                                                  |
| Queue           | Cloudflare Queues (`CLICKFOLIO_PARSE_QUEUE`) + DLQ                                                                                                                                                                      |
| Realtime        | Cloudflare Durable Objects (`ClickfolioStatusDO`) over WebSocket                                                                                                                                                        |
| Email           | Cloudflare Email Workers (`EMAIL` binding)                                                                                                                                                                              |
| Styling         | shadcn/ui (new-york, `rsc:true`, lucide) + Tailwind CSS 4 (PostCSS-only, no `tailwind.config`)                                                                                                                          |
| Validation      | Zod (v4 throughout)                                                                                                                                                                                                     |
| Lint/format     | Oxlint + Oxfmt via `vp check` — NOT Biome/ESLint/Prettier                                                                                                                                                               |
| Testing         | Vitest (via `vite-plus/test`) + jsdom + @testing-library/react                                                                                                                                                          |

## Project Structure

```
app/                        # vinext App Router
  page.tsx                  # Home page (root level, NOT inside any group) — ISR revalidate 3600
  [handle]/                 # Public profile viewer (/@handle — root level, NOT in (public)/) — ISR 3600
  (public)/                 # verify-email/ only
  (protected)/              # dashboard, edit, settings, waiting, wizard, themes
                            #   NOTE: the group LAYOUT does not gate auth — each page self-gates
                            #   layout.tsx sets group-wide metadata.robots: noindex,nofollow
  (admin)/admin/            # Admin-only: analytics, referrals, resumes, users (requireAdminAuth())
                            #   ONLY the layout gates auth; the 4 sub-pages are "use client", no own gate
  api/                      # API routes (see API Routes section)
  blog/                     # Static blog pages — 17 hardcoded route folders, not DB-driven — ISR 86400 (list page too)
                            #   (lib/blog/posts.ts BLOG_POSTS lists 17 entries; 1:1 with route folders)
  for/                      # SEO landing pages by role (6: software-engineer, designer, ...) — ISR 86400
  explore/                  # Single static explore page (lists users where showInDirectory=true) — ISR 300
  preview/[id]/             # Demo-data-only template preview (noindex, ISR 7d) for thumbnail script
  privacy/                  # Privacy policy
  terms/                    # Terms of service
  reset-password/           # Password reset flow
components/
  ui/                       # shadcn/ui components
  templates/                # 10 resume templates
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
  templates/                # Theme registry (server + client variants) + theme-ids data module
  password/                 # HIBP check + zxcvbn strength (client-side only)
  seo/                      # JSON-LD schema generation + sitemap helpers
  data/                     # DB-layer data access functions
  config/                   # App-wide constants (site, retry, FAQ, professions, author)
  types/                    # Shared TypeScript types
  utils/                    # Sanitization, security headers, pending-upload cookie, env helpers, log
  stubs/                    # Module stubs for CF Workers-incompatible packages
  umami/                    # Umami analytics client
  blog/                     # Blog post data (posts.ts) + fetching utilities
  r2.ts                     # R2 upload/download helpers
  referral.ts               # Referral code system
  cloudflare-env.d.ts       # Auto-generated (cf-typegen) — do not edit
worker/index.ts             # Real entrypoint — wraps vinext + Queue + Cron + WebSocket
proxy.ts                    # vinext proxy (cookie-presence-only auth check, NO D1 access)
__tests__/                  # Tests (see Testing section)
migrations/                 # D1 database migrations
scripts/                    # Utility scripts (deploy, seed, thumbnails, favicons, migrate-prod)
```

## Build, Test & Dev Commands

```bash
# Development
pnpm run dev              # vp dev --port 3000 (Vite+ dev server on :3000)
pnpm run preview          # vp build && pnpm exec wrangler dev (local CF Workers preview)
pnpm run start            # vp preview
pnpm run clean            # rm -rf .next dist (clear build artifacts)

# Type checking & quality
pnpm run type-check       # tsc --noEmit
pnpm run lint             # vp lint (Oxlint)
pnpm run fix              # vp check --fix (auto-fix lint + format)
vp check                 # lint + format + type-check (all at once)

# Testing
pnpm run test             # ALL test files (vp test run, no --config → vitest.config.ts, retry:2/threads)
pnpm run test:unit        # unit suite (vp test run --config vitest.unit.config.ts)
pnpm run test:integration # integration suite (--config vitest.integration.config.ts)
pnpm run test:security    # security suite (--config vitest.security.config.ts)
pnpm run test:coverage    # combined coverage, 80% gate (vp test run --coverage → vitest.config.ts)
pnpm run test:watch       # interactive watch mode (vp test)
pnpm run test:ui          # Vitest browser UI (vp test --ui)
pnpm run test:ci          # vp test run --coverage --reporter=json (NOT wired into ci.yml)

# Build & deploy
pnpm run build            # vp build (vinext)
pnpm run build:worker     # alias for vp build (identical to build)
pnpm run analyze          # ANALYZE=true vp build → dist/stats.html (bundle visualizer)
pnpm run ci               # full CI: install + type-check + vp check + test + build
pnpm run deploy           # scripts/deploy.ts — thin `pnpm exec wrangler deploy` wrapper, NO build step

# Database
pnpm run db:generate      # drizzle-kit generate (create migration files)
pnpm run db:migrate       # wrangler d1 migrations apply clickfolio-db --local
pnpm run db:migrate:prod  # scripts/migrate-prod.ts (apply to production D1; destructive-SQL gate)
pnpm run db:push          # drizzle-kit push (schema only, no migration files — local prototyping only)
pnpm run db:reset         # rm -rf .wrangler/state/v3/d1 + re-run db:migrate (destructive, local-only)
pnpm run db:reset:local   # db:reset + db:seed:local
pnpm run db:seed:local    # seed local DB from scripts/seed-local.ts
pnpm run db:studio        # Drizzle GUI at :4984 (drizzle-kit studio --port 4984)

# Codegen & tooling
pnpm run cf-typegen       # regen lib/cloudflare-env.d.ts (wrangler types)
pnpm run generate:favicons # regen favicons from scripts/generate-favicons.ts
# (no npm script) pnpm run scripts/generate-thumbnails.ts — Playwright template thumbnails
```

`prepare` (runs on install) = `vp config`.

**Pre-push:** `pnpm run type-check && vp check && pnpm run test`

> **pnpm lockfile gotcha (`catalog:` refs + `--frozen-lockfile`).** In pnpm 11.10 an inconsistent state can leave the lockfile importer block storing the raw `specifier:'catalog:'` for `vite` and `vitest` even though `package.json` uses `catalog:` and `pnpm-workspace.yaml`'s `catalog:` block resolves to concrete versions. A fresh `pnpm install --frozen-lockfile` (or any consume-from-scratch environment like Cloudflare Pages' clean checkout) then fails with `ERR_PNPM_OUTDATED_LOCKFILE` citing `lockfile: catalog:, manifest: npm:@voidzero-dev/vite-plus-core@^0.2.2`. Repro: `rm -rf node_modules && pnpm install --frozen-lockfile`. Fix: `pnpm install --no-frozen-lockfile` once locally and commit the regenerated `pnpm-lock.yaml` (the importer block will then write the resolved specifier `npm:@voidzero-dev/vite-plus-core@^0.2.2` / `4.1.10`, and the now-empty top-level `catalogs:` block is dropped). A populated local `node_modules/.modules.yaml` can mask the bug, so always reproduce against a fresh `node_modules` before declaring the lockfile healthy. If recurring, inline the resolved versions in `package.json` directly to bypass `catalog:` entirely.

> **Note:** `db:push` skips migration files — use `db:generate` + `db:migrate` for the canonical path. `db:reset` is destructive and local-only. After `db:reset`, existing browser sessions point at deleted user rows — `requireAuthWithUserValidation()` will return **404** for them (see Common gotchas).

**Scripts detail (`scripts/`):**

- **`deploy.ts`** — thin wrapper: `spawnSync("pnpm", ["exec", "wrangler", "deploy", ...args])`, forwards CLI args + exit code. **No build step, no custom logic.** `pnpm run deploy` does NOT build first; run `pnpm run build` separately or rely on wrangler. No GitHub Actions deploy workflow exists — deploys are manual.
- **`migrate-prod.ts`** (`db:migrate:prod`) — (1) scans every `migrations/*.sql` for `/DROP\s+TABLE/i`, `/DELETE\s+FROM/i`, `/TRUNCATE\s+TABLE/i` and **hard-blocks (exit 1) unless `--force`** (`pnpm run db:migrate:prod -- --force`); (2) ALWAYS runs `wrangler d1 export clickfolio-db --remote --output=d1-backup-<ISO>.sql` first and aborts if backup fails; (3) `wrangler d1 migrations apply clickfolio-db --remote`. Rationale: on D1 `PRAGMA foreign_keys=OFF` may not persist across statements, so a `DROP TABLE` can fire `ON DELETE CASCADE` and wipe related tables.
- **`seed-local.ts`** (`db:seed:local`) — seeds **admin** user `test@example.com`/`password` into local D1 via `better-sqlite3` (raw INSERTs, bypassing Drizzle/Better Auth), `is_admin=1`, `email_verified=1`. Password hashed with `@noble/hashes` scrypt (N=16384, p=1, r=16, dkLen=64, format `salt:hex`) to match Better Auth. Idempotent (skips if email exists).
- **`generate-favicons.ts`** (`generate:favicons`) — reads `public/icon.svg` → `sharp` emits favicon-16/32, mstile-150, apple-touch-icon (180), icon-192/512 PNGs + multi-size `favicon.ico` (`png-to-ico`). Source of truth: `public/icon.svg`.
- **`generate-thumbnails.ts`** (no npm script — run directly) — Playwright (chromium, 1280×800, DSF 2) screenshots `${BASE_URL}/preview/<id>` for templates into `public/previews/*.png`. **Requires dev server running**; `BASE_URL` overrides `http://localhost:3000`. **STALE:** hand-maintained `TEMPLATES` array lists only 8 of 10 (missing `design_folio`, `dev_terminal`) and outputs `.png`, while `THEME_METADATA[id].preview` points at `/previews/<slug>.webp` (slug mismatches: `neo_brutalist`→`brutalist`, `minimalist_editorial`→`minimalist`).

## Coding Style & Conventions

- Double quotes, semicolons, trailing commas, 2-space indent, 100-char line width
- Formatter: Oxfmt (`vp fmt`); Linter: Oxlint (`vp lint`). Oxlint config lives in `vite.config.ts` `lint` block: plugins `["react","typescript","jsx-a11y","oxc"]`, `typeAware:true`+`typeCheck:true`, rules `vite-plus/prefer-vite-plus-imports:"error"`, `typescript/no-explicit-any:"warn"`, `typescript/no-unused-vars:"error"`, custom JS plugin `vite-plus/oxlint-plugin`. Both `fmt` and `lint` ignore `dist/**` and `lib/cloudflare-env.d.ts`.
- Lint suppression: `// eslint-disable-next-line <rule> -- <reason>` (not `biome-ignore`)
- **Staged files are auto-fixed** via a Vite+ native staged hook in `vite.config.ts`: `staged: { "*.{ts,tsx,js,jsx,json,css}": ["vp check --fix"] }` (not husky/lint-staged).
- **DB access**: always use `getDb(env.CLICKFOLIO_DB)` or the right session variant — never construct drizzle directly (see DB Session Variants). `getDb()` exposes `.$client` (raw D1) and returns `Database = DrizzleD1Database<typeof schema> & { $client: D1Database }`.
- **Session reads in pages/RSC**: always `getServerSession()` from `@/lib/auth/session` — never `getAuth().api.getSession()` directly (see Auth patterns)
- **API responses**: use `createSuccessResponse(data, status=200)` / `createErrorResponse(error, code, status, details?)` + the `ERROR_CODES` enum from `lib/utils/security-headers.ts` — never hand-roll `Response.json` (you'd lose per-response `SECURITY_HEADERS`).
- **Body-size guard** on write routes: call BOTH `validateRequestSize(request, 5_000_000)` (trusts `Content-Length`, 413) AND `readJsonWithLimit(request, 5_000_000)` (streams with a hard cap independent of Content-Length; returns `{ok:true,data}` | `{ok:false,reason:'too_large'|'invalid_json'}` → 413/400). See `lib/utils/validation.ts`.
- **Authed WRITE routes must call `await captureBookmark()`** after the D1 write, before returning (read-your-own-writes). Read-only authed routes do NOT.
- **Backend logging** (worker/queue/cron/DLQ): use `log(level, msg, fields)` from `lib/utils/log.ts` (one JSON line, field-queryable) — not bare `console.*`.
- Zod schemas in `lib/schemas/`; auth form validation in `lib/schemas/auth.ts`
- shadcn components in `components/ui/`, resume templates in `components/templates/`
- `lib/cloudflare-env.d.ts` is auto-generated — do not edit manually
- Use `<img>` tags, not Next.js `<Image />` (CF Workers constraint)
- TypeScript: `target ES2022`, `module esnext`, `moduleResolution: "bundler"`, `incremental`, `allowJs`, `skipLibCheck`, `isolatedModules`. Strict flags are **errors**: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`. `include` explicitly lists `global.d.ts` + `lib/cloudflare-env.d.ts`. `global.d.ts` declares `Window.__clickfolioOwner?: boolean` and the `vite-plus/test` jest-dom matcher augmentation (NOT a `vitest` augmentation).
- **New user profile field?** Add it in BOTH `lib/db/schema/auth.ts` (Drizzle column) AND `user.additionalFields` in `getAuth()` (`lib/auth/index.ts`) so Better Auth serializes it into the session.

## Testing Guidelines

Tests follow the trophy model. Four vitest config files exist — one per suite and one combined. **All test files import from `vite-plus/test`, NOT `vitest`** (`import { describe, it, expect, vi } from "vite-plus/test"`); `vitest` is a regular dep `"^4.1.9"` (pinned to `4.1.9` via `overrides`) providing the runner that the `vite-plus/test` wrapper re-exports. This is the #1 thing needed to write a test.

| Suite       | Command            | Config                         | Pool    | Retry | Isolate | Timeout | Coverage gate                             |
| ----------- | ------------------ | ------------------------------ | ------- | ----- | ------- | ------- | ----------------------------------------- |
| Unit        | `test:unit`        | `vitest.unit.config.ts`        | threads | 0     | true    | default | stmts/lines/fns: 20%, branches: 15%       |
| Integration | `test:integration` | `vitest.integration.config.ts` | default | 2     | —       | 10s     | stmts/lines: 34%, branches: 24%, fns: 27% |
| Security    | `test:security`    | `vitest.security.config.ts`    | forks   | 0     | —       | 15s     | stmts/lines: 20%, branches/fns: 15%       |
| Combined    | `test:coverage`    | `vitest.config.ts`             | threads | 2     | —       | default | **80% (CI gate)**                         |

> Suite selection is via the `--config` flag baked into each npm script. `test`/`test:coverage` pass NO `--config` → use `vitest.config.ts`, whose `include` is `**/__tests__/**/*.test.{ts,tsx}` (every file, regardless of "assigned" suite, at `retry:2`/`threads`). All four configs `exclude` `["node_modules",".next","dist","__tests__/e2e/**",".worktrees/**"]`.

**Retry/pool rationale:** unit `retry:0`+`isolate:true` (fast, deterministic, per-file isolation); integration `retry:2`+10s (tolerates timing flakiness); security `retry:0`+`pool:"forks"`+15s (process isolation between attack scenarios; zero retries so a regression can't be masked by a flaky re-run).

**Coverage `include` differs per suite** (denominators are NOT comparable across suites): unit = `lib/**`,`app/**`,`components/**` (also excludes `app/blog/**`,`app/for/**`); integration = `lib/**`,`app/api/**`,`worker/**` only; security = `lib/auth/**`,`lib/utils/**`,`app/api/**`,`lib/schemas/**`,`lib/rate-limit/**`. Common coverage excludes: `worker/**`, `lib/stubs/**`, `lib/db/migrations/**`, `**/__tests__/**`, `**/*.d.ts`.

**Test file locations & suite routing (explicit `include` globs):**

- `__tests__/unit/**`, `__tests__/integration/**`, `__tests__/security/**` — auto-picked by the suite's `<dir>/**/*.test.{ts,tsx}` glob.
- `__tests__/` (root-level `*.test.ts`) — must be **hard-coded** into the right config's `include` array or it runs ONLY in combined coverage. Current assignment (all 16 assigned, none in two suites):
  - **Unit:** privacy, profile-schema, resume-schema, sitemap, sync-disposable-domains, theme-id-consistency
  - **Integration:** claim-flow, referral, share, milestones
  - **Security:** idor-ownership, sanitization, disposable-email, password-strength, email-verification, claim-security-cookie
- `__tests__/e2e/` — has an `e2e/fixtures/` subdir but no active `.test` files; excluded from every run.

**Dominant test pattern — mock-then-dynamic-import:** declare top-level `vi.mock("<module>", () => ({...}))` (hoisted), then inside `it()` do `const { POST } = await import("@/app/api/.../route")` so the SUT loads AFTER the mocks. `vi.doMock` (used in upload-claim-parse.test.ts) is NOT hoisted, for per-test dynamic mocking. **Inline hand-rolled mocks are the norm** — only ~9 of 98 files import the shared `@/__tests__/setup/...` fixtures; match the inline style of the suite you're editing.

**Test infrastructure:**

- Global setup `__tests__/setup.ts` (applied to all 4 suites via each config's `setupFiles`): jest-dom matchers via `vite-plus/test`; a hand-rolled `globalThis.localStorage` (jsdom's localStorage can be unreliable in some Node.js runtimes); **overrides `globalThis.crypto`** with deterministic mocks; `beforeEach` clears localStorage + crypto mocks + `clearKeyCache()` from `lib/utils/pending-upload-cookie`.
- **Crypto mocks** `__tests__/mocks/crypto.ts` (sibling of `setup/`, NOT under `setup/mocks/`): `digest` does REAL hashing only for SHA-1/SHA-256 (delegates to `node:crypto`), other algos return a fake XOR hash; `randomUUID()` returns SEQUENTIAL ids `...0000000000NN` (module counter, only `.mockClear()`'d); `sign`/`importKey` produce a deterministic pseudo-HMAC embedding the secret — signatures are NOT cryptographically valid (SHA-256 hex output IS real).
- All 4 configs alias `cloudflare:workers` → `lib/stubs/cloudflare-workers-client-stub.mjs` (Node, not Workers). Tests needing `env` add `vi.mock("cloudflare:workers", () => ({ env: { ... } }))` to inject bindings.
- `vitest.config.ts` (combined) and `vitest.security.config.ts` set `server.deps.inline:[/@zxcvbn-ts\//]` + alias `@zxcvbn-ts/language-common`/`-en` to `dist/index.mjs` (zxcvbn-ts v4's CJS `main` has broken decompressor interop under Node require; password-strength tests live in the security suite). Touch if zxcvbn tests fail on import.
- **Shared fixtures/helpers (imported via `@/` root alias):**
  - `__tests__/setup/mocks/db.mock.ts` — `createMockQueryChain<T>(rows)` (Proxy chainable awaitable resolving to `rows`), `createMockDb()` (`{select,insert,update,delete}` each a `vi.fn()`), `createMockDbResume(overrides)` (full `Resume` row, status `completed`, ISO dates).
  - `__tests__/setup/mocks/r2.mock.ts` — `createMockR2Bucket(initialStore?)` → `{ bucket, store }`, Map-backed in-memory R2 (get/put/delete/head/list).
  - `__tests__/setup/fixtures/index.ts` — barrel re-exporting ONLY `createMockDb` + `createMockDbResume`.
  - `__tests__/setup/helpers/test-utils.ts` — `setupMockCleanup()` (afterEach restore+clear), `suppressConsole(method='error')`.
- **Auth-middleware mock contract:** `requireAuthWithUserValidation` resolves to `{ user, db, captureBookmark, dbUser, env, error }`; `requireAuthWithMessage` to `{ user, error }`. On auth failure return `{...all-null, error: new Response(...,{status:401}) }`; routes return `error` directly.
- **DB-mock chaining is fragile & per-query-shape:** match the route's exact drizzle call order (e.g. `from→where→orderBy→limit`). After `vi.clearAllMocks()` in `beforeEach` you MUST re-wire every chain return. Sequential same-shape queries can't be distinguished by one shared chain mock.

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
- All CI checks pass (`pnpm run ci`)

**Dependabot** (`.github/dependabot.yml`) runs **daily** for both `npm` (pnpm is detected via `pnpm-lock.yaml`; commit prefix `chore(deps)`, label `dependencies`, 10 open-PR limit, all minor/patch grouped into one `all-minor-patch` PR) and `github-actions` (prefix `chore(ci)`, labels `ci`+`dependencies`). Major bumps are NOT grouped.

## CI pipeline (deep)

Three workflows exist: `ci.yml`, `ai-review.yml` + `ai-review-commands.yml` (the latter two are the self-hosted AI PR reviewer, reusable workflows calling `divkix/ai-review/...@main`).

CI (`.github/workflows/ci.yml`) is **9 jobs**. The five primary jobs run **in parallel** (no inter-dependencies); only the downstream jobs have `needs`. `ci-success` is the single required gate. Workflow-level `permissions: { contents: read, pull-requests: write }`. `concurrency` group `${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true`. Triggers: push + PR on `main`/`master`. **All actions are pinned to full commit SHAs except `voidzero-dev/setup-vp@v1`** (floating tag); every checkout sets `persist-credentials: false`.

| Job                 | `needs`                                                         | Command (reproduce locally)                            | Gates / notes                                                                                                            |
| ------------------- | --------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `quality`           | —                                                               | `vp check` (via `pnpm install` + `pnpm exec vp check`) | Lint+format+type-check (Vite+). Uses `pnpm/action-setup` + `actions/setup-node` with `cache: pnpm`.                      |
| `type-check`        | —                                                               | `pnpm run type-check` (`tsc --noEmit`)                 | Strict TS flags are errors. `pnpm/action-setup` + `actions/setup-node` with `cache: pnpm`. Parallel.                     |
| `unit-tests`        | —                                                               | `pnpm run test:unit -- --coverage`                     | `pool:threads`,`retry:0`. Uploads `unit-coverage-report` → `coverage/unit/` (`if: always()`).                            |
| `integration-tests` | —                                                               | `pnpm run test:integration -- --coverage`              | `retry:2`,10s. Uploads `integration-coverage-report` → `coverage/integration/`.                                          |
| `security-tests`    | —                                                               | `pnpm run test:security -- --coverage`                 | `pool:forks`,`retry:0`,15s. Uploads `security-coverage-report` → `coverage/security/`.                                   |
| `coverage-summary`  | unit, integration, security                                     | (PR-only) `romeovs/lcov-reporter-action`               | **PR events only.** Downloads all 3 artifacts but feeds ONLY `coverage/unit/coverage.lcov` (title 'Unit Test Coverage'). |
| `coverage-gate`     | unit, integration, security                                     | `pnpm run test:coverage`                               | **Hard 80% gate** across lines/statements/functions/branches.                                                            |
| `build`             | quality, type-check, unit, integration, security, coverage-gate | `pnpm exec knip` + `pnpm run build`                    | Production build; `knip` fails on unused exports. Uses `pnpm/action-setup` + `actions/setup-node` with `cache: pnpm`.    |
| `ci-success`        | all 7 above (`if: always()`)                                    | shell check of each `needs.*.result`                   | **The required status check.** Fails if any upstream job != success.                                                     |

Because the test npm scripts already inject `--config vitest.<suite>.config.ts`, the trailing `-- --coverage` is appended to that. pnpm store cache key is managed by `actions/setup-node` with `cache: pnpm` (key derived from `pnpm-lock.yaml`).

**knip** (`pnpm exec knip`, `knip.jsonc`): `entry = scripts/**/*.ts` (NOT `app/` — imported by vinext at build time), `project = app/components/hooks/lib`. Ignores `components/blog/HighlightBlock.tsx` (dynamically imported by blog renderer), all of `lib/db/schema/**`, and `lib/db/schema/relations.ts` (redundant); `ignoreDependencies` = postcss, tailwindcss, tw-animate-css, @tailwindcss/typography, cloudflare; `ignoreExportsUsedInFile: true`. Adding a script that's only dynamically imported, or a new build-only tailwind/postcss dep, fails `pnpm exec knip` unless added here.

**Full local equivalent:** `pnpm run ci` (`pnpm install --frozen-lockfile && pnpm run type-check && vp check && pnpm run test && pnpm run build`). Run `pnpm run type-check && vp check && pnpm run test` before every push.

**Reproducing a CI failure:** run the single failing job's command above locally, fix root cause, rerun that command, then `pnpm run ci` before pushing.

## Architecture Notes

### Worker entry (`worker/index.ts`)

The real entrypoint. Wraps the vinext handler and adds:

- **Scanner-probe short-circuit** (FIRST thing in `fetch()`, before the WS block): a module-scope `BLOCKED_PATHS` RegExp matches obvious vuln-scanner paths (`*.php`, `/.env`, `/.git/`, `/.aws/`, `/wp-*`, `xmlrpc`, `adminer`, `/config.json`, `application.ya?ml`) and returns a bare `404` with `SECURITY_HEADERS` — skipping the full vinext/React 404 render (these were ~10% of fetch CPU). Kept deliberately narrow so `/@handle`, `/for/*`, `/api/*`, `/blog/*` never match.
- **Queue consumer** (`CLICKFOLIO_PARSE_QUEUE`) + **DLQ handler** (`clickfolio-parse-dlq`), detected via `batch.queue === INFRA.DLQ_NAME`. Every message is `queueMessageSchema.safeParse`'d; **malformed messages are `ack()`'d (DISCARDED — they do NOT go to DLQ)**. On a processing throw, `isRetryableError(error)` → `retry()`; otherwise `ack()` (lets Cloudflare's `dead_letter_queue` config route it to the DLQ). The parse queue has `max_retries:3`; the **DLQ is a SECOND consumer on the same worker with `max_batch_size:1, max_retries:0`** — a DLQ message that throws is dropped, not retried.
- **4 cron triggers** called **directly** (not via HTTP self-fetch — ADR-0013). Dispatched by `controller.cron` in `scheduled()`. Each case early-returns with an error log if its required binding is missing (R2 for `0 2`, KV for `0 4`, Queue for `*/15`); the whole switch is wrapped in try/catch (a throwing cron does NOT crash the worker); unknown expressions log `unknown cron trigger`.
  - `"0 2 * * *"` — R2 temp cleanup + pending-deletion retry (`lib/cron/cleanup-r2.ts`)
  - `"0 3 * * *"` — DB cleanup / expired sessions (`lib/cron/cleanup.ts` `performCleanup`)
  - `"0 4 * * *"` — disposable domain KV sync (`lib/cron/sync-disposable-domains.ts`)
  - `"*/15 * * * *"` — orphan resume recovery (`lib/cron/recover-orphaned.ts`)
- **WebSocket upgrade routing** (`/ws/resume-status`) → Durable Object. Regex-extracts the session token from the raw `Cookie` header (`/better-auth\.session_token=([^;]+)/`) as a **cheap presence pre-check only** — the real auth passes the FULL raw Cookie header to `auth.api.getSession({ headers })`. Verifies D1 resume ownership via `getSessionDbForWebhook` (`"first-primary"`, no cookies — _not_ `getDb`), then forwards to the DO (`idFromName(resumeId)`) injecting the `X-Authenticated-User-Id` header.
- **Security headers** injected on every non-WS response by **importing the single `SECURITY_HEADERS` constant from `lib/utils/security-headers.ts`** (also applied to the scanner-probe early-404 above). There is now exactly ONE such constant (issue #172): HSTS `max-age=63072000; includeSubDomains; preload` (**2yr WITH preload**, per ADR-0001), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 0`, `Referrer-Policy: strict-origin-when-cross-origin`, Permissions-Policy for camera/microphone/geolocation. The worker is the catch-all covering page routes that never pass through the API toolkit; because it applies the same object, "applied last" equals "applied first". The Content-Security-Policy itself originates in `next.config.ts` `headers()`, not here (see below).

### Cloudflare bindings (`wrangler.jsonc`)

| Binding                         | Type   | Name                                  | Notes                                                                                              |
| ------------------------------- | ------ | ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `CLICKFOLIO_DB`                 | D1     | `clickfolio-db`                       | `database_id 37cf1935-96c5-40c8-aa2e-0d0655f9b652`. Use via `getDb()` / session variants           |
| `CLICKFOLIO_R2_BUCKET`          | R2     | `clickfolio-bucket`                   | Use via `lib/r2.ts` helpers                                                                        |
| `CLICKFOLIO_DISPOSABLE_DOMAINS` | KV     | `id 6fe2480a4f4d46a9970eb2c441ecf38a` | Disposable email list (synced by cron, KV key `disposable-domains`)                                |
| `CLICKFOLIO_PARSE_QUEUE`        | Queue  | `clickfolio-parse-queue`              | `max_batch_size:1`, `max_retries:3`, DLQ `clickfolio-parse-dlq` (`max_batch_size:1,max_retries:0`) |
| `CLICKFOLIO_STATUS_DO`          | DO     | `ClickfolioStatusDO`                  | Hibernatable WebSocket parse status                                                                |
| `EMAIL`                         | Email  | `send_email`                          | Transactional email via CF Email Workers; sender: `noreply@clickfolio.me`                          |
| `ASSETS`                        | Static | `dist/client`                         | Static asset binding                                                                               |

**Compat:** `compatibility_date: "2026-01-22"`, `compatibility_flags: ["nodejs_compat","global_fetch_strictly_public"]`. `workers_dev: true` but `preview_urls: false` (intentionally disabled). Custom-domain routes (`clickfolio.me`, `www.clickfolio.me`) are kept in wrangler.jsonc specifically so CI/wrangler deploy does not remove them. **Smart placement** is on (`placement.mode: "smart"`; rationale in ADR-0014). **Observability at 100% head sampling** (`head_sampling_rate: 1` top-level + under `logs`, `persist: true`, `invocation_logs: true`).

**DO migration history** (all tags required when applying fresh): `v1 DOShardedTagCache` (SQLite-backed, `new_sqlite_classes`) → `v2 ResumeStatusDO` (`new_classes`/`deleted_classes`) → `v3` `renamed_classes` → `ClickfolioStatusDO`. ClickfolioStatusDO uses **`ctx.storage` (DO storage), NOT the SQL storage API**.

### Environment variables

**Static wrangler vars** (in `wrangler.jsonc`): `NODE_ENV: "production"`, `AI_MODEL: "openai/gpt-oss-120b:nitro"`

**Required secrets** (`wrangler secret put <name>`):

- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` — **`BETTER_AUTH_URL` is the single source of truth for the app URL** (used as `baseURL`, and by `isLocalEnvironment()`/`getPublicSiteUrl()`). `getEnvValue()` throws at `getAuth()` build time if it (or any Google/secret var below) is missing — breaking ALL auth routes for that isolate.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `CF_AI_GATEWAY_ACCOUNT_ID`, `CF_AI_GATEWAY_ID`, `CF_AIG_AUTH_TOKEN` (AI gateway via OpenRouter / BYOK)
- `CRON_SECRET` (protects `/api/cron/*` HTTP endpoints; `requireCronAuth` is fail-closed)
- Optional: `ALERT_CHANNEL` (`logpush | webhook`, default `logpush`), `ALERT_WEBHOOK_URL` (Slack/Discord-compatible on permanent queue failures), `DISABLE_RATE_LIMITS` (`'true'` bypasses limits — IGNORED in production), `MAX_UPLOAD_SIZE_MB` (default 5), `RATE_LIMIT_UPLOADS_PER_DAY` (default 5), Umami vars (`NEXT_PUBLIC_UMAMI_WEBSITE_ID`, `UMAMI_API_URL`, `UMAMI_USERNAME`, `UMAMI_PASSWORD`)

**Local dev:** a real **`.dev.vars`** file at repo root is auto-loaded by Vite (this is the live local secrets file). `.env.example` (4.9 KB) is the template.

### Build system notes

- **PostCSS/Tailwind:** NO `tailwind.config` — Tailwind CSS 4 is wired via `postcss.config.mjs` (`@tailwindcss/postcss`) + `app/globals.css`. `components.json`: style `new-york`, `rsc:true`, `tailwind.config:""`, css `app/globals.css`, baseColor neutral, cssVariables true, icon lucide.
- **CSP/HSTS** live in `next.config.ts` `headers()` (not just the worker constant). CSP allowlists `https://analytics.divkix.me` for `script-src`/`connect-src`, `https://accounts.google.com` for `connect-src`; `frame-src 'none'`, `object-src 'none'`, `frame-ancestors 'none'`. HSTS here = `max-age=63072000; includeSubDomains; preload`. `next.config.ts` also: `serverActions.bodySizeLimit` dynamic from `MAX_UPLOAD_SIZE_MB` (default `5mb`); `allowedDevOrigins` includes `*.ngrok-free.app`; `rewrites()` (sitemap) + `redirects()` (308 bare-handle).
- **Bundle analysis:** `ANALYZE=true pnpm run build` → `dist/stats.html` (rollup-plugin-visualizer, `open: true`)
- **Vendor chunks:** `@radix-ui` → `vendor-radix`, `react-hook-form` → `vendor-forms`, `better-auth` → `vendor-auth`. The client vendor-split plugin WRAPS vinext's `manualChunks` (rather than replacing it) to keep the main client bundle under 500 KB.
- **`cloudflare()` plugin** configured with `viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] }`.
- **`onwarn`** suppresses the Rollup `MISSING_EXPORT` warning for `"middleware"` imported from `proxy.ts` (vinext's virtual entry imports `middleware` even though only `proxy`/`default` are exported).
- **SSR aliases** (in `vite.config.ts`): `next/dist/compiled/@vercel/og/index.edge.js` → `lib/stubs/og-stub.js`; `@zxcvbn-ts/core` → `lib/stubs/zxcvbn-core-stub.mjs`, `@zxcvbn-ts/language-common` + `@zxcvbn-ts/language-en` → `lib/stubs/zxcvbn-lang-stub.mjs`; `zod/v3` → `lib/stubs/zod-v3-stub.mjs`; `cloudflare:workers` → `cloudflare-workers-client-stub.mjs`; `node:async_hooks`/`async_hooks` → `async-hooks-client-stub.mjs`
- **`optimizeDeps.exclude: ["lucide-react"]`** (lucide-react v1) — excluded from Vite pre-bundling
- **`ensureClientDir` plugin** — creates `dist/client/` before writeBundle (upstream vinext bug workaround)
- **`drizzle.config.ts`** is local-only: auto-discovers the miniflare SQLite at `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite` (first `.sqlite`, falls back to `.../local.sqlite`). `schema ./lib/db/schema/index.ts`, `out ./migrations`, dialect `sqlite`. There is NO prod credentials path — production migrations go exclusively through `scripts/migrate-prod.ts` + wrangler; drizzle-kit never touches remote D1.

### DB Session Variants (important — use the right one)

All in `lib/db/session.ts`. Using the wrong variant causes stale-read bugs, FK errors, or read-your-own-writes inconsistency.

| Function                           | When to use                                                                                                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getDb(env.CLICKFOLIO_DB)`         | Read-only or non-user-facing queries. **WeakMap-cached** per binding (once-per-isolate drizzle parse)                                                                               |
| `getSessionDbWithPrimaryFirst(d1)` | Authenticated page/API routes + immediately after user creation (`"first-primary"` — avoids FK errors before D1 replication); provides `captureBookmark()` for read-your-own-writes |
| `getSessionDbForWebhook(d1)`       | Queue consumers, cron handlers, WebSocket handlers (no cookies; `"first-primary"`, no bookmark)                                                                                     |

⚠️ The two session variants build a **FRESH `drizzle(session, {schema})` on every call** (each wraps a per-request `d1.withSession(...)`); they are NOT WeakMap-cached. Only `getDb()` gets the once-per-isolate cache.

The `d1-session-bookmark` cookie (`D1_BOOKMARK_COOKIE`): `httpOnly`, `sameSite:lax`, `path:/`, `BOOKMARK_COOKIE_MAX_AGE=30` (s), `secure` **only when `process.env.NODE_ENV === "production"`** (insecure in dev). `captureBookmark()`/read/set are all try/catch-wrapped and only `console.warn` on failure (bookmark failures degrade silently to non-read-your-own-writes).

### Data model (D1 tables)

**10 tables** across `lib/db/schema/`: `user`, `session`, `account`, `verification` (`auth.ts`); `resumes` (`resume.ts`); `site_data` (`site.ts`); `handle_changes`, `upload_rate_limits`, `referral_clicks` (`rate-limit.ts`); `pending_r2_deletions` (`maintenance.ts`). Relations in `relations.ts`; barrel `index.ts`.

**Conventions:** ALL timestamp columns are `text` (ISO strings), never integer epochs (D1 can't `.bind()` `Date` — ADR-0004). Booleans use `integer({ mode: "boolean" })`. `lib/types/database.ts` derives the content-blob shape from **Zod** (`ResumeContent = ResumeContentFormData` from `lib/schemas/resume.ts`), NOT from Drizzle; row types (`User`/`Resume`/`SiteData`) come from each schema's `$inferSelect`/`$inferInsert`.

**FK CASCADE topology (data-loss footgun):**

- `site_data.resumeId` → `resumes.id` `onDelete:cascade`, AND `site_data.userId` is **UNIQUE + `onDelete:cascade`** to `user.id`. There is exactly one `site_data` per user → **deleting a user's resume row CASCADE-deletes their entire published portfolio.**
- `referral_clicks.referrerUserId` → user `cascade`; `referral_clicks.convertedUserId` → user `onDelete:set null`.
- `resumes.userId`, `session.userId`, `account.userId`, `handle_changes.userId` — all `cascade`.
- `pending_r2_deletions` INTENTIONALLY has NO FK to user (the user row is gone when the 2 AM cron retries the R2 delete).

**`resumes`** status enum (6, default `"pending_claim"`): `pending_claim → queued → processing → completed | failed | waiting_for_cache`. Column semantics: `parsedContent` (final validated JSON) vs `parsedContentStaged` (raw pre-validation AI output, cleared on success); `errorMessage` (terminal) vs `lastAttemptError` (most-recent, cleared on retry, stored as `classifyQueueError().toJSON()`); `retryCount` (per manual cycle) vs `totalAttempts` (cumulative, monotonic). `fileHash` SHA-256 for dedup. 6 indexes: `resumes_user_id_idx`, `resumes_file_hash_idx`, `resumes_file_hash_status_idx`, `resumes_user_id_created_at_idx`, `resumes_status_idx`, `resumes_status_queued_at_idx`. (`updatedAt` is the only nullable timestamp here; `createdAt` notNull.)

**`site_data`** carries **6 denormalized preview columns** (`previewName/previewHeadline/previewLocation/previewExpCount/previewEduCount/previewSkills` [JSON array of first 4 skills]) to power directory/SEO listing without parsing the 50–100 KB `content` JSON. Written by `buildSiteDataUpsert()` (`lib/data/site-data-upsert.ts`) which always calls `extractPreviewFields(content)` and spreads them into BOTH insert and `onConflictDoUpdate(target: userId)`. `themeId` is `text('theme_id').default('minimalist_editorial')`, nullable. `updatedAt` is **notNull**; only `lastPublishedAt` is nullable. Indexes: `site_data_resume_id_idx`, `site_data_updated_at_idx`.

**`user`** denormalized columns: `showInDirectory` (mirrors privacy JSON; `notNull default(true)`, `user_show_in_directory_idx`), `referralCount` (maintained by D1 triggers, not app code; `user_referred_by_idx`). `privacySettings` default JSON literal `{"show_phone":false,"show_address":false,"hide_from_search":false,"show_in_directory":true}` MUST stay equal to `DEFAULT_PRIVACY_SETTINGS_JSON` in `lib/utils/privacy.ts` (duplicated as a literal to avoid a circular import). The `PrivacySettings` TS interface (4 snake_case booleans) lives in `auth.ts`. Other indexes: `referral_clicks_dedup_idx` UNIQUE (referrerUserId, visitorHash) — plus `referral_clicks_referrer_idx`, `referral_clicks_visitor_idx`, `referral_clicks_referrer_created_idx`, `referral_clicks_referrer_converted_idx`; `account_provider_account_id_idx` UNIQUE (providerId, accountId); `upload_rate_limits` uses composite `upload_rate_limits_ip_created_idx` (ipHash, createdAt) / `upload_rate_limits_ip_action_idx` (ipHash, actionType, createdAt) + `upload_rate_limits_expires_idx`.

**Triggers (footgun — drizzle snapshots do NOT track triggers).** `migrations/0026_referral_count_triggers.sql` defines **5 idempotent triggers** (`user_referral_count_after_{insert,referred_by_set,referred_by_cleared,referred_by_moved,delete}`) keeping `user.referral_count` in sync with `user.referred_by`, with a `CASE WHEN referral_count > 0 ... ELSE 0` floor. First introduced in `0025_steady_gazelle.sql` (which also backfills counts via COUNT subquery + backfills `referred_at`/`converted_at`); 0026 is the idempotent re-creation (each CREATE preceded by DROP IF EXISTS). **MUST be re-appended (renumbered) after any drizzle migration that rebuilds the `user` table**, because SQLite drops triggers on table drop+recreate and drizzle-kit's column-add pattern is a full `CREATE __new_user → INSERT → DROP → RENAME` rebuild. `migrations/meta/_journal.json` has 28 entries (0000–0027); idx-26's `when:1750100000000` is intentionally out-of-order (ordering is by filename/idx, NOT `when`).

**Data-access layer (`lib/data/resume.ts`):** public fetchers (`getResumeData`, `getResumeMetadata`, `getRelatedProfiles`) are wrapped in React `cache()` for request-level dedup and use `getDb(env.CLICKFOLIO_DB)` (importing `env` from `cloudflare:workers`). **D1 content JSON is NOT re-validated with Zod on read** (trusted source, saves 200–400 ms) — only `JSON.parse` in try/catch → null on failure. Privacy filtering applied at fetch (strips `content.contact.phone` when `show_phone` false; truncates location via `extractCityState` when `show_address` false; uses a defensive copy to avoid mutating the React.cache-shared JSON). **Defense-in-depth theme check** even on the public read path: re-verifies the stored `themeId` via `isThemeUnlocked(themeId, referralCount, isPro)` and silently falls back to `DEFAULT_THEME` (logs `[theme-defense]`) if a locked theme was DB-set directly; reads denormalized `user.referralCount` to avoid a COUNT. `getRelatedProfiles` deliberately avoids `ORDER BY random()`: COUNTs eligible public profiles, picks a random OFFSET into a stable `orderBy(user.handle)` window of 12, shuffles in-memory, returns 3; eligibility filters on `json_extract(privacy_settings,'$.hide_from_search') IS NULL OR = false`.

### API Routes

**Universal response toolkit** (`lib/utils/security-headers.ts`): `createSuccessResponse(data, status=200)` / `createErrorResponse(error, code, status, details?)` + `ERROR_CODES` (`UNAUTHORIZED, VALIDATION_ERROR, RATE_LIMIT_EXCEEDED, NOT_FOUND, CONFLICT, INTERNAL_ERROR, FORBIDDEN, BAD_REQUEST, DATABASE_ERROR, EXTERNAL_SERVICE_ERROR`). Spreads the **single exported `SECURITY_HEADERS`** — the SAME object the worker imports and applies to every response (issue #172): HSTS `max-age=63072000; includeSubDomains; preload` (**2yr WITH preload**), `X-XSS-Protection: '0'`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(), microphone=(), camera=()`. API JSON responses get one consistent set (the API toolkit and the worker apply identical values, so the worker's re-apply is a no-op overwrite).

Key routes not obvious from directory names:

- `POST /api/upload` — Anon **raw-body** direct R2 upload to `temp/{uuid}/{sanitizedFilename}`. **Requires `X-Filename` header** (original filename, set by `FileDropzone.tsx`/`UploadStep.tsx`; 400 if missing/empty/>255 chars) AND `Content-Length` (**missing → 411**, not 400; parse-invalid or actual-bytes mismatch → 400). magic-byte (`%PDF-`)/size validation; IP rate limit (returns `X-RateLimit-Remaining-Hourly/-Daily` + `remaining:{hourly,daily}`); sets signed `pending_upload` cookie via `Set-Cookie` (`SameSite=Strict`, `+Secure` in prod).
- `GET|POST|DELETE /api/upload/pending` — manages the cookie. POST does `R2.head` to confirm the temp object exists **before signing** (anti-forgery), sets `sameSite:'lax'` (survives OAuth redirect).
- `POST /api/resume/claim` — inserts a `pending_claim` row, then per-user `fileHash` cache hit → `completed`(`cached:true`), in-flight dup → `waiting_for_cache`, double-claim guard, moves R2 `temp/`→`users/{userId}/{ts}/{file}`, enqueues parse. Authed `resume_upload` limit 5/24hr enforced HERE (not in /upload). (See AI pipeline section.)
- `GET /api/resume/status` — poll. `waiting_for_cache` 10-min timeout (`WAITING_FOR_CACHE_TIMEOUT_MS`)→failed; `queued`/`waiting_for_cache` surfaced as `processing` (25%/30%); `can_retry` via `canRetryResume()` (mirrors retry-route gates); `parsed_content` only when completed.
- `POST /api/resume/retry` — manual re-queue. **4 gates in order:** (1) `hasExceededMaxAttempts(totalAttempts>=6)`→429; (2) `isPermanentErrorType(lastAttemptError.type)`→400; (3) `status!=='failed'`→400; (4) `retryCount>=2`→429. Status→`queued` before publish, rollback on failure.
- `GET /api/resume/latest-status` — latest resume for the user; `can_retry` via the same `canRetryResume()` as `/status` (loads `totalAttempts`+`lastAttemptError` and mirrors it — the two endpoints agree by construction; asserted by a cross-endpoint test in the resume-operations integration suite).
- `PUT /api/resume/update` — `resumeContentSchemaStrict` + `extractPreviewFields` denormalization + `captureBookmark`.
- `POST /api/resume/update-theme` — validates `THEME_IDS`, `verifyThemeUnlocked`, 404 if no siteData; `captureBookmark` after write.
- `POST /api/wizard/complete` — canonical onboarding write. Schema built dynamically `buildWizardCompleteSchema([...THEME_IDS])`. `verifyThemeUnlocked` BEFORE writing. Atomic `db.batch`: updates user (`handle, privacySettings, showInDirectory, onboardingCompleted:true`) + UPSERTs siteData (`onConflictDoUpdate(target: userId)`, `content:'{}'` placeholder filled later by the consumer, `themeId`). UNIQUE→409.
- `PUT /api/profile/handle` — SQL-counts `handleChanges` in last 24h (>=3→429), atomic `db.batch([update user.handle, insert handleChanges])`, `UNIQUE constraint failed`→409, response uses snake_case `old_handle`. (`isHandleTaken` shared with wizard.)
- `PUT /api/profile/privacy` — dual-writes `privacySettings` JSON + denormalized `showInDirectory` column.
- `GET /api/profile/me` (returns `{id,name,email,image,handle,headline,privacySettings(parsed),onboardingCompleted,role,roleSource,isAdmin,createdAt,updatedAt}`), `GET /api/site-data`, `GET /api/user/stats` (`{referralCount,isPro}`), `PUT /api/profile/role` (`role`+`roleSource:'user'`) — all use `requireAuthWithUserValidation()` (404 not 401 on deleted row); reads do NOT call `captureBookmark`.
- `POST /api/email/validate` — public disposable-email check; `emailValidateSchema`, `checkEmailValidateRateLimit` (30/hr IP); **fails OPEN** (returns `{valid:true}` on infra error); never reveals account existence.
- `GET|POST /api/auth/[...all]` — Better Auth catch-all via `toNextJsHandler(getAuth())`.
- `POST /api/account/delete` — requires `confirmation` to **case-insensitively equal the user's email** (400 else). Order: (1) delete all resume R2 keys via `Promise.allSettled`, **failed deletes recorded in `pendingR2Deletions` BEFORE the DB batch** (GDPR 2 AM retry); (2) `db.batch([delete verification WHERE identifier=email, delete user WHERE id])` (verification has no user FK; deleting user cascades the rest). Returns optional `warnings:[{type:'r2'}]`, then `captureBookmark()` + clears both cookie forms (`Max-Age=0`).
- `GET /api/handle/check?handle=` — **highest-volume** endpoint (~every 500 ms while typing). Deliberate ordering: (1) format validate FIRST (so invalid input never touches D1/limiter; reserved→`{available:false,reason:'reserved'}`); (2) IP rate-limit only for valid formats; (3) plain `getDb()` (no session variant); (4) available→return with ZERO auth cost; (5) only if TAKEN resolve `getAuth()`+`getSession()` to distinguish `{isCurrentHandle:true}` vs taken. **Do not reorder.**
- `POST /api/referral/track` & `POST /api/client-error` — fire-and-forget, **ALWAYS 204** (`EMPTY_204`), never throw, unauthenticated, unrated. track: `{code?,handle?,source?}`, rejects code>64, `isBot(ua)` BEFORE any DB write, matches `OR(referralCode=code.toUpperCase(), handle=code.toLowerCase())`, inserts `referralClicks` with `generateVisitorHash(ip,ua)` (SHA-256 `ip|ua|YYYY-MM-DD`) `.onConflictDoNothing()`. client-error: truncates message(1000)/stack(2000)/componentStack(2000)/url(500), logs `[client-error]`.
- `GET /api/admin/{stats,users,resumes,referrals,analytics}` — all gated via the `withAdmin` wrapper (`requireAdminAuthForApi`), **none rate-limited**. `stats`/`analytics` keep an inner `try/catch → 503` on Umami/D1 failure; `users`/`resumes`/`referrals` let the wrapper's catch-all handle unexpected throws → 500. `analytics` validates `?period=` ∈ `{7d,30d,90d}`, cache `private, max-age=30, swr=60`. `resumes` `PAGE_SIZE=25`, `?status=` ∈ `{all,completed,processing,queued,failed}`, GROUPS status: `completed`+`waiting_for_cache`→completed, `queued`+`pending_claim`→queued. `users` `PAGE_SIZE=25` + `?search=` ESCAPES SQLite LIKE wildcards via `escapeLikePattern()` + raw `LIKE ... ESCAPE '\'` (Drizzle's `like()` omits ESCAPE).
- `GET /api/analytics/stats` (per-user) — proxies Umami; aggregates the user's CURRENT handle + up to 3 OLD handles from `handleChanges` (the query has NO `orderBy`, so `.slice(0,3)` takes them in DB/insertion order — effectively the OLDEST, not most-recent; Umami has no OR-on-URL filter) → **uniqueVisitors can be double-counted across a handle change** (accepted). `directVisits = max(0, totalViews - Σ referrerViews)`. Empty zeros (200) if no handle. Cache `private, max-age=60, swr=120`. Umami `.x` is a full ISO ts (timezone=UTC) → callers `.x.slice(0,10)`.
- `GET /api/cron/*` — manual cron triggers (`cleanup`, `cleanup-r2`, `recover-orphaned`, `sync-domains`); `Bearer ${CRON_SECRET}` (`requireCronAuth`, fail-closed).
- `GET /api/health` — `dynamic='force-dynamic'`, unauthenticated public liveness probe. Checks D1 (`SELECT 1`), R2 (`list({limit:1})`), AI gateway **config presence only** (no AI call). all healthy→200 `healthy`; any unhealthy→503; else 200 `degraded`. Returns per-service `latencyMs`.
- `GET /api/og/home` — **SVG-only** hardcoded branded 1200×630 SVG (`max-age=604800`, no DB/auth/params).
- `GET /api/og/[handle]` — **renders a REAL PNG** via `@cf-wasm/resvg/workerd` (`Resvg.async(svg,{fitTo:{mode:'width',value:1200}}).render().asPng()`), 1200×630, `Cache-Control: public, max-age=86400, swr=604800`. **Empty/unknown handle → `renderLastResort()` (static raw SVG, NO resvg, `max-age=300`)** to avoid paying ~150 ms WASM rasterization for bot probes; only a genuine resvg failure on a REAL profile falls through `catch` → `renderLastResort`. Only the `@vercel/og` _import path_ is stubbed (`lib/stubs/og-stub.js`); `@cf-wasm/resvg` is a LIVE dependency.
- Sitemap: `/sitemap.xml` → `/api/sitemap-index`; `/sitemap/:id.xml` → `/api/sitemap/:id` (`next.config.ts` `rewrites()`). `redirects()` 308s bare `/:handle` → `/@handle` (reserved-path negative-lookahead). See SEO section for sharding.

### Auth patterns

Auth is **Better Auth** (Google OAuth + email/password) backed by D1 via the Drizzle adapter. Authorization is layered: edge cookie gate → page/API session checks → admin DB re-read.

- **No `middleware.ts`** — the file is `proxy.ts` (vinext convention, exported as both named `proxy` and default).
- **`getAuth()` is built ONCE per isolate, not per request.** `lib/auth/index.ts` builds `betterAuth()` lazily on first call, cached in a module-level `WeakMap` (`authInstanceCache`) keyed by `env.CLICKFOLIO_DB` (stable within an isolate). Subsequent calls reuse it; only headers/cookies pass per call.
- **Session read in pages/RSC:** `getServerSession()` (`lib/auth/session.ts`) wraps `auth.api.getSession({ headers })` in React `cache()`. Better Auth's `cookieCache` (maxAge 30 min) serves many reads from a signed cookie with no D1 round-trip; `session.expiresIn` 7 days, `updateAge` 1 day. **There is a SECOND, non-cached `getSession()` in `lib/auth/middleware.ts`** used only by the `requireAuth*` API helpers — don't mix them up.
- **Route gating is layered and redundant by design:**
  1. `proxy.ts` — cheap **cookie-presence-only** check at the edge for `/dashboard /edit /settings /waiting /wizard`. Checks both `__Secure-better-auth.session_token` and `better-auth.session_token`. No D1, no signature/expiry validation.
  2. Every protected **page** independently calls `getServerSession()` and `redirect('/')` if null. `(protected)/layout.tsx` only renders `SidebarLayoutClient` and sets group-wide `metadata.robots: noindex,nofollow` — **it does NOT gate auth.** `/themes` is under `(protected)` but NOT in proxy's list; it relies entirely on its own page-level check.
  3. API routes call `requireAuthWithMessage` / `requireAuthWithUserValidation`.
- **API auth helpers** (`lib/auth/middleware.ts`) — both return `{ error }` as a ready-to-return `Response`:
  - `requireAuthWithMessage()` — session-only; returns `{ user, error }`. Error **401** (`UNAUTHORIZED`).
  - `requireAuthWithUserValidation()` — uses `getSessionDbWithPrimaryFirst` (`"first-primary"`) → `db`+`captureBookmark`, then SELECTs the user row (`{id, handle}`) to defend against stale sessions. Returns `{ user, db, captureBookmark, dbUser, env, error }`. **Returns 404 (`User account not found`), not 401,** when the session is valid but the row is gone.
  - `requireCronAuth(request, env)` — `Bearer CRON_SECRET`; missing secret → 500, mismatch → 401 (fail-closed).
- **Route wrappers** (`lib/auth/with-auth.ts`, **ADR-0002 inner-callback form**) — routes stay `export async function METHOD(req) { return withUser(req, async (ctx) => { … }) }` (NOT `export const METHOD = …`: vinext's route detection for const-exported handlers is unproven). `withUser(request, handler, message?)` wraps `requireAuthWithUserValidation` (~15 user routes); `withAdmin(request, handler)` wraps `requireAdminAuthForApi` (~5 admin routes). Each: runs the auth check, returns its failure `Response` directly (401/404 user, 401/403 admin), invokes `handler` with a guaranteed-non-null context (the full auth result minus `error`), and absorbs the catch-all outer `try/catch → 500` (generic message, request path logged via `pathnameOf`). `request` may be `undefined` for a param-less handler (path logs as "unknown path"). **Inner, purpose-specific try/catch STAYS in the route body** (JSON-body parse, Umami→503, unique-constraint→409). Cron gate + the session-only `requireAuthWithMessage` primitive are intentionally NOT wrapped.
- **Admin gating** (`lib/auth/admin.ts`) — `requireAdminAuth()` (pages) and `requireAdminAuthForApi()` (401/403 Responses); API routes reach the latter via the `withAdmin` wrapper above. Both call `getServerSession()`, then **re-query** the user row via `getDb(env.CLICKFOLIO_DB)` and check `dbUser.isAdmin` — never trust session/JWT claims (revoking admin is immediate). `isAdmin` is a real D1 boolean defaulting `false`; no Better Auth admin plugin. `requireAdminAuth()` redirects to `/` when no session OR no DB row, and `/dashboard` for an authenticated non-admin. **Admin segment is gated ONLY by `requireAdminAuth()` in `app/(admin)/admin/layout.tsx`** — it's NOT in proxy's routes. The `/admin` overview page IS a server component and double-gates (calls `requireAdminAuth()` itself); the 4 sub-pages (`users/analytics/referrals/resumes`) are `"use client"` and call it nowhere — real protection lives in the `/api/admin/*` routes. `AdminLayoutClient` reads `useSession()` purely for display.
- **`user.role` is a career-level enum, NOT a permission.** Values: `student/entry_level/mid_level/senior/executive` (`ROLE_OPTIONS` in `lib/schemas/profile.ts`), with `roleSource` (`'ai' | 'user'`), surfaced as Better Auth `additionalField`s. **Do not conflate `role` with admin** — admin is the separate `isAdmin` boolean. The AI writes `role` (`roleSource:'ai'`) on every parse, INTENTIONALLY overwriting a user-set role on re-upload.
- **Browser client** (`lib/auth/client.ts`) re-exports `signIn/signUp/signOut/resetPassword/useSession/sendVerificationEmail`. `requestPasswordReset()` is a hand-rolled `fetch`.
- **`trustedOrigins`** = `baseURL` + `localhost:3000/8787` + `https://clickfolio.me`/`https://www.clickfolio.me`, plus `http://clickfolio.me` only when `process.env.NODE_ENV !== 'production'`.

### Key lib/ modules

- **`lib/ai/`** — `parseResumeWithAi(buffer: ArrayBuffer, env)` in `lib/ai/index.ts`. **Lazy-imported in the consumer** (`await import('../ai')`) so HTTP/page requests never bundle unpdf + AI SDK. See "AI parsing pipeline" subsection for full detail.
- **`lib/rate-limit/`** — IP-based limits in D1, **IPs SHA-256 hashed (GDPR)**. Constants in `lib/rate-limit/ip.ts`: `HOURLY_LIMIT=10`, `DAILY_LIMIT=50` (anon upload), `HANDLE_CHECK_HOURLY_LIMIT=100`, `EMAIL_VALIDATE_HOURLY_LIMIT=30`. Authed: `handle_change` 3/24h (`user.ts`), `resume_upload` (`RATE_LIMIT_UPLOADS_PER_DAY || 5`)/24h. Shared `uploadRateLimits` table by `actionType` (`upload` 24h / `handle_check` 1h / `email_validate` 1h); the upload-count query uses conditional SUM aggregation to save a D1 roundtrip. **Anon IP fails OPEN; authed fails CLOSED.** Bypasses: `NODE_ENV !== 'production'` OR `isLocalEnvironment()` (BETTER_AUTH_URL localhost — this is what disables limits under `pnpm run preview`, which runs as NODE_ENV=production); `DISABLE_RATE_LIMITS === 'true'` is IGNORED with a `[SECURITY]` warn in production.
- **`lib/email/`** — Cloudflare Email Workers (`env.EMAIL`), no external API keys. `createEmailSender(env, baseURL)`; `getFromEmail(appUrl)` = `noreply@<hostname>` (localhost→`noreply@clickfolio.me`), display name `Clickfolio`. **Gotcha: do NOT wrap `resetUrl`/`verificationUrl` in `encodeURI()`** — Better Auth already encodes them; `encodeURI` re-encodes `%`→`%25`. Reset link says 1h, verification 24h. All user values via local `escapeHtml()`. Send errors returned `{success:false,error}`, never thrown. `disposable-check.ts` `isDisposableEmail()`: `TRUSTED_DOMAINS` (43-domain allowlist: gmail/outlook/yahoo/icloud/proton/fastmail/zoho/ISPs…) checked first; module-level `cachedDomains` Set with 1h TTL (`_resetCache()` test-only); `extractDomain()` uses `lastIndexOf('@')`; **fails open** on infra error. KV key `disposable-domains`. The email sender module is `lib/email/cloudflare.ts` (not `sender.ts`); it validates URLs via `new URL()` (NOT `encodeURI`).
- **`lib/templates/`** — Theme registry. See "Resume templates" subsection.
- **`lib/password/`** — HIBP breach (`hibp.ts`, k-anonymity SHA-1, 5-char prefix, `Add-Padding:true`, `User-Agent: clickfolio.me-password-check`, **fails OPEN**) + zxcvbn strength (`strength.ts`, `MINIMUM_SCORE=2`, dynamically imported + module-cached, expands userInputs). **Both run CLIENT-SIDE ONLY**; server-side `passwordSchema` checks length 8–128 only — keep it that way (`@zxcvbn-ts/*` SSR-stubbed; the stub `.check()` always returns score 0).
- **`lib/utils/sanitization.ts`** — `noXssPattern(value)` (Zod refinement, true=SAFE) over `containsXssPattern()` (`XSS_PATTERN` blocks `<script|<iframe|<embed|<object|<applet|<base|<form|<link|<meta|javascript:|vbscript:|data:text/html|on<event>=`); `sanitizeUrl()` blocks `javascript:/data:/vbscript:/file:/about:` and AUTO-PREPENDS `https://`; `sanitizeEmail()` lenient (TLD optional). HTML-entity encoding (Workers has no DOM).
- **`lib/utils/privacy.ts`** — single source of `DEFAULT_PRIVACY_SETTINGS` (+ `_JSON`); `parsePrivacySettings`/`normalizePrivacySettings`/`isValidPrivacySettings`; `extractCityState(location)` strips street addresses (5 regex) for `show_address:false`.
- **`lib/utils/analytics.ts`** — `isBot(ua)` (true for UA<10 chars OR a large bot regex: gptbot/claudebot/bytespider/ahrefsbot/lighthouse/headlesschrome…); `generateVisitorHash(ip,ua)`/`generateVisitorHashWithDate()` SHA-256 daily-salt dedup.
- **`lib/utils/referral-code.ts`** — `generateReferralCode()` (length 8, confusion-resistant alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, `crypto.getRandomValues`, timestamp fallback).
- **`lib/referral.ts`** — client `captureReferralCode`/`getStoredReferralCode`/`clearStoredReferralCode` (localStorage); server `writeReferral()` (imports `cloudflare:workers`) sets `referredBy`/`referredAt` via atomic `WHERE referredBy IS NULL` UPDATE (first-referral-wins, TOCTOU-safe); resolves EITHER referralCode (uppercased) OR handle (lowercased, `@`-stripped); rejects code>64.
- **`lib/umami/client.ts`** — self-hosted Umami v2.12+ JWT client (POST `/api/auth/login`, token cached 1h, 5s AbortController timeout, auto-clear+retry on 401). `getStats`/`getPageviews`/`getMetrics`.
- **`lib/config/`** SoT modules: `site.ts` `siteConfig` (name clickfolio, supportEmail support@clickfolio.me, SEO entity graph: `alternateNames`/`sameAs`/`founder` Person = Divanshu Chauhan / divkix.me, **hardcoded `url: https://clickfolio.me`**); `author.ts` `authorPersona` (brand byline 'The clickfolio Careers Desk', url `/about` — NOT a real person); `professions.ts` `PROFESSIONS` (6 slugs: software-engineer/designer/product-manager/marketer/consultant/student) drives BOTH homepage role grid AND sitemap, slugs match `app/for/<slug>`; `faq.ts` `FAQ_ITEMS` (9) feeds FAQ JSON-LD; `retry.ts` (see retry constants below).
- **`lib/utils/format.ts`** `formatRelativeTime()` is deterministic (no `Intl.RelativeTimeFormat`/locale) to avoid SSR hydration mismatches. **NOT shared, despite the name:** all 4 admin pages (`admin/page.tsx`, `referrals/`, `resumes/`, `users/`) each define their OWN local `formatRelativeTime(dateStr)` with DIVERGING output ('Xh/Xd ago' vs adds 'Xm ago' vs 'Today'/'Yesterday'/'Xw ago' with `toLocaleDateString`); `components/ui/save-indicator.tsx` has yet another taking a `Date` (uses locale-dependent `toLocaleTimeString`, safe only because it's `"use client"` and never SSRs). Don't assume "the shared formatter" is used. **`lib/utils/site-url.ts`** `getPublicSiteUrl()` & **`lib/utils/environment.ts`** `isLocalEnvironment()` both read `BETTER_AUTH_URL` (default `https://clickfolio.me`) NOT `NODE_ENV` (ADR-0023).

**Client-only vs server-only split** (importing the wrong one breaks):

- **Client-only** (browser APIs): `lib/utils/clipboard.ts`, `share.ts`, `wait-for-completion.ts`, `errors.ts` (imports `sonner`+`window.location`), `pending-upload-client.ts`, client fns in `referral.ts`.
- **Server-only** (import `cloudflare:workers` env at module top): `lib/rate-limit/ip.ts`, `user.ts`, `referral.ts`.
- **Isomorphic** (Web Crypto only): `lib/utils/hash.ts`, `pending-upload-cookie.ts`, `lib/password/hibp.ts`, `sanitization.ts`, `xml.ts`, `analytics.ts`.

### Platform constraints

- **No `fs`** — use R2 bindings for file I/O
- **No D1 in proxy/middleware** — auth check is cookie-presence-only there
- `unsafe-inline` in CSP required for React hydration (no nonce support on Workers)
- `vinext` uses `@cloudflare/vite-plugin` — do not add raw wrangler CLI to the build pipeline
- **Local D1** is auto-discovered from `.wrangler/state/v3/d1/...` — run `pnpm run dev` or `pnpm run db:migrate` at least once to create it before using drizzle-kit

### Module aliases & stubs

- `@/*` → project root — defined in `tsconfig.json` (`"@/*": ["./*"]`) and in the THREE vitest configs' `resolve.alias`. The main `vite.config.ts` does NOT alias `@/*` (the build relies on vinext for `@/*` resolution).
- `cloudflare:workers` + `node:async_hooks`/`async_hooks` — stubbed for the CLIENT environment via the `clientModuleStubs()` Vite plugin (NOT `resolve.alias`): `cloudflare-workers-client-stub.mjs` (`export const env = {}`) + `async-hooks-client-stub.mjs`. Also aliased in vitest to the workers stub.
- `@vercel/og` — stubbed via `vite.config.ts` `resolve.alias` `next/dist/compiled/@vercel/og/index.edge.js` → `lib/stubs/og-stub.js` (aliases away ~2 MB resvg+yoga for the `@vercel/og` code path ONLY; `@cf-wasm/resvg` used by `/api/og/[handle]` is live). NOTE: og-stub.js's own header comment ("Aliased via wrangler.jsonc") is STALE — aliasing moved to Vite.
- `@zxcvbn-ts/*` — stubbed in SSR `resolve.alias` (password strength runs client-side only)
- `zod/v3` — stubbed in SSR `resolve.alias` (`lib/stubs/zod-v3-stub.mjs` exports ONLY the `ZodFirstPartyTypeKind` enum the AI SDK imports for a dead zod3→json-schema path; project is all Zod v4; drops 128 KB)

## Request lifecycle & data flow

**A request, end to end:**

1. **`proxy.ts` (edge).** For `protectedRoutes` (`/dashboard /edit /settings /waiting /wizard`) checks only that a session cookie is _present_ — no D1, no signature/expiry validation. Cookie name has two forms: `better-auth.session_token` (dev/HTTP) and `__Secure-better-auth.session_token` (prod HTTPS); proxy checks both.
2. **`worker/index.ts`.** The real entrypoint. WebSocket upgrades to `/ws/resume-status` are intercepted here (auth + ownership → DO). Everything else flows to the vinext handler. Queue and cron invocations also enter here. The worker's `SECURITY_HEADERS` are injected on every response.
3. **Page (RSC) or API route.** Pages call `getServerSession()` and self-redirect; APIs call the `requireAuth*` helpers. DB access goes through the correct session variant. On first call this isolate, `getAuth()` builds + caches the Better Auth instance.

### The AI parsing pipeline (upload → claim → queue → parse → DO → websocket)

**State machine (the real one):** a resume row is FIRST inserted as **`pending_claim`** (claim route), then `pending_claim → queued → processing → completed | failed`. `waiting_for_cache` and `completed` (cache hit) are **ALTERNATE branches taken at CLAIM time**, not a linear prefix.

```
1. POST /api/upload          Anonymous OK. File → R2 temp/{uuid}/{filename}.
                             Magic-byte (%PDF-)/size validation. Signed pending_upload cookie.
                             Rate-limited by hashed IP (10/hr, 50/day).
2. (auth)                    User signs in (Google OAuth or email/password).
3. POST /api/resume/claim    Verifies signed cookie (re-checks tempKey===key). Inserts a
                             pending_claim row. Authed resume_upload limit 5/24hr.
                             fileHash cache (PER-USER, never cross-user):
                               (a) prior completed resume w/ same userId+fileHash+parsedContent
                                   → copy cached content, batch resume-complete + siteData upsert,
                                   return status=completed, cached:true;
                               (b) else another same-hash resume currently processing →
                                   set THIS row waiting_for_cache, return processing+waiting_for_cache:true.
                             Double-claim guard: wizard mounts twice (auth redirect); if
                             R2.getAsArrayBuffer returns null/throws missing → return a resume
                             created by this user in the last 2 min with already_claimed:true.
                             Moves R2 temp/ → users/{userId}/{ts}/{file} (R2.put with in-mem buffer;
                             temp delete is best-effort, swept by the 0 2 cron). Enqueues parse job.
4. /waiting or dashboard     Opens WS wss://.../ws/resume-status?resume_id={id}.
   (live status)             worker validates full Cookie via getSession + D1 ownership
                             (getSessionDbForWebhook), routes to ClickfolioStatusDO
                             (idFromName(resumeId)) with X-Authenticated-User-Id.
5. Queue consumer            handleResumeParse: idempotency (already-completed → skip;
   (background)              parsedContentStaged exists → complete from it without re-parsing,
                             crash recovery); fileHash cache lookup; parseResumeWithAi(ArrayBuffer).
                             Resume-complete UPDATE + siteData upsert ALWAYS in ONE db.batch()
                             (a crash between them would leave "completed" with no siteData and
                             the idempotency guard would then permanently skip it).
                             waiting_for_cache fan-out: bulk-completes ALL same-fileHash
                             waiting_for_cache rows + their siteData upserts + sets owners'
                             user.role + notifyStatusChangeBatch.
6. Status / failure          RETRYABLE error → consumer leaves status processing, records
                             lastAttemptError ONLY (no false-negative "failed"). status=failed +
                             "failed" DO notify ONLY on a non-retryable error OR by the DLQ
                             consumer after retries exhausted (the authoritative final-failure writer,
                             which SKIPS if the resume is already completed). Alert via
                             getAlertChannel(ALERT_CHANNEL): default logpush (DLQ_ALERT log);
                             webhook only if ALERT_CHANNEL==='webhook'.
7. Orphan recovery (cron)    */15 recovers pending_claim(>5m)/processing(>15m)/queued(>15m)
                             stuck rows; status→queued+totalAttempts+1 BEFORE publish,
                             rollback to pending_claim on publish failure; skips totalAttempts>=6.
```

**Retry/error config (`lib/config/retry.ts`):** `RETRY_LIMITS.MANUAL_MAX_RETRIES=2`, `RETRY_LIMITS.TOTAL_MAX_ATTEMPTS=6` (cumulative ceiling across manual + queue auto-retry + orphan recovery, enforced by `hasExceededMaxAttempts()`/`canRetryResume()`). `INFRA.DLQ_NAME='clickfolio-parse-dlq'`, `INFRA.DISPOSABLE_DOMAINS_KEY='disposable-domains'`. `PERMANENT_ERROR_TYPES` = `[invalid_pdf, malformed_response, service_binding_not_found, file_not_found, parse_validation_error]`. `canRetryResume()` mirrors the retry route's 4 gates so `/status`'s `can_retry` never lies.

**Error classification (`lib/queue/errors.ts`) is REGEX-on-message-string.** `classifyQueueError()` matches `ERROR_PATTERNS`. **Transient/retryable** (→ `retry()`): `db_connection_error`, `service_binding_timeout`, `r2_throttle`, `ai_provider_error` (incl. `NoObjectGeneratedError` + HTTP 5xx). **Permanent** (→ `ack()`→DLQ): `invalid_pdf`, `malformed_response`, `service_binding_not_found`, `file_not_found`, `parse_validation_error`, `unknown`. **GOTCHA: `unknown` is NON-retryable** (only the 4 transient types retry). Any message containing `timeout`/`429`/`rate limit`/`5xx` is forced retryable.

**Queue message contract (`lib/queue/types.ts`):** `queueMessageSchema` = zod `{type: z.literal('parse'), resumeId, userId, r2Key, fileHash, attempt:positiveInt}` (single-variant union today; add via `z.discriminatedUnion('type',[...])`). `DeadLetterMessage {originalMessage,failureReason,failedAt,attempts}` is a TYPE only — Cloudflare delivers the ORIGINAL body to the DLQ, so `handleDLQMessage` handles both shapes via an `'originalMessage' in message` check. Producer: `publishResumeParse(queue, {...})` (`lib/queue/resume-parse.ts`). DLQ writes `Permanently failed after {N} attempts: {failureReason}`.

**`notifyStatusChange` (`lib/queue/notify-status.ts`) is BEST-EFFORT:** no-ops silently if `CLICKFOLIO_STATUS_DO` is unbound (local dev), catches+logs all errors without throwing (polling fallback covers misses). POSTs to `https://do-internal/notify`.

**AI provider routing (`lib/ai/ai-parser.ts`):** Cloudflare AI Gateway → OpenRouter via `@ai-sdk/openai-compatible` (`name:'openrouter'`, baseURL `gateway.ai.cloudflare.com/v1/{acct}/{gw}/openrouter`, header `cf-aig-authorization: Bearer ${CF_AIG_AUTH_TOKEN}`). STRUCTURED path forces `provider.quantizations:['fp16','bf16']`, `require_parameters:true`, `allow_fallbacks:false` (fail fast if no provider supports json_schema; excludes fp4) + OpenRouter `response-healing` plugin. TEXT fallback uses `allow_fallbacks:true`. `DEFAULT_AI_MODEL='openai/gpt-oss-120b:nitro'`. Provider module-cached on acct+gateway id. Timeouts: structured 90s, fallback 60s; `maxOutputTokens 16384`; `temperature 0`.

**5 parse paths** (`ParseEvent.path` in ai-parser.ts): `structured` (primary, `Output.object()` json_schema) → `structured-salvage` (extract+repair from `NoObjectGeneratedError`) → `text-fallback` (full `SYSTEM_PROMPT` + inline schema) → `text-fallback-retry` (smaller truncation) → `error-feedback-retry` (re-prompt with previous output + Zod errors). `index.ts` ALSO does its own one-shot schema-validation retry feeding `validateParseResult` errors back through `parseWithAi`.

**Hard limits:** PDF page cap **50** (`lib/ai/pdf-extract.ts`, `%PDF-` magic, maps password/encrypted/corrupt → friendly errors); `MAX_FILE_SIZE = (MAX_UPLOAD_SIZE_MB||5)*1MB` (defined in `lib/utils/validation.ts`, enforced in `app/api/upload/route.ts` + `claim/route.ts`); `MIN_PDF_SIZE 100` bytes (the Content-Length guard in `app/api/upload/route.ts`, NOT pdf-extract.ts); text truncation MAX **60000** chars (head 38000 + tail 18000, `...[truncated]...`); retry truncation smaller **32000** (20000+11000). `professional_level` is extracted by `parseResumeWithAi`, DELETED from serialized content, returned separately as `professionalLevel`, written to `user.role` (`roleSource:'ai'`) in a SEPARATE update outside the critical batch (if it fails the resume still completes).

**Transform (`lib/ai/transform.ts`, FALLBACK path only):** caps full_name 100, headline 150, summary 2000 (auto-generates from first experience/templated headline if empty), experience description 2000/highlights 500, project description 1000, skills 100. `validateUrl` blocks `javascript:/data:/vbscript:`, rejects URL>500 chars/>12 path segments/repeating segments/hostnames without a dot or >253 chars. `normalizeEndDate` strips present/current/ongoing/now → ''. **STRUCTURED path SKIPS `transformAiResponse`** (schema already enforces) — only URL/email sanitization + end_date normalization. Other AI modules: `ai-normalize.ts` (`normalizeAiKeys` maps alt key names → canonical snake_case, coerces skills `string[]` → `{category,items}`); `ai-fallback.ts` (`parseJsonWithRepair` = JSON.parse then `ai.parsePartialJson`, returns `{data:null}` if the parsed/repaired value is a non-object — primitives/arrays rejected; `transformToSchema` normalizes 3 keys: skills object-map `{Category:items}`→array `[{category,items}]` (scalar wrapped to 1-elem `items`), experience/project `description` array→space-joined string AND experience copies the original array into `highlights`, project `date`→`year` (preserves existing `year`))).

**Signed `pending_upload` cookie (`lib/utils/pending-upload-cookie.ts`):** `COOKIE_NAME='pending_upload'`, `COOKIE_MAX_AGE=1800` (30 min). Format `{tempKey}|{expiresAt_ms}|{base64_hmac}`, HMAC-SHA256 over `{tempKey}|{expiresAt}` via `BETTER_AUTH_SECRET`, CryptoKey cached in a module `Map` keyed by secret (`clearKeyCache()` test-only), constant-time verify.

### Realtime (Durable Object + client hooks)

**ClickfolioStatusDO (`lib/durable-objects/resume-status.ts`)** uses the **WebSocket HIBERNATION API** (`ctx.acceptWebSocket(server)`, not standard accept) — evicted from memory while sockets stay open (zero idle cost). State in DO storage keys `lastStatus`+`lastError` (batched `ctx.storage.get([...])`/`put({...})`). On connect it immediately pushes the cached status (client needs no separate fetch). **Self-cleanup via ALARM:** on terminal status (`completed`/`failed`) `handleNotify` schedules `ctx.storage.setAlarm(Date.now()+30_000)`; `alarm()` closes all sockets (code 1000) + `ctx.storage.deleteAll()` — **DO state is gone ~30s after completion; D1 is the source of truth.** Defense-in-depth: `handleWebSocketUpgrade` 401s without `X-Authenticated-User-Id` (injected by the worker after auth; not re-verified inside the DO). Protocol: client sends `"ping"`→`"pong"` / `"status"`→cached `StatusMessage` JSON; server pushes `{type:'status', status, error?, timestamp}`. The DO uses raw `console.error` in `webSocketError` (no `log` import); `webSocketClose` does no logging.

**Client (`hooks/useResumeWebSocket.ts` + `useResumeStatus.ts`, AND standalone `lib/utils/wait-for-completion.ts`):** there are **TWO parallel WS-first/poll-fallback implementations** (the hook pair used by `/waiting` + `RealtimeStatusListener`; the promise-based `waitForResumeCompletion(resumeId, timeoutMs=90_000)` used by inline wizard/upload flows). **Keep both in sync.** Shared constants: `MAX_RECONNECT_ATTEMPTS=3`, exp backoff `1000*2^(n-1)` capped at 10s, `PING_INTERVAL_MS=30000` (sends literal `"ping"`). `connectionState`: connecting→connected→reconnecting→fallback→closed. **Close code 1000 → NO reconnect** (clean/server terminal). After 3 failed reconnects → `"fallback"`, which makes `useResumeStatus` start 3s HTTP polling of `/api/resume/status`. URL `${ws|wss}://${host}/ws/resume-status?resume_id={id}`. Client ignores any non-`type:"status"` message and `"pong"`. Progress is hardcoded client-side: processing=50%, completed=100% (the WS carries no `progress_pct`; only HTTP `/status` returns real `progress_pct`). A **WS `"failed"` push does NOT optimistically enable Retry** — the push payload (`{status,error,timestamp}`) can't judge [Retry eligibility](CONTEXT.md), so `handleWSStatus` instead triggers `useResumeStatus`'s existing `fetchStatus` refetch (via a `fetchStatusRef`) and `canRetry` is derived from the authoritative `/api/resume/status` response. `useResumeStatus` also does ONE initial fetch, has its own 90s soft timeout ('taking longer than expected'), and 5 consecutive poll errors → 'refresh the page'.

### Cron jobs (detail)

- **`0 2` (`lib/cron/cleanup-r2.ts`):** `performR2Cleanup` (deletes `temp/` objects older than 24h, paginated 1000/page, **only keys starting with `temp/`** as a safety guard) + `retryPendingR2Deletions` (sweeps `pending_r2_deletions`, batch 100/run, gives up after 10 attempts leaving the row for manual review — the GDPR account-deletion retry path).
- **`0 3` (`lib/cron/cleanup.ts`):** batches 3 DELETEs in one D1 roundtrip — expired `uploadRateLimits`, expired `session`, and `handleChanges` older than 90 DAYS.
- **`0 4` (`lib/cron/sync-disposable-domains.ts`):** fetches github.com/disposable-email-domains, **THROWS (KV untouched) if <1000 domains parse** (`MINIMUM_DOMAIN_COUNT` sanity guard), stores under KV key `disposable-domains` as a JSON array string.
- **`*/15` (`lib/cron/recover-orphaned.ts`):** recovers THREE stuck states — `pending_claim` (createdAt>5min), `processing` (queuedAt>15min, falls back to createdAt for legacy null queuedAt), `queued` (same 15-min gate). Writes status=`queued`+queuedAt+`total_attempts+1` BEFORE publishing; on publish failure ROLLS BACK to `pending_claim` (queuedAt=null). 10 rows/run/state; skips `totalAttempts>=6`.

## Key user flows

- **Onboarding wizard** (`app/(protected)/wizard/page.tsx`) — `"use client"` state machine (NOT routed steps), self-gates via `useSession()` (redirects `/` if no userId). Named step ids `upload|handle|review|privacy|theme` ordered by `getStepOrder(needsUpload)` (5 if upload needed, else 4). Reads the pending upload from the HTTP-only cookie first (`GET /api/upload/pending`), falls back to sessionStorage `temp_upload` (30-day migration). Returning-user short-circuit: if `onboardingCompleted===true` it claims any pending upload and redirects straight to `/dashboard`. Guards via `initializingRef`/`hasClaimedRef`. POSTs `/api/wizard/complete` then `<Confetti/>`+`<YouAreLiveModal/>`→`/dashboard`. Wizard privacy defaults: `show_phone:false, show_address:false, show_in_directory:true, hide_from_search:false`. `components/wizard/index.ts` only re-exports `WizardProgress`; other steps imported directly.
- **`/waiting`** (`app/(protected)/waiting/page.tsx`) — `"use client"` ERROR-FALLBACK/retry page (dashboard handles live status inline). `useResumeStatus`, `INITIAL_COUNTDOWN=35s`, synthetic presentational `PROCESSING_STAGES`. On `completed` auto-redirects to `/wizard` (NOT dashboard) after 2s. Retry POSTs `/api/resume/retry`.
- **Dashboard** (`app/(protected)/dashboard/page.tsx`, `force-dynamic`) — `getServerSession()` gate; **safety-net redirect to `/wizard` if `profile && !onboardingCompleted`**; renders `<RealtimeStatusListener>` for status `processing`/`pending_claim`/`queued`, but the component only **OPENS the WS when status is `processing` or `queued`** (`RealtimeStatusListener.tsx:58`) — a `pending_claim` row passes `resumeId:null` (no WS, no poll fallback) and shows the static 'Processing' UI with no live refresh. Internal `detected` state maps both `processing` and `queued` → 'processing'. Debounced single `router.refresh()` on terminal.
- **Resume edit / autosave** (`app/(protected)/edit/`, `components/forms/EditResumeForm.tsx`) — **3000 ms debounced autosave** via `form.watch()`, re-validates with `resumeContentSchemaStrict.safeParse` before each save (failure → `toast.warning` of up to 3 dotted paths, no save), `beforeunload` guard while `saveStatus==='saving'`. `EditResumeFormWrapper` PUTs `/api/resume/update`; calls `router.refresh()` ONLY on manual "Publish Changes", NOT autosaves (already persisted). Form sections (`components/forms/sections/*`) take `{ form: UseFormReturn<ResumeContentFormData> }`, fixed order, hardcoded array caps (`disabled={fields.length>=N}`: experience 10, education 10, skills 20, certs 20, projects 10, highlights 5), `window.confirm` on remove. **Strict vs lenient schema split:** `ResumeContentFormData` is inferred from the LENIENT `resumeContentSchema` (used by AI), but the edit form's RHF resolver uses `resumeContentSchemaStrict` (requires email TLD).
- **Theme / template selection** — see "Resume templates" subsection. **6 free** (bento, classic_ats, dev_terminal, glass, minimalist_editorial [default], neo_brutalist) and **4 referral-gated** (DesignFolio @3, Spotlight @3, Midnight @5, Bold Corporate @10; `isPro` unlocks all).
- **Referral system** — every user gets a unique code at signup (generated in `databaseHooks.user.create.before`; failure logged, signup proceeds, code backfilled later). `ReferralCapture.tsx` reads `?ref=` (must be inside Suspense), `captureReferralCode(ref)` to localStorage + a single `navigator.sendBeacon("/api/referral/track", {code, source:"homepage"})` per load. Claim flows read `getStoredReferralCode()` → send `referral_code` on `/api/resume/claim` → `clearStoredReferralCode()` on success. `user.referralCount` maintained by D1 triggers.
- **Account deletion / GDPR** (`app/api/account/delete/`) — clears BOTH cookie forms (`Max-Age=0`). IPs stored only as SHA-256 hashes. (See API Routes for the deletion order/contract.)
- **Email verification & password reset** — `emailVerification.sendOnSignUp: true`, `autoSignInAfterVerification: true`, 24h expiry. **Send failures are logged, never thrown.** `EmailVerificationBanner` shown only for unverified email/password users (hidden for OAuth), dismissal in localStorage `email_verification_dismissed` (7-day re-show), 60s resend cooldown. Verify: `app/(public)/verify-email/`; reset: `app/reset-password/`.

### Components & state patterns

- **Autosave** vs **optimistic** vs **per-toggle** patterns coexist:
  - `EditResumeForm` (debounced autosave, above).
  - `components/settings/RoleSelectorCard.tsx` — **canonical optimistic-update-with-rollback** (sets role+`source:'user'` before PUT `/api/profile/role`, rolls back on failure).
  - `components/forms/PrivacySettings.tsx` (`PrivacySettingsForm`) — autosaves EACH toggle immediately via PUT `/api/profile/privacy` with per-field `savingField` (keys `show_phone/show_address/hide_from_search/show_in_directory`). Distinct from `components/wizard/PrivacyStep.tsx` (pure local state → batched `/api/wizard/complete`). This is where the `showInDirectory` desync originates on the client.
- **Pending-upload claim** has THREE storage layers (`FileDropzone.tsx`): sessionStorage `temp_upload` (+`temp_file_hash`) AND the HTTP-only signed cookie (`setPendingUploadCookie`). **Cookie is PRIMARY; sessionStorage is a migration fallback** ("remove after 30 days"). `FileDropzone` auto-claims via useEffect once `session.user` is present, `await sleep(100)` to let the OAuth Set-Cookie settle, then `router.replace("/dashboard")`. Reused by `DashboardUploadSection`, `ResumeManagementCard`, `MobileStickyUpload`, home page (modal vs inline via `open`/`onOpenChange`).
- **Handle availability** checked TWO ways: `components/wizard/HandleStep.tsx` (debounce 500ms `GET /api/handle/check`, client-sanitizes + generates suggestions) vs `components/forms/HandleForm.tsx` (settings; RHF + `handleUpdateSchema`, PUT `/api/profile/handle`).
- **Password** — `components/auth/PasswordInput.tsx` debounces zxcvbn strength (150ms) + HIBP (500ms, length>=8), client-only. `SignUpForm` blocks submit if `!passwordStrength?.isAcceptable` or disposable-email error. Disposable checked on blur (400ms) via POST `/api/email/validate`, **fails OPEN**.
- **Analytics** — `components/analytics/OwnerDetector.tsx` sets `window.__clickfolioOwner=true` when `session.user.id===profileId`; `app/layout.tsx` injects `window.umamiBeforeSend` that drops the Umami payload when the flag is set (owners don't inflate their own view counts). Rendered on `[handle]`. `components/dashboard/MilestoneToasts.tsx` — localStorage-gated view milestones (1/10/100/500/1000), once-ever per browser. **Charts use `uplot`** (`^1.6.32`, the only charting dep — NOT in the vendor-chunk list): `dashboard/AnalyticsCard.tsx` (per-user, fetches `GET /api/analytics/stats?period=7d|30d|90d`, drives `MilestoneToasts` off `totalViews`), `admin/AdminSparkline.tsx` (80px), `admin/AdminTrafficChart.tsx` (200px dual-series). All `"use client"` (uPlot needs DOM/ResizeObserver, can't SSR on Workers), construct/destroy the instance on width+data change, and HARDCODE brand coral `#D94E4E` for stroke (not the `--brand`/`--chart-1` CSS token). `admin/FunnelChart.tsx` is a pure CSS/div bar chart (no lib, the only non-`"use client"` chart).
- **Theme/template** — `components/dashboard/ThemeSelector.tsx` (POST `/api/resume/update-theme`+`router.refresh`, renders a LIVE scaled 1280px preview via `DYNAMIC_TEMPLATES` + `TEMPLATE_BACKGROUNDS`, locked themes blurred+grayscale) vs `components/wizard/ThemeStep.tsx` (local state). Both use `THEME_METADATA`/`isThemeUnlocked`. **App light/dark theme** (`components/ThemeProvider.tsx` over next-themes, `ThemeToggle.tsx` 3-way) is SEPARATE from resume TEMPLATE themes.
- **Share** — `components/ShareBar.tsx` (inline row) + `components/SharePopover.tsx` (fixed floating, `print:hidden`), both `cva`-variant-themed per template id (KEBAB-case), both use `lib/utils/share.ts` (prefer Web Share API). `AttributionWidget.tsx` is a separate fixed "Built with" badge (UNDERSCORE-keyed `Record<ThemeId>`, falls back to `bento`).
- **Social brand icons** (`components/icons/BrandIcons.tsx`) are NOT lucide — they `<img>` official brand assets from `public/brand/` via `BrandAsset` with a `variant:"black"|"white"` prop (GitHub SVG `/brand/github/invertocat-{black,white}.svg`, LinkedIn PNG `/brand/linkedin/inbug-{black,white}.png`); `WhatsAppIcon` is an inline `currentColor` SVG with no variant. Exports PascalCase (`GitHubIcon`/`LinkedInIcon`) + lucide-style aliases (`Github`/`Linkedin`). Adding/changing social links uses these, not lucide.
- **Sidebar** (`components/dashboard/Sidebar.tsx`) fetches `/api/profile/me` with a 30s client stale-cache for the conditional Admin/View-Site links (Admin link visibility is cosmetic; real gating is server-side). Protected shell `app/(protected)/SidebarLayoutClient.tsx` handles Escape-to-close + body-scroll-lock. `Confetti.tsx` wraps `@neoconfetti/react` (50 particles mobile / 100 desktop).

### App Router render modes & boundaries

- **`force-dynamic`:** dashboard, edit, settings, themes, admin/overview.
- **ISR `revalidate`:** homepage 3600, `[handle]` 3600, explore 300, about/faq/privacy/terms 86400, blog LISTING (`app/blog/page.tsx`) 86400, individual blog POSTS 86400, role `for/<slug>` 86400, `preview/[id]` 604800.
- **Client-component pages with `revalidate=86400` as a no-op shell directive:** wizard, waiting, reset-password, `(public)/verify-email`, the 4 admin sub-pages.
- **5 `loading.tsx`** (all under `(protected)`: dashboard/edit/settings/themes/wizard) — skeleton UIs.
- **4 `error.tsx` levels:** `app/error.tsx` (route-segment, **`console.error` ONLY, does NOT report**), `app/global-error.tsx` (own html/body, **hardcoded hex colors** since globals.css isn't loaded; reports), `app/[handle]/error.tsx`, `app/(protected)/error.tsx`. All except `app/error.tsx` POST `{message,stack,url}` to `/api/client-error` (fire-and-forget).
- **Public profile** (`app/[handle]/page.tsx`): `dynamicParams=true`. Decodes the `%40` param, requires `@` prefix (non-@ → notFound; old non-@ URLs 308-redirected by next.config), then `isValidHandleFormat()` to skip the D1 query for bot probes. **`hide_from_search` does NOT 404/hide the profile** — it only adds `robots:noindex`, suppresses JSON-LD + breadcrumb, and skips `getRelatedProfiles`. Field-level privacy (phone/address strip, theme downgrade) is enforced in `lib/data/resume.ts`, not the page. ⚠️ **STALE COMMENT** (`app/[handle]/page.tsx` docblock ~line 122) claims privacy changes purge edge cache via Cloudflare API — **no such purge exists**; freshness relies solely on `revalidate=3600`.
- **`explore/page.tsx`** (ISR 300): three AND conditions — `isNotNull(user.handle)`, `eq(user.showInDirectory,true)` (denormalized boolean, NOT json_extract), `eq(user.onboardingCompleted,true)`, innerJoined to siteData. Renders from denormalized preview columns. `ITEMS_PER_PAGE=12`, `?role=` filter, `?page=` with rel=prev/next.
- **`preview/[id]/page.tsx`** (ISR 7d, noindex): renders `DEMO_RESUME_CONTENT[id]` (demo data only, no real user) wrapped in `TEMPLATE_BACKGROUNDS[id].bg`, synthetic `profile={avatar_url:null, handle:<fullName lowercased>}`. `notFound()` if no demo content. Exists ONLY for `scripts/generate-thumbnails.ts`.
- **Root layout** (`app/layout.tsx`): injects the `umamiBeforeSend` owner-suppression script; loads Umami from `https://analytics.divkix.me/script.js`; `metadataBase=siteConfig.url`, title template `%s | <fullName>`, `manifest=/manifest.webmanifest`, OG default `/api/og/home`; viewport themeColor light `#fbfaf9`/dark `#121211`; skip-link to `#main-content`.

### Resume templates & theme registry

**Adding a template — update ALL of these together** (TS `Record<ThemeId,...>` catches most; the registry-sync test catches the rest):

1. `THEME_IDS` const tuple in `lib/templates/theme-ids.ts` (single source of truth; `ThemeId = typeof THEME_IDS[number]`).
2. `THEME_METADATA[id]` (`name/description/category/preview/referralsRequired`).
3. `themeToShareVariant[id]` (UNDERSCORE id → KEBAB `SharePopoverVariant`).
4. `TEMPLATE_LOADERS` + `TEMPLATE_EXPORT_NAME` in `lib/templates/theme-registry.ts`.
5. `DYNAMIC_TEMPLATES` (`next/dynamic`) in `lib/templates/theme-registry.client.tsx`.
6. `DEMO_RESUME_CONTENT[id]` + `TEMPLATE_BACKGROUNDS[id]` + a `DEMO_PROFILES` array entry in `lib/templates/demo-data.ts` (the array is NOT a Record — a missing entry is NOT compiler-caught, it just won't appear in the landing/modal carousel).
7. FOUR cva/Record variant maps: `ShareBar` + `SharePopover` (KEBAB), `CreateYoursCTA` (UNDERSCORE), `AttributionWidget` (`Record<ThemeId>`, UNDERSCORE).
8. A matching `.webp` in `public/previews/` AND the entry in the STALE `scripts/generate-thumbnails.ts` `TEMPLATES` array.

**Two id casings (footgun):** `THEME_IDS`/`siteData.themeId`/CTA/AttributionWidget use **UNDERSCORE** (`neo_brutalist`, `bold_corporate`, `minimalist_editorial`, `dev_terminal`, `design_folio`, `classic_ats`); `ShareBar`/`SharePopover`/`themeToShareVariant` values use **KEBAB** (`neo-brutalist`). `themeToShareVariant` is the bridge; `SharePopoverVariant` is DERIVED from `SharePopover`'s cva via `VariantProps` (so theme-ids.ts imports the type from there). Canonical ids `glass`/`bento` (NOT `glass_morphic`/`glassmorphic`/`bento_grid`).

**Guard tests:** `__tests__/unit/lib/templates/registry-sync.test.ts` asserts `THEME_IDS == THEME_METADATA keys == themeToShareVariant keys` (it can't import `theme-registry.client.tsx` due to `next/dynamic`). `__tests__/unit/lib/templates/theme-ids.test.ts` hard-codes referral tiers (design_folio=3, spotlight=3, midnight=5, bold_corporate=10), `DEFAULT_THEME==='minimalist_editorial'`, and `preview` path regex `/^\/previews\/.+\.(webp|png|jpg)$/` — update when changing tiers/default. `__tests__/theme-id-consistency.test.ts` asserts the legacy-typo ids are invalid.

**Server/client split:** `theme-registry.ts` (server) `async getTemplate(id)` via `import()` (RSC: `[handle]`, `preview/[id]`); `theme-registry.client.tsx` `"use client"` `DYNAMIC_TEMPLATES` via `next/dynamic` (client: `TemplatePreviewModal`, `ThemeSelector`). Both fall back to `DEFAULT_THEME`; `getTemplate` never throws. Templates are NOT all `"use client"` — only Spotlight/GlassMorphic/Midnight/ClassicATS/BoldCorporate are (hooks/`window`/`window.print()`); BentoGrid/DesignFolio/DevTerminal/MinimalistEditorial/NeoBrutalist are server components (but NeoBrutalist delegates its hamburger sub-nav to a `"use client"` child `NeoBrutalistMobileNav` — a server template CAN embed a client island). Export `export const <PascalName>: React.FC<TemplateProps>` matching `TEMPLATE_EXPORT_NAME[id]`.

**`TemplateProps` (`lib/types/template.ts`)** = `{ content: ResumeContent; profile: { avatar_url: string|null; handle: string } }` — the prop is **`profile`, NOT `user`**. Only Spotlight/GlassMorphic/NeoBrutalist/BoldCorporate/Midnight render `avatar_url`.

**Shared helpers a template MUST use:** `getContactLinks(content.contact)` (`lib/templates/contact-links.ts`, null-checked `ContactLinkDescriptor[]`); `getContactIcon(type,opts)` (`components/templates/shared/ContactIcon.tsx`, returns NULL for `behance`/`dribbble` → render inline 'Be'/'Dr'); `TemplateFontLinks` (`components/templates/shared/TemplateFontLinks.tsx`, the 3-tag Google Fonts pattern); date/skills helpers in `lib/templates/helpers.ts` (`formatDateRange` → 'Mon YYYY — Present', `formatShortDate`, `formatYear`, `flattenSkills`, `getInitials`, all UTC). Footers rendering `new Date().getFullYear()` MUST add `suppressHydrationWarning`. Every template renders `<ShareBar variant=... />` in its footer. (Some templates keep bespoke icon maps intentionally — not drift to "fix".)

**Theme persistence + access:** stored in `siteData.themeId`. Writes go through `POST /api/resume/update-theme` and `app/api/wizard/complete/route.ts`, both: (a) `isValidThemeId()` (400 + `valid_themes` if invalid), (b) `verifyThemeUnlocked(db, userId, themeId)` (`lib/templates/theme-access.ts`; selects `user.referralCount`/`isPro`, returns a 403 Response with `required_referrals`/`current_referrals` if locked, else null). update-theme calls `captureBookmark()` after. The public viewer casts `(theme_id ?? DEFAULT_THEME) as ThemeId` and does NOT re-check access at render time (a downgraded user keeps a previously-selected premium theme until they change it — but `lib/data/resume.ts` has the defense-in-depth downgrade noted above).

## Design decisions & rationale

Each major decision + its _why_ is one ADR under `docs/adr/`. Read the ADR for full context; the one-line summary here is just an index. When you make a new architecturally-significant decision, add the next-numbered ADR file AND a row here (see the maintenance protocol at the top).

| ADR                                                              | Decision (one-line)                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [0001](docs/adr/0001-hsts-preload.md)                            | HSTS `preload` site-wide (2yr max-age) — slow to reverse                       |
| [0002](docs/adr/0002-inner-callback-auth-wrapper.md)             | Auth route wrappers use the inner-callback form (vinext route detection)       |
| [0003](docs/adr/0003-getauth-cached-per-isolate.md)              | `getAuth()` built once per isolate, WeakMap-cached by D1 binding               |
| [0004](docs/adr/0004-d1-date-serializing-proxy.md)               | D1 binding wrapped in a date-serializing `Proxy` (→ all timestamps are `text`) |
| [0005](docs/adr/0005-proxy-cookie-presence-only.md)              | `proxy.ts` does cookie-presence-only checks (no D1 on Workers edge)            |
| [0006](docs/adr/0006-admin-reads-isadmin-from-d1.md)             | Admin re-reads `isAdmin` from D1 every request (immediate revoke)              |
| [0007](docs/adr/0007-db-session-variants.md)                     | Four DB session variants; only `getDb()` is isolate-cached                     |
| [0008](docs/adr/0008-resume-complete-single-batch.md)            | Resume-complete UPDATE + siteData upsert always in one `db.batch()`            |
| [0009](docs/adr/0009-pending-r2-deletions-before-batch.md)       | `pendingR2Deletions` written before the delete batch; no user FK               |
| [0010](docs/adr/0010-filehash-cache-per-user.md)                 | fileHash dedup/cache is per-user (never leak content cross-user)               |
| [0011](docs/adr/0011-retryable-errors-keep-processing.md)        | Retryable errors keep status `processing` (no false-negative `failed`)         |
| [0012](docs/adr/0012-unknown-queue-error-non-retryable.md)       | `unknown` queue error is non-retryable (straight to DLQ)                       |
| [0013](docs/adr/0013-cron-called-directly.md)                    | Cron triggers called directly in `worker/index.ts` (avoid double-billing)      |
| [0014](docs/adr/0014-smart-placement.md)                         | Smart placement enabled (Worker is origin-bound, not edge-latency-bound)       |
| [0015](docs/adr/0015-password-strength-client-side.md)           | Server password validation length-only; strength is client-side                |
| [0016](docs/adr/0016-stubs-for-cf-incompatible-packages.md)      | Stubs for CF-incompatible packages (`@vercel/og`, `@zxcvbn-ts/*`, `zod/v3`, …) |
| [0017](docs/adr/0017-ip-addresses-sha256-hashed.md)              | IP addresses SHA-256 hashed before storage (GDPR, no raw PII)                  |
| [0018](docs/adr/0018-claim-check-pending-upload-cookie.md)       | Claim-check pattern (`pending_upload` signed cookie) for anon upload           |
| [0019](docs/adr/0019-disposable-email-fail-open.md)              | Disposable-email check is fail-open (availability over strictness)             |
| [0020](docs/adr/0020-theme-ids-zero-component-import.md)         | `theme-ids.ts` is a zero-component-import data module                          |
| [0021](docs/adr/0021-related-profiles-avoids-order-by-random.md) | `getRelatedProfiles` avoids `ORDER BY random()` (not indexable on D1)          |
| [0022](docs/adr/0022-public-reads-skip-zod-revalidation.md)      | Public reads skip Zod re-validation of D1 content (trusted, saves 200–400 ms)  |
| [0023](docs/adr/0023-env-detection-keys-off-better-auth-url.md)  | Env detection keys off `BETTER_AUTH_URL`, not `NODE_ENV`                       |

## Common gotchas / footguns

- **ONE `SECURITY_HEADERS` constant exists** (unified in issue #172), exported from `lib/utils/security-headers.ts` and imported by `worker/index.ts` (every response), the API helper responses, and `lib/rate-limit/user.ts`: HSTS 2yr WITH preload + `X-XSS-Protection: 0`. Editing that one constant now takes effect on every response — the worker re-applies the identical object as the catch-all for page routes, so "applied last" equals "applied first". The CSP+HSTS _origin_ (independent of this constant) is `next.config.ts` `headers()`.
- **`(protected)/layout.tsx` does NOT enforce auth.** Every page under it must call `getServerSession()` and `redirect('/')` itself. `/themes` relies entirely on its own page check (not in proxy's `protectedRoutes`).
- **`proxy.ts` is presence-only.** A forged/expired-but-present cookie passes. `/admin` and `/themes` are not in proxy's `protectedRoutes` at all.
- **Cookie name has two forms.** `better-auth.session_token` (dev/HTTP) and `__Secure-better-auth.session_token` (prod HTTPS). `proxy.ts`/account-delete handle both. The WS regex `/better-auth\.session_token=([^;]+)/` matches the prefixed name in prod **by coincidence**. Any EXACT lookup of only the unprefixed name breaks in production.
- **`requireAuthWithUserValidation` returns 404, not 401,** when the session is valid but the DB row is gone (e.g. after `db:reset`). Treat 404 as an auth failure.
- **Two `getSession` functions exist.** Use cached `getServerSession()` from `lib/auth/session.ts` in pages/RSC; the non-cached one in `lib/auth/middleware.ts` is only for the `requireAuth*` helpers.
- **Authed write routes must `captureBookmark()` after the D1 write.** Forgetting it causes a stale read on the immediate next request.
- **Disposable-email block is fail-open.** Don't assume a thrown error in `databaseHooks.user.create.before` blocks registration — only `APIError` does.
- **`account.password` comment in `lib/db/schema/auth.ts` is stale** (reads 'exists for Better Auth compatibility (future email/password support). Currently unused.') — `emailAndPassword` is live and writes that column.
- **`getEnvValue()` throws at `getAuth()` build time** if `BETTER_AUTH_URL/BETTER_AUTH_SECRET/GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET` is missing — breaks ALL auth routes for the isolate.
- **`showInDirectory` (denormalized column) ≠ `hide_from_search` (privacy JSON only, NOT denormalized).** `/explore` filters on `eq(user.showInDirectory, true)`; the SITEMAP filters on `json_extract(privacySettings,'$.hide_from_search') IS NULL OR = false`. They are independent: `show_in_directory=false` removes from `/explore`; `hide_from_search` removes from sitemaps. Keep `privacySettings.show_in_directory` and the `showInDirectory` column in sync (wizard-complete / privacy routes dual-write).
- **`role` ≠ admin.** `role` is a career-level enum; admin is `isAdmin`. Don't gate on `role`. The AI overwrites `role` on every re-upload.
- **`waiting_for_cache` is NOT the first resume state.** Rows start at `pending_claim`; `waiting_for_cache`/`completed` are claim-time branches.
- **`/api/resume/status` and `/api/resume/latest-status` agree on `can_retry`** — both defer to the single canonical `canRetryResume()` (`lib/config/retry.ts`). Any new surface answering "can this resume be retried?" must call it, not re-implement the rule.
- **`db:push` skips migration files** — use `db:generate` + `db:migrate`. `db:reset` is destructive and local-only.
- **Referral triggers are dropped on any `user`-table rebuild** — re-append `0026_referral_count_triggers.sql` (renumbered) after such a migration (drizzle snapshots don't track triggers).
- **Email send failures are swallowed** (logged, not thrown).
- **`lib/cloudflare-env.d.ts` is generated** (`cf-typegen` / `wrangler types`) — add bindings in `wrangler.jsonc` and regenerate.
- **Blog routes are static folders.** `app/blog/` has 17 route folders in 1:1 correspondence with `lib/blog/posts.ts` `BLOG_POSTS` (17 entries). Adding a post needs BOTH, plus a hand-edit of `public/llms-full.txt` or `seo-assets.test.ts` fails (see SEO subsection).
- **`app/manifest.webmanifest` is STALE blue brand** (`theme_color #3b82f6`, `background_color #eff6ff`) vs the current coral design system (layout viewport `#fbfaf9`/`#121211`). Static file — update separately when changing brand.
- **`scripts/generate-thumbnails.ts` is out of sync** with `THEME_METADATA` (8/10 templates, `.png` vs `.webp`).

## SEO, JSON-LD, sitemaps, blog & role pages

**JSON-LD generators** live in `lib/seo/json-ld.ts` (Person/ProfilePage, the homepage trio WebSite+Organization+SoftwareApplication, CollectionPage explore, FAQPage, `generateWebPageJsonLd`, two breadcrumb variants) — **EXCEPT** Article + BreadcrumbList for blog posts, which are LOCAL helpers in `components/blog/BlogPostLayout.tsx`. **`serializeJsonLd` (json-ld.ts) is mandatory** before embedding JSON-LD in `dangerouslySetInnerHTML` (escapes `< >` → `</>` to prevent `</script>` breakout, plus U+2028/U+2029). Never `JSON.stringify` JSON-LD directly into a script tag.

- **Profile (`/@handle`) JSON-LD** is generated in `lib/data/resume.ts` (`generateResumeJsonLd` + `generateBreadcrumbJsonLd`), returning pre-serialized `jsonLdResumeScript`/`jsonLdBreadcrumbScript` strings ONLY when `!hide_from_search && siteData.content` (try/catch → null on failure; page still renders). `includeEmail` defaults false; experience capped at 5; social `sameAs` URLs regex-validated.
- **Homepage** emits `generateHomepageJsonLd` (array of 3) + `generateFAQJsonLd()` (no args — reads `FAQ_ITEMS` internally; the arg-taking variant is the separate `generateFAQPageJsonLd(items)` used by `for/` + blog pages). WebSite has a SearchAction → `/explore?search={search_term_string}`. `/explore` uses `generateExploreJsonLd` (CollectionPage + ItemList); `/faq` reuses `generateFAQJsonLd`.
- **Breadcrumb generators differ:** `generatePageBreadcrumbJsonLd(name,path)` = 2-item Home>Page (blog listing, for/ pages); `generateBreadcrumbJsonLd(handle,name)` = 3-item Home>Explore>@handle (profile only).

**⚠️ URL source inconsistency:** sitemap/robots/manifest derive base URL from `getPublicSiteUrl()` (`BETTER_AUTH_URL || https://clickfolio.me`), but ALL JSON-LD/canonical/openGraph use hardcoded `siteConfig.url` (`https://clickfolio.me`). On any deploy where `BETTER_AUTH_URL != https://clickfolio.me` (staging/preview) they diverge.

**Sitemap (`lib/seo/sitemap.ts`):** `URLS_PER_SITEMAP=50000`. `STATIC_SITEMAP_ENTRY_COUNT = BASE(7) + PROFESSIONS.length + BLOG_POSTS.length` (this constant MUST stay accurate or shard-0 math over/under-fills). The 7 static entries: home(1.0), /privacy, /terms, /explore(0.9), /blog(0.8), /about, /faq. Shard 0 = static + first `(50000 - STATIC_COUNT)` users; shard N>0 = 50000 users at offset `firstShardUserLimit + (N-1)*50000`; users ordered by `user.handle`. Indexable filter `notHiddenFromSearch`: handle IS NOT NULL AND `json_extract(privacySettings,'$.hide_from_search') IS NULL OR =false`. Per-entry `lastModified` = `lastPublishedAt || siteData.updatedAt || user.updatedAt`; published <7 days ago → `changeFrequency:'daily'` else weekly; priority 0.8. Routing is a rewrite chain (vinext doesn't emit a sitemap index): `/sitemap.xml` → `app/api/sitemap-index/route.ts` (`buildSitemapIndexXml(getSitemapShardCount(count))`); `/sitemap/:id.xml` → `app/api/sitemap/[id]/route.ts` (`parseSitemapId` validates `^\d+$` + `Number.isSafeInteger`, 400 else); `app/api/sitemap/route.ts` hardcodes shard 0 (parallel/legacy). All handlers try/catch→500, cache `public, max-age=3600, s-maxage=3600, swr=86400` (index + `[id]` also set `CDN-Cache-Control`).

**Blog (2-file pattern, both required, kept in sync):** (1) add a `BlogPostMeta` entry to `BLOG_POSTS` in `lib/blog/posts.ts` (`slug, title, description, date[ISO], dateModified?, readTime, category, keywords[], faq?[{q,a}]`); (2) create `app/blog/<slug>/page.tsx` doing `const post = getPostBySlug("<slug>")!` at MODULE scope (non-null — a folder-name vs `BLOG_POSTS` slug desync throws at BUILD time), `revalidate=86400` (same as the LISTING `app/blog/page.tsx`), a module-scope `relatedPosts` = `[slugs].map(getPostBySlug).filter(Boolean) as (typeof post)[]`, `generateMetadata()` (canonical `${siteConfig.url}/blog/${slug}`, OG `/api/og/home`, robots index+follow), `<BlogPostLayout post={post} relatedPosts={relatedPosts}>`. `BlogPostLayout.tsx` injects 3 schemas: Article (LOCAL `generateArticleJsonLd`), BreadcrumbList, and FAQPage (only when `post.faq` non-empty). ⚠️ `app/blog/clickfolio-templates-showcase/page.tsx` is the ONLY non-static-prose post — it imports LIVE `THEME_METADATA`/`getThemeReferralRequirement` from `theme-ids.ts` and renders theme names/descriptions/referral thresholds inline, so editing `theme-ids.ts` changes this published post's text. `authorPersona` ('The clickfolio Careers Desk', `/about`) is the Article author + visible byline (brand persona, not a real person — keep credentials honest).

**Role landing pages (`app/for/<slug>/page.tsx`, 6 today):** `revalidate=86400`; `metadata` (canonical `${siteConfig.url}${path}`, OG `/api/og/home`); emit `generateWebPageJsonLd` + `generatePageBreadcrumbJsonLd` as two `<script>`s; render `<RoleFaqSection items={faqs} />` (exported from `components/Faq.tsx`, imported as `@/components/Faq` — there is no standalone `RoleFaqSection.tsx`) (which itself emits the FAQPage JSON-LD — so a for/ page has 3 schemas total). **CRITICAL SYNC:** for/ slugs MUST match `lib/config/professions.ts` `PROFESSIONS` (consumed by both homepage grid AND sitemap). `components/Faq.tsx` exports `FaqAccordion` (collapsible, blog + /faq), `RoleFaqSection` (always-expanded + FAQPage JSON-LD, for/ pages), and `FaqItem`.

**AI-discovery static files (`public/llms.txt` ~3 KB + `public/llms-full.txt` ~8.7 KB), guarded by `__tests__/unit/app/seo-assets.test.ts`:** the test asserts `llms.txt` contains fixed keyword phrases (`PDF resume to website`, `resume website builder`, `LinkedIn to portfolio`, `DesignFolio resume`, …) plus the `/blog/pdf-resume-to-website`, `/blog/best-resume-website-builders`, `/for/software-engineer`, `/for/designer`, `/explore` URLs; and that `llms-full.txt` contains EVERY `BLOG_POSTS` slug+title AND all 6 `/for/<slug>` profession paths. **Maintenance constraint:** adding a blog post (`lib/blog/posts.ts`) or a profession (`lib/config/professions.ts` / `app/for/<slug>`) requires HAND-updating `public/llms-full.txt` (and often `llms.txt`) or this unit test fails. These files are NOT generated.

**robots (`app/robots.ts`, MetadataRoute.Robots — not static):** base URL `getPublicSiteUrl()`. Allows `/` + `/api/og/` for `*`; disallows `/api/ /admin/ /dashboard/ /edit/ /preview/ /reset-password/ /settings/ /verify-email/ /waiting/ /wizard/`. Explicit per-AI-crawler allowlists (GPTBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, GoogleOther) scoped to `/, /explore, /blog`. `/for/` and `/blog/*` are intentionally indexable. The `next.config.ts` 308 bare-handle redirect regex (negative-lookahead excluding sitemap/robots.txt/favicon.ico/manifest + reserved prefixes) **must be updated whenever a new top-level reserved route is added** or it'll be redirected to `/@route`.

## Agent skills

### Issue tracker

Issues live in **GitHub Issues** (`Divkix/clickfolio.me`), managed via the `gh` CLI. External PRs are **not** a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), used as-is with no custom mapping. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root (created lazily by `/domain-modeling`). See `docs/agents/domain.md`.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
