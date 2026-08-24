import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration for PlanetScale Postgres (logical DB `clickfolio`
 * on the `side-projects` cluster), reached through Cloudflare Hyperdrive
 * (binding HYPERDRIVE in wrangler.jsonc).
 *
 * Connection topology — read this before "fixing" the url:
 *   - The Hyperdrive binding is only resolvable inside a Worker at runtime.
 *     drizzle-kit runs in plain Node, so it CANNOT use HYPERDRIVE. For local
 *     `drizzle-kit push|studio|migrate` set DATABASE_URL to the DIRECT
 *     PlanetScale connection string (PlanetScale console → clickfolio →
 *     Connect → Postgres URL).
 *   - The deployed Worker connects via `env.HYPERDRIVE.connectionString` with
 *     the postgres-js driver (drizzle-orm/postgres-js) — see lib/db/index.ts.
 *
 * Usage:
 *   DATABASE_URL="postgres://..." pnpm exec drizzle-kit generate
 *   DATABASE_URL="postgres://..." pnpm exec drizzle-kit push
 *
 * Migrations land in ./migrations_pg.
 */
const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./lib/db/schema/index.ts",
  out: "./migrations_pg",
  dialect: "postgresql",
  dbCredentials: {
    // generate works offline; push/migrate/studio need a real reachable URL.
    url: url ?? "postgres://unset-DATABASE_URL:unset@localhost:5432/clickfolio",
  },
});
