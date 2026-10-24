import { describe, expect, it } from "vite-plus/test";
import { classifyParseError } from "@/lib/parse/errors";
import { ParseErrorType } from "@/lib/parse/error-types";
import {
  AiOutputInvalid,
  AiProviderFailed,
  AiProviderRejected,
  AiTimedOut,
  DbUnavailable,
  PdfInvalid,
  R2BindingMissing,
  R2ObjectMissing,
  R2Unavailable,
  R2Rejected,
  SchemaRejected,
  UnknownParseFailure,
  toParseErrorJson,
} from "@/lib/parse/failures";
import {
  checkRetryEligibility,
  isPermanentErrorType,
  parseLastAttemptError,
  RETRY_LIMITS,
} from "@/lib/resume/lifecycle";

const cause = new Error("original");

const details = { message: "failure", cause };

const cases = [
  [new DbUnavailable(details), "db_connection_error", true],
  [new AiProviderFailed(details), "ai_provider_error", true],
  [new AiProviderRejected(details), "ai_provider_error", false],
  [new R2Unavailable(details), "r2_throttle", true],
  [new R2Rejected(details), "r2_throttle", false],
  [new AiTimedOut(details), "service_binding_timeout", true],
  [new PdfInvalid({ ...details, reason: "encrypted" }), "invalid_pdf", false],
  [new R2ObjectMissing(details), "file_not_found", false],
  [new R2BindingMissing(details), "service_binding_not_found", false],
  [new AiOutputInvalid(details), "malformed_response", false],
  [new SchemaRejected(details), "parse_validation_error", false],
  [new UnknownParseFailure(details), "unknown", false],
] as const;

describe("stable parse failure wire format", () => {
  it("leaves both manual retries reachable after exhausted parse runs", () => {
    for (const retryCount of [0, 1]) {
      expect(
        checkRetryEligibility({
          status: "failed",
          retryCount,
          totalAttempts: (retryCount + 1) * RETRY_LIMITS.PARSE_MAX_ATTEMPTS,
        }),
      ).toEqual({ eligible: true, nextAttempt: retryCount + 1 });
    }

    expect(
      checkRetryEligibility({
        status: "failed",
        retryCount: 2,
        totalAttempts: RETRY_LIMITS.TOTAL_MAX_ATTEMPTS,
      }).eligible,
    ).toBe(false);
    expect(RETRY_LIMITS.TOTAL_MAX_ATTEMPTS).toBe(12);
  });

  it.each([ParseErrorType.MALFORMED_RESPONSE, ParseErrorType.PARSE_VALIDATION_ERROR])(
    "allows a manual retry after nondeterministic %s output",
    (type) => {
      expect(
        checkRetryEligibility({
          status: "failed",
          retryCount: 0,
          totalAttempts: 1,
          lastAttemptError: JSON.stringify({ type }),
        }),
      ).toEqual({ eligible: true, nextAttempt: 1 });
    },
  );

  it.each(cases)("serializes %s using its legacy wire type", (failure, type, retryable) => {
    expect(toParseErrorJson(failure)).toEqual({
      name: "ParseError",
      type,
      message: "failure",
      isRetryable: retryable,
      originalError: { name: "Error", message: "original" },
    });
    const wire = JSON.parse(JSON.stringify(toParseErrorJson(failure)));
    expect(wire).not.toHaveProperty("_tag");
    expect(parseLastAttemptError(JSON.stringify(wire))).toMatchObject({
      type,
    });
  });

  it.each(Object.values(ParseErrorType))("reads an old stored %s row", (type) => {
    // Captured legacy shape: no Effect fields, including rows with no originalError.
    const raw = JSON.stringify({
      name: "ParseError",
      type,
      message: "old error",
      isRetryable: !isPermanentErrorType(type) && type !== "unknown",
    });

    expect(parseLastAttemptError(raw)).toEqual({ type });
  });

  it.each([null, "", "not json", "null", "[]", "{}", '{"type":4}'])(
    "ignores an invalid stored failure %s",
    (raw) => expect(parseLastAttemptError(raw)).toBeNull(),
  );

  it.each([
    ["encrypted", "password-protected"],
    ["corrupt", "valid PDF"],
    ["scanned-empty", "clearer photo"],
    ["empty", "scanned image"],
    ["too-many-pages", "under 50 pages"],
  ] as const)("selects a user message for %s", (reason, message) => {
    expect(new PdfInvalid({ message: "opaque source error", reason }).userMessage).toContain(
      message,
    );
  });
});

