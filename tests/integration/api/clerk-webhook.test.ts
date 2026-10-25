import { serverHandler } from "@/tests/helpers/server-route";
import { eq } from "drizzle-orm";
import { Webhook } from "svix";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { resumes, user } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/types/json";
import { NOW, seedUser } from "../../helpers/clerk-session";
import { createTestDb, type TestDb } from "../../helpers/pglite-db";

const SECRET = `whsec_${btoa("clickfolio-test-secret-bytes")}`;

type Bindings = { secret: string | undefined; workflowBound: boolean };

const mocks = vi.hoisted(() => {
  const state: Bindings = { secret: undefined, workflowBound: true };

  return {
    getDb: vi.fn(),
    workflowCreate: vi.fn(),
    revalidate: vi.fn(),
    indexNow: vi.fn(),
    state,
  };
});

vi.mock("cloudflare:workers", () => ({
  env: {
    get CLERK_WEBHOOK_SECRET() {
      return mocks.state.secret;
    },
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
    get CLICKFOLIO_R2_DELETE_WORKFLOW() {
      return mocks.state.workflowBound ? { create: mocks.workflowCreate } : undefined;
    },
  },
  waitUntil: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.getDb() }));

vi.mock("@/lib/utils/revalidate", () => ({
  revalidatePublicProfilePages: (handles: unknown[]) => mocks.revalidate(handles),
}));

vi.mock("@/lib/seo/indexnow-runtime", () => ({
  notifyIndexNowForProfiles: (handles: unknown[], options?: { skipDebounce?: boolean }) =>
    mocks.indexNow(handles, options),
}));

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
  mocks.getDb.mockReturnValue(db);
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  mocks.state.secret = SECRET;
  mocks.state.workflowBound = true;
  mocks.workflowCreate.mockReset().mockResolvedValue({ id: "wf-1" });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  mocks.revalidate.mockClear();
  mocks.indexNow.mockClear();
});

function clerkUser(overrides: Record<string, JsonValue> = {}) {
  return {
    id: "user_clerk_1",
    external_id: null,
    first_name: "Ada",
    last_name: "Lovelace",
    image_url: "https://img.clerk.test/ada.png",
    primary_email_address_id: "idn_1",
    email_addresses: [{ id: "idn_1", email_address: "ada@example.com", verification: null }],
    ...overrides,
  };
}

/** A delivery signed the way Svix signs it, so the route verifies it for real. */
function delivery(
  type: string,
  data: JsonValue,
  options: { secret?: string; tamper?: boolean } = {},
): Request {
  const payload = JSON.stringify({ type, data });
  const id = "msg_test_1";
  const timestamp = new Date();
  const signature = new Webhook(options.secret ?? SECRET).sign(id, timestamp, payload);

  return new Request("https://clickfolio.me/api/webhooks/clerk", {
    method: "POST",
    headers: {
      "svix-id": id,
      "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "svix-signature": signature,
    },
    body: options.tamper ? `${payload} ` : payload,
  });
}

async function usersWhere(clerkId: string) {
  return db.select().from(user).where(eq(user.clerkId, clerkId));
}

