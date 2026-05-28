import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * Drizzle D1 database instance typed with the local schema.
 * The `$client` property exposes the raw D1 binding for direct SQL access.
 */
type SchemaDb = DrizzleD1Database<typeof schema> & { $client: D1Database };

/**
 * Module-level cache for Drizzle instances, keyed by raw D1 binding identity.
 *
 * Within a single Cloudflare Workers isolate, `env.CLICKFOLIO_DB` is the same object
 * reference on every request, so the drizzle() constructor (schema parsing,
 * relation graph) runs exactly once per isolate rather than once per request.
 * WeakMap ensures automatic cleanup when the binding is garbage-collected.
 */
const dbInstanceCache = new WeakMap<D1Database, SchemaDb>();

/**
 * Returns a singleton Drizzle D1 database instance per isolate.
 *
 * Uses a `WeakMap` keyed by the raw `D1Database` binding to cache the drizzle
 * constructor (schema parsing, relation graph) exactly once per Cloudflare
 * Workers isolate, rather than once per request. The WeakMap ensures automatic
 * cleanup when the binding is garbage-collected.
 *
 * **This is the canonical accessor** — do not construct `drizzle()` directly.
 *
 * @param d1 - The raw D1 database binding from the environment.
 * @returns A typed Drizzle database instance.
 */
export function getDb(d1: D1Database): SchemaDb {
  const cached = dbInstanceCache.get(d1);
  if (cached) return cached;

  const db = drizzle(d1, { schema }) as SchemaDb;
  dbInstanceCache.set(d1, db);
  return db;
}

export type Database = SchemaDb;
