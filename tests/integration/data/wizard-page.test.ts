import { sql } from "drizzle-orm";
import { Effect } from "effect";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { AppSession } from "@/lib/auth/session";
import { loadWizardPage } from "@/lib/data/wizard-page";
import { resumes, siteData, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { COOKIE_NAME, createSignedCookieValue } from "@/lib/utils/pending-upload-cookie";
import { createTestDb, INDEXABLE_CONTENT, type TestDb } from "../../helpers/pglite-db";

interface Holder {
  db: TestDb | null;
  session: AppSession | null;
  cookie: string | undefined;
  secret: string | undefined;
}

const holder = vi.hoisted(() => {
  const value: Holder = { db: null, session: null, cookie: undefined, secret: "wizard-secret" };

  return value;
});

vi.mock("cloudflare:workers", () => ({
  env: {
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
    get PENDING_UPLOAD_SECRET() {
      return holder.secret;
    },
  },
}));

vi.mock("@/lib/db", () => ({ getDb: () => holder.db }));

vi.mock("@/lib/auth/session", () => ({
  getServerSession: () => Promise.resolve(holder.session),
}));

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === COOKIE_NAME && holder.cookie ? { value: holder.cookie } : undefined,
    }),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string): never => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  },
}));

vi.mock("@/components/wizard/WizardClient", () => ({ default: () => null }));

let db: TestDb;
let closeDb: () => Promise<void>;
const NOW = new Date().toISOString();

beforeAll(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  closeDb = () => testDb.close();
});

afterAll(async () => {
  await closeDb();
  vi.unstubAllEnvs();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE "site_data", "resumes", "user" CASCADE`);
  holder.db = db;
  holder.cookie = undefined;
  holder.secret = "wizard-secret";
  vi.stubEnv("PENDING_UPLOAD_SECRET", undefined);
  holder.session = {
    user: {
      id: "owner",
      name: "Owner",
      email: "owner@example.com",
      image: null,
      handle: "owner",
      headline: null,
      privacySettings: {
        show_phone: false,
        show_address: false,
        hide_from_search: false,
        show_in_directory: true,
      },
      onboardingCompleted: false,
      role: null,
      isAdmin: false,
    },
    session: { id: "session", userId: "owner", token: "jwt", expiresAt: new Date(NOW) },
  };
  await db.insert(user).values({
    id: "owner",
    email: "owner@example.com",
    name: "Owner",
    createdAt: NOW,
    updatedAt: NOW,
  });
});

function runLoader() {
  return Effect.runPromise(Effect.provide(loadWizardPage("owner"), Db.layerFrom(db)));
}

async function seedProcessing() {
  await db.insert(resumes).values({
    id: "processing-resume",
    userId: "owner",
    r2Key: "users/owner/resume.pdf",
    fileHash: "hash",
    status: "processing",
    createdAt: NOW,
    updatedAt: NOW,
  });
}

async function seedContent() {
  await db.insert(siteData).values({
    id: "site-owner",
    userId: "owner",
    content: INDEXABLE_CONTENT,
    themeId: "minimalist_editorial",
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe("wizard server initialization", () => {
  it("redirects signed-out visitors before reading the pending cookie or loading data", async () => {
    holder.session = null;
    const { default: WizardPage } = await import("@/app/(protected)/wizard/page");

    await expect(WizardPage()).rejects.toThrow("NEXT_REDIRECT /");
  });

  it("hands content to the client without a loading phase", async () => {
    await seedContent();
    await seedProcessing();
    const { default: WizardPage } = await import("@/app/(protected)/wizard/page");

    expect(await WizardPage()).toMatchObject({
      props: { initialStart: { kind: "review", content: INDEXABLE_CONTENT } },
    });
  });

  it("redirects to waiting on the server when the latest resume is processing", async () => {
    await seedProcessing();
    const { default: WizardPage } = await import("@/app/(protected)/wizard/page");

    await expect(WizardPage()).rejects.toThrow(
      "NEXT_REDIRECT /waiting?resume_id=processing-resume",
    );
  });

  it("gives a verified pending upload priority over old content and an older processing resume", async () => {
    await seedContent();
    await seedProcessing();
    holder.cookie = await createSignedCookieValue("temp/new-resume.pdf", "wizard-secret");
    // Malformed old content must not even be validated before the new upload has been claimed.
    await db.execute(sql`UPDATE site_data SET content = jsonb_set(content, '{skills}', '{}')`);
    const { default: WizardPage } = await import("@/app/(protected)/wizard/page");

    expect(await WizardPage()).toMatchObject({
      props: {
        initialStart: {
          kind: "claim-first",
          pendingUpload: { key: "temp/new-resume.pdf", file_hash: null },
        },
      },
    });
  });

  it("ignores a forged pending cookie", async () => {
    holder.cookie = await createSignedCookieValue("temp/forged.pdf", "wrong-secret");
    await seedProcessing();

    expect(await runLoader()).toEqual({ kind: "redirect-waiting", resumeId: "processing-resume" });
  });

  it("still preloads content without a pending-upload secret", async () => {
    holder.secret = undefined;
    await seedContent();

    expect(await runLoader()).toEqual({ kind: "review", content: INDEXABLE_CONTENT });
  });

  it("ignores an unverifiable cookie when the signing secret is absent", async () => {
    holder.secret = undefined;
    holder.cookie = await createSignedCookieValue("temp/new.pdf", "wizard-secret");
    await seedContent();

    expect(await runLoader()).toEqual({ kind: "review", content: INDEXABLE_CONTENT });
  });

  it("starts an owner with no upload or content at upload", async () => {
    expect(await runLoader()).toEqual({ kind: "upload" });
  });
});
