# Coding standards — clickfolio.me

Review-time rules: judgement calls no linter can make. Lint, types, tests, knip and Start's import
protection already enforce the mechanical ones; when an `anti-slop*` rule fires, its rule file in
`tools/oxlint/anti-slop/` explains it. Subsystem invariants live in their module's header comment;
read it before changing the module.

## Server I/O (Effect)

- Every server call to something external (Postgres, Clerk, R2, email, queues, Durable Objects,
  Workflow bindings, third-party `fetch`) is an Effect failing with a tagged error from
  `lib/effect/failures.ts`; `lib/effect/failure-map.ts` gives each tag its status, code,
  `retryable` flag and log level.
- One `Context.Service` + owning `Layer` per dependency (`lib/effect/services/`). Edges build
  layers per invocation; module scope holds no client, pool or token (sole exception:
  `lib/umami/client.ts`, whose header says why).
- Effects run only at edges: `lib/effect/edges.ts`, `runWorkflowStep` inside `step.do`, and the
  server-fn handler of a page. TanStack `redirect()`/`notFound()` are thrown after the Effect returns.
- Each external call has an explicit timeout from `lib/effect/timeouts.ts` and passes the Effect
  `AbortSignal` where accepted. A timeout only stops waiting, so a timed-out non-idempotent write
  (email, queue send, DO notify, R2 put, webhook POST) is never retried.
- Retry belongs to the layer that owns it: Workflows retries steps, the queue consumer picks
  `retry()` vs ack, routes answer 503, email never retries. No `Schedule` inside a step.
- Best-effort work (email, alerts, DO push) recovers from a named tag and logs it.
- Data crossing a boundary (webhooks, Clerk/Umami responses, queue messages, Workflow params, DO
  requests, cookies, jsonb read back) is parsed with Zod into a tagged `InvalidInput`/`*Invalid`.
  Zod is the only validator; DB access stays Drizzle.
- Logs and spans go through `log` and `withSpan`, which redact and reach Workers traces.
- Parse failures live in `lib/parse/failures.ts`; stored and wire JSON stays backward compatible.

## Client-reachable code

- Route modules, components, `app/client.tsx` and their imports stay Effect-free: `import type`
  only, plain `switch`/`if` on wire strings instead of `Match` or tag classes. Server work goes in a
  `createServerFn(...).handler` or `server.handlers`, the bodies Start strips from the client
  (pattern: `lib/parse/error-types.ts` split from `lib/parse/failures.ts`).
- Entry-chunk code stays small: search schemas and `lib/schemas/handle.ts` use `zod/mini`,
  `lib/telemetry/browser.ts` has type-only imports, `sonner` loads on demand.

## API routes

- Shape: `app/routes/api/profile/role.ts`. Wrap handlers in `withUserEffect`/`withAdminEffect`
  (`lib/auth/with-auth.ts`); success via `createSuccessResponse`; a 4xx inside the Effect fails
  with its tagged error. `createErrorResponse` is for checks before the Effect and statuses with
  no tag.
- Bound JSON bodies with `oversizedBodyResponse` + `readJsonBody` (`lib/effect/json-body.ts`) and
  a schema from `lib/schemas/`.
- Crawler- or cache-kept bodies (sitemaps, OG images) answer a failed read with `retryLater`
  (`lib/effect/retry-later.ts`) and a fixed route label, never a degraded 200.

## Auth

- Sessions come only from the `__session` cookie; `Authorization: Bearer` is never a fallback.
  Signed-out is 401; Clerk or config failure is `ClerkFailed` (5xx), never a sign-out.
- Admin checks re-read `isAdmin` from the DB; `user.role` is a career level, never authz.

## Data

- `getDb(env.HYPERDRIVE)` per invocation; multi-row writes in one `db.transaction`; Postgres
  `23505` maps to 409.
- Timestamps `timestamptz` with `mode: "string"`; enum-like columns are `text` + a TS union; JSON
  is `jsonb`.
- Rate limiters fail closed (`lib/rate-limit/store-failure.ts`).
- Resume status and retry decisions call `lib/resume/lifecycle.ts`, never re-derive them.

## Logging and telemetry

- Caught errors log as `...errorFields(error)`, client code included.
- Log fields, span attributes and error messages carry no handles, names, emails or R2 keys (keys
  end in the uploaded file name). Route labels are fixed strings.
- One `logEvent` per business outcome; ids/enums named like the surrounding logs, numbers in
  snake_case with their unit (`duration_ms`). Browser `trackEvent` payloads are enums and numbers.
- Span names and attributes stay low-cardinality.

## Tests

- Real SQL semantics (ownership predicates, jsonb, upserts) run on `createTestDb()`
  (`tests/helpers/pglite-db.ts`), not a mocked query chain.
- Route tests: hoisted `vi.mock`, then `serverHandler(Route, "POST")`
  (`tests/helpers/server-route.ts`); sign-in via `tests/helpers/authenticate-stub.ts`.
- Mocks are typed; `as unknown as` and `as never` are dodges, not types.
- A removed behavioural test needs a replacement covering the same behaviour; coverage
  thresholds do not notice.

## Misc

- JSON-LD is embedded via `serializeJsonLd()` (`lib/seo/json-ld.ts`).
- Theme previews use `srcSet={previewSrcSet(preview)}` with a `sizes` matching rendered width.
- Copy uses `TEMPLATE_COUNT`, never a literal template count.
