# Effect v4 resume parsing pilot

## Status (2026-10): expanded beyond the pilot

The pilot's "stop at this boundary" decision is superseded by the Effect
hardening project. Its decisions (rules in `AGENTS.md`, "Effect (server)" and
"No Effect in client-reachable code"):

- Effect covers all server I/O: routes, server modules under `lib/`, cron, the
  queue consumer, the Durable Object and Workflows. No framework migration.
- Effects run only at edges: one route-handler helper, `runStep` in Workflow
  steps, and the cron/queue/DO handlers. No `runPromise` mid-logic, no Promise
  wrappers around Effects.
- No `ManagedRuntime` or module-scope I/O; `getDb(env.HYPERDRIVE)` per
  invocation. Plain arguments first; `Context`/`Layer` services only for a
  dependency threaded through 3+ levels, built per invocation.
- Zod stays the only validator; a server-only helper maps Zod failures to a
  tagged `InvalidInput` error. No Effect Schema.
- Every tagged error maps to an HTTP status + `ERROR_CODES` entry, a retryable
  flag and a log level. Every external call has an explicit timeout. Workflows
  own retries inside steps; routes fail fast.
- Stored and wire formats stay backward compatible (`toParseErrorJson`,
  existing error types).
- No Effect in client-reachable code, shared contract modules included. The
  `client-effect-guard` plugin in `vite.config.ts` fails `pnpm run build` when
  the client module graph reaches `effect` and prints each importer chain.

Bundle size: the client delta must stay 0 (the guard enforces it). Project
baseline at `main@3327340b` with wrangler 4.151.3: `pnpm run build`, then
`pnpm exec wrangler deploy --dry-run --outdir <new dir>`, gives 8784.80 KiB
upload / 2656.69 KiB gzip. It already includes the pilot's Effect code.
Unrelated changes since the pilot's `d9b85996` baseline put it 11.84 KiB gzip
below that one, so the pilot tables below are history, not a baseline. The
gate: the project's Effect work may grow the server gzip by at most 6.34 KiB
over 2656.69 KiB, the rest of the pilot's 25 KiB budget after its 18.66 KiB.
At the end of the project, build the final branch and measure it with the same
command and wrangler version into a fresh outdir. If the toolchain changed,
rebuild `3327340b` with it and compare those two numbers. Measure non-Effect
changes made during the project (features, dependency bumps) separately and
leave them out of the delta. Going over needs an explicit decision recorded
here.

## Pilot gates (historical)

- Scope: `lib/ai`, parse attempt bodies and their Workflow adapter. No API or
  Layer migration. _Superseded: see Status._
- Version: exact `effect@4.0.5` in `package.json` (the pilot measured 4.0.4),
  accepted by the existing pnpm release-age policy.
- Provisional bundle budget: at most 25 KiB additional gzip. Workflows owns retries and journaling.
  _Its remaining 6.34 KiB gates the project's server growth over the
  `main@3327340b` baseline (2656.69 KiB gzip): see Status._
- Keep stored error JSON and successful `parse` step output compatible with existing rows and journals.

## Baseline and spike

Measured from commit `d9b85996` with pnpm 12.6.0. `pnpm run build` followed by
`pnpm exec wrangler deploy --dry-run --outdir /private/tmp/effect-baseline-worker`:

| Build                               | Wrangler upload |        Gzip |
| ----------------------------------- | --------------: | ----------: |
| Baseline                            |     8655.99 KiB | 2668.53 KiB |
| Minimal Effect call in `parse` step |     8677.52 KiB | 2676.16 KiB |

Spike adds 7.63 KiB gzip. `pnpm run verify`, `pnpm run test` (591 tests), and
`pnpm run build` pass. Existing lint reports eight warnings and zero errors.
Wrangler dry-run reports bundle sizes, but does not report Worker startup CPU time.

## Sources

