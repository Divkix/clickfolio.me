import { Effect } from "effect";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { DbFailed } from "@/lib/effect/failures";
import {
  isHandleTaken,
  isHandleTakenEffect,
  isValidHandleFormat,
} from "@/lib/rate-limit/handle-validation";
import { createTestDb, type TestDb } from "../../helpers/pglite-db";

let working: Awaited<ReturnType<typeof createTestDb>>;
let broken: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;
let brokenDb: TestDb;

beforeAll(async () => {
  working = await createTestDb();
  broken = await createTestDb();
  db = working.db;
  brokenDb = broken.db;
  await brokenDb.execute(sql`DROP TABLE "user" CASCADE`);
});

afterAll(async () => {
  await working.close();
  await broken.close();
});

beforeEach(async () => {
  await working.reset();

  const now = new Date().toISOString();

  await db.insert(user).values([
    {
      id: "u1",
      name: "One",
      email: "one@example.com",
      handle: "alice",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "u2",
      name: "Two",
      email: "two@example.com",
      handle: "bob",
      createdAt: now,
      updatedAt: now,
    },
  ]);
});

function run<A, E>(program: Effect.Effect<A, E, Db>, target: TestDb = db) {
  return Effect.runPromise(Effect.provide(program, Db.layerFrom(target)));
}

describe("isHandleTaken", () => {
  it("is true for a handle another user owns and false for your own or a free one", async () => {
    expect(await isHandleTaken(db, "u1", "bob")).toBe(true);
    expect(await isHandleTaken(db, "u1", "alice")).toBe(false);
    expect(await isHandleTaken(db, "u1", "carol")).toBe(false);
  });

  it("reads inside a transaction handle", async () => {
    expect(await db.transaction((tx) => isHandleTaken(tx, "u2", "alice"))).toBe(true);
  });
});

describe("isHandleTakenEffect", () => {
  it("answers through the Db service", async () => {
    expect(await run(isHandleTakenEffect("u1", "bob"))).toBe(true);
    expect(await run(isHandleTakenEffect("u1", "alice"))).toBe(false);
  });

  it("fails with a typed DbFailed instead of answering free when the store is down", async () => {
    const failure = await run(Effect.flip(isHandleTakenEffect("u1", "bob")), brokenDb);

    expect(failure).toBeInstanceOf(DbFailed);
    expect(failure).toMatchObject({ operation: "handle.taken", kind: "rejected" });
  });
});

describe("isValidHandleFormat", () => {
  it("rejects dots, reserved words and malformed handles", () => {
    expect(isValidHandleFormat("alice")).toBe(true);
    expect(isValidHandleFormat("a.b")).toBe(false);
    expect(isValidHandleFormat("API")).toBe(false);
    expect(isValidHandleFormat("-bad")).toBe(false);
  });
});
