import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { Effect } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import type { UserRole } from "@/lib/config/roles";
import {
  countIndexableProfiles,
  getDirectoryPage,
  getIndexableProfileWindow,
  indexableProfileCondition,
} from "@/lib/data/indexable-profiles";
import { siteDataContentColumns } from "@/lib/data/site-data-content";
import { siteData, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import {
  generateSitemapEntries,
  getTotalIndexableUserCount,
  STATIC_SITEMAP_ENTRY_COUNT,
} from "@/lib/seo/sitemap";
import { isIndexableProfile } from "@/lib/seo/profile-indexability";
import { normalizePrivacySettings } from "@/lib/utils/privacy";
import {
  createTestDb,
  INDEXABLE_CONTENT,
  THIN_CONTENT,
  type TestDb,
} from "@/tests/helpers/pglite-db";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

function run<A, E>(program: Effect.Effect<A, E, Db>) {
  return Effect.runPromise(Effect.provide(program, Db.layerFrom(db)));
}

const ROLES: (UserRole | null)[] = ["senior", "mid_level", "student", null];
const USER_COUNT = 60;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

const minutes = (n: number) => new Date(T0 + n * 60_000).toISOString();

/**
 * Every combination that matters to the old JS filter: indexable vs thin content,
 * hide_from_search missing/false/true, directory and onboarding flags, roles, freelance, null
 * handles, updated_at ties (exercises the user_id tiebreak) and null last_published_at.
 */
async function seed() {
  for (let i = 0; i < USER_COUNT; i++) {
    const id = `user_${String(i).padStart(3, "0")}`;
    const showInDirectory = i % 7 !== 0;

    await db.insert(user).values({
      id,
      name: id,
      email: `${id}@example.com`,
      handle: i % 13 === 5 ? null : `h-${String((i * 37) % USER_COUNT).padStart(3, "0")}-${i}`,
      privacySettings: {
        show_phone: false,
        show_address: i % 2 === 0,
        hide_from_search: i % 4 === 1,
        show_in_directory: showInDirectory,
      },
      showInDirectory,
      onboardingCompleted: i % 11 !== 3,
      role: ROLES[i % ROLES.length],
      isFreelance: i % 5 === 0,
      createdAt: minutes(0),
      updatedAt: minutes(i),
    });

    const content = i % 3 === 2 ? THIN_CONTENT : INDEXABLE_CONTENT;

    await db.insert(siteData).values({
      id: `site_${id}`,
      userId: id,
      ...siteDataContentColumns(content),
      previewName: `Name ${i}`,
      previewHeadline: `Headline ${i}`,
      previewLocation: "123 Main St, Portland, OR",
      previewExpCount: i % 4,
      previewEduCount: 1,
      previewSkills: ["TypeScript"],
      lastPublishedAt: i % 6 === 4 ? null : minutes(1000 + ((i * 17) % USER_COUNT)),
      createdAt: minutes(0),
      // Pairs share updated_at, so order falls back to user_id desc.
      updatedAt: minutes(Math.floor(i / 2)),
    });
  }

  // Legacy rows predating the hide_from_search key: the old code treated a missing key as false.
  await db.execute(
    sql`update "user" set privacy_settings = privacy_settings - 'hide_from_search' where right(id, 1) in ('0', '4')`,
  );
}

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
  await seed();
});

afterAll(async () => {
  await testDb.close();
});

/** The pre-change /explore query: load everything with content, filter in JS. */
async function legacyExplore(roleFilter: UserRole | "freelance" | "") {
  const conditions = [
    isNotNull(user.handle),
    eq(user.showInDirectory, true),
    eq(user.onboardingCompleted, true),
  ];

  if (roleFilter === "freelance") conditions.push(eq(user.isFreelance, true));
  else if (roleFilter) conditions.push(eq(user.role, roleFilter));

  const rows = await db
    .select({
      handle: user.handle,
      role: user.role,
      previewName: siteData.previewName,
      previewHeadline: siteData.previewHeadline,
      previewLocation: siteData.previewLocation,
      previewExpCount: siteData.previewExpCount,
      previewEduCount: siteData.previewEduCount,
      previewSkills: siteData.previewSkills,
      privacySettings: user.privacySettings,
      content: siteData.content,
    })
    .from(user)
    .innerJoin(siteData, eq(user.id, siteData.userId))
    .where(and(...conditions))
    .orderBy(desc(siteData.updatedAt), desc(siteData.userId));

  return rows
    .filter(
      (u) =>
        u.handle !== null &&
        isIndexableProfile(u.content, normalizePrivacySettings(u.privacySettings)),
    )
    .map(({ content: _content, ...row }) => row);
}

/** The pre-change sitemap query: every profile with a handle, filtered in JS, handle order. */
async function legacySitemapProfiles() {
  const rows = await db
    .select({
      handle: user.handle,
      userUpdatedAt: user.updatedAt,
      siteUpdatedAt: siteData.updatedAt,
      lastPublishedAt: siteData.lastPublishedAt,
      privacySettings: user.privacySettings,
      content: siteData.content,
    })
    .from(user)
    .innerJoin(siteData, sql`${siteData.userId} = ${user.id}`)
    .where(isNotNull(user.handle))
    .orderBy(user.handle, user.id);

  return rows
    .filter(
      (profile) =>
        profile.handle !== null && isIndexableProfile(profile.content, profile.privacySettings),
    )
    .map(({ content: _content, privacySettings: _privacy, ...row }) => row);
}

