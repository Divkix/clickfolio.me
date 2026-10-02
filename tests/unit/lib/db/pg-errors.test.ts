import { describe, expect, it } from "vite-plus/test";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { DatabaseError } from "pg";
import { isUniqueViolation } from "@/lib/db/pg-errors";

describe("isUniqueViolation", () => {
  it("recognizes pg unique violations wrapped by Drizzle", () => {
    const cause = new DatabaseError("conflict", 0, "error");
    cause.code = "23505";
    expect(isUniqueViolation(new DrizzleQueryError("insert", [], cause))).toBe(true);
  });

  it("does not classify other wrapped database failures as conflicts", () => {
    const cause = new DatabaseError("missing referenced row", 0, "error");
    cause.code = "23503";
    expect(isUniqueViolation(new DrizzleQueryError("insert", [], cause))).toBe(false);
  });
});