// Every old classifier pattern has a representative before the fallback is narrowed.
const legacyPatterns = [
  ["duplicate key value violates unique constraint", "parse_validation_error"],
  ["query [pg_code=23505]", "parse_validation_error"],
  ["query [pg_code=08006]", "db_connection_error"],
  ["ECONNRESET", "db_connection_error"],
  ["deadlock detected", "db_connection_error"],
  ["R2 temporarily unavailable", "r2_throttle"],
  ["invalid PDF", "invalid_pdf"],
  ["not a PDF", "invalid_pdf"],
  ["encrypted PDF", "invalid_pdf"],
  ["Extracted resume text is empty", "invalid_pdf"],
  ["scanned PDF; use a clearer photo", "invalid_pdf"],
  ["PDF has 51 pages", "invalid_pdf"],
  ["NoObjectGeneratedError", "ai_provider_error"],
  ["AI parser returned no result", "ai_provider_error"],
  ["API error", "ai_provider_error"],
  ["model not found", "ai_provider_error"],
  ["HTTP 503", "ai_provider_error"],
  ["AI_APICallError", "ai_provider_error"],
  ["failed to process successful response", "ai_provider_error"],
  ["timeout", "service_binding_timeout"],
  ["request took too long", "service_binding_timeout"],
  ["R2 throttle", "r2_throttle"],
  ["invalid JSON", "malformed_response"],
  ["Invalid JSON response from AI", "malformed_response"],
  ["AI parsing failed", "malformed_response"],
  ["binding not available", "service_binding_not_found"],
  ["PDF worker not available", "service_binding_not_found"],
  ["R2 binding not available", "service_binding_not_found"],
  ["file not found", "file_not_found"],
  ["Failed to fetch PDF from R2", "file_not_found"],
  ["R2 object does not exist", "file_not_found"],
  ["schema validation error", "parse_validation_error"],
  ["required field missing", "parse_validation_error"],
  ["something unexpected", "unknown"],
] as const;

describe("legacy stored error golden cases", () => {
  it.each(legacyPatterns)("classifies %s as %s", (message, type) => {
    const stored = JSON.stringify({
      name: "ParseError",
      type,
      message,
      isRetryable: [
        "db_connection_error",
        "service_binding_timeout",
        "r2_throttle",
        "ai_provider_error",
      ].includes(type),
      originalError: { name: "Error", message },
    });

    expect(parseLastAttemptError(stored)).toEqual({ type });
  });
});

describe("foreign database/network fallback", () => {
  it.each([
    "08000",
    "08001",
    "08003",
    "08004",
    "08006",
    "53300",
    "53400",
    "57P01",
    "57P02",
    "57P03",
    "40001",
    "40P01",
    "55P03",
  ])("keeps PostgreSQL %s retryable", (code) => {
    const cause = new Error("query failed", {
      cause: Object.assign(new Error("driver"), { code }),
    });

    const failure = classifyParseError(cause);
    expect(failure).toBeInstanceOf(DbUnavailable);
    expect(failure.retryable).toBe(true);
  });
  it.each(["23502", "23503", "23505", "23514"])("keeps PostgreSQL %s permanent", (code) => {
    const failure = classifyParseError(Object.assign(new Error("query failed"), { code }));
    expect(failure).toBeInstanceOf(SchemaRejected);
    expect(failure.retryable).toBe(false);
  });
  it.each(["ECONNRESET", "ENOTFOUND", "deadlock detected", "server closed the connection"])(
    "recognizes %s",
    (message) => {
      expect(classifyParseError(new Error(message))).toBeInstanceOf(DbUnavailable);
    },
  );
  it("preserves an already tagged error without inspecting its message", () => {
    const failure = new AiProviderFailed({ message: "invalid JSON" });
    expect(classifyParseError(failure)).toBe(failure);
  });
  it("does not guess an unknown source from PDF or AI wording", () => {
    expect(classifyParseError(new Error("invalid PDF"))).toBeInstanceOf(UnknownParseFailure);
  });
});
