# Coding standards — clickfolio.me

Review-time rules. Apply every rule below to each changed hunk and report each violation as `file:line` + rule. `pnpm run verify` and `pnpm run test` already enforce lint, types, formatting and the guard tests; this file holds what they cannot check yet. When a rule becomes a lint rule or test, delete it here.

## API routes

- Handlers in `app/routes/api/` wrap in `withUserEffect` / `withAdminEffect` (`lib/auth/with-auth.ts`) and return an Effect; services beyond `appLayer` are provided inside it. Reference: `app/routes/api/profile/role.ts`.
- Successes use `createSuccessResponse` (`lib/utils/security-headers.ts`). A 4xx inside the Effect fails with the matching tagged error for `runRoute` to map.
- `createErrorResponse` + `ERROR_CODES` only for checks before the Effect (upload headers), a 5xx whose specific message the failure map would replace, and statuses with no tag (upload's 411, retry's permanent-cap 429, `/api/health`).
- JSON bodies are bounded and validated: `oversizedBodyResponse` (413 before auth) + `readJsonBody` with a Zod schema from `lib/schemas/` (`lib/effect/json-body.ts`).
- Bodies that crawlers or caches keep (sitemaps, `/api/og/<handle>`) answer a failed read or render with `retryLater(...)` (`lib/effect/retry-later.ts`) and a fixed route label, never a degraded 200. `/api/health` returns fixed strings; details go to the log.

## Auth

- Session auth reads only the `__session` cookie; `Authorization: Bearer` is never a fallback.
- Only an expired or invalid token is signed-out (401); a token's `azp` must match the `APP_URL` origin (localhost in dev). An unreachable JWKS, a bad `CLERK_SECRET_KEY` or a missing/malformed `APP_URL` is `ClerkFailed` (5xx), never a sign-out.
- A valid JWT whose user row is missing (webhook lag) is 404; callers treat it as an auth failure.
- Admin checks re-read `isAdmin` from the DB every request. `user.role` is career level, never an authz signal.
- Each `app/routes/_protected/` page's server fn gates itself (`getServerSession` → `redirect`); the layout never redirects.
- The Clerk publishable key and Umami website id reach the client at request time through the root `getPublicConfig` server fn, never inlined at build time.
- Client auth goes through `lib/auth/client.tsx` (`useSession`, `SignInButton`, `useSignOut`); `lib/auth/clerk-bridge.tsx` is the only `@clerk/react` importer. A `SignInButton` child stays enabled while `isPending`: that click loads Clerk.

## Database

- `getDb(env.HYPERDRIVE)` per invocation, never at module scope.
- Multi-write → `db.transaction`. Postgres `23505` → 409.
- Raw SQL through Drizzle `execute` (`rows`, `rowCount`); no Effect SQL.
- Schema: `timestamptz` with `mode: "string"`; enum-like columns are `text` + a TS union (no PG enums); JSON is `jsonb`, read back without `JSON.parse`.
- `site_data.content` writes spread `siteDataContentColumns(content)`; list queries (sitemap, `/explore`, `/examples`) filter with `indexableProfileCondition()` and never select `content`.
- Directory visibility is dual-written: `showInDirectory` on the user row and `privacySettings.show_in_directory` change together (wizard and privacy routes).

## Effect (server I/O)

- Every server call to something external (Postgres, Clerk, R2, email, queues, Durable Objects, Workflow bindings, third-party `fetch`) is an Effect failing with a tagged error from `lib/effect/failures.ts`; `describeFailure` (`lib/effect/failure-map.ts`) maps each tag to an HTTP status + `ERROR_CODES` entry, `retryable` and a log level.
- Each dependency is a `Context.Service` with an owning `Layer` in `lib/effect/services/`; code yields the service, edges build layers per invocation. No `ManagedRuntime` and no module-scope client, pool or token (sole exception: the login-token cache in `lib/umami/client.ts`).
- Effects run only at edges: `runRoute` / `runPage` / `runBackground` (`lib/effect/edges.ts`) and `runWorkflowStep` (`lib/workflows/`). No `Effect.run*` mid-logic, no Promise wrapper around an Effect. TanStack `redirect()` / `notFound()` are thrown after the Effect returns.
- Every external call has an explicit `Effect.timeout` from `lib/effect/timeouts.ts` and passes the abort signal where accepted (`fetch`).
- Retry belongs to its owner: Workflows retry steps (map `retryable` to `NonRetryableError`, no `Schedule` inside a step), the queue consumer chooses `message.retry()` or ack, routes answer 503, email never retries.
- Best-effort work (email, alerts, DO push) recovers from a named tagged error and logs it; every `catch` logs.
- Data crossing a boundary (webhook bodies, Clerk and Umami responses, queue messages, Workflow params, DO requests, cookies, jsonb read back) is parsed with Zod into `InvalidInput` / `*Invalid`; Effect Schema is not used.
- Logs and spans go through `log` / `withSpan`, never `Effect.log*` / `Effect.withSpan` (those skip redaction and Workers traces).
- Parse failures live in `lib/parse/failures.ts` and serialize with `toParseErrorJson()`; stored and wire formats stay backward compatible.