describe("seed sanity", () => {
  it("covers missing, false and true hide_from_search among indexable directory profiles", async () => {
    const rows = await db
      .select({
        hide: sql<string>`coalesce(${user.privacySettings} ->> 'hide_from_search', 'missing')`,
      })
      .from(user)
      .innerJoin(siteData, eq(user.id, siteData.userId))
      .where(eq(siteData.contentIndexable, true));

    expect(new Set(rows.map((row) => row.hide))).toEqual(new Set(["missing", "false", "true"]));
  });
});

describe("getDirectoryPage matches the old JS filter", () => {
  const PAGE_SIZE = 4;

  for (const roleFilter of ["", "freelance", "senior", "student"] as const) {
    it(`role="${roleFilter}": same rows, order, total and pages`, async () => {
      const expected = await legacyExplore(roleFilter);
      const totalPages = Math.ceil(expected.length / PAGE_SIZE);

      expect(expected.length).toBeGreaterThan(0);

      for (let page = 1; page <= totalPages; page++) {
        const result = await getDirectoryPage(db, { roleFilter, page, pageSize: PAGE_SIZE });

        expect(result.totalCount).toBe(expected.length);
        expect(result.users).toEqual(expected.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
      }

      // Past the end: no rows, so the caller's out-of-range check (total 0 < page) 404s.
      const past = await getDirectoryPage(db, {
        roleFilter,
        page: totalPages + 1,
        pageSize: PAGE_SIZE,
      });

      expect(past).toEqual({ users: [], totalCount: 0 });
    });
  }

  it("page 1 with no matches reports an empty directory", async () => {
    expect(await getDirectoryPage(db, { roleFilter: "executive", page: 1, pageSize: 12 })).toEqual({
      users: [],
      totalCount: 0,
    });
  });
});

describe("sitemap queries match the old JS filter", () => {
  it("getIndexableProfileWindow pages the same profiles with the same total and newest publish", async () => {
    const expected = await legacySitemapProfiles();

    const newest = expected
      .map((profile) => profile.lastPublishedAt)
      .filter((value): value is string => value !== null)
      .reduce<string | null>(
        (max, value) => (max === null || Date.parse(value) > Date.parse(max) ? value : max),
        null,
      );

    for (const [limit, offset] of [
      [expected.length + 5, 0],
      [7, 0],
      [7, 7],
      [7, 14],
    ]) {
      const window = await getIndexableProfileWindow(db, { limit, offset });

      expect(window.profiles).toEqual(expected.slice(offset, offset + limit));
      expect(window.totalCount).toBe(expected.length);
      expect(window.newestPublishedAt).toBe(newest);
    }

    expect(await getIndexableProfileWindow(db, { limit: 7, offset: 1000 })).toEqual({
      profiles: [],
      totalCount: 0,
      newestPublishedAt: null,
    });
  });

  it("countIndexableProfiles / getTotalIndexableUserCount equal the old JS count", async () => {
    const expected = (await legacySitemapProfiles()).length;

    expect(await countIndexableProfiles(db)).toBe(expected);
    expect(await run(getTotalIndexableUserCount())).toBe(expected);
  });

  it("generateSitemapEntries(0) lists the same profile URLs, lastmods and /explore lastmod", async () => {
    const expected = await legacySitemapProfiles();
    const entries = await run(generateSitemapEntries(0));

    expect(entries).not.toBeNull();

    const userEntries = (entries ?? []).slice(STATIC_SITEMAP_ENTRY_COUNT);

    expect(userEntries.map((entry) => entry.url)).toEqual(
      expected.map((profile) => expect.stringMatching(new RegExp(`/@${profile.handle}$`))),
    );
    expect(userEntries.map((entry) => entry.lastModified)).toEqual(
      expected.map(
        (profile) =>
          new Date(profile.lastPublishedAt || profile.siteUpdatedAt || profile.userUpdatedAt),
      ),
    );

    const explore = (entries ?? []).find((entry) => entry.url.endsWith("/explore"));

    const newest = Math.max(
      ...expected.flatMap((profile) =>
        profile.lastPublishedAt ? [Date.parse(profile.lastPublishedAt)] : [],
      ),
    );

    expect(explore?.lastModified).toEqual(new Date(newest));
  });

  it("generateSitemapEntries returns null for a shard past the end", async () => {
    expect(await run(generateSitemapEntries(1))).toBeNull();
  });
});

describe("indexableProfileCondition", () => {
  it("excludes a NULL (not yet backfilled) flag, which the old filter would have included", async () => {
    const id = "user_999";

    await db.insert(user).values({
      id,
      name: id,
      email: `${id}@example.com`,
      handle: "zz-unbackfilled",
      createdAt: minutes(0),
      updatedAt: minutes(0),
    });
    await db.insert(siteData).values({
      id: `site_${id}`,
      userId: id,
      content: INDEXABLE_CONTENT,
      contentIndexable: null,
      createdAt: minutes(0),
      updatedAt: minutes(0),
    });

    try {
      const rows = await db
        .select({ handle: user.handle })
        .from(user)
        .innerJoin(siteData, eq(user.id, siteData.userId))
        .where(and(inArray(user.id, [id]), indexableProfileCondition()));

      expect(rows).toEqual([]);
      expect((await legacySitemapProfiles()).map((profile) => profile.handle)).toContain(
        "zz-unbackfilled",
      );
    } finally {
      await db.delete(user).where(eq(user.id, id));
    }
  });
});
