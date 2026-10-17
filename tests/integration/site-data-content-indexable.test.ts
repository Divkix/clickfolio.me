import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { buildSiteDataUpsert } from "@/lib/data/site-data-upsert";
import { siteDataContentColumns } from "@/lib/data/site-data-content";
import { resumes, siteData, user } from "@/lib/db/schema";
import { isIndexableContent, isIndexableProfile } from "@/lib/seo/profile-indexability";
import {
  createTestDb,
  INDEXABLE_CONTENT,
  THIN_CONTENT,
  type TestDb,
} from "@/tests/helpers/pglite-db";

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

  await db.insert(user).values({
    id: "user_1",
    name: "Avery",
    email: "avery@example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  await db.insert(resumes).values(
    ["resume_1", "resume_2", "resume_3"].map((id) => ({
      id,
      userId: "user_1",
      r2Key: `users/user_1/${id}.pdf`,
      createdAt: "2026-01-01T00:00:00.000Z",
    })),
  );
});

async function storedFlag(): Promise<boolean | null | undefined> {
  const rows = await db
    .select({ contentIndexable: siteData.contentIndexable })
    .from(siteData)
    .where(eq(siteData.userId, "user_1"));

  return rows[0]?.contentIndexable;
}

describe("isIndexableContent", () => {
  it("accepts realistic content and rejects thin or placeholder content", () => {
    expect(isIndexableContent(INDEXABLE_CONTENT)).toBe(true);
    expect(isIndexableContent(THIN_CONTENT)).toBe(false);
    expect(isIndexableContent({ ...INDEXABLE_CONTENT, full_name: "John Doe" })).toBe(false);
    expect(isIndexableContent({ ...INDEXABLE_CONTENT, experience: [], education: [] })).toBe(false);
    expect(
      isIndexableContent({
        ...INDEXABLE_CONTENT,
        summary: "Short.",
        experience: [
          { title: "Engineer", company: "Acme", start_date: "2020", description: "Built." },
        ],
        projects: [],
        skills: [],
      }),
    ).toBe(false);
  });

  it("is isIndexableProfile without the privacy check", () => {
    for (const content of [INDEXABLE_CONTENT, THIN_CONTENT]) {
      expect(isIndexableProfile(content, { hide_from_search: false })).toBe(
        isIndexableContent(content),
      );
      expect(isIndexableProfile(content, { hide_from_search: true })).toBe(false);
    }
  });
});

describe("siteDataContentColumns", () => {
  it("pairs content with its indexability flag", () => {
    expect(siteDataContentColumns(INDEXABLE_CONTENT)).toEqual({
      content: INDEXABLE_CONTENT,
      contentIndexable: true,
    });
    expect(siteDataContentColumns(THIN_CONTENT)).toEqual({
      content: THIN_CONTENT,
      contentIndexable: false,
    });
  });
});

describe("buildSiteDataUpsert sets content_indexable", () => {
  it("on insert", async () => {
    await buildSiteDataUpsert(db, "user_1", "resume_1", INDEXABLE_CONTENT);

    expect(await storedFlag()).toBe(true);
  });

  it("on conflict update, flipping both ways", async () => {
    await buildSiteDataUpsert(db, "user_1", "resume_1", INDEXABLE_CONTENT);
    await buildSiteDataUpsert(db, "user_1", "resume_2", THIN_CONTENT, { publish: false });

    expect(await storedFlag()).toBe(false);

    await buildSiteDataUpsert(db, "user_1", "resume_3", INDEXABLE_CONTENT);

    expect(await storedFlag()).toBe(true);
  });

  it("on the guarded (onlyIfUpdatedAtLte) update, and leaves it alone when the guard skips", async () => {
    await buildSiteDataUpsert(db, "user_1", "resume_1", THIN_CONTENT);

    await buildSiteDataUpsert(db, "user_1", "resume_2", INDEXABLE_CONTENT, {
      onlyIfUpdatedAtLte: "2999-01-01T00:00:00.000Z",
    });

    expect(await storedFlag()).toBe(true);

    await buildSiteDataUpsert(db, "user_1", "resume_3", THIN_CONTENT, {
      onlyIfUpdatedAtLte: "2000-01-01T00:00:00.000Z",
    });

    expect(await storedFlag()).toBe(true);
  });
});
