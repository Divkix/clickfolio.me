import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema> & { $client: Pool };

export function getDb(hyperdrive: Hyperdrive): Database {
  // Create clients per invocation; never cache request-scoped sockets at module scope.
  return drizzle({
    client: new Pool({
      connectionString: hyperdrive.connectionString,
      max: 5,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 20_000,
    }),
    schema,
  });
}
