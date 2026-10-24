import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Effect, Layer } from "effect";
import { eq } from "drizzle-orm";
import type { PgQueryable } from "@/lib/db";
import { resumes, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { DbFailed } from "@/lib/effect/failures";
import { AlertWebhook } from "@/lib/effect/services/alert-webhook";
import { R2Store } from "@/lib/effect/services/r2-store";
import { StatusChannel } from "@/lib/effect/services/status-channel";
import { ParseErrorType } from "@/lib/parse/errors";
import {
  AiProviderFailed,
  PdfInvalid,
  R2BindingMissing,
  R2ObjectMissing,
  R2Throttled,
  UnknownParseFailure,
  toParseErrorJson,
} from "@/lib/parse/failures";
import {
  claimResumeForParse,
  completeParsedResume,
  expireWaitingForCache,
  markResumeParseFailed,
  parseResumePdf,
} from "@/lib/parse/pipeline";
import { createTestDb, INDEXABLE_CONTENT, type TestDb } from "@/tests/helpers/pglite-db";

// Step bodies of ResumeParseWorkflow, run against in-process Postgres with fakes for the
// bucket, the status Durable Object and the alert webhook.

const mocks = vi.hoisted(() => ({
  parseResumeWithAi: vi.fn(),
  classifyCareerEffect: vi.fn(),
}));

vi.mock("@/lib/utils/log", () => ({ log: vi.fn(), logEvent: vi.fn() }));

vi.mock("@/lib/ai", () => ({ parseResumeWithAi: mocks.parseResumeWithAi }));

vi.mock("@/lib/ai/career", () => ({ classifyCareerEffect: mocks.classifyCareerEffect }));

const T0 = "2026-01-01T00:00:00.000Z";

const CONTENT = INDEXABLE_CONTENT;

const JOB = {
  resumeId: "resume-1",
  userId: "user-1",
  r2Key: "users/user-1/resume-1/resume.pdf",
  fileHash: "a".repeat(64),
};

const WEBHOOK_URL = "https://hooks.example.com/services/T000";

// SAFETY: the AI modules are mocked, so the steps never read a binding from the env.
const ENV = {} as CloudflareEnv;

type StatusPush = { resumeId: string; status: string };

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;
let pushes: StatusPush[];
let pushFails: boolean;
let objects: Map<string, ArrayBuffer>;
let bucketFailure: Error | undefined;
let webhookBodies: unknown[];
let webhookFails: boolean;

function pdfBuffer(): ArrayBuffer {
  const bytes = new TextEncoder().encode("%PDF-1.4 test");

  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function unused(): never {
  throw new Error("not used by the parse pipeline");
}

const bucket = {
  get: async (key: string) => {
    if (bucketFailure) throw bucketFailure;

    const object = objects.get(key);

    return object ? { arrayBuffer: async () => object } : null;
  },
  put: async () => unused(),
  delete: async () => unused(),
  head: async () => unused(),
  list: async () => unused(),
};

const statusNamespace = {
  idFromName: (name: string) => name,
  get: (resumeId: string) => ({
    fetch: async (_url: string, init?: RequestInit) => {
      if (pushFails) throw new Error("DO unavailable");

      pushes.push({ resumeId, status: JSON.parse(String(init?.body)).status });

      return new Response("OK");
    },
  }),
};

async function webhookFetch(_url: string, init: RequestInit): Promise<Response> {
  if (webhookFails) throw new Error("webhook unavailable");

  webhookBodies.push(JSON.parse(String(init.body)));

  return new Response("ok");
}

function services(r2: Layer.Layer<R2Store> = R2Store.layerFrom(bucket)) {
  return Layer.mergeAll(
    Db.layerFrom(db),
    StatusChannel.layerFrom(statusNamespace),
    r2,
    AlertWebhook.layerFrom(WEBHOOK_URL, webhookFetch),
  );
}

function run<A, E>(
  program: Effect.Effect<A, E, Db | StatusChannel | R2Store | AlertWebhook>,
  layer = services(),
) {
  return Effect.runPromise(Effect.provide(program, layer));
}

function fail<A, E>(
  program: Effect.Effect<A, E, Db | StatusChannel | R2Store | AlertWebhook>,
  layer = services(),
) {
  return Effect.runPromise(Effect.flip(Effect.provide(program, layer)));
}

async function row(id: string) {
  const [found] = await db.select().from(resumes).where(eq(resumes.id, id));

  return found;
}

async function seed(id: string, values: Partial<typeof resumes.$inferInsert> = {}) {
  await db.insert(resumes).values({
    id,
    userId: JOB.userId,
    r2Key: `users/${JOB.userId}/${id}/resume.pdf`,
    fileHash: JOB.fileHash,
    status: "processing",
    createdAt: T0,
    ...values,
  });
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
    id: JOB.userId,
    name: "Unnamed",
    email: "user@example.com",
    createdAt: T0,
    updatedAt: T0,
  });
  pushes = [];
  pushFails = false;
  objects = new Map();
  bucketFailure = undefined;
  webhookBodies = [];
  webhookFails = false;
  mocks.parseResumeWithAi.mockReturnValue(Effect.succeed(CONTENT));
  mocks.classifyCareerEffect.mockReturnValue(
    Effect.succeed({ role: "mid_level", isFreelance: false }),
  );
});

