import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Drizzle Postgres instance typed with the canonical schema.
 * The `$client` property exposes the raw postgres-js client for direct SQL
 * (e.g. raw conditional inserts keyed on PostgreSQL row counts/codes).
 */
export type Database = PostgresJsDatabase<typeof schema> & { $client: postgres.Sql };

/**
 * Cloudflare Workers only keep database client connections alive for one
 * invocation. Keep the schema module global, but create the postgres-js client
 * inside the current invocation; Hyperdrive owns the reusable origin pool.
 *
 * Never cache the returned database or `$client` across requests. Reusing a
 * client retains request-scoped sockets that fail immediately on a later
 * invocation.
 */

/** Postgres-JS options tuned for Hyperdrive (see Cloudflare + Drizzle docs). */
const POSTGRES_OPTIONS = {
  // Hyperdrive does not support prepared statements at the protocol edge —
  // postgres-js must inline parameters instead.
  prepare: false,
  // Avoid a round-trip of type catalog queries on connect; Drizzle maps types.
  fetch_types: false,
  // Small pooled-connection cap: each Worker isolate gets its own pool, and
  // PlanetScale/PG maxes out quickly if isolates open large pools.
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
} as const;

/**
 * Returns a new Drizzle Postgres database instance for the current invocation.
 *
 * **This is the canonical accessor** — do not construct `postgres()` /
 * `drizzle()` directly. Multi-statement atomicity uses
 * `db.transaction(async (tx) => ...)`.
 *
 * @param hyperdrive - The HYPERDRIVE binding from the Workers environment.
 * @returns A typed Drizzle database instance over the PG schema.
 */
export function getDb(hyperdrive: Hyperdrive): Database {
  const client = postgres(hyperdrive.connectionString, POSTGRES_OPTIONS);
  // SAFETY: drizzle(client, { schema }) returns PostgresJsDatabase whose runtime
  // $client is the postgres-js Sql instance; the Database type adds that explicitly.
  return drizzle(client, { schema }) as Database;
}
