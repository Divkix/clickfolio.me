import type { Config } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";

// Find the local D1 SQLite file dynamically
function getLocalD1Path(): string {
  const d1Dir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
  if (fs.existsSync(d1Dir)) {
    const files = fs.readdirSync(d1Dir).filter((f) => f.endsWith(".sqlite"));
    if (files.length > 0) {
      return path.join(d1Dir, files[0]);
    }
  }
  // Fallback - will error if not found, but that's expected if no local DB exists
  return ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/local.sqlite";
}

export default {
  schema: "./lib/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: getLocalD1Path(),
  },
} satisfies Config;
