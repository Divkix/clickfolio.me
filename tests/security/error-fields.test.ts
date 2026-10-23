import { DrizzleQueryError } from "drizzle-orm/errors";
import { describe, expect, it } from "vite-plus/test";
import { errorFields } from "@/lib/utils/error-fields";

describe("errorFields", () => {
  it("keeps the message, name and stack of an Error", () => {
    const fields = errorFields(new TypeError("bad input"));

    expect(fields["error.message"]).toBe("bad input");
    expect(fields["error.name"]).toBe("TypeError");
    expect(fields.stack).toMatch(/^TypeError: bad input\n\s+at /);
  });

  it("drops Drizzle's SQL and bound params, keeping the driver message and SQLSTATE", () => {
    const driver = Object.assign(new Error("duplicate key value violates unique constraint"), {
      code: "23505",
    });

    const fields = errorFields(
      new DrizzleQueryError('insert into "user" values ($1)', ["someone@example.com"], driver),
    );

    expect(fields["error.message"]).toBe("duplicate key value violates unique constraint");
    expect(fields["error.code"]).toBe("23505");
    expect(JSON.stringify(fields)).not.toMatch(/someone|Failed query|insert into/);
  });

  it("drops params when a wrapper copied Drizzle's message into its own", () => {
    const query = new DrizzleQueryError(
      "update resumes set content = $1",
      ["Jane Doe"],
      new Error("timeout"),
    );

    const wrapped = new Error(`${query.message} (cause: timeout)`, { cause: query });

    const fields = errorFields(wrapped);

    expect(fields["error.message"]).toBe("timeout");
    expect(JSON.stringify(fields)).not.toContain("Jane Doe");
  });

  it("drops params from a serialized query error, including resume lines in its stack header", () => {
    const serialized = {
      name: "Error",
      message: "Failed query: update resumes set content = $1\nparams: worked\n    at Acme Corp",
      stack:
        "Error: Failed query: update resumes set content = $1\nparams: worked\n    at Acme Corp\n    at completeParsedResume (pipeline.ts:1:1)",
    };

    const fields = errorFields(serialized);

    expect(fields["error.message"]).toBe(
      "Failed query: update resumes set content = $1 [params redacted]",
    );
    expect(fields.stack).toContain("at completeParsedResume");
    expect(JSON.stringify(fields)).not.toMatch(/Acme|worked/);
  });

  it("redacts email addresses", () => {
    const fields = errorFields(new Error("rejected recipient jane.doe@example.com"));

    expect(fields["error.message"]).toBe("rejected recipient [email]");
    expect(fields.stack).not.toContain("jane.doe");
  });

  it.each([
    ["a string", "boom", "boom"],
    ["an object", { status: 500 }, '{"status":500}'],
    ["undefined", undefined, "undefined"],
  ])("tolerates %s", (_label, thrown, message) => {
    expect(errorFields(thrown)).toEqual({ "error.message": message, "error.name": "NonError" });
  });

  it("reads Error-shaped objects and ignores a non-string code", () => {
    expect(errorFields({ name: "WorkflowError", message: "step failed", code: 7 })).toEqual({
      "error.message": "step failed",
      "error.name": "WorkflowError",
    });
  });
});
