import { sql } from "drizzle-orm";
import { Effect } from "effect";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { loadPublicResume } from "@/lib/data/public-resume";
import { readStoredContent } from "@/lib/data/stored-content";
import { siteData, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { DbFailed } from "@/lib/effect/failures";
import { DEMO_RESUME_CONTENT } from "@/lib/templates/demo-data";
import { THEME_IDS } from "@/lib/templates/theme-ids";
import type { ResumeContent } from "@/lib/types/database";
import { createTestDb, INDEXABLE_CONTENT, type TestDb } from "../../helpers/pglite-db";

const NOW = "2026-01-01T00:00:00.000Z";

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

function run<A, E>(program: Effect.Effect<A, E, Db>) {
  return Effect.runPromise(Effect.provide(program, Db.layerFrom(db)));
}

async function seedProfile(
  handle: string,
  content: ResumeContent,
  privacy: { show_phone: boolean; show_address: boolean } = {
    show_phone: false,
    show_address: false,
  },
) {
  await db.insert(user).values({
    id: `id-${handle}`,
    name: "Avery Johnson",
    email: `${handle}@example.com`,
    handle,
    privacySettings: { ...privacy, hide_from_search: false, show_in_directory: true },
    createdAt: NOW,
    updatedAt: NOW,
  });

  await db.insert(siteData).values({
    id: `site-${handle}`,
    userId: `id-${handle}`,
    content,
    themeId: "minimalist_editorial",
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe("loadPublicResume", () => {
  it("returns the published profile with privacy applied to the rendered content", async () => {
    await seedProfile("avery", INDEXABLE_CONTENT);

    const resume = await run(loadPublicResume("avery"));

    expect(resume?.data.profile.handle).toBe("avery");
    expect(resume?.data.content.full_name).toBe("Avery Johnson");
    expect(resume?.data.content.contact?.phone).toBeUndefined();
    expect(resume?.data.content.contact?.location).toBe("Portland, OR");
    expect(resume?.metadata?.indexable).toBe(true);
    expect(resume?.metadata?.jsonLdResumeScript).toContain("Avery Johnson");
  });

  it("keeps phone and address when the owner opted in", async () => {
    await seedProfile("open", INDEXABLE_CONTENT, { show_phone: true, show_address: true });

    const resume = await run(loadPublicResume("open"));

    expect(resume?.data.content.contact?.phone).toBe("+1-555-0100");
  });

  it("answers null for an unknown handle and for a user without a site", async () => {
    await db.insert(user).values({
      id: "id-nosite",
      name: "No Site",
      email: "nosite@example.com",
      handle: "nosite",
      createdAt: NOW,
      updatedAt: NOW,
    });

    expect(await run(loadPublicResume("ghost"))).toBeNull();
    expect(await run(loadPublicResume("nosite"))).toBeNull();
  });

  it("fails with a typed DbFailed when the database is down, never as not found", async () => {
    const closed = await createTestDb();

    await closed.close();

    const failure = await Effect.runPromise(
      Effect.flip(Effect.provide(loadPublicResume("x"), Db.layerFrom(closed.db))),
    );

    expect(failure).toBeInstanceOf(DbFailed);
    expect(failure).toMatchObject({ operation: "public-resume.by-handle" });
  });

  it("fails as invalid-response when the stored content is not a resume", async () => {
    await seedProfile("broken", INDEXABLE_CONTENT);
    await db.execute(
      sql`UPDATE site_data SET content = jsonb_set(content, '{experience}', '"oops"')`,
    );

    const failure = await run(Effect.flip(loadPublicResume("broken")));

    expect(failure).toBeInstanceOf(DbFailed);
    expect(failure).toMatchObject({ operation: "public-resume.content", kind: "invalid-response" });
    expect(failure.message).not.toContain("Avery");
  });
});

describe("readStoredContent", () => {
  const sparse: ResumeContent = {
    full_name: "Sparse Person",
    headline: "Headline",
    summary: "Summary.",
    contact: { email: "" },
    experience: [],
  };

  it("hands back the very value it read for every theme demo and the sparse shape", async () => {
    const samples = [...THEME_IDS.map((id) => DEMO_RESUME_CONTENT[id]), sparse, INDEXABLE_CONTENT];

    for (const content of samples) {
      expect(await Effect.runPromise(readStoredContent(content, "test.read"))).toBe(content);
    }
  });

  it("accepts the nulls and omissions older rows carry", async () => {
    const content: ResumeContent = JSON.parse(
      '{"full_name":"Old Row","headline":"H","summary":"S","contact":null,"experience":null,"education":null,"projects":null}',
    );

    expect(await Effect.runPromise(readStoredContent(content, "test.read"))).toBe(content);
  });

  it.each([
    ["a list that is not an array", '{"experience":[],"education":{}}'],
    ["a skill group without items", '{"experience":[],"skills":[{"category":"Languages"}]}'],
    ["a contact that is a string", '{"experience":[],"contact":"a@b.co"}'],
  ])("rejects %s", async (_label, json) => {
    const content: ResumeContent = JSON.parse(json);

    const failure = await Effect.runPromise(Effect.flip(readStoredContent(content, "test.read")));

    expect(failure).toBeInstanceOf(DbFailed);
    expect(failure.kind).toBe("invalid-response");
  });
});
