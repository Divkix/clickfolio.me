# Effect v4 resume parsing pilot

## Status (2026-10-24): expanded beyond the pilot

The pilot decision below ("stop at this boundary") is superseded. All server code that
talks to something external now moves to Effect, one area per PR; the rules live in
AGENTS.md ("Effect (server I/O)"). Differences from the pilot gates:

- Layers are allowed: each external dependency is a `Context.Service` with an owning `Layer`, built per invocation at the edge.
- Zod stays the only validator; Effect Schema is not introduced.
- `effect` must never reach the browser bundle. Start's import protection (`importProtection` in `vite.config.ts`) fails `pnpm run build` and prints the import trace.
- The 25 KiB gzip budget no longer applies per area; re-measure `wrangler deploy --dry-run` in each PR (baseline at `main@3327340b`: 2656.69 KiB gzip).

## Gates

- Scope: `lib/ai`, parse attempt bodies and their Workflow adapter. No API or Layer migration.
- Version: exact `effect@4.0.4`, accepted by the existing pnpm release-age policy.
- Provisional bundle budget: at most 25 KiB additional gzip. Workflows owns retries and journaling.
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

- [Effect 4.0.4 source and API documentation](https://github.com/Effect-TS/effect/tree/effect%404.0.4/packages/effect/src).
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

Decision: **keep the parser pilot and stop at this boundary**. Typed failures and
validated resume values remove ambiguity, JSON re-parsing, and thirteen assertions.
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
- API routes, Layers, Effect SQL, claim/completion/cache-expiry logic, and database
  schema remain outside the migration.
