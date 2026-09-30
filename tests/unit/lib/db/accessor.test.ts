import { describe, expect, it } from "vite-plus/test";
import { getDb } from "@/lib/db";

// SAFETY: getDb reads only hyperdrive.connectionString when it constructs the
// postgres client; the fake binding supplies exactly that field.
const hyperdrive = {
  connectionString: "postgres://user:password@example.com:5432/clickfolio",
} as Hyperdrive;

describe("getDb", () => {
  it("creates a new postgres client for each invocation", () => {
    const first = getDb(hyperdrive);
    const second = getDb(hyperdrive);

    expect(first).not.toBe(second);
    expect(first.$client).not.toBe(second.$client);
  });
});
