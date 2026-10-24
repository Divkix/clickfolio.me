import { sql } from "drizzle-orm";
import { Effect } from "effect";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { AppSession } from "@/lib/auth/session";
import { loadDashboard } from "@/lib/data/owner-pages";
import { resumes, siteData, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
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

vi.mock("next/navigation", () => ({
  redirect: (path: string): never => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  },
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

    const { default: EditPage } = await import("@/app/(protected)/edit/page");

    expect(await EditPage()).toBeTruthy();
  });

  it("sends an owner without a site to the dashboard", async () => {
    await seedOwner("owner");

    const { default: EditPage } = await import("@/app/(protected)/edit/page");

    await expect(EditPage()).rejects.toThrow("NEXT_REDIRECT /dashboard");
  });

  it("sends a signed-out visitor home", async () => {
    holder.session = null;

    const { default: EditPage } = await import("@/app/(protected)/edit/page");

    await expect(EditPage()).rejects.toThrow("NEXT_REDIRECT /");
  });

  it("throws the typed failure when the database is down, not a redirect", async () => {
    holder.db = await closedDb();

    const { default: EditPage } = await import("@/app/(protected)/edit/page");
    const error = await EditPage().catch((cause: Error) => cause);

    expect(error).toMatchObject({ cause: expect.any(DbFailed) });
  });

  it("fails as invalid-response on corrupt stored content", async () => {
    await seedOwner("owner");
    await seedSite("owner");
    await db.execute(sql`UPDATE site_data SET content = jsonb_set(content, '{skills}', '{}')`);

    const { default: EditPage } = await import("@/app/(protected)/edit/page");
    const error = await EditPage().catch((cause: Error) => cause);

    expect(error).toMatchObject({ cause: expect.objectContaining({ kind: "invalid-response" }) });
  });
});

describe("/themes", () => {
  it("renders for an owner with a site", async () => {
    await seedOwner("owner");
    await seedSite("owner");

    const { default: ThemesPage } = await import("@/app/(protected)/themes/page");

    expect(await ThemesPage()).toBeTruthy();
  });

  it("sends an owner without a site to the dashboard", async () => {
    await seedOwner("owner");

    const { default: ThemesPage } = await import("@/app/(protected)/themes/page");

    await expect(ThemesPage()).rejects.toThrow("NEXT_REDIRECT /dashboard");
  });

  it("throws the typed failure when the database is down", async () => {
    holder.db = await closedDb();

    const { default: ThemesPage } = await import("@/app/(protected)/themes/page");
    const error = await ThemesPage().catch((cause: Error) => cause);

    expect(error).toMatchObject({ cause: expect.any(DbFailed) });
  });
});

describe("/settings", () => {
  it("renders for an owner", async () => {
    await seedOwner("owner");
    await seedResume("owner");

    const { default: SettingsPage } = await import("@/app/(protected)/settings/page");

    expect(await SettingsPage()).toBeTruthy();
  });

  it("sends a session whose user row is gone to the dashboard", async () => {
    const { default: SettingsPage } = await import("@/app/(protected)/settings/page");

    await expect(SettingsPage()).rejects.toThrow("NEXT_REDIRECT /dashboard");
  });

  it("throws the typed failure when the database is down", async () => {
    holder.db = await closedDb();

    const { default: SettingsPage } = await import("@/app/(protected)/settings/page");
    const error = await SettingsPage().catch((cause: Error) => cause);

    expect(error).toMatchObject({ cause: expect.any(DbFailed) });
  });
});

describe("/dashboard", () => {
  it("shows the empty state to an owner without a resume", async () => {
    await seedOwner("owner");

    const { default: DashboardPage } = await import("@/app/(protected)/dashboard/page");

    expect(await DashboardPage()).toBeTruthy();
  });

  it("renders the published site", async () => {
    await seedOwner("owner");
    await seedResume("owner");
    await seedSite("owner");

    const { default: DashboardPage } = await import("@/app/(protected)/dashboard/page");

    expect(await DashboardPage()).toBeTruthy();
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

    const dashboard = await Effect.runPromise(
      Effect.provide(loadDashboard("owner"), Db.layerFrom(db)),
    );

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

    const { default: DashboardPage } = await import("@/app/(protected)/dashboard/page");

    await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT /wizard");
  });

  it("throws the typed failure when the database is down, not the empty state", async () => {
    holder.db = await closedDb();

    const { default: DashboardPage } = await import("@/app/(protected)/dashboard/page");
    const error = await DashboardPage().catch((cause: Error) => cause);

    expect(error).toMatchObject({ cause: expect.any(DbFailed) });
  });
});
