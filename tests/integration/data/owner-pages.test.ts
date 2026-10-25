import { isRedirect } from "@tanstack/react-router";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { AppSession } from "@/lib/auth/session";
import {
  dashboardPageData,
  editPageData,
  settingsPageData,
  themesPageData,
} from "@/lib/data/owner-pages";
import { resumes, siteData, user } from "@/lib/db/schema";
import { DbFailed } from "@/lib/effect/failures";
import type { ResumeContent } from "@/lib/types/database";
import { getProfileSuggestions } from "@/lib/utils/profile-completeness";
import { createTestDb, INDEXABLE_CONTENT, type TestDb } from "../../helpers/pglite-db";

interface Holder {
  db: TestDb | null;
  session: AppSession | null;
}

const holder = vi.hoisted(() => {
  const value: Holder = { db: null, session: null };

  return value;
});

vi.mock("cloudflare:workers", () => ({
  env: { HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" } },
}));

vi.mock("@/lib/db", () => ({
  getDb: () => holder.db,
}));

vi.mock("@/lib/auth/session", () => ({
  getServerSession: () => Promise.resolve(holder.session),
}));

const NOW = "2026-01-01T00:00:00.000Z";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

function sessionFor(id: string): AppSession {
  return {
    user: {
      id,
      name: "Avery Johnson",
      email: `${id}@example.com`,
      image: null,
      handle: `handle-${id}`,
      headline: null,
      privacySettings: {
        show_phone: false,
        show_address: false,
        hide_from_search: false,
        show_in_directory: true,
      },
      onboardingCompleted: true,
      role: null,
      isAdmin: false,
    },
    session: { id: "sess", userId: id, token: "jwt", expiresAt: new Date(NOW) },
  };
}

async function seedOwner(id: string, onboardingCompleted = true) {
  await db.insert(user).values({
    id,
    name: "Avery Johnson",
    email: `${id}@example.com`,
    handle: `handle-${id}`,
    onboardingCompleted,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

async function seedSite(id: string) {
  await db.insert(siteData).values({
    id: `site-${id}`,
    userId: id,
    content: INDEXABLE_CONTENT,
    themeId: "minimalist_editorial",
    createdAt: NOW,
    updatedAt: NOW,
  });
}

async function seedResume(id: string) {
  await db.insert(resumes).values({
    id: `resume-${id}`,
    userId: id,
    r2Key: `users/${id}/resume.pdf`,
    fileHash: "hash",
    status: "completed",
    createdAt: NOW,
    updatedAt: NOW,
  });
}

async function closedDb(): Promise<TestDb> {
  const closed = await createTestDb();

  await closed.close();

  return closed.db;
}

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  holder.db = db;
  holder.session = sessionFor("owner");
  await testDb.reset();
});

describe("/edit", () => {
  it("hands the stored content to the editor", async () => {
    await seedOwner("owner");
    await seedSite("owner");

    expect(await editPageData()).toEqual(INDEXABLE_CONTENT);
  });

  it("sends an owner without a site to the dashboard", async () => {
    await seedOwner("owner");

    const error = await editPageData().catch((cause: unknown) => cause);
    expect(isRedirect(error) && error.options.to).toBe("/dashboard");
  });

  it("sends a signed-out visitor home", async () => {
    holder.session = null;

    const error = await editPageData().catch((cause: unknown) => cause);
    expect(isRedirect(error) && error.options.to).toBe("/");
  });

  it("throws the typed failure when the database is down, not a redirect", async () => {
    holder.db = await closedDb();

    const error = await editPageData().catch((cause: Error) => cause);

    expect(error).toMatchObject({ cause: expect.any(DbFailed) });
  });

  it("fails as invalid-response on corrupt stored content", async () => {
    await seedOwner("owner");
    await seedSite("owner");
    await db.execute(sql`UPDATE site_data SET content = jsonb_set(content, '{skills}', '{}')`);

    const error = await editPageData().catch((cause: Error) => cause);

    expect(error).toMatchObject({ cause: expect.objectContaining({ kind: "invalid-response" }) });
  });
});

describe("/themes", () => {
  it("hands the stored theme and content to the selector", async () => {
    await seedOwner("owner");
    await seedSite("owner");

    expect(await themesPageData()).toEqual({
      session: holder.session,
      choice: {
        themeId: "minimalist_editorial",
        content: INDEXABLE_CONTENT,
      },
    });
  });

  it("sends an owner without a site to the dashboard", async () => {
    await seedOwner("owner");

    const error = await themesPageData().catch((cause: unknown) => cause);
    expect(isRedirect(error) && error.options.to).toBe("/dashboard");
  });

  it("throws the typed failure when the database is down", async () => {
    holder.db = await closedDb();

    const error = await themesPageData().catch((cause: Error) => cause);

    expect(error).toMatchObject({ cause: expect.any(DbFailed) });
  });

  it("sends a signed-out visitor home", async () => {
    holder.session = null;
    const error = await themesPageData().catch((cause: unknown) => cause);
    expect(isRedirect(error) && error.options.to).toBe("/");
  });
});

describe("/settings", () => {
  it("hands the profile, resume count and latest resume to the page", async () => {
    await seedOwner("owner");
    await seedResume("owner");

    const settings = await settingsPageData();

    expect(settings.session).toEqual(holder.session);

    expect(settings.profile).toMatchObject({
      id: "owner",
      email: "owner@example.com",
      handle: "handle-owner",
    });
    expect(settings.resumeCount).toEqual([{ count: 1 }]);
    expect(settings.latestResume).toMatchObject({ id: "resume-owner", status: "completed" });
  });

  it("sends a session whose user row is gone to the dashboard", async () => {
    const error = await settingsPageData().catch((cause: unknown) => cause);
    expect(isRedirect(error) && error.options.to).toBe("/dashboard");
  });

  it("throws the typed failure when the database is down", async () => {
    holder.db = await closedDb();

    const error = await settingsPageData().catch((cause: Error) => cause);

    expect(error).toMatchObject({ cause: expect.any(DbFailed) });
  });

  it("sends a signed-out visitor home", async () => {
    holder.session = null;
    const error = await settingsPageData().catch((cause: unknown) => cause);
    expect(isRedirect(error) && error.options.to).toBe("/");
  });
});

describe("/dashboard", () => {
  it("shows the empty state to an owner without a resume", async () => {
    await seedOwner("owner");

    expect(await dashboardPageData()).toMatchObject({
      session: holder.session,
      userData: { id: "owner", resumes: [], siteData: null },
      content: null,
    });
  });

  it("renders the published site", async () => {
    await seedOwner("owner");
    await seedResume("owner");
    await seedSite("owner");

    const dashboard = await dashboardPageData();

    expect(dashboard.session).toEqual(holder.session);

    expect(dashboard.content).toEqual(INDEXABLE_CONTENT);
    expect(dashboard.userData?.id).toBe("owner");
    expect(dashboard.userData?.resumes?.[0]?.id).toBe("resume-owner");
    expect(dashboard.userData?.siteData?.themeId).toBe("minimalist_editorial");
  });

  it("keeps a legacy resume whose contact and experience are null renderable", async () => {
    const legacy: ResumeContent = JSON.parse(
      '{"full_name":"Old Row","headline":"H","summary":"S","contact":null,"experience":null}',
    );

    await seedOwner("owner");
    await seedResume("owner");
    await db.insert(siteData).values({
      id: "site-owner",
      userId: "owner",
      content: legacy,
      themeId: "minimalist_editorial",
      createdAt: NOW,
      updatedAt: NOW,
    });

    const dashboard = await dashboardPageData();

    expect(dashboard.content).toEqual(legacy);

    if (!dashboard.content) throw new Error("legacy content should load");

    expect(getProfileSuggestions(dashboard.content)).toEqual([
      "Add your education background",
      "List your technical skills",
      "Add certifications to stand out",
      "Add more work experience entries",
      "Link your professional social profiles",
    ]);
  });

  it("sends an owner who has not finished onboarding to the wizard", async () => {
    await seedOwner("owner", false);

    const error = await dashboardPageData().catch((cause: unknown) => cause);
    expect(isRedirect(error) && error.options.to).toBe("/wizard");
  });

  it("throws the typed failure when the database is down, not the empty state", async () => {
    holder.db = await closedDb();

    const error = await dashboardPageData().catch((cause: Error) => cause);

    expect(error).toMatchObject({ cause: expect.any(DbFailed) });
  });

  it("sends a signed-out visitor home", async () => {
    holder.session = null;
    const error = await dashboardPageData().catch((cause: unknown) => cause);
    expect(isRedirect(error) && error.options.to).toBe("/");
  });
});
