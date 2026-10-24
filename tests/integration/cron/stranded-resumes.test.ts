import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Layer } from "effect";
import { and, eq, sql } from "drizzle-orm";
import { resumes, user } from "@/lib/db/schema";
import { runStrandedSweep } from "@/lib/cron/stranded-resumes";
import { Db } from "@/lib/effect/db";
import { StatusChannel } from "@/lib/effect/services/status-channel";
import { R2Store } from "@/lib/effect/services/r2-store";
import { claimResumeForParse, parseResumePdf } from "@/lib/parse/pipeline";
import {
  checkRetryEligibility,
  STRANDED_PROCESSING_MESSAGE,
  STRANDED_START_MESSAGE,
} from "@/lib/resume/lifecycle";
import { logEvent } from "@/lib/utils/log";
import { createTestDb, type TestDb } from "@/tests/helpers/pglite-db";
import { Effect } from "effect";

// The stranded-row sweeper against in-process Postgres: the age comparison and the status guard
// are SQL, so a mocked query chain could not show them. The status Durable Object is a fake.

vi.mock("@/lib/utils/log", () => ({ log: vi.fn(), logEvent: vi.fn() }));

const MINUTE = 60 * 1000;

const USER_ID = "user-1";

type StatusPush = { resumeId: string; status: string; error?: string };

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;
let pushes: StatusPush[];
let pushFails: boolean;

const statusNamespace = {
  idFromName: (name: string) => name,
  get: (resumeId: string) => ({
    fetch: async (_url: string, init?: RequestInit) => {
      if (pushFails) throw new Error("DO unavailable");

      pushes.push({ resumeId, ...JSON.parse(String(init?.body)) });

      return new Response("OK");
    },
  }),
};

function unused(): never {
  throw new Error("not used by the sweep");
}

const emptyBucket = {
  get: async () => null,
  put: async () => unused(),
  delete: async () => unused(),
  head: async () => unused(),
  list: async () => unused(),
};

// SAFETY: parseResumePdf reads the env only after the attempt guard; these tests stop before it.
const ENV = {} as CloudflareEnv;

const layer = () => Layer.mergeAll(Db.layerFrom(db), StatusChannel.layerFrom(statusNamespace));

const sweep = (batchSize?: number) => runStrandedSweep(layer(), batchSize);

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * MINUTE).toISOString();

async function seed(id: string, values: Partial<typeof resumes.$inferInsert> = {}) {
  await db.insert(resumes).values({
    id,
    userId: USER_ID,
    r2Key: `users/${USER_ID}/${id}/resume.pdf`,
    fileHash: "a".repeat(64),
    status: "queued",
    createdAt: minutesAgo(600),
    ...values,
  });
}

async function row(id: string) {
  const [found] = await db.select().from(resumes).where(eq(resumes.id, id));

  return found;
}

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  vi.clearAllMocks();
  await testDb.reset();
  await db.insert(user).values({
    id: USER_ID,
    name: "Unnamed",
    email: "user@example.com",
    createdAt: minutesAgo(1000),
    updatedAt: minutesAgo(1000),
  });
  pushes = [];
  pushFails = false;
});

