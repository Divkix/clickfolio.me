# Effect v4 resume parsing pilot

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
