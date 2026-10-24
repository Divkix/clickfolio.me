import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { updatePrivacySettings } from "@/lib/data/privacy-settings";
import { user } from "@/lib/db/schema";
import { rowVersionSchema } from "@/lib/schemas/profile";
import { createTestDb, type TestDb } from "@/tests/helpers/pglite-db";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

const LOADED_AT = "2026-10-23T23:28:57.872123Z";

const NOW = "2026-10-24T08:00:00.000Z";

const SETTINGS = {
  show_phone: true,
  show_address: false,
  hide_from_search: false,
  show_in_directory: false,
};

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
    updatedAt: LOADED_AT,
  });
});

async function storedRow() {
  const [row] = await db
    .select({
      updatedAt: user.updatedAt,
      privacySettings: user.privacySettings,
      showInDirectory: user.showInDirectory,
    })
    .from(user)
    .where(eq(user.id, "user_1"));

  return row;
}

function write(expectedUpdatedAt: string | null) {
  return updatePrivacySettings(db, {
    userId: "user_1",
    settings: SETTINGS,
    expectedUpdatedAt,
    now: NOW,
  });
}

describe("updatePrivacySettings", () => {
  it("matches the updated_at text Postgres returned, at microsecond precision", async () => {
    const loaded = (await storedRow())?.updatedAt ?? "";

    expect(rowVersionSchema.safeParse(loaded).success).toBe(true);
    await expect(write(loaded)).resolves.toBe(true);

    const row = await storedRow();

    expect(row?.privacySettings).toEqual(SETTINGS);
    expect(row?.showInDirectory).toBe(false);
    expect(new Date(row?.updatedAt ?? "").toISOString()).toBe(NOW);
  });

  it("matches the ISO timestamp the route answered with after a save", async () => {
    await write(null);

    await expect(write(NOW)).resolves.toBe(true);
  });

  it("rejects a version truncated to milliseconds instead of matching the wrong row state", async () => {
    await expect(write("2026-10-23T23:28:57.872Z")).resolves.toBe(false);
  });

  it("leaves the row untouched when the version is stale", async () => {
    await expect(write("2026-10-22T10:00:00.000Z")).resolves.toBe(false);

    const row = await storedRow();

    expect(row?.privacySettings.show_phone).toBe(false);
    expect(row?.showInDirectory).toBe(true);
    expect(new Date(row?.updatedAt ?? "").getTime()).toBe(Date.parse("2026-10-23T23:28:57.872Z"));
  });

  it("writes unconditionally, keeping show_in_directory in sync, when no version is sent", async () => {
    await expect(write(null)).resolves.toBe(true);

    const row = await storedRow();

    expect(row?.privacySettings.show_in_directory).toBe(false);
    expect(row?.showInDirectory).toBe(false);
  });

  it("reports no match for a user without a row", async () => {
    await expect(
      updatePrivacySettings(db, {
        userId: "user_missing",
        settings: SETTINGS,
        expectedUpdatedAt: null,
        now: NOW,
      }),
    ).resolves.toBe(false);
  });
});
