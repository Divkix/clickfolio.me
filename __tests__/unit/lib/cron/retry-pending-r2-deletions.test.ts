import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { retryPendingR2Deletions } from "@/lib/cron/cleanup-r2";
import type { JsonValue } from "@/lib/types/json";

interface PendingRow {
  id: string;
  r2Key: string;
  attempts: number;
}

interface Statement {
  text: string;
  values: unknown[];
}

const MAX_ATTEMPTS = 10;

function normalize(strings: TemplateStringsArray): string {
  return strings.join("?").replace(/\s+/g, " ").trim();
}

function createDb(rows: PendingRow[]) {
  const statements: Statement[] = [];

  const tx = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = normalize(strings);
    statements.push({ text, values });
    if (text.startsWith("SELECT id, r2_key")) {
      return rows.filter((row) => row.attempts < MAX_ATTEMPTS);
    }
    return [];
  });

  const client = Object.assign(
    vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      statements.push({ text: normalize(strings), values });
      return [{ count: rows.filter((row) => row.attempts >= MAX_ATTEMPTS).length }];
    }),
    {
      begin: vi.fn(async (callback: (txFn: typeof tx) => Promise<unknown>) => callback(tx)),
    },
  );

  return { $client: client, _statements: statements };
}

function findStatement(db: { _statements: Statement[] }, needle: string): Statement | undefined {
  return db._statements.find((statement) => statement.text.includes(needle));
}

function createBinding(deleteImpl?: () => Promise<void>) {
  return {
    delete: vi.fn(deleteImpl ?? (() => Promise.resolve(undefined))),
  };
}

function run(db: JsonValue, binding: JsonValue) {
  return retryPendingR2Deletions(db as never, binding as unknown as R2Bucket);
}

describe("retryPendingR2Deletions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes a pending row when the R2 delete succeeds", async () => {
    const db = createDb([{ id: "pending-1", r2Key: "users/user-1/resume.pdf", attempts: 1 }]);
    const binding = createBinding();

    const result = await run(db as unknown as JsonValue, binding as unknown as JsonValue);

    expect(result.ok).toBe(true);
    expect(result.retried).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);

    expect(binding.delete).toHaveBeenCalledWith("users/user-1/resume.pdf");
    const deleteStatement = findStatement(db, "DELETE FROM pending_r2_deletions");
    expect(deleteStatement?.values).toEqual(["pending-1"]);
  });

  it("increments attempts in SQL and records lastError when R2 delete fails", async () => {
    const db = createDb([{ id: "pending-1", r2Key: "users/user-1/resume.pdf", attempts: 1 }]);
    const binding = createBinding(() => Promise.reject(new Error("R2 unavailable")));

    const result = await run(db as unknown as JsonValue, binding as unknown as JsonValue);

    expect(result.retried).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);

    const updateStatement = findStatement(db, "UPDATE pending_r2_deletions");
    expect(updateStatement?.text).toContain("attempts = attempts + 1");
    expect(updateStatement?.values).toEqual(["R2 unavailable", "pending-1"]);
    expect(findStatement(db, "DELETE FROM pending_r2_deletions")).toBeUndefined();
  });

  it("sweeps oldest-first, skips locked rows, and caps attempts in SQL", async () => {
    const db = createDb([]);
    const binding = createBinding();

    await run(db as unknown as JsonValue, binding as unknown as JsonValue);

    const selectStatement = findStatement(db, "SELECT id, r2_key");
    expect(selectStatement?.text).toContain("WHERE attempts < ?");
    expect(selectStatement?.text).toContain("ORDER BY created_at");
    expect(selectStatement?.text).toContain("FOR UPDATE SKIP LOCKED");
    expect(selectStatement?.text).toContain("LIMIT ?");
    expect(selectStatement?.values).toEqual([MAX_ATTEMPTS, 100]);
  });

  it("reports rows at the attempt cap as skipped without touching R2 or DB", async () => {
    const db = createDb([{ id: "max-1", r2Key: "users/u1/a.pdf", attempts: MAX_ATTEMPTS }]);
    const binding = createBinding();

    const result = await run(db as unknown as JsonValue, binding as unknown as JsonValue);

    expect(result.retried).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);

    expect(binding.delete).not.toHaveBeenCalled();
    expect(findStatement(db, "DELETE FROM pending_r2_deletions")).toBeUndefined();
    expect(findStatement(db, "UPDATE pending_r2_deletions")).toBeUndefined();
  });

  it("returns zero counts and a timestamp when there are no pending rows", async () => {
    const db = createDb([]);
    const binding = createBinding();

    const result = await run(db as unknown as JsonValue, binding as unknown as JsonValue);

    expect(result.retried).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.timestamp).toBeTruthy();
    expect(binding.delete).not.toHaveBeenCalled();
  });

  it("handles a mix of successful, failing, and max-attempts rows", async () => {
    const db = createDb([
      { id: "ok-1", r2Key: "users/u1/a.pdf", attempts: 1 },
      { id: "fail-1", r2Key: "users/u2/b.pdf", attempts: 2 },
      { id: "max-1", r2Key: "users/u3/c.pdf", attempts: MAX_ATTEMPTS },
    ]);
    const binding = {
      delete: vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("timeout")),
    };

    const result = await run(db as unknown as JsonValue, binding as unknown as JsonValue);

    expect(result.retried).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(1);
  });
});
