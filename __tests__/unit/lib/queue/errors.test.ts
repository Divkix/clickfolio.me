import { describe, expect, it } from "vite-plus/test";
import { classifyQueueError, QueueErrorType } from "@/lib/queue/errors";

describe("queue error handling", () => {
  describe("classifyQueueError", () => {
    it.each([
      ["database unavailable", QueueErrorType.DB_CONNECTION_ERROR],
      ["db timeout while opening transaction", QueueErrorType.DB_CONNECTION_ERROR],
      ["deadline exceeded in worker timeout", QueueErrorType.SERVICE_BINDING_TIMEOUT],
      ["request took too long and exceeded time limit", QueueErrorType.SERVICE_BINDING_TIMEOUT],
      ["R2 throttle: too many requests 429", QueueErrorType.R2_THROTTLE],
      ["R2 service temporarily unavailable", QueueErrorType.R2_THROTTLE],
      ["not a pdf and cannot parse pdf", QueueErrorType.INVALID_PDF],
      ["cannot parse pdf: worker timeout", QueueErrorType.INVALID_PDF],
      ["provider error HTTP 429", QueueErrorType.AI_PROVIDER_ERROR],
      ["AI parser returned no result", QueueErrorType.AI_PROVIDER_ERROR],
      ["encrypted pdf password protected", QueueErrorType.INVALID_PDF],
      ["extracted resume text is empty", QueueErrorType.INVALID_PDF],
      ["NoObjectGeneratedError from provider", QueueErrorType.AI_PROVIDER_ERROR],
      ["API request failed with provider error", QueueErrorType.AI_PROVIDER_ERROR],
      ["model unavailable due to insufficient credits", QueueErrorType.AI_PROVIDER_ERROR],
      ["HTTP 502 bad gateway service unavailable", QueueErrorType.AI_PROVIDER_ERROR],
      ["invalid json unexpected token", QueueErrorType.MALFORMED_RESPONSE],
      ["invalid json response from ai", QueueErrorType.MALFORMED_RESPONSE],
      ["ai parsing failed", QueueErrorType.MALFORMED_RESPONSE],
      ["worker not available service not found", QueueErrorType.SERVICE_BINDING_NOT_FOUND],
      ["pdf worker not available", QueueErrorType.SERVICE_BINDING_NOT_FOUND],
      ["R2 binding not available", QueueErrorType.SERVICE_BINDING_NOT_FOUND],
      ["object not found 404", QueueErrorType.FILE_NOT_FOUND],
      ["failed to fetch pdf from r2", QueueErrorType.FILE_NOT_FOUND],
      ["r2 object does not exist no such key", QueueErrorType.FILE_NOT_FOUND],
      ["schema validation zod error", QueueErrorType.PARSE_VALIDATION_ERROR],
      ["required field missing type mismatch", QueueErrorType.PARSE_VALIDATION_ERROR],
    ])("classifies %s", (message, expectedType) => {
      const error = classifyQueueError(new Error(message));

      expect(error.type).toBe(expectedType);
      expect(error.isRetryable()).toBe(
        [
          QueueErrorType.DB_CONNECTION_ERROR,
          QueueErrorType.SERVICE_BINDING_TIMEOUT,
          QueueErrorType.R2_THROTTLE,
          QueueErrorType.AI_PROVIDER_ERROR,
        ].includes(expectedType),
      );
    });

    it("extracts messages from strings, causes, response-like objects, and unknown values", () => {
      expect(classifyQueueError("api request failed").type).toBe(QueueErrorType.AI_PROVIDER_ERROR);
      expect(classifyQueueError(new Error("outer", { cause: new Error("invalid pdf") })).type).toBe(
        QueueErrorType.INVALID_PDF,
      );
      expect(classifyQueueError({ message: "binding not available" }).type).toBe(
        QueueErrorType.SERVICE_BINDING_NOT_FOUND,
      );
      expect(classifyQueueError({ error: "validation error" }).type).toBe(
        QueueErrorType.PARSE_VALIDATION_ERROR,
      );
      expect(classifyQueueError({ status: 429 }).type).toBe(QueueErrorType.R2_THROTTLE);
      expect(classifyQueueError(null).type).toBe(QueueErrorType.UNKNOWN);
    });

    it("classifies a too-many-pages PDF as permanent invalid_pdf", () => {
      const error = classifyQueueError(
        new Error("PDF has 60 pages (maximum 50). Please upload a shorter document."),
      );

      expect(error.type).toBe(QueueErrorType.INVALID_PDF);
      expect(error.isRetryable()).toBe(false);
    });

    it("does not treat PostgreSQL constraint violations as retryable", () => {
      const uniqueError = classifyQueueError(
        new Error("duplicate key value violates unique constraint on resumes.file_hash"),
      );

      expect(uniqueError.type).toBe(QueueErrorType.PARSE_VALIDATION_ERROR);
      expect(uniqueError.isRetryable()).toBe(false);

      const fkError = classifyQueueError(
        new Error('insert or update on table "site_data" violates foreign key constraint'),
      );

      expect(fkError.type).toBe(QueueErrorType.PARSE_VALIDATION_ERROR);
      expect(fkError.isRetryable()).toBe(false);

      const codedUnique = classifyQueueError(
        Object.assign(new Error("unique_violation"), { code: "23505" }),
      );

      expect(codedUnique.type).toBe(QueueErrorType.PARSE_VALIDATION_ERROR);
      expect(codedUnique.isRetryable()).toBe(false);

      const serialization = classifyQueueError(
        Object.assign(new Error("serialization failure"), { code: "40001" }),
      );

      expect(serialization.type).toBe(QueueErrorType.DB_CONNECTION_ERROR);
      expect(serialization.isRetryable()).toBe(true);

      expect(
        classifyQueueError(new Error("server closed the connection unexpectedly")).isRetryable(),
      ).toBe(true);
    });

    it("matches a bare 404 but not a 404 embedded in a longer number", () => {
      expect(classifyQueueError(new Error("object not found, status 404")).type).toBe(
        QueueErrorType.FILE_NOT_FOUND,
      );
      expect(classifyQueueError({ status: 404 }).type).toBe(QueueErrorType.FILE_NOT_FOUND);
      expect(classifyQueueError(new Error("HTTP 4040"))).not.toBe(QueueErrorType.FILE_NOT_FOUND);
    });

    it.each([
      ["Cannot connect to API: fetch failed", QueueErrorType.AI_PROVIDER_ERROR],
      ["Failed to process error response", QueueErrorType.AI_PROVIDER_ERROR],
      ["Failed to process successful response", QueueErrorType.AI_PROVIDER_ERROR],
      ["AI_APICallError: request to provider failed", QueueErrorType.AI_PROVIDER_ERROR],
    ])("classifies AI SDK message %s as retryable ai_provider_error", (msg, expectedType) => {
      const error = classifyQueueError(new Error(msg));

      expect(error.type).toBe(expectedType);
      expect(error.isRetryable()).toBe(true);
    });
  });
});
