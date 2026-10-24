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

vi.mock("next/navigation", () => ({
  notFound: (): never => {
    throw new Error("NEXT_NOT_FOUND");
  },
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
  const search = (params: { page?: string; role?: string } = {}) => Promise.resolve(params);

  it("renders the directory from the database", async () => {
    await seedListed("amy");

    const { default: ExplorePage } = await import("@/app/explore/page");

    expect(await ExplorePage({ searchParams: search() })).toBeTruthy();
  });

  it("404s a page past the end", async () => {
    await seedListed("amy");

    const { default: ExplorePage } = await import("@/app/explore/page");

    await expect(ExplorePage({ searchParams: search({ page: "9" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("throws the typed failure when the database is down, not an empty directory", async () => {
    holder.db = await closedDb();

    const { default: ExplorePage } = await import("@/app/explore/page");
    const error = await ExplorePage({ searchParams: search() }).catch((cause: Error) => cause);

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ cause: expect.any(DbFailed) });
  });
});

describe("/examples/[slug]", () => {
  const gallery = EXAMPLE_GALLERIES[0];
  const params = Promise.resolve({ slug: gallery.slug });

  it("lists the curated profiles that are public", async () => {
    await seedListed(gallery.handles[0]);

    const { default: GalleryPage, generateMetadata } = await import("@/app/examples/[slug]/page");

    expect(await GalleryPage({ params })).toBeTruthy();
    expect((await generateMetadata({ params })).robots).toMatchObject({ index: false });
  });

  it("throws the typed failure when the database is down, not an empty gallery", async () => {
    holder.db = await closedDb();

    const { default: GalleryPage } = await import("@/app/examples/[slug]/page");

    const error = await GalleryPage({ params: Promise.resolve({ slug: gallery.slug }) }).catch(
      (cause: Error) => cause,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ cause: expect.any(DbFailed) });
  });
});
