import { readFileSync } from "node:fs";
import { Effect, Layer } from "effect";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { buildSiteDataUpsert } from "@/lib/data/site-data-upsert";
import { resumes, siteData, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { Mailer } from "@/lib/effect/services/mailer";
import { portfolioLiveEmail, portfolioLiveEmailBestEffort } from "@/lib/parse/email";
import { NOW, seedUser } from "../../helpers/clerk-session";
import {
  createTestDb,
  INDEXABLE_CONTENT,
  type TestDb,
  type TestDbHandle,
} from "../../helpers/pglite-db";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  send: vi.fn<(message: EmailMessage | EmailMessageBuilder) => Promise<EmailSendResult>>(),
  log: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.getDb() }));

vi.mock("@/lib/utils/log", () => ({ log: mocks.log }));

// SAFETY: getDb is mocked, so the binding is never read.
const HYPERDRIVE = {} as CloudflareEnv["HYPERDRIVE"];

const CONFIG = { appUrl: "https://clickfolio.me", from: "notifications@clickfolio.me" };

let testDb: TestDbHandle;
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
  vi.clearAllMocks();
  mocks.send.mockResolvedValue({ messageId: "message-1" });
  await testDb.reset();
  await seedUser(db, "alice", { emailVerified: true });
});

function sendLive(userId = "alice", config = CONFIG) {
  return Effect.runPromise(
    Effect.provide(
      portfolioLiveEmail(userId, config),
      Layer.mergeAll(Db.layer(HYPERDRIVE), Mailer.layerFrom({ send: mocks.send })),
    ),
  );
}

/** A completed resume and the published site_data a parse completion writes for it. */
async function publishParsed(userId = "alice", publish = true) {
  const resumeId = `resume-${userId}`;

  await db.insert(resumes).values({
    id: resumeId,
    userId,
    r2Key: `users/${userId}/resume.pdf`,
    status: "completed",
    parsedContent: INDEXABLE_CONTENT,
    createdAt: NOW,
  });
  await buildSiteDataUpsert(db, userId, resumeId, INDEXABLE_CONTENT, { publish });
}

async function sentAt(userId = "alice") {
  const [row] = await db.select({ at: user.liveEmailSentAt }).from(user).where(eq(user.id, userId));

  return row.at;
}

describe("portfolioLiveEmail", () => {
  it("emails the verified owner their profile link once, however often it is asked", async () => {
    await publishParsed();

    await expect(sendLive()).resolves.toBe("sent");
    await expect(sendLive()).resolves.toBe("skipped");

    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        from: "notifications@clickfolio.me",
        subject: "Your portfolio is live",
        text: expect.stringMatching(
          /https:\/\/clickfolio\.me\/@handle-alice[\s\S]*https:\/\/clickfolio\.me\/dashboard/,
        ),
      }),
    );
    expect(await sentAt()).not.toBeNull();
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("alice@example.com");
  });

  it("waits for parsed content behind the wizard's placeholder row, then sends", async () => {
    // The wizard publishes a placeholder (no resume_id) when it finishes before the parse.
    await db.insert(siteData).values({
      id: "site-alice",
      userId: "alice",
      content: { ...INDEXABLE_CONTENT, full_name: "Pending" },
      lastPublishedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    });

    await expect(sendLive()).resolves.toBe("skipped");
    expect(await sentAt()).toBeNull();

    await publishParsed();

    await expect(sendLive()).resolves.toBe("sent");
  });

  it.each([
    ["has no handle yet", { handle: null }],
    ["is unverified", { emailVerified: false }],
    ["has an unknown verification state", { emailVerified: null }],
    ["is anonymous", { clerkId: null }],
  ] as const)("skips an owner who %s without spending the claim", async (_label, overrides) => {
    await db.update(user).set(overrides).where(eq(user.id, "alice"));
    await publishParsed();

    await expect(sendLive()).resolves.toBe("skipped");
    expect(await sentAt()).toBeNull();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("skips an unpublished page and a missing user", async () => {
    await publishParsed("alice", false);

    await expect(sendLive()).resolves.toBe("skipped");
    await expect(sendLive("nobody")).resolves.toBe("skipped");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not spend the claim on a bad APP_URL", async () => {
    await publishParsed();

    await expect(sendLive("alice", { ...CONFIG, appUrl: "not a url" })).rejects.toThrow();
    expect(await sentAt()).toBeNull();
  });
});

describe("portfolioLiveEmailBestEffort", () => {
  it("logs a rejected send without the recipient and never sends again", async () => {
    await publishParsed();
    mocks.send.mockRejectedValue(new Error("Provider details: alice@example.com"));
    const layer = Layer.mergeAll(Db.layer(HYPERDRIVE), Mailer.layerFrom({ send: mocks.send }));

    await Effect.runPromise(Effect.provide(portfolioLiveEmailBestEffort("alice", CONFIG), layer));
    await Effect.runPromise(Effect.provide(portfolioLiveEmailBestEffort("alice", CONFIG), layer));

    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "portfolio live email failed",
      expect.objectContaining({ userId: "alice", "error.message": "Provider details: [email]" }),
    );
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("alice@example.com");
  });
});

describe("0016 backfill", () => {
  it("marks portfolios already live with parsed content, and nobody else", async () => {
    await publishParsed();
    await seedUser(db, "bob", { emailVerified: true });
    await db.insert(siteData).values({
      id: "site-bob",
      userId: "bob",
      content: { ...INDEXABLE_CONTENT, full_name: "Pending" },
      lastPublishedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await seedUser(db, "carol", { emailVerified: true });
    await publishParsed("carol", false);

    const [, backfill] = readFileSync("migrations_pg/0016_portfolio_live_email.sql", "utf8").split(
      "--> statement-breakpoint",
    );

    await db.execute(sql.raw(backfill));

    expect(await sentAt("alice")).not.toBeNull();
    expect(await sentAt("bob")).toBeNull();
    expect(await sentAt("carol")).toBeNull();
  });
});
