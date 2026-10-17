import { PGlite, type QueryOptions } from "@electric-sql/pglite";
import { asc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { backfillContentIndexable } from "@/lib/data/content-indexable-backfill";
import { siteData, user } from "@/lib/db/schema";
import {
  createTestDb,
  INDEXABLE_CONTENT,
  THIN_CONTENT,
  type TestDb,
} from "@/tests/helpers/pglite-db";
import type { ResumeContent } from "@/lib/types/database";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
});

const T0 = "2026-01-01T00:00:00.000Z";

/** A pre-migration row: content written without the flag (as the old Worker does). */
async function seedLegacyRow(
  id: string,
  content: ResumeContent,
  contentIndexable: boolean | null = null,
) {
  await db.insert(user).values({
    id: `user_${id}`,
    name: id,
    email: `${id}@example.com`,
    createdAt: T0,
    updatedAt: T0,
  });
  await db.insert(siteData).values({
    id,
    userId: `user_${id}`,
    content,
    contentIndexable,
    createdAt: T0,
    updatedAt: T0,
  });
}

async function flags() {
  const rows = await db
    .select({ id: siteData.id, contentIndexable: siteData.contentIndexable })
    .from(siteData)
    .orderBy(asc(siteData.id));

  return Object.fromEntries(rows.map((row) => [row.id, row.contentIndexable]));
}

describe("backfillContentIndexable", () => {
  it("fills NULL rows across several batches with the content-only predicate", async () => {
    await seedLegacyRow("a", INDEXABLE_CONTENT);
    await seedLegacyRow("b", THIN_CONTENT);
    await seedLegacyRow("c", INDEXABLE_CONTENT);
    await seedLegacyRow("d", THIN_CONTENT);
    await seedLegacyRow("e", INDEXABLE_CONTENT);

    const result = await backfillContentIndexable(db, { batchSize: 2 });

    expect(result).toEqual({ updated: 5, indexable: 3, malformed: 0 });
    expect(await flags()).toEqual({ a: true, b: false, c: true, d: false, e: true });
  });

  it("leaves rows that already carry a flag untouched and is idempotent", async () => {
    // Deliberately "wrong" stored flag: the backfill must not recompute non-NULL rows.
    await seedLegacyRow("a", THIN_CONTENT, true);
    await seedLegacyRow("b", INDEXABLE_CONTENT);

    expect(await backfillContentIndexable(db)).toEqual({ updated: 1, indexable: 1, malformed: 0 });
    expect(await backfillContentIndexable(db)).toEqual({ updated: 0, indexable: 0, malformed: 0 });
    expect(await flags()).toEqual({ a: true, b: true });
  });

  it("with updatedSince, recomputes stale flags on rows changed since then (old-Worker writes)", async () => {
    // First pass already ran; then the old Worker rewrote content without touching the flag.
    await seedLegacyRow("a", THIN_CONTENT, true);
    await seedLegacyRow("b", INDEXABLE_CONTENT, false);
    await seedLegacyRow("c", INDEXABLE_CONTENT);
    await db
      .update(siteData)
      .set({ updatedAt: "2026-03-01T00:00:00.000Z" })
      .where(eq(siteData.id, "b"));

    const result = await backfillContentIndexable(db, {
      batchSize: 1,
      updatedSince: "2026-02-01T00:00:00.000Z",
    });

    // "a" was last written before the cutoff, so its (deliberately wrong) flag is left alone;
    // "b" changed after it and is corrected; "c" is NULL and filled regardless of the cutoff.
    expect(result).toEqual({ updated: 2, indexable: 2, malformed: 0 });
    expect(await flags()).toEqual({ a: true, b: true, c: true });
  });

  it("stores malformed legacy content as not indexable instead of aborting", async () => {
    await seedLegacyRow("a", INDEXABLE_CONTENT);
    // Legacy jsonb without the experience array makes the predicate throw.
    await db
      .update(siteData)
      .set({ content: sql`${siteData.content} - 'experience'` })
      .where(eq(siteData.id, "a"));

    expect(await backfillContentIndexable(db)).toEqual({ updated: 1, indexable: 0, malformed: 1 });
    expect(await flags()).toEqual({ a: false });
  });

  it("re-reads a row whose content changed after it was read instead of stamping a stale flag", async () => {
    let raced = false;

    // An old-Worker content write lands between the backfill's read and its guarded update.
    class RacingPGlite extends PGlite {
      override async query<T>(query: string, params?: unknown[], options?: QueryOptions) {
        if (!raced && query.startsWith('update "site_data" set "content_indexable"')) {
          raced = true;
          await super.query(
            `update site_data set content = $1, updated_at = '2026-02-01T00:00:00.000Z' where id = 'a'`,
            [JSON.stringify(INDEXABLE_CONTENT)],
          );
        }

        return super.query<T>(query, params, options);
      }
    }

    const racing = await createTestDb(new RacingPGlite());

    try {
      db = racing.db;
      await seedLegacyRow("a", THIN_CONTENT);

      const result = await backfillContentIndexable(racing.db);

      expect(raced).toBe(true);
      // Without the updated_at guard this would be false, computed from the stale THIN_CONTENT.
      expect(result).toEqual({ updated: 1, indexable: 1, malformed: 0 });
      expect(await flags()).toEqual({ a: true });
    } finally {
      db = testDb.db;
      await racing.close();
    }
  });
});
