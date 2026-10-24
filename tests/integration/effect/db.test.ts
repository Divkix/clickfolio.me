import { Effect } from "effect";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { Db } from "@/lib/effect/db";
import { DbConflict, DbFailed } from "@/lib/effect/failures";
import { createTestDb, type TestDb } from "../../helpers/pglite-db";

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
  await db.execute(sql`CREATE TABLE IF NOT EXISTS effect_probe (id text PRIMARY KEY)`);
  await db.execute(sql`TRUNCATE effect_probe`);
});

function run<A, E>(program: Effect.Effect<A, E, Db>) {
  return Effect.runPromise(Effect.provide(program, Db.layerFrom(db)));
}

describe("Db service", () => {
  it("returns the rows of a query", async () => {
    const rows = await run(
      Db.use((service) =>
        service.query("test.select", (handle) => handle.execute(sql`SELECT 1 AS one`)),
      ),
    );

    expect(rows).toMatchObject({ rows: [{ one: 1 }] });
  });

  it("maps a unique violation to DbConflict", async () => {
    const insert = Db.use((service) =>
      service.query("test.insert", (handle) =>
        handle.execute(sql`INSERT INTO effect_probe (id) VALUES ('a')`),
      ),
    );

    await run(insert);
    const failure = await run(Effect.flip(insert));

    expect(failure).toBeInstanceOf(DbConflict);
  });

  it("maps a rejected statement to a non-retryable DbFailed", async () => {
    const failure = await run(
      Effect.flip(
        Db.use((service) =>
          service.query("test.bad-sql", (handle) => handle.execute(sql`SELECT * FROM nowhere`)),
        ),
      ),
    );

    expect(failure).toBeInstanceOf(DbFailed);
    expect(failure).toMatchObject({ kind: "rejected", operation: "test.bad-sql" });
  });

  it("rolls a failed transaction back", async () => {
    const failure = await run(
      Effect.flip(
        Db.use((service) =>
          service.transaction("test.tx", async (tx) => {
            await tx.execute(sql`INSERT INTO effect_probe (id) VALUES ('rolled-back')`);
            await tx.execute(sql`SELECT * FROM nowhere`);
          }),
        ),
      ),
    );

    expect(failure).toBeInstanceOf(DbFailed);

    const rows = await db.execute(sql`SELECT id FROM effect_probe`);

    expect(rows.rows).toEqual([]);
  });
});