describe("claimResumeForParse", () => {
  it("moves a queued row to processing and notifies", async () => {
    await seed(JOB.resumeId, { status: "queued" });

    await expect(run(claimResumeForParse(JOB))).resolves.toBe("parse");

    expect((await row(JOB.resumeId)).status).toBe("processing");
    expect(pushes).toEqual([{ resumeId: JOB.resumeId, status: "processing" }]);
  });

  it("claims a row it already moved, so a re-run after a lost response still parses", async () => {
    await seed(JOB.resumeId, { status: "processing" });

    await expect(run(claimResumeForParse(JOB))).resolves.toBe("parse");
  });

  it.each([
    ["missing", null],
    ["already completed", "completed" as const],
    ["not in a parseable state", "failed" as const],
  ])("skips a %s row without writing", async (_label, status) => {
    if (status) await seed(JOB.resumeId, { status });

    await expect(run(claimResumeForParse(JOB))).resolves.toBe("skipped");

    expect(pushes).toEqual([]);

    if (status) expect((await row(JOB.resumeId)).status).toBe(status);
  });

  it("claims a row whose retry count matches the run's", async () => {
    await seed(JOB.resumeId, { status: "queued", retryCount: 1 });

    await expect(run(claimResumeForParse({ ...JOB, retryCount: 1 }))).resolves.toBe("parse");

    expect((await row(JOB.resumeId)).status).toBe("processing");
  });

  it("skips a row that was swept and retried since this run started", async () => {
    // The first run (retryCount 0) outlived the sweep; the user's retry queued the row again
    // under retryCount 1 and started its own run. The old run must not parse it a second time.
    await seed(JOB.resumeId, { status: "queued", retryCount: 1 });

    await expect(run(claimResumeForParse({ ...JOB, retryCount: 0 }))).resolves.toBe("skipped");

    expect(await row(JOB.resumeId)).toMatchObject({ status: "queued", retryCount: 1 });
    expect(pushes).toEqual([]);
  });

  it("does not check the retry count of a run started before it was in the payload", async () => {
    await seed(JOB.resumeId, { status: "queued", retryCount: 1 });

    await expect(run(claimResumeForParse(JOB))).resolves.toBe("parse");
  });

  it("completes from an identical earlier parse without calling the AI", async () => {
    await seed("earlier", { status: "completed", parsedContent: CONTENT });
    await seed(JOB.resumeId, { status: "queued" });

    await expect(run(claimResumeForParse(JOB))).resolves.toBe("cached");

    expect(await row(JOB.resumeId)).toMatchObject({
      status: "completed",
      parsedContent: CONTENT,
    });
    expect(pushes).toEqual([{ resumeId: JOB.resumeId, status: "completed" }]);
    expect(mocks.parseResumeWithAi).not.toHaveBeenCalled();
  });
});

