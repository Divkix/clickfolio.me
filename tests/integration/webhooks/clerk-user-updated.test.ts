import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { user } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/tests/helpers/pglite-db";

interface FailingDb {
  query: { user: { findFirst: () => Promise<never> } };
}

interface DbHolder {
  db: TestDb | FailingDb | null;
}

const state = vi.hoisted(() => {
  const holder: DbHolder = { db: null };

  return holder;
});

const logMock = vi.hoisted(() => vi.fn());

vi.mock("cloudflare:workers", () => ({
  env: {
    CLERK_WEBHOOK_SECRET: "whsec_test",
    HYPERDRIVE: { connectionString: "postgres://localhost/test" },
    CLICKFOLIO_R2_DELETE_WORKFLOW: {},
  },
}));

vi.mock("svix", () => ({
  Webhook: class {
    verify() {}
  },
}));

vi.mock("@/lib/db", () => ({ getDb: () => state.db }));

vi.mock("@/lib/utils/log", () => ({ log: logMock }));

vi.mock("@/lib/r2", () => ({ collectR2KeysForUser: vi.fn(async () => []) }));

vi.mock("@/lib/seo/indexnow-runtime", () => ({ notifyIndexNowForProfiles: vi.fn() }));

vi.mock("@/lib/utils/revalidate", () => ({ revalidatePublicProfilePages: vi.fn() }));

vi.mock("@/lib/workflows/r2-delete", () => ({ scheduleR2Deletion: vi.fn() }));

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
  state.db = db;
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  logMock.mockClear();

  await db.insert(user).values([
    {
      id: "user_1",
      clerkId: "clerk_1",
      name: "Avery",
      email: "old@example.com",
      emailVerified: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "user_2",
      clerkId: "clerk_2",
      name: "Blake",
      email: "taken@example.com",
      emailVerified: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
});

function userUpdated(email: string, status: string, firstName = "Avery") {
  return new Request("https://clickfolio.me/api/webhooks/clerk", {
    method: "POST",
    body: JSON.stringify({
      type: "user.updated",
      data: {
        id: "clerk_1",
        first_name: firstName,
        primary_email_address_id: "idn_new",
        email_addresses: [{ id: "idn_new", email_address: email, verification: { status } }],
      },
    }),
  });
}

async function storedUser(id: string) {
  const rows = await db.select().from(user).where(eq(user.id, id));

  return rows[0];
}

describe("clerk webhook user.updated email verification", () => {
  it("treats Clerk's verification status `verified` as verified", async () => {
    const { POST } = await import("@/app/api/webhooks/clerk/route");

    const response = await POST(userUpdated("old@example.com", "verified"));

    expect(response.status).toBe(200);
    expect((await storedUser("user_1"))?.emailVerified).toBe(true);
  });

  it("leaves an unverified primary email unverified", async () => {
    const { POST } = await import("@/app/api/webhooks/clerk/route");

    await POST(userUpdated("old@example.com", "unverified"));

    expect((await storedUser("user_1"))?.emailVerified).toBe(false);
  });
});

describe("clerk webhook user.updated email sync", () => {
  it("moves to a verified new primary email and marks it verified", async () => {
    const { POST } = await import("@/app/api/webhooks/clerk/route");

    const response = await POST(userUpdated("new@example.com", "verified"));

    expect(response.status).toBe(200);

    const row = await storedUser("user_1");

    expect(row?.email).toBe("new@example.com");
    expect(row?.emailVerified).toBe(true);
  });

  it("does not adopt an unverified new primary email", async () => {
    const { POST } = await import("@/app/api/webhooks/clerk/route");

    const response = await POST(userUpdated("new@example.com", "unverified"));

    expect(response.status).toBe(200);

    const row = await storedUser("user_1");

    expect(row?.email).toBe("old@example.com");
    expect(row?.emailVerified).toBe(false);
  });

  it("on an email collision keeps the old email, clears emailVerified, warns without the address, and still acks", async () => {
    const { POST } = await import("@/app/api/webhooks/clerk/route");

    await db.update(user).set({ emailVerified: true }).where(eq(user.id, "user_1"));

    const response = await POST(userUpdated("taken@example.com", "verified", "Avery Renamed"));

    expect(response.status).toBe(200);

    const row = await storedUser("user_1");

    expect(row?.email).toBe("old@example.com");
    expect(row?.emailVerified).toBe(false);
    // Other fields still sync.
    expect(row?.name).toBe("Avery Renamed");

    const other = await storedUser("user_2");

    expect(other?.email).toBe("taken@example.com");
    expect(other?.emailVerified).toBe(true);

    const warns = logMock.mock.calls.filter(([level]) => level === "warn");

    expect(warns).toHaveLength(1);
    expect(JSON.stringify(warns)).not.toContain("example.com");
  });

  it("answers 500 for a real database failure so Svix retries", async () => {
    const { POST } = await import("@/app/api/webhooks/clerk/route");
    const original = state.db;

    state.db = {
      query: {
        user: {
          findFirst: async () => {
            throw new Error("connection refused");
          },
        },
      },
    };

    try {
      const response = await POST(userUpdated("new@example.com", "verified"));

      expect(response.status).toBe(500);
    } finally {
      state.db = original;
    }
  });
});
