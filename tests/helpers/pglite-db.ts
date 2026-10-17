import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { z } from "zod";
import * as schema from "@/lib/db/schema";
import type { ResumeContent } from "@/lib/types/database";

/**
 * In-process Postgres (PGlite) with every migration in migrations_pg/ applied, for tests that
 * need real SQL semantics (jsonb operators, window functions, upserts) instead of a mocked chain.
 */
const MIGRATIONS_DIR = "migrations_pg";

const journalSchema = z.object({ entries: z.array(z.object({ tag: z.string() })) });

export async function createTestDb(client: PGlite = new PGlite()) {
  const journal = journalSchema.parse(
    JSON.parse(readFileSync(join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8")),
  );

  // Simple-protocol exec, like drizzle-kit migrate over node-postgres: some migrations hold
  // several statements without breakpoints, which drizzle's pglite migrator would prepare.
  for (const { tag } of journal.entries) {
    await client.exec(readFileSync(join(MIGRATIONS_DIR, `${tag}.sql`), "utf8"));
  }

  const db = drizzle({ client, schema });

  return {
    db,
    reset: () => db.execute(sql`TRUNCATE "site_data", "resumes", "user" CASCADE`),
    close: () => client.close(),
  };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>["db"];

/** Passes isIndexableContent: real labels, experience + education, well over 100 words. */
export const INDEXABLE_CONTENT: ResumeContent = {
  full_name: "Avery Johnson",
  headline: "Senior Software Engineer",
  summary:
    "Backend engineer with a decade of experience designing distributed systems, leading small teams, mentoring junior developers, and shipping reliable APIs used by millions of people every day across web and mobile products.",
  contact: { email: "avery@example.com", phone: "+1-555-0100", location: "Portland, OR" },
  experience: [
    {
      title: "Senior Software Engineer",
      company: "Northwind Systems",
      location: "Remote",
      start_date: "2019-03",
      end_date: "Present",
      description:
        "Own the billing platform end to end, from schema design and capacity planning to on-call runbooks and incident reviews with product partners.",
      highlights: [
        "Cut p99 checkout latency by forty percent by moving hot reads to a regional cache",
        "Led the migration of twelve services from a monolith to independently deployed workers",
        "Mentored five engineers through promotion with weekly pairing and design reviews",
      ],
    },
    {
      title: "Software Engineer",
      company: "Contoso Labs",
      location: "Seattle, WA",
      start_date: "2015-06",
      end_date: "2019-02",
      description:
        "Built internal tooling for data pipelines and wrote the first version of the public reporting API.",
    },
  ],
  education: [
    {
      degree: "BS Computer Science",
      institution: "Oregon State University",
      location: "Corvallis, OR",
      graduation_date: "2015",
    },
  ],
  skills: [
    { category: "Languages", items: ["TypeScript", "Go", "Python", "SQL"] },
    { category: "Infrastructure", items: ["Postgres", "Kubernetes", "Terraform"] },
  ],
  projects: [
    {
      title: "Open Ledger",
      description: "Open source double entry accounting library with streaming exports.",
      technologies: ["TypeScript", "Postgres"],
    },
  ],
};

/** Fails isIndexableContent: placeholder headline. */
export const THIN_CONTENT: ResumeContent = { ...INDEXABLE_CONTENT, headline: "Your headline" };