- [Effect 4.0.5 source and API documentation](https://github.com/Effect-TS/effect/tree/effect%404.0.5/packages/effect/src).
- [Current migration guide](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md).
- [v4 timeout semantics](https://effect.website/docs/v4/error-management/timing-out): feed the Effect cancellation signal into the SDK request.
- [Flattened Cause model](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Cause.ts): preserve defects at the Workflow boundary.

The plan's `effect-smol` migration link is archived. Explicit serialization keeps
the legacy `name: "ParseError"` and wire type strings independent of Effect tags.

## Final measurements and decision

Both bundle gates pass. Using fresh output directories prevents stale hashed
chunks from earlier builds from inflating the startup profiler's module list.

| Measurement                             |              Baseline |           Final pilot |
| --------------------------------------- | --------------------: | --------------------: |
| Wrangler dry-run gzip                   |           2668.53 KiB |           2687.19 KiB |
| Startup profiler gzip (same configs)    |           2668.47 KiB |           2686.95 KiB |
| Local startup active CPU, three samples | 24.1 / 24.1 / 24.1 ms | 22.6 / 24.0 / 22.7 ms |
| Local startup active CPU, median        |               24.1 ms |               22.7 ms |

The final profiler delta is **18.48 KiB gzip**, within the provisional 25 KiB
budget. Local startup samples show no regression; they do not measure production
cold starts. Compression totals differ slightly between Wrangler commands, so
compare numbers from the same command.

Reproduce size measurement after `pnpm run build`, choosing a new output directory for each build:

```sh
pnpm exec wrangler deploy --dry-run --outdir /private/tmp/effect-final-clean-worker
```

For startup profiling, point a temporary Wrangler config at each saved bundle's
`index.js`, preserve `compatibility_date` and `compatibility_flags`, set
`find_additional_modules: true`, and omit bindings. Then run, alternating the two
configs three times:

```sh
pnpm exec wrangler check startup \
  --config /private/tmp/effect-pilot-runtime/final-wrangler.json \
  --outfile /private/tmp/effect-pilot-runtime/final-clean.cpuprofile \
  --args='--no-bundle --config /private/tmp/effect-pilot-runtime/final-wrangler.json'
```

The same local smoke also executed the real `runStep` adapter inside a journaled
Workflow step. Success returns its value; a transient failure throws plain
`Error`; a permanent failure retains the exact `NonRetryableError` name; ordinary
and mixed-cause defects retain their identity. No production services were used.

### Validation

- `pnpm run verify && pnpm run test && pnpm run build`: pass, **710 tests in 27 files**.
- `pnpm run test:coverage`: pass. Statements 39.10%, branches 48.40%, functions
  42.54%, lines 39.35%; all repository thresholds hold unchanged.
- Repeated verification, coverage and build in a disposable Docker copy with
  **Node 22.22.1 and pnpm 12.6.0**: pass. The host uses Node 26.11.1, so the
  isolated run supplies the required pinned-Node validation.
- Existing lint warnings: eight, unchanged; zero errors.
- `pnpm run preview --port 8799 --inspector-port 9399 --local --show-interactive-dev-session=false`:
  build passes, but Wrangler cannot start without
  `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`. This worktree also
  lacks Clerk and AI Gateway credentials. The signed-in good/encrypted/scanned
  PDF upload and WebSocket check remains a pre-merge integration check.

### Code comparison

Counted source lines in `lib/parse/errors.ts`, `lib/parse/pipeline.ts`, and all
`lib/ai/*.ts`; new failure/adapter files are shown separately rather than omitted.
Tests and generated files are excluded.

| Measure                                             | Baseline | Final |
| --------------------------------------------------- | -------: | ----: |
| Lines in the existing files                         |     2503 |  2335 |
| Lines including new `failures.ts` and `run-step.ts` |     2503 |  2512 |
| JavaScript catch blocks                             |       15 |     2 |
| Effect recovery sites (`catch` / `catchTag`)        |        0 |     9 |
| Promise boundary error mappings (`catch:`)          |        0 |    16 |
| `// SAFETY:` assertions/comments                    |       62 |    49 |

_Superseded (2026-10): see Status._ Pilot decision: **keep the parser pilot and
stop at this boundary**. Typed failures and validated resume values remove
ambiguity, JSON re-parsing, and thirteen assertions.
Total source size is nearly unchanged; Effect still adds recovery/mapping syntax.
Review maintainability and real parse behavior before expanding to `with-auth.ts`
or introducing Layers.

### Compatibility details

- Explicit wire serialization preserves legacy names, type strings, keys and
  retryability. Old stored rows remain readable; legacy `ParseError` is removed.
- Workflow names, retry/timeouts, email step and successful parse output stay
  unchanged. A replay without `career` still completes using the existing null
  fallback.
- Current failure metadata takes precedence over stale rows. Serialized Workflow
  failures can recover their wire metadata from the database after a replay.
- PDF/AI/R2 errors are tagged at their source; the remaining unknown-source
  classifier handles PostgreSQL/network errors. Notifications and alert failures
  are ignored and logged. This parse path creates no temporary R2 object to delete.
- At pilot time, API routes, Layers, Effect SQL, claim/completion/cache-expiry
  logic, and database schema remained outside the migration. _Superseded: see
  Status._