describe("runStrandedSweep: rows that never started", () => {
  it("fails a queued row older than 15 minutes with a retryable message", async () => {
    await seed("stuck", { status: "queued", queuedAt: minutesAgo(16) });

    await expect(sweep()).resolves.toEqual({ neverStarted: 1, timedOut: 0 });

    const swept = await row("stuck");

    expect(swept).toMatchObject({
      status: "failed",
      errorMessage: STRANDED_START_MESSAGE,
      lastAttemptError: null,
    });
    expect(STRANDED_START_MESSAGE).toBe("Processing didn't start. Please try again.");

    // The cleanup cron deletes failed rows three days after `updated_at`: a swept row must not
    // look three days old because it was created long ago.
    expect(Date.now() - Date.parse(String(swept.updatedAt))).toBeLessThan(MINUTE);

    expect(checkRetryEligibility(swept)).toEqual({ eligible: true, nextAttempt: 1 });
  });

  it("fails a pending_claim row that was never queued, measured from created_at", async () => {
    await seed("claim", { status: "pending_claim", queuedAt: null, createdAt: minutesAgo(20) });

    await expect(sweep()).resolves.toEqual({ neverStarted: 1, timedOut: 0 });

    expect(await row("claim")).toMatchObject({
      status: "failed",
      errorMessage: STRANDED_START_MESSAGE,
    });
  });

  it("leaves rows younger than 15 minutes alone", async () => {
    await seed("queued", { status: "queued", queuedAt: minutesAgo(5) });
    await seed("claim", { status: "pending_claim", queuedAt: null, createdAt: minutesAgo(5) });

    await expect(sweep()).resolves.toEqual({ neverStarted: 0, timedOut: 0 });

    expect((await row("queued")).status).toBe("queued");
    expect((await row("claim")).status).toBe("pending_claim");
    expect(pushes).toEqual([]);
  });

  it("measures a retried row from the retry, not from the upload", async () => {
    await seed("retried", {
      status: "queued",
      retryCount: 1,
      createdAt: minutesAgo(5000),
      queuedAt: minutesAgo(2),
    });

    await expect(sweep()).resolves.toEqual({ neverStarted: 0, timedOut: 0 });

    expect((await row("retried")).status).toBe("queued");
  });

  it("keeps a swept row retryable, and a retry makes an older run's claim a no-op", async () => {
    await seed("stuck", { status: "queued", queuedAt: minutesAgo(30) });

    await sweep();

    // What POST /api/resume/retry does to a failed row, in one statement.
    await db
      .update(resumes)
      .set({
        status: "queued",
        errorMessage: null,
        retryCount: sql`${resumes.retryCount} + 1`,
        queuedAt: new Date().toISOString(),
      })
      .where(and(eq(resumes.id, "stuck"), eq(resumes.status, "failed")));

    const job = { resumeId: "stuck", userId: USER_ID, r2Key: "k", fileHash: "a".repeat(64) };

    const run = (retryCount: number) =>
      Effect.runPromise(Effect.provide(claimResumeForParse({ ...job, retryCount }), layer()));

    // The first run, started at upload time, wakes up late.
    await expect(run(0)).resolves.toBe("skipped");
    expect((await row("stuck")).status).toBe("queued");

    await expect(run(1)).resolves.toBe("parse");
    expect((await row("stuck")).status).toBe("processing");
  });
});

describe("runStrandedSweep: rows that started and never finished", () => {
  it("fails a processing row 91 minutes after it was claimed", async () => {
    await seed("slow", { status: "processing", queuedAt: minutesAgo(91) });

    await expect(sweep()).resolves.toEqual({ neverStarted: 0, timedOut: 1 });

    const swept = await row("slow");

    expect(swept).toMatchObject({
      status: "failed",
      errorMessage: STRANDED_PROCESSING_MESSAGE,
      lastAttemptError: null,
    });
    expect(STRANDED_PROCESSING_MESSAGE).toBe("Processing took too long. Please try again.");
    expect(checkRetryEligibility(swept).eligible).toBe(true);
  });

  it("keeps the attempts and the last error a stuck run left behind", async () => {
    // One run's worth of parse attempts (the step retries 3 times) that ended in a transient error.
    const transient = JSON.stringify({
      type: "ai_provider_error",
      message: "AI provider returned an error",
      isRetryable: true,
    });

    await seed("slow", {
      status: "processing",
      queuedAt: minutesAgo(91),
      totalAttempts: 4,
      lastAttemptError: transient,
    });

    await sweep();

    const swept = await row("slow");

    expect(swept).toMatchObject({ lastAttemptError: transient, totalAttempts: 4 });
    expect(checkRetryEligibility(swept)).toEqual({ eligible: true, nextAttempt: 1 });
  });

  it("leaves the existing retry limits in force", async () => {
    await seed("spent", {
      status: "processing",
      queuedAt: minutesAgo(91),
      retryCount: 2,
      totalAttempts: 6,
    });
    await seed("permanent", {
      status: "processing",
      queuedAt: minutesAgo(91),
      lastAttemptError: JSON.stringify({ type: "invalid_pdf", message: "Not a PDF" }),
    });

    await sweep();

    expect(checkRetryEligibility(await row("spent")).eligible).toBe(false);
    expect(checkRetryEligibility(await row("permanent")).eligible).toBe(false);
  });

  it("hands a swept, retried row to the new run only", async () => {
    // Run 0 claimed the row and is still retrying its parse step when the sweep fails the row.
    // The user retries; run 1 claims it. Run 0's next attempt must find the row is not its own.
    await seed("slow", { status: "processing", queuedAt: minutesAgo(91) });

    await sweep();

    await db
      .update(resumes)
      .set({ status: "queued", retryCount: 1, errorMessage: null, queuedAt: minutesAgo(0) })
      .where(eq(resumes.id, "slow"));

    const job = { resumeId: "slow", userId: USER_ID, r2Key: "k", fileHash: "a".repeat(64) };

    const run = <A, E>(program: Effect.Effect<A, E, Db | StatusChannel | R2Store>) =>
      Effect.runPromise(
        Effect.provide(program, Layer.mergeAll(layer(), R2Store.layerFrom(emptyBucket))),
      );

    await expect(run(claimResumeForParse({ ...job, retryCount: 1 }))).resolves.toBe("parse");
    await expect(run(parseResumePdf({ ...job, retryCount: 0 }, ENV))).resolves.toBeNull();

    expect(await row("slow")).toMatchObject({ status: "processing", totalAttempts: 0 });
  });

  it("leaves a processing row at 30 minutes alone", async () => {
    await seed("working", { status: "processing", queuedAt: minutesAgo(30) });

    await expect(sweep()).resolves.toEqual({ neverStarted: 0, timedOut: 0 });

    expect((await row("working")).status).toBe("processing");
    expect(pushes).toEqual([]);
  });

  it("does not use the 15-minute limit on a processing row", async () => {
    await seed("working", { status: "processing", queuedAt: minutesAgo(60) });

    await sweep();

    expect((await row("working")).status).toBe("processing");
  });
});

