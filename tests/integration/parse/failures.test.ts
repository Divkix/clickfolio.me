import { describe, expect, it } from "vite-plus/test";
import { classifyParseError, ParseErrorType } from "@/lib/parse/errors";
import {
  AiOutputInvalid,
  AiProviderFailed,
  AiTimedOut,
  DbUnavailable,
  PdfInvalid,
  R2BindingMissing,
  R2ObjectMissing,
  R2Throttled,
  SchemaRejected,
  UnknownParseFailure,
  toParseErrorJson,
} from "@/lib/parse/failures";
import { isPermanentErrorType, parseLastAttemptError } from "@/lib/resume/lifecycle";

const cause = new Error("original");

const details = { message: "failure", cause };

const cases = [
  [new DbUnavailable(details), "db_connection_error", true],
  [new AiProviderFailed(details), "ai_provider_error", true],
  [new AiTimedOut(details), "service_binding_timeout", true],
  [new R2Throttled(details), "r2_throttle", true],
  [new PdfInvalid({ ...details, reason: "encrypted" }), "invalid_pdf", false],
  [new R2ObjectMissing(details), "file_not_found", false],
  [new R2BindingMissing(details), "service_binding_not_found", false],
  [new AiOutputInvalid(details), "malformed_response", false],
  [new SchemaRejected(details), "parse_validation_error", false],
  [new UnknownParseFailure(details), "unknown", false],
] as const;

describe("stable parse failure wire format", () => {
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
      isRetryable: retryable,
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

    expect(parseLastAttemptError({ lastAttemptError: raw })).toMatchObject({
      name: "ParseError",
      type,
      message: "old error",
      raw,
    });
  });

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

describe("legacy classifier golden cases", () => {
  it.each(legacyPatterns)("classifies %s as %s", (message, type) => {
    expect(classifyParseError(new Error(message)).type).toBe(type);
  });
});