describe("parseResumePdf", () => {
  it("returns validated content and counts the attempt in SQL", async () => {
    await seed(JOB.resumeId);
    objects.set(JOB.r2Key, pdfBuffer());

    const parsed = await run(parseResumePdf(JOB, ENV));

    expect(parsed?.parsedContent.full_name).toBe(CONTENT.full_name);
    expect(parsed?.career).toEqual({ role: "mid_level", isFreelance: false });
    expect(mocks.classifyCareerEffect).toHaveBeenCalledWith(parsed?.parsedContent, ENV);
    expect((await row(JOB.resumeId)).totalAttempts).toBe(1);

    await run(parseResumePdf(JOB, ENV));
    expect((await row(JOB.resumeId)).totalAttempts).toBe(2);
  });

  it("returns null without parsing when the row is no longer processing", async () => {
    await seed(JOB.resumeId, { status: "failed" });

    await expect(run(parseResumePdf(JOB, ENV))).resolves.toBeNull();
    expect(mocks.parseResumeWithAi).not.toHaveBeenCalled();
  });

  it("does not parse a row that a sweep and a retry handed to a newer run", async () => {
    // Run 0 claimed the row and kept retrying its parse step past the 90-minute sweep. The
    // user's retry (retryCount 1) was claimed by run 1, so the row is `processing` again.
    await seed(JOB.resumeId, { status: "processing", retryCount: 1, totalAttempts: 1 });
    objects.set(JOB.r2Key, pdfBuffer());

    await expect(run(parseResumePdf({ ...JOB, retryCount: 0 }, ENV))).resolves.toBeNull();

    expect(mocks.parseResumeWithAi).not.toHaveBeenCalled();
    expect((await row(JOB.resumeId)).totalAttempts).toBe(1);

    await expect(run(parseResumePdf({ ...JOB, retryCount: 1 }, ENV))).resolves.not.toBeNull();
    expect((await row(JOB.resumeId)).totalAttempts).toBe(2);
  });

  it("does not record a failure on a row that was retried while the AI call ran", async () => {
    await seed(JOB.resumeId, { status: "processing" });
    objects.set(JOB.r2Key, pdfBuffer());
    mocks.parseResumeWithAi.mockReturnValue(
      Effect.promise(() =>
        db.update(resumes).set({ retryCount: 1 }).where(eq(resumes.id, JOB.resumeId)),
      ).pipe(
        Effect.andThen(
          Effect.fail(new PdfInvalid({ message: "PDF is encrypted", reason: "encrypted" })),
        ),
      ),
    );

    await expect(run(parseResumePdf({ ...JOB, retryCount: 0 }, ENV))).rejects.toThrow();

    expect(await row(JOB.resumeId)).toMatchObject({ errorMessage: null, lastAttemptError: null });
  });

  it("fails permanently and records it when the PDF is missing", async () => {
    await seed(JOB.resumeId);

    const failure = await fail(parseResumePdf(JOB, ENV));

    expect(failure).toBeInstanceOf(R2ObjectMissing);
    expect(failure.retryable).toBe(false);
    expect((await row(JOB.resumeId)).lastAttemptError).toContain("Failed to fetch PDF");
  });

  it("records a friendly message when the AI reports a bad PDF", async () => {
    await seed(JOB.resumeId);
    objects.set(JOB.r2Key, pdfBuffer());
    mocks.parseResumeWithAi.mockReturnValue(
      Effect.fail(new PdfInvalid({ message: "PDF is encrypted", reason: "encrypted" })),
    );

    await expect(run(parseResumePdf(JOB, ENV))).rejects.toThrow("PDF is encrypted");
    expect((await row(JOB.resumeId)).errorMessage).toBe(
      "Your PDF is password-protected. Please upload an unprotected version.",
    );
  });

  it("fails retryably for a transient AI failure without failing the row", async () => {
    await seed(JOB.resumeId);
    objects.set(JOB.r2Key, pdfBuffer());
    mocks.parseResumeWithAi.mockReturnValue(
      Effect.fail(new AiProviderFailed({ message: "AI provider timeout" })),
    );

    const failure = await fail(parseResumePdf(JOB, ENV));

    expect(failure).toBeInstanceOf(AiProviderFailed);
    expect(failure.retryable).toBe(true);
    expect((await row(JOB.resumeId)).status).toBe("processing");
  });

  it("does not overwrite a completed row when recording a failure", async () => {
    await seed(JOB.resumeId);
    objects.set(JOB.r2Key, pdfBuffer());
    mocks.parseResumeWithAi.mockImplementation(() =>
      Effect.promise(() =>
        db.update(resumes).set({ status: "completed" }).where(eq(resumes.id, JOB.resumeId)),
      ).pipe(Effect.flatMap(() => Effect.fail(new AiProviderFailed({ message: "late" })))),
    );

    await fail(parseResumePdf(JOB, ENV));

    expect((await row(JOB.resumeId)).lastAttemptError).toBeNull();
  });
});

