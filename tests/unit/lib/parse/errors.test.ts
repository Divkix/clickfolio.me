import { describe, expect, it } from "vite-plus/test";
import { classifyParseError, ParseErrorType } from "@/lib/parse/errors";

describe("queue error handling", () => {
  describe("classifyParseError", () => {
    it.each([
      ["database unavailable", ParseErrorType.DB_CONNECTION_ERROR],
      ["db timeout while opening transaction", ParseErrorType.DB_CONNECTION_ERROR],
      ["deadline exceeded in worker timeout", ParseErrorType.SERVICE_BINDING_TIMEOUT],
      ["request took too long and exceeded time limit", ParseErrorType.SERVICE_BINDING_TIMEOUT],
      ["R2 throttle: too many requests 429", ParseErrorType.R2_THROTTLE],
      ["R2 service temporarily unavailable", ParseErrorType.R2_THROTTLE],
      ["not a pdf and cannot parse pdf", ParseErrorType.INVALID_PDF],
      ["cannot parse pdf: worker timeout", ParseErrorType.INVALID_PDF],
      ["provider error HTTP 429", ParseErrorType.AI_PROVIDER_ERROR],
      ["AI parser returned no result", ParseErrorType.AI_PROVIDER_ERROR],
      ["encrypted pdf password protected", ParseErrorType.INVALID_PDF],
      ["extracted resume text is empty", ParseErrorType.INVALID_PDF],
      ["NoObjectGeneratedError from provider", ParseErrorType.AI_PROVIDER_ERROR],
      ["API request failed with provider error", ParseErrorType.AI_PROVIDER_ERROR],
      ["model unavailable due to insufficient credits", ParseErrorType.AI_PROVIDER_ERROR],
      ["HTTP 502 bad gateway service unavailable", ParseErrorType.AI_PROVIDER_ERROR],
      ["invalid json unexpected token", ParseErrorType.MALFORMED_RESPONSE],
      ["invalid json response from ai", ParseErrorType.MALFORMED_RESPONSE],
      ["ai parsing failed", ParseErrorType.MALFORMED_RESPONSE],
      ["worker not available service not found", ParseErrorType.SERVICE_BINDING_NOT_FOUND],
      ["pdf worker not available", ParseErrorType.SERVICE_BINDING_NOT_FOUND],
      ["R2 binding not available", ParseErrorType.SERVICE_BINDING_NOT_FOUND],
      ["object not found 404", ParseErrorType.FILE_NOT_FOUND],
      ["failed to fetch pdf from r2", ParseErrorType.FILE_NOT_FOUND],
      ["r2 object does not exist no such key", ParseErrorType.FILE_NOT_FOUND],
      ["schema validation zod error", ParseErrorType.PARSE_VALIDATION_ERROR],
      ["required field missing type mismatch", ParseErrorType.PARSE_VALIDATION_ERROR],
    ])("classifies %s", (message, expectedType) => {
      const error = classifyParseError(new Error(message));

      expect(error.type).toBe(expectedType);
      expect(error.isRetryable()).toBe(
        [
          ParseErrorType.DB_CONNECTION_ERROR,
          ParseErrorType.SERVICE_BINDING_TIMEOUT,
          ParseErrorType.R2_THROTTLE,
          ParseErrorType.AI_PROVIDER_ERROR,
        ].includes(expectedType),
      );
    });

    it("extracts messages from strings, causes, response-like objects, and unknown values", () => {
      expect(classifyParseError("api request failed").type).toBe(ParseErrorType.AI_PROVIDER_ERROR);
      expect(classifyParseError(new Error("outer", { cause: new Error("invalid pdf") })).type).toBe(
        ParseErrorType.INVALID_PDF,
      );
      expect(classifyParseError({ message: "binding not available" }).type).toBe(
        ParseErrorType.SERVICE_BINDING_NOT_FOUND,
      );
      expect(classifyParseError({ error: "validation error" }).type).toBe(
        ParseErrorType.PARSE_VALIDATION_ERROR,
      );
      expect(classifyParseError({ status: 429 }).type).toBe(ParseErrorType.R2_THROTTLE);
      expect(classifyParseError(null).type).toBe(ParseErrorType.UNKNOWN);
    });

    it("classifies a too-many-pages PDF as permanent invalid_pdf", () => {
      const error = classifyParseError(
        new Error("PDF has 60 pages (maximum 50). Please upload a shorter document."),
      );

      expect(error.type).toBe(ParseErrorType.INVALID_PDF);
      expect(error.isRetryable()).toBe(false);
    });

    it("does not treat PostgreSQL constraint violations as retryable", () => {
      const uniqueError = classifyParseError(
        new Error("duplicate key value violates unique constraint on resumes.file_hash"),
      );

      expect(uniqueError.type).toBe(ParseErrorType.PARSE_VALIDATION_ERROR);
      expect(uniqueError.isRetryable()).toBe(false);

      const fkError = classifyParseError(
        new Error('insert or update on table "site_data" violates foreign key constraint'),
      );

      expect(fkError.type).toBe(ParseErrorType.PARSE_VALIDATION_ERROR);
      expect(fkError.isRetryable()).toBe(false);

      const codedUnique = classifyParseError(
        Object.assign(new Error("unique_violation"), { code: "23505" }),
      );

      expect(codedUnique.type).toBe(ParseErrorType.PARSE_VALIDATION_ERROR);
      expect(codedUnique.isRetryable()).toBe(false);

      const serialization = classifyParseError(
        Object.assign(new Error("serialization failure"), { code: "40001" }),
      );

      expect(serialization.type).toBe(ParseErrorType.DB_CONNECTION_ERROR);
      expect(serialization.isRetryable()).toBe(true);

      expect(
        classifyParseError(new Error("server closed the connection unexpectedly")).isRetryable(),
      ).toBe(true);
    });

    it("matches a bare 404 but not a 404 embedded in a longer number", () => {
      expect(classifyParseError(new Error("object not found, status 404")).type).toBe(
        ParseErrorType.FILE_NOT_FOUND,
      );
      expect(classifyParseError({ status: 404 }).type).toBe(ParseErrorType.FILE_NOT_FOUND);
      expect(classifyParseError(new Error("HTTP 4040"))).not.toBe(ParseErrorType.FILE_NOT_FOUND);
    });

    it.each([
      ["Cannot connect to API: fetch failed", ParseErrorType.AI_PROVIDER_ERROR],
      ["Failed to process error response", ParseErrorType.AI_PROVIDER_ERROR],
      ["Failed to process successful response", ParseErrorType.AI_PROVIDER_ERROR],
      ["AI_APICallError: request to provider failed", ParseErrorType.AI_PROVIDER_ERROR],
    ])("classifies AI SDK message %s as retryable ai_provider_error", (msg, expectedType) => {
      const error = classifyParseError(new Error(msg));

      expect(error.type).toBe(expectedType);
      expect(error.isRetryable()).toBe(true);
    });
  });
});
