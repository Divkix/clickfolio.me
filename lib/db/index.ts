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
 * Module-level cache of Drizzle instances, keyed by Hyperdrive connection string.
 *
 * Within a single Cloudflare Workers isolate, `env.HYPERDRIVE.connectionString`
 * is stable across requests, so this keeps one postgres-js socket pool alive
 * (instead of paying TCP + TLS setup per invocation) AND runs the drizzle()
 * constructor (schema parsing, relation graph) exactly once per isolate.
 * Hyperdrive does not support prepared statements at the protocol edge, and a
 * small pooled-connection cap avoids exhausting PlanetScale connections across
 * many isolates.
 */
const dbInstanceCache = new Map<string, Database>();

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
 * Returns a singleton Drizzle Postgres database instance per isolate.
 *
 * **This is the canonical accessor** — do not construct `postgres()` /
 * `drizzle()` directly. Multi-statement atomicity uses
 * `db.transaction(async (tx) => ...)`.
 *
 * @param hyperdrive - The HYPERDRIVE binding from the Workers environment.
 * @returns A typed Drizzle database instance over the PG schema.
 */
export function getDb(hyperdrive: Hyperdrive): Database {
  const connectionString = hyperdrive.connectionString;

  const cached = dbInstanceCache.get(connectionString);
  if (cached) return cached;

  const client = postgres(connectionString, POSTGRES_OPTIONS);
  // SAFETY: drizzle(client, { schema }) returns PostgresJsDatabase whose runtime
  // $client is the postgres-js Sql instance; the Database type adds that explicitly.
  const db = drizzle(client, { schema }) as Database;
  dbInstanceCache.set(connectionString, db);
  return db;
}