describe("typed parse failure boundaries", () => {
  it("maps an R2 outage to a retryable throttle", async () => {
    await seed(JOB.resumeId);
    bucketFailure = new Error("R2 temporarily unavailable");

    const failure = await fail(parseResumePdf(JOB, ENV));

    expect(failure).toBeInstanceOf(R2Throttled);
    expect(failure.retryable).toBe(true);
  });

  it("maps a missing bucket binding to a permanent failure", async () => {
    await seed(JOB.resumeId);

    const failure = await fail(parseResumePdf(JOB, ENV), services(R2Store.layer({})));

    expect(failure).toBeInstanceOf(R2BindingMissing);
    expect(failure.retryable).toBe(false);
  });

  it("records a defect while retaining its identity", async () => {
    await seed(JOB.resumeId);
    objects.set(JOB.r2Key, pdfBuffer());

    const defect = new Error("unexpected transform bug");
    mocks.parseResumeWithAi.mockReturnValue(Effect.die(defect));

    await expect(run(parseResumePdf(JOB, ENV))).rejects.toBe(defect);
    expect((await row(JOB.resumeId)).lastAttemptError).toContain("unexpected transform bug");
  });

  it("keeps the original failure when recording it also fails", async () => {
    await seed(JOB.resumeId);
    objects.set(JOB.r2Key, pdfBuffer());

    const failure = new PdfInvalid({ message: "encrypted", reason: "encrypted" });
    mocks.parseResumeWithAi.mockReturnValue(Effect.fail(failure));

    const recordFails = Layer.effect(
      Db,
      Effect.gen(function* () {
        const real = yield* Db;

        return {
          ...real,
          query: <A>(operation: string, work: (handle: PgQueryable) => PromiseLike<A>) =>
            operation === "parse.record_failure"
              ? Effect.fail(
                  new DbFailed({
                    operation,
                    kind: "unavailable",
                    message: "database connection reset",
                  }),
                )
              : real.query(operation, work),
        };
      }),
    ).pipe(Layer.provide(Db.layerFrom(db)));

    const layer = Layer.mergeAll(
      recordFails,
      StatusChannel.layerFrom(undefined),
      R2Store.layerFrom(bucket),
    );

    await expect(
      Effect.runPromise(Effect.flip(Effect.provide(parseResumePdf(JOB, ENV), layer))),
    ).resolves.toBe(failure);
  });
});

describe("completeParsedResume", () => {
  const parsed = {
    parsedContent: CONTENT,
    career: { role: "senior" as const, isFreelance: true },
  };

  it("completes the row and fans out to identical uploads waiting on it", async () => {
    await seed(JOB.resumeId);
    await seed("waiting-1", { status: "waiting_for_cache" });

    await run(completeParsedResume(JOB, parsed));

    expect(await row(JOB.resumeId)).toMatchObject({ status: "completed", parsedContent: CONTENT });
    expect(await row("waiting-1")).toMatchObject({ status: "completed", parsedContent: CONTENT });
    expect(pushes.map((push) => push.resumeId).sort()).toEqual(["resume-1", "waiting-1"]);

    const [owner] = await db.select().from(user).where(eq(user.id, JOB.userId));
    expect(owner).toMatchObject({ role: "senior", roleSource: "ai", isFreelance: true });
  });

  it("completes only the row itself when nothing is waiting, without a career", async () => {
    await seed(JOB.resumeId);

    await run(completeParsedResume(JOB, { ...parsed, career: null }));

    expect((await row(JOB.resumeId)).status).toBe("completed");
    expect(pushes).toEqual([{ resumeId: JOB.resumeId, status: "completed" }]);

    const [owner] = await db.select().from(user).where(eq(user.id, JOB.userId));
    expect(owner.roleSource).not.toBe("ai");
  });
});

