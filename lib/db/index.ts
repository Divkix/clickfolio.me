import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type SchemaDb = DrizzleD1Database<typeof schema> & { $client: D1Database };

/**
 * Module-level cache for Drizzle instances, keyed by raw D1 binding identity.
 *
 * Within a single Cloudflare Workers isolate, `env.DB` is the same object
 * reference on every request, so the drizzle() constructor (schema parsing,
 * relation graph) runs exactly once per isolate rather than once per request.
 * WeakMap ensures automatic cleanup when the binding is garbage-collected.
 */
const dbInstanceCache = new WeakMap<D1Database, SchemaDb>();

// For use in API routes and server components where we have access to env
export function getDb(d1: D1Database): SchemaDb {
  const cached = dbInstanceCache.get(d1);
  if (cached) return cached;

  const db = drizzle(d1, { schema }) as SchemaDb;
  dbInstanceCache.set(d1, db);
  return db;
}

export type Database = SchemaDb;
