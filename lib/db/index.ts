import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { traceQueries } from "./query-spans";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema> & { $client: Pool };

/** Any Drizzle handle on this schema: a `Database`, one of its transactions, or a test database. */
export type PgQueryable = PgDatabase<PgQueryResultHKT, typeof schema>;

export function getDb(hyperdrive: Hyperdrive): Database {
  // Create clients per invocation; never cache request-scoped sockets at module scope.
  const pool = new Pool({
    connectionString: hyperdrive.connectionString,
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 20_000,
  });

  pool.on("connect", traceQueries);

  return drizzle({ client: pool, schema });
}