describe("runStrandedSweep: guards", () => {
  it.each(["completed", "failed", "waiting_for_cache"] as const)(
    "never touches a stale %s row",
    async (status) => {
      await seed("other", { status, queuedAt: minutesAgo(500), errorMessage: "kept" });

      await expect(sweep()).resolves.toEqual({ neverStarted: 0, timedOut: 0 });

      expect(await row("other")).toMatchObject({ status, errorMessage: "kept" });
      expect(pushes).toEqual([]);
    },
  );

  it("sweeps at most one batch per rule and takes the oldest first", async () => {
    await seed("a-oldest", { status: "queued", queuedAt: minutesAgo(300) });
    await seed("b-old", { status: "queued", queuedAt: minutesAgo(200) });
    await seed("c-newer", { status: "queued", queuedAt: minutesAgo(100) });

    await expect(sweep(2)).resolves.toEqual({ neverStarted: 2, timedOut: 0 });

    expect((await row("a-oldest")).status).toBe("failed");
    expect((await row("b-old")).status).toBe("failed");
    expect((await row("c-newer")).status).toBe("queued");

    await expect(sweep(2)).resolves.toEqual({ neverStarted: 1, timedOut: 0 });
  });
});

describe("runStrandedSweep: reporting", () => {
  it("pushes the failure to each swept row's status channel", async () => {
    await seed("stuck", { status: "queued", queuedAt: minutesAgo(20) });
    await seed("slow", { status: "processing", queuedAt: minutesAgo(100) });

    await sweep();

    expect(pushes).toHaveLength(2);
    expect(pushes).toContainEqual(
      expect.objectContaining({
        resumeId: "stuck",
        status: "failed",
        error: STRANDED_START_MESSAGE,
      }),
    );
    expect(pushes).toContainEqual(
      expect.objectContaining({
        resumeId: "slow",
        status: "failed",
        error: STRANDED_PROCESSING_MESSAGE,
      }),
    );
  });

  it("logs one event per swept row with ids and an enum only", async () => {
    await seed("stuck", { status: "queued", queuedAt: minutesAgo(20) });
    await seed("slow", { status: "processing", queuedAt: minutesAgo(100) });

    await sweep();

    expect(logEvent).toHaveBeenCalledTimes(2);
    expect(logEvent).toHaveBeenCalledWith(
      "resume_swept",
      { resumeId: "stuck", reason: "never_started" },
      "warn",
    );
    expect(logEvent).toHaveBeenCalledWith(
      "resume_swept",
      { resumeId: "slow", reason: "processing_timeout" },
      "warn",
    );
  });

  it("keeps the row failed when the status push fails", async () => {
    pushFails = true;
    await seed("stuck", { status: "queued", queuedAt: minutesAgo(20) });

    await expect(sweep()).resolves.toEqual({ neverStarted: 1, timedOut: 0 });

    expect((await row("stuck")).status).toBe("failed");
    expect(logEvent).toHaveBeenCalledTimes(1);
  });

  it("rejects when the database fails, so the run is recorded as failed", async () => {
    const down = Layer.mergeAll(
      Db.layerFrom(
        // SAFETY: only `update` is reached, and it throws before returning a builder.
        {
          update: () => {
            throw new Error("connection refused");
          },
        } as never,
      ),
      StatusChannel.layerFrom(statusNamespace),
    );

    await expect(runStrandedSweep(down)).rejects.toThrow();
    expect(logEvent).not.toHaveBeenCalled();
  });
});