## Client bundle

- Route modules, components and everything they import value-import no `effect`, tagged error class or module that does (`import type` is fine). Server work sits in `createServerFn` handlers or `server.handlers`, which Start strips from the client build (pattern: `getDashboard` in `app/routes/_protected/dashboard.tsx`, called from the `loader`); mixed modules split into an Effect-free one (pattern: `lib/parse/error-types.ts`).
- `validateSearch` schemas and `handleSchema` (`lib/schemas/handle.ts`) use `zod/mini`: they ship in the entry chunk and full `zod` doesn't tree-shake. `app/client.tsx` imports `lib/utils/zod-jitless.ts` first because the CSP has no `unsafe-eval`. `sonner` stays lazily loaded.
- `lib/telemetry/browser.ts` keeps type-only imports: it ships in the entry chunk.

## Resume lifecycle and Workflows

- Status transitions, retry eligibility and status presentation come from `lib/resume/lifecycle.ts`, never re-derived.
- Workflow steps are replay-safe: status-guarded `UPDATE … RETURNING`, SQL-side increments, and row ownership by `retryCount` (`ownsRow` in `lib/parse/pipeline.ts`, the required `retryCount` in `lib/resume/completion.ts`). Every parse run carries the row's `retryCount` in its params.
- Side effects that must not repeat (failure push, ops alert, email, public-page refresh) run in their own journaled no-retry step after the DB step.
- A new cron has its expression in `wrangler.jsonc` `triggers.crons` and a `case` in `scheduled()` (`worker/index.ts`).

## Email and rate limits

- Mail goes to the verified Clerk account email, never the resume's contact email. A send failure never blocks a status update.
- `EMAIL_FROM` matches the binding's `allowed_sender_addresses` and an onboarded domain.
- Rate limits fail closed: a store outage is `RateLimitUnavailable` (503 + `Retry-After`). Per-user quotas count with `readQuotaIn(tx, …)` under the user-row lock the caller's transaction holds, then `requireQuota(quota)` after it.

## Public pages, cache and SEO

- A page opts into the edge cache with `headers: () => edgeCacheHeaders(seconds, tags?)`, and its server render never reads the visitor.
- A write that changes a public page calls `revalidatePublicProfilePages` (inside a Workflow step, which has no `waitUntil`: `purgeEdgeTags(publicProfileTags(handles))`, as `lib/parse/public-refresh.ts` does), plus `notifyIndexNowForProfiles` for indexable profiles (`skipDebounce: true` when hiding, deleting or renaming).
- JSON-LD is embedded through `serializeJsonLd()` (`lib/seo/json-ld.ts`).
- A new public static route gets a `lib/seo/lastmod.json` key and a `STATIC_PAGES` entry (`lib/seo/static-pages.ts`); `/llms.txt` and `/llms-full.txt` are route handlers, so nothing of that name goes in `public/`.
- A new blog post is a `BLOG_POSTS` entry (`lib/blog/posts.ts`) plus `app/routes/blog/<slug>.tsx` calling `getPostBySlug("<slug>")!` at module scope; title ≤ 60 chars (else set `metaTitle`), description ≤ 160.

## Logging and telemetry

- Caught errors are logged as `...errorFields(error)`, never `String(error)`, client code included.
- No handles, names, emails or R2 keys (they end in the uploaded file name) in log fields, error messages or span attributes; span names and attributes stay low-cardinality.
- One `logEvent` per outcome; ids and enums named like the surrounding logs (`resumeId`, `errorType`), metrics in snake_case with their unit (`duration_ms`); failure events at `error` or `warn`.
- Browser funnel events go through `trackEvent`, typed in `ProductEvents` with enums and numbers only.

## Themes and UI

- Per-theme data lives in the existing `Record<ThemeId, …>` tables, no new per-theme maps. Server-loaded pages pass `THEME_CHROME[themeId]` entries as props; chrome components `import type` it.
- Copy uses `TEMPLATE_COUNT`, never a literal template count.
- `app/globals.css` forces `h1`–`h4` to `var(--font-display)`, so a template scopes its own heading font rule (see `components/templates/CaseFile.tsx`).
- Images are plain `<img>`; theme previews add `srcSet={previewSrcSet(preview)}` and a `sizes` matching the rendered width.
- Resume text is stored raw; nothing HTML-escapes it before storage.

## Tests

- A test pins consumer-visible behavior. SQL semantics (ownership predicates, jsonb operators, upserts, window functions) are tested on `createTestDb()` (`tests/helpers/pglite-db.ts`), never a mocked query chain; DB helpers under test take `PgQueryable`.
- Route tests hoist `vi.mock(...)`, `await import` the route and call `serverHandler(Route, "POST")` (`tests/helpers/server-route.ts`); sign-in uses `authenticateStub` / `authenticateAdminStub` (`tests/helpers/authenticate-stub.ts`). Mocks stay typed.
- Indexable-profile fixtures use `INDEXABLE_CONTENT` (≥ 100 words of resume text).
- Code that reads the request through `@tanstack/react-start/server` gets a `vi.mock` of that module.
