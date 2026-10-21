import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { siteDataContentColumns } from "@/lib/data/site-data-content";
import { siteData, user } from "@/lib/db/schema";
import { createTestDb, INDEXABLE_CONTENT, type TestDb } from "@/tests/helpers/pglite-db";

const MIGRATION_SQL = readFileSync("migrations_pg/0011_remap_removed_themes.sql", "utf8");
const NOW = "2026-01-01T00:00:00.000Z";

// What 0011 itself remaps; later removals ship their own migration, so don't read the live map.
const REMAPPED = new Map([
  ["consulting_brief", "classic_ats"],
  ["dashboard", "workspace"],
  ["infographic", "bento"],
  ["networked", "bold_corporate"],
  ["noir", "midnight"],
  ["sidebar_photo", "bold_corporate"],
  ["timeline", "minimalist_editorial"],
]);

const client = new PGlite();
let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

beforeAll(async () => {
  testDb = await createTestDb(client);
  db = testDb.db;
});

afterAll(async () => {
  await testDb.close();
});

describe("0011_remap_removed_themes", () => {
  it("moves every removed theme to its replacement and leaves other rows alone", async () => {
    const stored: (string | null)[] = [...REMAPPED.keys(), "bento", "not_a_theme", null];

    await db.insert(user).values(
      stored.map((_, i) => ({
        id: `user_${i}`,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        createdAt: NOW,
        updatedAt: NOW,
      })),
    );
    await db.insert(siteData).values(
      stored.map((themeId, i) => ({
        id: `site_${i}`,
        userId: `user_${i}`,
        ...siteDataContentColumns(INDEXABLE_CONTENT),
        themeId,
        createdAt: NOW,
        updatedAt: NOW,
      })),
    );

    // Twice: the migration must be idempotent.
    await client.exec(MIGRATION_SQL);
    await client.exec(MIGRATION_SQL);

    const rows = await db.select({ id: siteData.id, themeId: siteData.themeId }).from(siteData);
    const byId = new Map(rows.map((row) => [row.id, row.themeId]));

    stored.forEach((themeId, i) => {
      const expected = (themeId && REMAPPED.get(themeId)) ?? themeId;

      expect(byId.get(`site_${i}`)).toBe(expected);
    });
  });
});
