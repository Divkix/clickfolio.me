# Create Hyperdrive database clients per invocation

**Date:** 2026-08 • **Status:** Accepted

## Decision

`getDb(env.HYPERDRIVE)` creates a new postgres-js client and Drizzle database for
each call made inside a Worker invocation. It must never cache the database or
`$client` in module scope. Hyperdrive owns the reusable origin connection pool;
Workers automatically clean up the edge client when the fetch, queue, scheduled,
or Durable Object invocation ends, so callers do not call `sql.end()`.

The imported schema stays module-scoped. The driver options remain
`prepare:false`, `fetch_types:false`, `max:5`, `idle_timeout:20`, and
`connect_timeout:10`.

## Why

Cloudflare Workers do not permit I/O objects to cross request contexts. The
original Postgres cutover cached a postgres-js pool by Hyperdrive connection
string, so later requests reused sockets created by an earlier invocation.
Production then alternated between successful requests and immediate database
failures: concurrent `/api/health` probes returned roughly half 200 and half 503,
with failed `SELECT 1` calls reporting 0 ms latency. The same first-query failure
broke protected pages and admin APIs while the identical SQL always succeeded
through a direct PlanetScale connection.

Cloudflare explicitly requires database clients to be created inside each
handler and identifies global or cross-request driver pools as the cause of
stale-connection and request-context I/O errors:

- [Hyperdrive connection lifecycle](https://developers.cloudflare.com/hyperdrive/concepts/connection-lifecycle/)
- [Hyperdrive stale connection troubleshooting](https://developers.cloudflare.com/hyperdrive/observability/troubleshooting/#stale-connection-and-io-context-errors)
- [postgres-js with Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/postgres-js/)

## Consequences

- All existing callers keep using the single `getDb(env.HYPERDRIVE)` accessor.
- Constructing the lightweight edge client and Drizzle wrapper per call is
  intentional; Hyperdrive avoids a new origin database handshake.
- `db.transaction()` and raw `$client` SQL retain their existing semantics but
  are valid only during the current invocation.
- `__tests__/unit/lib/db/accessor.test.ts` guards against reintroducing shared
  client state by requiring consecutive calls to return distinct clients.