describe("markResumeParseFailed", () => {
  const stored = toParseErrorJson(new R2ObjectMissing({ message: "Failed to fetch PDF from R2" }));

  it("fails the row, notifies, and alerts with the attempt count", async () => {
    await seed(JOB.resumeId, { totalAttempts: 4 });

    await run(markResumeParseFailed(JOB, stored, "webhook"));

    // COALESCE supplies the generic message when the parse step wrote none.
    expect(await row(JOB.resumeId)).toMatchObject({
      status: "failed",
      errorMessage: expect.stringContaining("Something went wrong"),
    });
    expect(pushes).toEqual([{ resumeId: JOB.resumeId, status: "failed" }]);
    expect(webhookBodies).toEqual([
      expect.objectContaining({ resumeId: JOB.resumeId, totalAttempts: 4 }),
    ]);
  });

  it("leaves a row alone when a sweep and a retry handed it to a newer run", async () => {
    await seed(JOB.resumeId, { status: "processing", retryCount: 1 });

    await run(markResumeParseFailed({ ...JOB, retryCount: 0 }, stored, "webhook"));

    expect((await row(JOB.resumeId)).status).toBe("processing");
    expect(pushes).toEqual([]);
    expect(webhookBodies).toEqual([]);
  });

  it("keeps a friendlier message written by the parse step", async () => {
    await seed(JOB.resumeId, { errorMessage: "Your PDF is password-protected." });

    await run(markResumeParseFailed(JOB, stored, "logpush"));

    expect((await row(JOB.resumeId)).errorMessage).toBe("Your PDF is password-protected.");
  });

  it("fails identical uploads waiting on this parse with the same message", async () => {
    const friendly =
      "No text could be extracted from your scanned PDF. Try a clearer photo or export as text PDF.";

    await seed(JOB.resumeId, { totalAttempts: 1, errorMessage: friendly });
    await seed("waiting-1", { status: "waiting_for_cache" });
    await seed("waiting-2", { status: "waiting_for_cache" });

    const scanned = toParseErrorJson(
      new PdfInvalid({ message: friendly, reason: "scanned-empty" }),
    );

    await run(markResumeParseFailed(JOB, scanned, "webhook"));

    for (const id of ["waiting-1", "waiting-2"]) {
      const waiting = await row(id);

      expect(waiting).toMatchObject({ status: "failed", errorMessage: friendly });
      expect(JSON.parse(String(waiting.lastAttemptError))).toMatchObject({
        type: ParseErrorType.INVALID_PDF,
      });
    }

    expect(pushes.map((push) => push.resumeId).sort()).toEqual([
      "resume-1",
      "waiting-1",
      "waiting-2",
    ]);
    expect(webhookBodies).toHaveLength(1);
  });

  it.each([["completed" as const], [null]])(
    "does nothing more when the row is %s",
    async (status) => {
      if (status) await seed(JOB.resumeId, { status });

      await run(
        markResumeParseFailed(
          JOB,
          toParseErrorJson(new UnknownParseFailure({ message: "boom" })),
          "webhook",
        ),
      );

      expect(pushes).toEqual([]);
      expect(webhookBodies).toEqual([]);

      if (status) expect((await row(JOB.resumeId)).status).toBe("completed");
    },
  );

  it("finishes the terminal updates even when notifications and alerting fail", async () => {
    await seed(JOB.resumeId, { totalAttempts: 4 });
    await seed("waiting-1", { status: "waiting_for_cache" });
    pushFails = true;
    webhookFails = true;

    await expect(run(markResumeParseFailed(JOB, stored, "webhook"))).resolves.toBeUndefined();

    expect((await row(JOB.resumeId)).status).toBe("failed");
    expect((await row("waiting-1")).status).toBe("failed");
  });
});

describe("expireWaitingForCache", () => {
  it("persists the timeout and notifies when the row is still waiting", async () => {
    await seed(JOB.resumeId, { status: "waiting_for_cache" });

    await expect(run(expireWaitingForCache(JOB.resumeId))).resolves.toBe(true);

    expect((await row(JOB.resumeId)).status).toBe("failed");
    expect(pushes).toEqual([{ resumeId: JOB.resumeId, status: "failed" }]);
  });

  it("leaves a row that already resolved alone", async () => {
    await seed(JOB.resumeId, { status: "completed" });

    await expect(run(expireWaitingForCache(JOB.resumeId))).resolves.toBe(false);
    expect(pushes).toEqual([]);
  });
});
