import { isNotFound, isRedirect } from "@tanstack/react-router";
import { examplePageData } from "@/lib/data/example-page";
import { explorePageData } from "@/lib/data/explore-page";
import { exploreSearchSchema } from "@/lib/data/explore-search";
import { bareHandleRedirect, profilePageData } from "@/lib/data/public-resume";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { siteDataContentColumns } from "@/lib/data/site-data-content";
import { getGalleryProfiles } from "@/lib/data/indexable-profiles";
import { siteData, user } from "@/lib/db/schema";
import { DbFailed } from "@/lib/effect/failures";
import { EXAMPLE_GALLERIES } from "@/lib/examples/galleries";
import {
  createTestDb,
  INDEXABLE_CONTENT,
  THIN_CONTENT,
  type TestDb,
} from "../../helpers/pglite-db";

interface DbHolder {
  db: TestDb | null;
}

const holder = vi.hoisted(() => {
  const value: DbHolder = { db: null };

  return value;
});

vi.mock("cloudflare:workers", () => ({
  env: { HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" } },
}));

vi.mock("@/lib/db", () => ({
  getDb: () => holder.db,
}));

const NOW = "2026-01-01T00:00:00.000Z";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
  holder.db = db;
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  holder.db = db;
  await testDb.reset();
});

async function seedListed(handle: string, thin = false) {
  await db.insert(user).values({
    id: `id-${handle}`,
    name: handle,
    email: `${handle}@example.com`,
    handle,
    showInDirectory: true,
    onboardingCompleted: true,
    privacySettings: {
      show_phone: false,
      show_address: false,
      hide_from_search: false,
      show_in_directory: true,
    },
    createdAt: NOW,
    updatedAt: NOW,
  });

  await db.insert(siteData).values({
    id: `site-${handle}`,
    userId: `id-${handle}`,
    ...siteDataContentColumns(thin ? THIN_CONTENT : INDEXABLE_CONTENT),
    previewName: `Name ${handle}`,
    previewHeadline: "Engineer",
    previewLocation: "123 Main St, Portland, OR",
    previewSkills: ["TypeScript"],
    createdAt: NOW,
    updatedAt: NOW,
  });
}

async function closedDb(): Promise<TestDb> {
  const closed = await createTestDb();

  await closed.close();

  return closed.db;
}

describe("getGalleryProfiles", () => {
  it("keeps the curated order and drops thin, unlisted and unknown handles", async () => {
    await seedListed("zed");
    await seedListed("amy");
    await seedListed("thin", true);
    await seedListed("hidden");
    await db.update(user).set({ showInDirectory: false }).where(eq(user.id, "id-hidden"));

    const profiles = await getGalleryProfiles(db, ["zed", "ghost", "thin", "hidden", "amy"]);

    expect(profiles.map((profile) => profile.handle)).toEqual(["zed", "amy"]);
    expect(profiles[0]?.previewLocation).toBe("Portland, OR");
  });
});

describe("/explore", () => {
  const search = (params: { page?: string | number | string[]; role?: string } = {}) =>
    exploreSearchSchema.parse(params);

  it("renders the directory from the database", async () => {
    await seedListed("amy");

    const result = await explorePageData(search());

    expect(result.directoryUsers.map((person) => person.handle)).toEqual(["amy"]);
    expect(result.totalCount).toBe(1);
  });

  it("404s a page past the end", async () => {
    await seedListed("amy");

    const error = await explorePageData(search({ page: "9" })).catch((cause: unknown) => cause);

    expect(isNotFound(error)).toBe(true);
  });

  it("throws the typed failure when the database is down, not an empty directory", async () => {
    holder.db = await closedDb();

    const error = await explorePageData(search()).catch((cause: Error) => cause);

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ cause: expect.any(DbFailed) });
  });
});

describe("/examples/[slug]", () => {
  const gallery = EXAMPLE_GALLERIES[0];

  it("lists the curated profiles that are public", async () => {
    await seedListed(gallery.handles[0]);

    const result = await examplePageData(gallery.slug);

    expect(result.profiles.map((person) => person.handle)).toEqual([gallery.handles[0]]);
    expect(result.indexable).toBe(false);
  });

  it("throws the typed failure when the database is down, not an empty gallery", async () => {
    holder.db = await closedDb();

    const error = await examplePageData(gallery.slug).catch((cause: Error) => cause);

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ cause: expect.any(DbFailed) });
  });
});

describe("public page routing", () => {
  it("redirects bare handles permanently to their public URL", () => {
    expect.assertions(2);

    try {
      bareHandleRedirect("alice");
    } catch (error) {
      expect(isRedirect(error)).toBe(true);

      if (!isRedirect(error)) throw error;

      expect(error.options).toMatchObject({
        to: "/@{$handle}",
        params: { handle: "alice" },
        statusCode: 308,
      });
    }
  });

  it.each(["api", "bad.handle", "@alice"])("404s invalid bare handle %s", (handle) => {
    expect.assertions(1);

    try {
      bareHandleRedirect(handle);
    } catch (error) {
      expect(isNotFound(error)).toBe(true);
    }
  });

  it("404s unknown galleries", async () => {
    const error = await examplePageData("unknown").catch((cause: unknown) => cause);

    expect(isNotFound(error)).toBe(true);
  });

  it("404s missing and unpublished profiles", async () => {
    await db.insert(user).values({
      id: "unpublished",
      name: "Unpublished",
      email: "unpublished@example.com",
      handle: "unpublished",
      createdAt: NOW,
      updatedAt: NOW,
    });

    for (const handle of ["unknown", "unpublished", "bad.handle"]) {
      const error = await profilePageData(handle).catch((cause: unknown) => cause);

      expect(isNotFound(error)).toBe(true);
    }
  });

  it("loads public profile chrome without a session", async () => {
    await seedListed("alice");
    const result = await profilePageData("alice");

    expect(result.data.profile.handle).toBe("alice");
    expect(result.chrome.share).toHaveProperty("linkedInIcon");
  });

  it.each(["0", "-1", "1.5", "not-a-page", ["1", "2"]])(
    "falls back to page one for malformed page %s",
    (page) => {
      expect(exploreSearchSchema.parse({ page }).page).toBe(1);
    },
  );

  it.each(["2", "2.0", "2e0", "02", 2])("normalizes integer page %s", (page) => {
    expect(exploreSearchSchema.parse({ page }).page).toBe(2);
  });

  it("survives the RPC re-validation unchanged", () => {
    const parsed = exploreSearchSchema.parse({ page: "3", role: "unknown" });

    expect(parsed).toEqual({ page: 3, role: "" });
    expect(exploreSearchSchema.parse(parsed)).toEqual(parsed);
  });
});