describe("POST /api/webhooks/clerk", () => {
  it("answers 500 and does nothing when the webhook secret is not configured", async () => {
    mocks.state.secret = undefined;

    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");
    const response = await POST(delivery("user.created", clerkUser()));

    expect(response.status).toBe(500);
    expect(await usersWhere("user_clerk_1")).toHaveLength(0);
  });

  it("answers 401 for a delivery signed with another secret", async () => {
    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(
      delivery("user.created", clerkUser(), { secret: `whsec_${btoa("someone-elses-secret")}` }),
    );

    expect(response.status).toBe(401);
    expect(await usersWhere("user_clerk_1")).toHaveLength(0);
  });

  it("answers 401 when the body was altered after signing", async () => {
    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");
    const response = await POST(delivery("user.created", clerkUser(), { tamper: true }));

    expect(response.status).toBe(401);
    expect(await usersWhere("user_clerk_1")).toHaveLength(0);
  });

  it("answers 401 when the Svix headers are missing", async () => {
    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(
      new Request("https://clickfolio.me/api/webhooks/clerk", {
        method: "POST",
        body: JSON.stringify({ type: "user.created", data: clerkUser() }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("answers 500, not 401, when the configured secret is not a valid Svix secret", async () => {
    mocks.state.secret = "not-a-svix-secret";

    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");
    const response = await POST(delivery("user.created", clerkUser()));

    // The sender did nothing wrong: this is our configuration, so Svix keeps retrying.
    expect(response.status).toBe(500);
    expect(await usersWhere("user_clerk_1")).toHaveLength(0);
  });

  it("answers 400 for a correctly signed body that is not JSON", async () => {
    const id = "msg_test_1";
    const timestamp = new Date();
    const payload = "{not json";
    const signature = new Webhook(SECRET).sign(id, timestamp, payload);

    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(
      new Request("https://clickfolio.me/api/webhooks/clerk", {
        method: "POST",
        headers: {
          "svix-id": id,
          "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
          "svix-signature": signature,
        },
        body: payload,
      }),
    );

    expect(response.status).toBe(400);
  });

  it("creates the user row on user.created", async () => {
    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(delivery("user.created", clerkUser()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: true,
      action: "upserted",
      detail: "user_clerk_1",
    });

    const [row] = await usersWhere("user_clerk_1");

    expect(row).toMatchObject({
      id: "user_clerk_1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      image: "https://img.clerk.test/ada.png",
      emailVerified: false,
    });
  });

  it.each(["user.created", "user.updated"])(
    "creates an unmapped user with a placeholder on %s when another account owns the email",
    async (eventType) => {
      await seedUser(db, "other", { email: "taken@example.com", emailVerified: true });

      const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

      const payload = clerkUser({
        email_addresses: [
          {
            id: "idn_1",
            email_address: "taken@example.com",
            verification: { status: "verified" },
          },
        ],
      });

      const response = await POST(delivery(eventType, payload));

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        action: "upserted",
        detail: "user_clerk_1",
      });
      expect(await usersWhere("user_clerk_1")).toMatchObject([
        {
          id: "user_clerk_1",
          name: "Ada Lovelace",
          email: "user_clerk_1@unverified.clerk",
          emailVerified: false,
          image: "https://img.clerk.test/ada.png",
        },
      ]);
      expect(await usersWhere("clerk-other")).toMatchObject([
        { id: "other", email: "taken@example.com", emailVerified: true },
      ]);

      expect((await POST(delivery(eventType, payload))).status).toBe(200);
      expect(await usersWhere("user_clerk_1")).toHaveLength(1);
      expect(await usersWhere("clerk-other")).toMatchObject([
        { id: "other", email: "taken@example.com", emailVerified: true },
      ]);
    },
  );

  it("uses the external id as the row id when Clerk carries one", async () => {
    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(
      delivery("user.created", clerkUser({ external_id: "legacy-id-7" })),
    );

    expect(response.status).toBe(200);
    expect((await usersWhere("user_clerk_1"))[0].id).toBe("legacy-id-7");
  });

  it("names the user Unnamed and keeps a placeholder email when Clerk sends neither", async () => {
    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(
      delivery(
        "user.created",
        clerkUser({ first_name: null, last_name: null, email_addresses: [] }),
      ),
    );

    expect(response.status).toBe(200);

    const [row] = await usersWhere("user_clerk_1");

    expect(row.name).toBe("Unnamed");
    expect(row.email).toBe("user_clerk_1@unverified.clerk");
  });

  it("updates the profile of an existing user on user.updated instead of inserting again", async () => {
    await seedUser(db, "existing", { clerkId: "user_clerk_1", name: "Old Name", image: null });

    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(delivery("user.updated", clerkUser({ first_name: "Grace" })));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ action: "upserted", detail: "existing" });

    const rows = await usersWhere("user_clerk_1");

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "existing",
      name: "Grace Lovelace",
      image: "https://img.clerk.test/ada.png",
    });
  });

  it("moves to a verified new primary email and marks it verified", async () => {
    await seedUser(db, "existing", {
      clerkId: "user_clerk_1",
      email: "old@example.com",
      emailVerified: false,
    });

    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(
      delivery(
        "user.updated",
        clerkUser({
          primary_email_address_id: "idn_2",
          email_addresses: [
            {
              id: "idn_2",
              email_address: "new@example.com",
              verification: { status: "verified" },
            },
          ],
        }),
      ),
    );

    expect(response.status).toBe(200);

    const [row] = await usersWhere("user_clerk_1");

    expect(row.email).toBe("new@example.com");
    expect(row.emailVerified).toBe(true);
  });

  it("does not adopt an unverified new primary email", async () => {
    await seedUser(db, "existing", {
      clerkId: "user_clerk_1",
      email: "old@example.com",
      emailVerified: false,
    });

    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(
      delivery(
        "user.updated",
        clerkUser({
          primary_email_address_id: "idn_2",
          email_addresses: [
            {
              id: "idn_2",
              email_address: "new@example.com",
              verification: { status: "unverified" },
            },
          ],
        }),
      ),
    );

    expect(response.status).toBe(200);

    const [row] = await usersWhere("user_clerk_1");

    expect(row.email).toBe("old@example.com");
    expect(row.emailVerified).toBe(false);
  });

  it("keeps the old email, clears emailVerified, and acks when the address belongs to another account", async () => {
    await seedUser(db, "existing", {
      clerkId: "user_clerk_1",
      email: "old@example.com",
      emailVerified: true,
    });
    await seedUser(db, "other", { email: "taken@example.com" });

    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(
      delivery(
        "user.updated",
        clerkUser({
          first_name: "Grace",
          primary_email_address_id: "idn_2",
          email_addresses: [
            {
              id: "idn_2",
              email_address: "taken@example.com",
              verification: { status: "verified" },
            },
          ],
        }),
      ),
    );

    // Acked so Svix does not retry a delivery that can never succeed.
    expect(response.status).toBe(200);

    const [row] = await usersWhere("user_clerk_1");

    expect(row.email).toBe("old@example.com");
    expect(row.emailVerified).toBe(false);
    // Unrelated profile fields still sync.
    expect(row.name).toBe("Grace Lovelace");

    const [other] = await usersWhere("clerk-other");

    expect(other.email).toBe("taken@example.com");

    const warns = vi
      .mocked(console.warn)
      .mock.calls.map((call) => call.join(" "))
      .join("\n");

    expect(warns).toContain("primary email already belongs to another account");
    expect(warns).not.toContain("taken@example.com");
  });

  it("answers 5xx when the user.updated write fails for another reason, so Svix retries", async () => {
    await seedUser(db, "existing", { clerkId: "user_clerk_1", email: "old@example.com" });

    vi.spyOn(db, "update").mockImplementation(() => {
      throw new Error("connection refused");
    });

    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(
      delivery(
        "user.updated",
        clerkUser({
          primary_email_address_id: "idn_2",
          email_addresses: [
            {
              id: "idn_2",
              email_address: "new@example.com",
              verification: { status: "verified" },
            },
          ],
        }),
      ),
    );

    expect(response.status).toBeGreaterThanOrEqual(500);
  });

  it("treats Clerk's email verification status `verified` as verified", async () => {
    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(
      delivery(
        "user.created",
        clerkUser({
          email_addresses: [
            {
              id: "idn_1",
              email_address: "ada@example.com",
              verification: { status: "verified" },
            },
          ],
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect((await usersWhere("user_clerk_1"))[0].emailVerified).toBe(true);
  });

  it("leaves an unverified primary email unverified", async () => {
    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(
      delivery(
        "user.created",
        clerkUser({
          email_addresses: [
            {
              id: "idn_1",
              email_address: "ada@example.com",
              verification: { status: "unverified" },
            },
          ],
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect((await usersWhere("user_clerk_1"))[0].emailVerified).toBe(false);
  });

  it("adopts a row created before the Clerk id was known, matched by external id", async () => {
    await seedUser(db, "legacy-id-7", { clerkId: null });

    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(
      delivery("user.created", clerkUser({ external_id: "legacy-id-7" })),
    );

    expect(response.status).toBe(200);
    expect((await usersWhere("user_clerk_1"))[0].id).toBe("legacy-id-7");
  });

  it("schedules the R2 cleanup, then deletes the user, on user.deleted", async () => {
    await seedUser(db, "alice", { clerkId: "user_clerk_1", handle: "alice-site" });
    await db.insert(resumes).values({
      id: "r1",
      userId: "alice",
      r2Key: "users/alice/r1/cv.pdf",
      status: "completed",
      createdAt: NOW,
    });

    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(delivery("user.deleted", { id: "user_clerk_1", deleted: true }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, action: "deleted" });
    expect(mocks.workflowCreate).toHaveBeenCalledWith({
      params: { keys: ["users/alice/r1/cv.pdf"], prefix: "users/alice/" },
    });
    expect(await usersWhere("user_clerk_1")).toHaveLength(0);
    expect(await db.select().from(resumes)).toHaveLength(0);
    expect(mocks.revalidate).toHaveBeenCalledWith(["alice-site"]);
    expect(mocks.indexNow).toHaveBeenCalledWith(["alice-site"], { skipDebounce: true });
  });

  it("removes a row that was only matched by external id, not left behind with its files gone", async () => {
    await seedUser(db, "legacy-id-7", { clerkId: null });
    await db.insert(resumes).values({
      id: "r1",
      userId: "legacy-id-7",
      r2Key: "users/legacy-id-7/r1/cv.pdf",
      status: "completed",
      createdAt: NOW,
    });

    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(
      delivery("user.deleted", { id: "user_clerk_1", external_id: "legacy-id-7", deleted: true }),
    );

    expect(response.status).toBe(200);
    expect(mocks.workflowCreate).toHaveBeenCalledWith({
      params: { keys: ["users/legacy-id-7/r1/cv.pdf"], prefix: "users/legacy-id-7/" },
    });
    expect(await db.select().from(user).where(eq(user.id, "legacy-id-7"))).toHaveLength(0);
    expect(await db.select().from(resumes)).toHaveLength(0);
  });

  it("keeps the user and answers 500 when the R2 cleanup cannot be scheduled, so Svix retries", async () => {
    await seedUser(db, "alice", { clerkId: "user_clerk_1" });
    mocks.workflowCreate.mockRejectedValue(new Error("workflow down"));

    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(delivery("user.deleted", { id: "user_clerk_1", deleted: true }));

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(await usersWhere("user_clerk_1")).toHaveLength(1);
  });

  it("deleting a user Clerk knew but this app never stored succeeds without scheduling anything", async () => {
    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(delivery("user.deleted", { id: "user_unknown", deleted: true }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, action: "deleted" });
    expect(mocks.workflowCreate).not.toHaveBeenCalled();
  });

  it("ignores a deactivation, which keeps the account", async () => {
    await seedUser(db, "alice", { clerkId: "user_clerk_1" });

    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(delivery("user.deleted", { id: "user_clerk_1", deleted: false }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: true,
      action: "ignored",
      detail: "deactivation",
    });
    expect(await usersWhere("user_clerk_1")).toHaveLength(1);
  });

  it("acknowledges event types it does not handle", async () => {
    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(delivery("session.created", { id: "sess_1" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: true,
      action: "ignored",
      detail: "session.created",
    });
  });

  it("answers 400 for a verified delivery whose user payload is not a Clerk user", async () => {
    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(delivery("user.created", { nope: true }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Unrecognized user payload" });
  });

  it("answers 5xx, not 200, when the database fails, so Svix retries", async () => {
    vi.spyOn(db, "query", "get").mockImplementation(() => {
      throw new Error("db down");
    });

    const POST = serverHandler((await import("@/app/routes/api/webhooks/clerk")).Route, "POST");

    const response = await POST(delivery("user.created", clerkUser()));

    expect(response.status).toBeGreaterThanOrEqual(500);
  });
});
