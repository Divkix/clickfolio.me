import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema> & { $client: postgres.Sql };

const POSTGRES_OPTIONS = {
  prepare: false,
  fetch_types: false,
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
} as const;

export function getDb(hyperdrive: Hyperdrive): Database {
  const client = postgres(hyperdrive.connectionString, POSTGRES_OPTIONS);
  // SAFETY: drizzle(client, { schema }) returns PostgresJsDatabase whose runtime
  // $client is the postgres-js Sql instance; the Database type adds that explicitly.
  return drizzle(client, { schema }) as Database;
}
